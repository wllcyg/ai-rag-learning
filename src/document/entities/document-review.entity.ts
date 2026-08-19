import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

/**
 * 审核结果枚举
 */
export enum ReviewResult {
  Approved = 1, // 通过
  Rejected = 2, // 驳回
}

/**
 * 文档审核记录实体
 * 对应表：kh_document_review
 */
@Entity({ name: 'kh_document_review' })
export class DocumentReviewEntity {
  /** 审核记录 ID（雪花） */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** 被审文档 ID → kh_document.id */
  @Column({ name: 'document_id', type: 'bigint' })
  documentId: string;

  /** 审核人 ID；待审时为 NULL */
  @Column({ name: 'reviewer_id', type: 'bigint', nullable: true })
  reviewerId?: string | null;

  /** 审核人姓名 */
  @Column({ name: 'reviewer_name', type: 'varchar', nullable: true })
  reviewerName?: string | null;

  /** 审核结果：NULL=待审 1=通过 2=驳回 */
  @Column({ name: 'review_result', type: 'smallint', nullable: true })
  reviewResult?: ReviewResult | null;

  /** 审核意见（驳回必填） */
  @Column({ name: 'review_comment', type: 'varchar', nullable: true })
  reviewComment?: string | null;

  /** 提审前文档 status（0 草稿 / 1 已发布 等） */
  @Column({ name: 'before_status', type: 'smallint' })
  beforeStatus: number;

  /** 审核完成时间 */
  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  /** 提交审核时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
