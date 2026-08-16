import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as dotenv from 'dotenv';

/**
 * 文本向量化服务（基于 LangChain OpenAIEmbeddings）
 *
 * <p>作用：把 chunk 文本变成固定维度浮点向量，供后续相似度检索。</p>
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly dimension: number;
  private embeddings: OpenAIEmbeddings | null = null;
  private currentApiKey: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.dimension = Number(this.config.get('EMBEDDING_DIMENSION', 1024));
    this.initEmbeddings();
  }

  private getApiKey(): string | undefined {
    // 动态刷新 .env 保证热更新修改 .env 文件能即时生效
    dotenv.config({ override: true });

    return (
      process.env.DASHSCOPE_API_KEY ||
      process.env.EMBEDDING_API_KEY ||
      process.env.OPENAI_API_KEY ||
      this.config.get<string>('DASHSCOPE_API_KEY') ||
      this.config.get<string>('EMBEDDING_API_KEY') ||
      this.config.get<string>('OPENAI_API_KEY')
    );
  }

  private initEmbeddings(): OpenAIEmbeddings | null {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        '未配置 EMBEDDING_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY，向量化服务未就绪',
      );
      return null;
    }

    if (this.embeddings && this.currentApiKey === apiKey) {
      return this.embeddings;
    }

    const configuredBatch = Number(
      process.env.EMBEDDING_BATCH_SIZE ||
        this.config.get('EMBEDDING_BATCH_SIZE', 10),
    );
    const batchSize = Math.min(
      Number.isFinite(configuredBatch) && configuredBatch > 0
        ? configuredBatch
        : 10,
      10,
    );

    const baseUrl =
      process.env.EMBEDDING_BASE_URL ||
      this.config.get(
        'EMBEDDING_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      );
    const model =
      process.env.EMBEDDING_MODEL ||
      this.config.get('EMBEDDING_MODEL', 'text-embedding-v3');

    this.embeddings = new OpenAIEmbeddings({
      apiKey,
      model,
      dimensions: this.dimension,
      batchSize,
      stripNewLines: false,
      configuration: {
        baseURL: baseUrl,
      },
    });

    this.currentApiKey = apiKey;
    this.logger.log(
      `Embedding 向量化服务已就绪：model=${model}, dimension=${this.dimension}, baseUrl=${baseUrl}`,
    );
    return this.embeddings;
  }

  /** 单条嵌入 */
  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }

  /** 批量嵌入（内部按 EMBEDDING_BATCH_SIZE 切片） */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const client = this.initEmbeddings();
    if (!client) {
      throw new Error(
        '未配置有效 API KEY (DASHSCOPE_API_KEY / OPENAI_API_KEY)，无法执行向量计算',
      );
    }

    this.logger.log(`开始向量化嵌入：count=${texts.length}...`);
    const vectors = await client.embedDocuments(texts);
    this.logger.log(`向量化嵌入成功：count=${vectors.length}`);
    return vectors;
  }
}
