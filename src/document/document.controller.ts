import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';
import { FileParserService } from './services/file-parser.service';
import { R2Service } from '../storage/r2.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import {
  decodeUploadFilename,
  getExtension,
  titleFromFilename,
} from './utils/markdown.util';

@Controller('document')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(
    private readonly documentService: DocumentService,
    private readonly fileParserService: FileParserService,
    private readonly r2Service: R2Service,
  ) {}

  /**
   * 上传文件并一键完成：
   * 1. 原始文件保存至 Cloudflare R2（生成 fileUrl）
   * 2. 自动解析为 Markdown（内嵌图片自动上传至 R2 并回填 URL）
   * 3. 结果分别存入 PostgreSQL (元数据) 与 MongoDB (正文)
   * 4. 🌟 事务回滚保障：一旦解析或数据库写入抛出异常，自动追溯并回滚删除 R2 上的原始文件和图片，杜绝孤儿垃圾文件！
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndCreateDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Partial<CreateDocumentDto>,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const decodedFilename = decodeUploadFilename(file.originalname);
    const title = body.title || titleFromFilename(decodedFilename);
    const extension = getExtension(decodedFilename);

    // 记录本次请求中所有上传到 R2 的文件/图片 Key，用于失败时的事务回滚删除
    const uploadedR2Keys: string[] = [];

    try {
      // Step 1: 异步上传原始文件到 Cloudflare R2 对象存储
      let fileUrl: string | undefined;
      if (this.r2Service.isEnabled()) {
        const rawResult = await this.r2Service.uploadBytesWithKey(
          file.buffer,
          {
            fileName: decodedFilename,
            contentType: file.mimetype,
            prefix: 'raw-documents',
          },
        );
        fileUrl = rawResult.url;
        uploadedR2Keys.push(rawResult.key);
      }

      // Step 2: 调用解析服务转 Markdown（注册回调：抽出的图片上传 R2 并记录 Key 供回滚）
      const content = await this.fileParserService.parse({
        originalname: decodedFilename,
        buffer: file.buffer,
        size: file.size,
        onImageUploaded: (key) => uploadedR2Keys.push(key),
      });

      // Step 3: 调用双数据库落盘（Postgres 保存元数据 + fileUrl，Mongo 保存 Markdown 正文）
      return await this.documentService.create({
        title,
        content,
        fileUrl,
        fileSize: file.size,
        fileType: extension,
        summary: body.summary,
        categoryId: body.categoryId,
        teamId: body.teamId,
        authorId: body.authorId,
        coverImage: body.coverImage,
        tags: body.tags,
        status: body.status,
        remark: body.remark,
        isPublic: body.isPublic,
        createBy: body.createBy,
      });
    } catch (err) {
      // 🌟 事务失败回滚逻辑：自动清理本次上传给 Cloudflare R2 的所有对象，防止存储空间浪费
      if (uploadedR2Keys.length > 0) {
        this.logger.warn(
          `文档上传解析失败，触发 R2 回滚清理 (共 ${uploadedR2Keys.length} 个对象)...`,
        );
        await Promise.all(
          uploadedR2Keys.map((key) => this.r2Service.deleteObject(key)),
        );
      }
      throw err;
    }
  }

  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentService.create(createDocumentDto);
  }

  @Get()
  findAll(@Query() query: QueryDocumentDto) {
    return this.documentService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentService.update(id, updateDocumentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentService.remove(id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.documentService.publish(id);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.documentService.archive(id);
  }

  @Post(':id/save-draft')
  saveAsDraft(@Param('id') id: string) {
    return this.documentService.saveAsDraft(id);
  }
}
