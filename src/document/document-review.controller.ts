import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DocumentReviewService } from './document-review.service';
import {
  ApproveReviewDto,
  QueryReviewTasksDto,
  RejectReviewDto,
} from './dto/review.dto';

/**
 * 文档审核控制器
 * 供审核员处理待办任务、通过/驳回审批，以及查看审核历史
 */
@Controller('document/review')
export class DocumentReviewController {
  constructor(private readonly reviewService: DocumentReviewService) {}

  /**
   * 分页查询审核任务列表（待办 / 已通过 / 已驳回）
   */
  @Get('tasks')
  listTasks(@Query() query: QueryReviewTasksDto) {
    return this.reviewService.listTasks(query);
  }

  /**
   * 获取待审任务总数（用于前端工作台角标提示）
   */
  @Get('pending-count')
  async getPendingCount() {
    const count = await this.reviewService.getPendingCount();
    return { count };
  }

  /**
   * 审核通过
   * - 审核记录置为 Approved (1)
   * - 文档置为 Published 并触发 RAG/Search/KG 索引构建
   */
  @Post(':id/approve')
  approve(
    @Param('id') reviewId: string,
    @Body() dto: ApproveReviewDto = {},
  ) {
    return this.reviewService.approveReview(
      reviewId,
      dto.reviewerId,
      dto.reviewerName,
      dto.reviewComment,
    );
  }

  /**
   * 审核驳回
   * - 审核记录置为 Rejected (2)，记录驳回意见
   * - 文档回退至 Draft (草稿)
   */
  @Post(':id/reject')
  reject(
    @Param('id') reviewId: string,
    @Body() dto: RejectReviewDto,
  ) {
    return this.reviewService.rejectReview(
      reviewId,
      dto.reviewComment,
      dto.reviewerId,
      dto.reviewerName,
    );
  }

  /**
   * 查询指定文档的当前进行中的待审记录（无则返回 null）
   */
  @Get('document/:documentId/current')
  getCurrentReview(@Param('documentId') documentId: string) {
    return this.reviewService.getCurrentReview(documentId);
  }

  /**
   * 查询指定文档的全部历史审核流水
   */
  @Get('document/:documentId/history')
  getReviewHistory(@Param('documentId') documentId: string) {
    return this.reviewService.getReviewHistory(documentId);
  }
}
