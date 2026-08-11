import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DocumentStatus {
  Draft = 0,
  Published = 1,
  Archived = 2,
}

@Entity({ name: 'kh_document' })
export class DocumentEntity {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ name: 'content_id', type: 'varchar', unique: true })
  contentId: string;

  @Column({ type: 'varchar', nullable: true })
  summary?: string;

  @Column({ name: 'category_id', type: 'bigint', nullable: true })
  categoryId?: string;

  @Column({ name: 'team_id', type: 'bigint', nullable: true })
  teamId?: string;

  @Column({ name: 'author_id', type: 'bigint', nullable: true })
  authorId?: string;

  @Column({ name: 'cover_image', type: 'varchar', nullable: true })
  coverImage?: string;

  @Column({ type: 'varchar', nullable: true })
  tags?: string;

  @Column({ type: 'smallint', default: DocumentStatus.Draft })
  status: DocumentStatus;

  @Column({ type: 'varchar', nullable: true })
  remark?: string;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount: number;

  @Column({ name: 'favourite_count', type: 'int', default: 0 })
  favouriteCount: number;

  @Column({ name: 'word_count', type: 'int', default: 0 })
  wordCount: number;

  @Column({ name: 'publish_time', type: 'timestamp', nullable: true })
  publishTime?: Date;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'create_by', type: 'bigint', nullable: true })
  createBy?: string;

  @Column({ name: 'update_by', type: 'bigint', nullable: true })
  updateBy?: string;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;
}
