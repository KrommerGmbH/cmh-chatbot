// ─── RAG Embedding Service ───────────────────────────────
// 임베딩 생성 — AI SDK + OpenAI-compatible 엔드포인트 활용.

import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { Logger } from '../core/logger.js';

export interface EmbeddingConfig {
  /** 임베딩 서버 baseURL (llama-server 또는 OpenAI) */
  baseUrl: string;
  /** API key (로컬이면 'not-needed') */
  apiKey?: string;
  /** 임베딩 모델 ID */
  modelId?: string;
  logger: Logger;
}

/**
 * AI SDK 기반 임베딩 서비스.
 * llama-server의 /v1/embeddings 또는 OpenAI Embeddings API 사용.
 */
export class EmbeddingService {
  private readonly provider;
  private readonly modelId: string;
  private readonly logger: Logger;

  constructor(config: EmbeddingConfig) {
    this.provider = createOpenAI({
      baseURL: `${config.baseUrl.replace(/\/v1\/?$/, '')}/v1`,
      apiKey: config.apiKey ?? 'not-needed',
    });
    this.modelId = config.modelId ?? 'text-embedding-3-small';
    this.logger = config.logger;
  }

  /**
   * 단일 텍스트 임베딩 생성.
   */
  async embed(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: this.provider.textEmbeddingModel(this.modelId),
      value: text,
    });
    return embedding;
  }

  /**
   * 다수 텍스트 일괄 임베딩.
   */
  async embedMany(texts: string[]): Promise<number[][]> {
    const { embeddings } = await embedMany({
      model: this.provider.textEmbeddingModel(this.modelId),
      values: texts,
    });
    return embeddings;
  }
}
