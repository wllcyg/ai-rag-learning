import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * 文件上传解析 DTO
 */
export class UploadParseDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  createBy?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
