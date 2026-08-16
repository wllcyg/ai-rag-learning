import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DocumentEntity } from '../document/entities/document.entity';
import {
  RAG_REINDEX_EXCHANGE,
  RAG_RK_BY_IDS,
  RAG_RK_DELETE,
  SEARCH_INDEX_EXCHANGE,
  SEARCH_RK_DELETE,
  SEARCH_RK_INDEX,
} from './mq.constants';
import { ReindexMessage, SearchIndexMessage } from './messages/pipeline.messages';
import { RabbitMqService } from './rabbitmq.service';

/**
 * 文档发布后的知识管线「生产者」
 *
 * <p>触发：RAG 向量化 + Search 全文索引。</p>
 * <p>采用 Claim Check 模式：MQ 只传轻量 ID，避免大包塞满消息队列。</p>
 */
@Injectable()
export class DocumentPipelinePublisher {
  private readonly logger = new Logger(DocumentPipelinePublisher.name);

  constructor(private readonly rabbit: RabbitMqService) {}

  /**
   * 发布成功后调用：并行投递 RAG / Search（仅传轻量 ID）。
   */
  async afterPublish(document: DocumentEntity) {
    await Promise.all([
      this.triggerRagReindex(document.id),
      this.triggerSearchIndex(document.id),
    ]);
  }

  /** 归档/删除后：通知 RAG / Search 按文档 ID 清理索引 */
  async afterUnpublish(documentId: string) {
    await Promise.all([
      this.triggerRagDelete(documentId),
      this.triggerSearchDelete(documentId),
    ]);
  }

  /** RAG：按文档 ID 重建向量块 */
  private async triggerRagReindex(documentId: string) {
    const message: ReindexMessage = {
      taskId: randomUUID(),
      type: 'BY_DOC_IDS',
      documentIds: [documentId],
    };
    const ok = await this.rabbit.publish(
      RAG_REINDEX_EXCHANGE,
      RAG_RK_BY_IDS,
      message,
    );
    this.logger.log(
      `RAG 重建索引${ok ? '已投递' : '投递失败'}：documentId=${documentId}, taskId=${message.taskId}`,
    );
  }

  private async triggerRagDelete(documentId: string) {
    const message: ReindexMessage = {
      taskId: randomUUID(),
      type: 'DELETE_BY_DOC_IDS',
      documentIds: [documentId],
    };
    await this.rabbit.publish(RAG_REINDEX_EXCHANGE, RAG_RK_DELETE, message);
  }

  /** Search：投递轻量文档 ID 索引消息 */
  private async triggerSearchIndex(documentId: string) {
    const message: SearchIndexMessage = {
      taskId: randomUUID(),
      type: 'INDEX',
      documentId,
    };
    const ok = await this.rabbit.publish(
      SEARCH_INDEX_EXCHANGE,
      SEARCH_RK_INDEX,
      message,
    );
    this.logger.log(
      `ES 搜索索引${ok ? '已投递' : '投递失败'}：documentId=${documentId}, taskId=${message.taskId}`,
    );
  }

  private async triggerSearchDelete(documentId: string) {
    const message: SearchIndexMessage = {
      taskId: randomUUID(),
      type: 'DELETE',
      documentId,
    };
    await this.rabbit.publish(SEARCH_INDEX_EXCHANGE, SEARCH_RK_DELETE, message);
  }
}
