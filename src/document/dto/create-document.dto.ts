import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '../entities/document.entity';

/** 创建文档 */
export class CreateDocumentDto {
  /** 标题 */
  @IsString()
  title: string;

  /** Markdown 正文 */
  @IsString()
  content: string;

  /** 原始文件在 R2 上的公开 URL */
  @IsOptional()
  @IsString()
  fileUrl?: string;

  /** 原始文件大小 (字节) */
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  /** 原始文件扩展名/类型 (如 pdf, docx) */
  @IsOptional()
  @IsString()
  fileType?: string;

  /** 摘要 */
  @IsOptional()
  @IsString()
  summary?: string;

  /** 分类 ID */
  @IsOptional()
  @IsString()
  categoryId?: string;

  /** 团队 ID */
  @IsOptional()
  @IsString()
  teamId?: string;

  /** 作者 ID */
  @IsOptional()
  @IsString()
  authorId?: string;

  /** 封面图 URL */
  @IsOptional()
  @IsString()
  coverImage?: string;

  /** 标签（逗号分隔） */
  @IsOptional()
  @IsString()
  tags?: string;

  /** 状态 */
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  /** 备注 */
  @IsOptional()
  @IsString()
  remark?: string;

  /** 是否公开 */
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /** 创建人 ID */
  @IsOptional()
  @IsString()
  createBy?: string;
}
