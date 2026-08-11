import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EntityManager, FindOptionsWhere, ILike } from 'typeorm';
import { nextSnowflakeId } from '../common/snowflake-id';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import {
  DocumentEntity,
  DocumentStatus,
} from './entities/document.entity';
import {
  DocumentContent,
  DocumentContentDocument,
} from './schemas/document-content.schema';

/**
 * 文档服务
 * - 元数据：PostgreSQL（kh_document）
 * - 正文：MongoDB（document_content）
 * - 关联：content_id ↔ Mongo _id，documentId ↔ 文档 id
 */
@Injectable()
export class DocumentService {
  constructor(
    /** Postgres 实体管理器 */
    @InjectEntityManager()
    private readonly em: EntityManager,
    /** Mongo 正文模型 */
    @InjectModel(DocumentContent.name)
    private readonly contentModel: Model<DocumentContentDocument>,
  ) {}

  /**
   * 创建文档
   * 流程：生成雪花 ID → 写 Mongo 正文（拿 ObjectId）→ 写 Postgres 元数据
   * 若 Postgres 写入失败，回滚删除已写入的 Mongo 正文，避免脏数据
   */
  async create(dto: CreateDocumentDto) {
    const id = nextSnowflakeId();
    const wordCount = this.countWords(dto.content);
    const status = dto.status ?? DocumentStatus.Draft;
    // 未传 summary 时，从正文截取预览作为 contentSummary
    const contentSummary =
      dto.summary ?? this.buildContentSummary(dto.content);

    // 先写 Mongo，_id 由驱动自动生成 ObjectId
    const contentDoc = await this.contentModel.create({
      documentId: id,
      content: dto.content,
      contentLength: dto.content.length,
      contentSummary,
      version: 1,
      deleted: false,
    });
    // ObjectId 转字符串，存入 Postgres content_id
    const contentId = String(contentDoc._id);

    try {
      const doc = this.em.create(DocumentEntity, {
        id,
        title: dto.title,
        contentId,
        summary: dto.summary,
        categoryId: dto.categoryId,
        teamId: dto.teamId,
        authorId: dto.authorId,
        coverImage: dto.coverImage,
        tags: dto.tags,
        status,
        remark: dto.remark,
        isPublic: dto.isPublic ?? false,
        wordCount,
        // 创建即发布时，记录发布时间
        publishTime: status === DocumentStatus.Published ? new Date() : undefined,
        createBy: dto.createBy,
        updateBy: dto.createBy,
        deleted: false,
      });

      const saved = await this.em.save(doc);
      return Object.assign({}, saved, { content: dto.content });
    } catch (error) {
      // Postgres 失败：物理删除刚写入的 Mongo 正文
      await this.contentModel.deleteOne({ _id: contentDoc._id });
      throw error;
    }
  }

  /**
   * 分页查询文档列表（只返回 Postgres 元数据，不含正文）
   * 无 IF 的优雅条件拼接写法
   */
  async findAll(query: QueryDocumentDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);

    // 动态拼接过滤条件对象，完全告别繁琐的 if 语句
    const where: FindOptionsWhere<DocumentEntity> = {
      deleted: false,
      ...(query.title && { title: ILike(`%${query.title}%`) }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.teamId && { teamId: query.teamId }),
      ...(query.authorId && { authorId: query.authorId }),
      ...(query.status !== undefined && { status: query.status }),
    };

    const [items, total] = await this.em.findAndCount(DocumentEntity, {
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 查询文档详情
   * @param withContent 是否附带 Mongo 正文，默认 true
   */
  async findOne(id: string, withContent = true) {
    const doc = await this.em.findOne(DocumentEntity, {
      where: { id, deleted: false },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (!withContent) {
      return doc;
    }

    // 通过 content_id 拉取未删除的正文
    const contentDoc = await this.contentModel
      .findOne({ _id: doc.contentId, deleted: false })
      .lean();
    return Object.assign({}, doc, {
      content: contentDoc?.content ?? '',
    });
  }

  /**
   * 更新文档
   * - 有 content：同步更新 Mongo 正文，并递增 version
   * - 仅改 summary：同步更新 Mongo contentSummary
   * - 其余字段只更新 Postgres 元数据
   * - 首次变为「已发布」时写入 publishTime
   */
  async update(id: string, dto: UpdateDocumentDto) {
    const doc = await this.em.findOne(DocumentEntity, {
      where: { id, deleted: false },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // —— 正文变更 ——
    if (dto.content !== undefined) {
      const contentSummary =
        dto.summary ?? this.buildContentSummary(dto.content);
      const result = await this.contentModel.updateOne(
        { _id: doc.contentId, deleted: false },
        {
          $set: {
            content: dto.content,
            contentLength: dto.content.length,
            contentSummary,
          },
          $inc: { version: 1 }, // 版本号 +1
        },
      );
      if (result.matchedCount === 0) {
        throw new BadRequestException(
          `Document content ${doc.contentId} not found`,
        );
      }
      doc.wordCount = this.countWords(dto.content);
    } else if (dto.summary !== undefined) {
      // 只改摘要时，同步 Mongo 侧预览字段
      await this.contentModel.updateOne(
        { _id: doc.contentId, deleted: false },
        { $set: { contentSummary: dto.summary } },
      );
    }

    // —— 元数据字段（有传才覆盖）——
    if (dto.title !== undefined) doc.title = dto.title;
    if (dto.summary !== undefined) doc.summary = dto.summary;
    if (dto.categoryId !== undefined) doc.categoryId = dto.categoryId;
    if (dto.teamId !== undefined) doc.teamId = dto.teamId;
    if (dto.authorId !== undefined) doc.authorId = dto.authorId;
    if (dto.coverImage !== undefined) doc.coverImage = dto.coverImage;
    if (dto.tags !== undefined) doc.tags = dto.tags;
    if (dto.remark !== undefined) doc.remark = dto.remark;
    if (dto.isPublic !== undefined) doc.isPublic = dto.isPublic;
    if (dto.updateBy !== undefined) doc.updateBy = dto.updateBy;

    // 状态从非发布 → 发布时，记录发布时间
    if (dto.status !== undefined) {
      if (
        dto.status === DocumentStatus.Published &&
        doc.status !== DocumentStatus.Published
      ) {
        doc.publishTime = new Date();
      }
      doc.status = dto.status;
    }

    const saved = await this.em.save(doc);

    // 本次已带新正文则直接返回；否则再查一次 Mongo
    if (dto.content !== undefined) {
      return Object.assign({}, saved, { content: dto.content });
    }

    const contentDoc = await this.contentModel
      .findOne({ _id: doc.contentId, deleted: false })
      .lean();
    return Object.assign({}, saved, { content: contentDoc?.content ?? '' });
  }

  /**
   * 软删除文档
   * Postgres、Mongo 两侧都将 deleted 置为 true（不物理删正文）
   */
  async remove(id: string) {
    const doc = await this.em.findOne(DocumentEntity, {
      where: { id, deleted: false },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    doc.deleted = true;
    await this.em.save(doc);
    await this.contentModel.updateOne(
      { _id: doc.contentId },
      { $set: { deleted: true } },
    );
    return { id, deleted: true };
  }

  /**
   * 从正文截取预览摘要
   * 压缩连续空白后截断到 maxLen，超出则追加省略号
   */
  private buildContentSummary(content: string, maxLen = 200): string {
    const trimmed = content.trim().replace(/\s+/g, ' ');
    return trimmed.length <= maxLen
      ? trimmed
      : `${trimmed.slice(0, maxLen)}...`;
  }

  /**
   * 统计正文字数（中英混合）
   * - 中日韩汉字：每个字符计 1 字
   * - 英文等拉丁文本：按空白分词，每个单词计 1 字
   */
  private countWords(content: string): number {
    const trimmed = content.trim();
    if (!trimmed) return 0;

    // 匹配所有 CJK 统一汉字（U+4E00–U+9FFF），每个汉字算 1
    const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) ?? []).length;

    // 去掉汉字后，剩余按空白切分为英文单词再计数
    const latin = trimmed
      .replace(/[\u4e00-\u9fff]/g, ' ') // 汉字替换为空格，避免与英文粘连
      .trim()
      .split(/\s+/) // 按连续空白分词
      .filter(Boolean).length; // 去掉空串

    return cjk + latin;
  }
}
