import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import * as dotenv from 'dotenv';
import {
  buildExtractionSystemPrompt,
  kgExtractionResultSchema,
  KgExtractionLlmOutput,
  normalizeEntityType,
  normalizeRelationType,
} from './kg-extraction.schema';
import { ExtractionResult } from './pipeline.types';

/**
 * 实体 / 关系抽取服务
 *
 * <p>供 KG 建图使用：从每个 chunk 抽「实体 + 关系」，再写入 Neo4j。</p>
 * <p>ChatOpenAI + withStructuredOutput；未配置 API Key 或调用失败时抛错。</p>
 *
 * <p>环境变量：OPENAI_API_KEY / LLM_API_KEY / DASHSCOPE_API_KEY / MODEL_NAME / KG_MAX_ENTITIES / KG_MAX_RELATIONS / KG_LLM_TIMEOUT_MS</p>
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  /** 单 chunk 最多实体数，防止图爆炸 */
  private readonly maxEntities: number;
  private readonly maxRelations: number;
  private structuredLlm?: Runnable<
    BaseLanguageModelInput,
    KgExtractionLlmOutput
  >;
  private currentApiKey: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.maxEntities = Number(config.get('KG_MAX_ENTITIES', 12));
    this.maxRelations = Number(config.get('KG_MAX_RELATIONS', 15));
    this.initLlm();
  }

  private getApiKey(): string | undefined {
    dotenv.config({ override: true });
    return (
      process.env.DASHSCOPE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.LLM_API_KEY ||
      this.config.get<string>('DASHSCOPE_API_KEY') ||
      this.config.get<string>('OPENAI_API_KEY') ||
      this.config.get<string>('LLM_API_KEY')
    );
  }

  private initLlm(): Runnable<BaseLanguageModelInput, KgExtractionLlmOutput> | undefined {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        'KG 抽取未配置 API Key（DASHSCOPE_API_KEY / OPENAI_API_KEY）',
      );
      return undefined;
    }

    if (this.structuredLlm && this.currentApiKey === apiKey) {
      return this.structuredLlm;
    }

    const baseUrl =
      this.config.get<string>('OPENAI_BASE_URL') ||
      this.config.get<string>('LLM_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const model =
      this.config.get<string>('MODEL_NAME') ||
      this.config.get<string>('LLM_MODEL') ||
      'qwen-plus';
    const timeout = Number(this.config.get('KG_LLM_TIMEOUT_MS', 60000));

    const llm = new ChatOpenAI({
      apiKey,
      model,
      temperature: 0.1,
      maxRetries: 2,
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 60000,
      // DashScope 走 Chat Completions，不要切 OpenAI Responses API
      useResponsesApi: false,
      configuration: { baseURL: baseUrl },
    });

    // jsonMode：兼容 DashScope / qwen；schema 仍由 withStructuredOutput + Zod 校验解析
    this.structuredLlm = llm.withStructuredOutput(kgExtractionResultSchema, {
      name: 'extract_knowledge_graph',
      method: 'jsonMode',
    });
    this.currentApiKey = apiKey;
    this.logger.log(`KG Extraction LLM 已初始化: model=${model}, baseUrl=${baseUrl}`);
    return this.structuredLlm;
  }

  /**
   * 对单个 chunk 做抽取。
   * @param content chunk 正文
   * @param heading 所属章节标题（给 LLM 当上下文）
   * @param documentTitle 文档标题
   */
  async extract(
    content: string,
    heading: string | null | undefined,
    documentTitle: string,
  ): Promise<ExtractionResult> {
    if (!content?.trim()) {
      return { entities: [], relations: [] };
    }

    return this.extractByLlm(content, heading, documentTitle);
  }

  /**
   * LLM 抽取：system 约束规则，user 塞标题+正文（截断 4000 字防超上下文）。
   */
  private async extractByLlm(
    content: string,
    heading: string | null | undefined,
    documentTitle: string,
  ): Promise<ExtractionResult> {
    const llm = this.initLlm();
    if (!llm) {
      throw new Error(
        'KG 抽取未配置 API Key（DASHSCOPE_API_KEY / OPENAI_API_KEY / LLM_API_KEY）',
      );
    }

    const system = buildExtractionSystemPrompt(
      this.maxEntities,
      this.maxRelations,
    );
    const user = `文档标题: ${documentTitle}\n章节: ${heading ?? '无'}\n\n内容:\n${content.slice(0, 4000)}`;

    const parsed = await llm.invoke([
      new SystemMessage(system),
      new HumanMessage(user),
    ]);

    return this.toExtractionResult(parsed);
  }

  /** 截断数量、规范化类型、丢掉挂空实体的关系 */
  private toExtractionResult(parsed: KgExtractionLlmOutput): ExtractionResult {
    const entityNames = new Set<string>();
    const entities: ExtractionResult['entities'] = [];
    for (const e of (parsed.entities ?? []).slice(0, this.maxEntities)) {
      const name = (e.name ?? '').trim();
      if (!name) continue;
      entityNames.add(name);
      entities.push({
        name,
        type: normalizeEntityType(e.type),
        description: (e.description ?? '').trim(),
        aliases: (e.aliases ?? []).map((a) => String(a).trim()).filter(Boolean),
      });
    }

    const relations: ExtractionResult['relations'] = [];
    for (const r of (parsed.relations ?? []).slice(0, this.maxRelations)) {
      const source = (r.source ?? '').trim();
      const target = (r.target ?? '').trim();
      if (!source || !target || !entityNames.has(source) || !entityNames.has(target)) {
        continue;
      }
      relations.push({
        source,
        target,
        relation: normalizeRelationType(r.relation ?? r.type),
        weight: typeof r.weight === 'number' ? r.weight : 0.5,
      });
    }

    return { entities, relations };
  }
}
