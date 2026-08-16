/** RAG 重建索引消息 */
export type ReindexType = 'BY_DOC_IDS' | 'DELETE_BY_DOC_IDS';

export interface ReindexMessage {
  taskId: string;
  type: ReindexType;
  documentIds?: string[];
}

/** ES 搜索索引消息（Claim Check 模式：仅传轻量 ID，消费者从 MongoDB 读取全量正文） */
export type SearchIndexType = 'INDEX' | 'DELETE';

export interface SearchIndexMessage {
  taskId: string;
  type: SearchIndexType;
  documentId: string;
}