import { IsOptional, IsString } from 'class-validator';

/**
 * 查询审核任务列表 DTO
 */
export class QueryReviewTasksDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;

  /** 状态过滤：pending=待办, approved=已通过, rejected=已驳回 */
  @IsOptional()
  @IsString()
  status?: 'pending' | 'approved' | 'rejected' | string;
}

/**
 * 审核通过 DTO
 */
export class ApproveReviewDto {
  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  reviewerName?: string;

  @IsOptional()
  @IsString()
  reviewComment?: string;
}

/**
 * 审核驳回 DTO
 */
export class RejectReviewDto {
  @IsString()
  reviewComment: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  reviewerName?: string;
}
