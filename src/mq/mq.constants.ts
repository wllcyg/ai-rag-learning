/**
 * RabbitMQ 拓扑常量
 *
 * 队列名统一带 `kh.` 前缀，避免和本机同时跑的其他项目冲突。
 */

// ============================================================================
// 1. RAG 知识切片与向量化管线 (面向 AI 问答 / kh_chunk 索引)
// ============================================================================

/** RAG 重建索引交换机（topic） */
export const RAG_REINDEX_EXCHANGE = 'rag.reindex.exchange';

/** RAG 消费者消费的队列 */
export const RAG_REINDEX_QUEUE = 'kh.rag.reindex.queue';

/** 路由键：按文档 ID 切片与向量化重建 */
export const RAG_RK_BY_IDS = 'rag.reindex.by_ids';

/** 路由键：删除文档全部向量切片 */
export const RAG_RK_DELETE = 'rag.reindex.delete';


// ============================================================================
// 2. 文档级全文检索管线 (面向前台搜索框 / kh_document 索引)
// ============================================================================

/** 文档级搜索索引交换机（topic） */
export const SEARCH_INDEX_EXCHANGE = 'search.index.exchange';

/** 文档搜索消费者消费的队列 */
export const SEARCH_INDEX_QUEUE = 'kh.search.index.queue';

/** 路由键：文档创建 / 更新 / 发布时建立搜索索引 */
export const SEARCH_RK_INDEX = 'search.index.document';

/** 路由键：文档删除 / 下架时从搜索索引中移除 */
export const SEARCH_RK_DELETE = 'search.index.delete';


// ============================================================================
// 3. KG 知识图谱构建管线 (面向实体多跳问答 / Neo4j 实体关系网络)
// ============================================================================

/** KG 知识图谱构建交换机（topic） */
export const KG_GRAPH_EXCHANGE = 'kg.graph.exchange';

/** KG 知识图谱消费者消费的队列 */
export const KG_GRAPH_QUEUE = 'kh.kg.graph.queue';

/** 路由键：按文档 ID 异步抽取实体关系并构建图谱 */
export const KG_RK_BUILD_BY_IDS = 'kg.graph.build.by_ids';

/** 路由键：删除文档对应的知识图谱子图 */
export const KG_RK_DELETE = 'kg.graph.delete';
