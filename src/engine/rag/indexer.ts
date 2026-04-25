// ─── RAG Document Indexer ─────────────────────────────────
// 문서 청킹 + 임베딩 → 벡터 스토어 저장.

import type { EmbeddingService } from './embedding.js';
import type { VectorStore } from '../types/index.js';
import type { Logger } from '../core/logger.js';

export interface IndexerConfig {
  embedding: EmbeddingService;
  vectorStore: VectorStore;
  logger: Logger;
  /** 청크 크기 (문자 수, 기본 1000) */
  chunkSize?: number;
  /** 청크 오버랩 (문자 수, 기본 200) */
  chunkOverlap?: number;
}

export interface IndexableDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * 문서 인덱서 — 텍스트를 청크로 분할하고 임베딩하여 벡터 스토어에 저장.
 */
export class DocumentIndexer {
  private readonly config: IndexerConfig;

  constructor(config: IndexerConfig) {
    this.config = config;
  }

  /**
   * 문서를 청크로 분할 → 임베딩 → 벡터 스토어에 저장.
   */
  async index(doc: IndexableDocument): Promise<number> {
    const { chunkSize = 1000, chunkOverlap = 200, embedding, vectorStore, logger } = this.config;

    // 1. 청킹
    const chunks = splitText(doc.content, chunkSize, chunkOverlap);
    if (chunks.length === 0) return 0;

    logger.info({ docId: doc.id, chunks: chunks.length }, 'indexer:chunking');

    // 2. 임베딩
    const embeddings = await embedding.embedMany(chunks);

    // 3. 벡터 스토어에 저장
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${doc.id}:chunk:${i}`;
      await vectorStore.upsert(chunkId, embeddings[i], {
        ...doc.metadata,
        content: chunks[i],
        documentId: doc.id,
        chunkIndex: i,
        totalChunks: chunks.length,
      });
    }

    logger.info({ docId: doc.id, indexed: chunks.length }, 'indexer:complete');
    return chunks.length;
  }

  /**
   * 다수 문서 일괄 인덱싱.
   */
  async indexMany(docs: IndexableDocument[]): Promise<number> {
    let total = 0;
    for (const doc of docs) {
      total += await this.index(doc);
    }
    return total;
  }

  /**
   * 문서 삭제 (해당 문서의 모든 청크).
   */
  async remove(docId: string): Promise<void> {
    await this.config.vectorStore.delete(docId);
    this.config.logger.info({ docId }, 'indexer:removed');
  }
}

// ── 텍스트 분할 유틸리티 ─────────────────────────────────

function splitText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  if (!text || text.length <= chunkSize) return text ? [text] : [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // 문장 경계에서 자르기 시도
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf('.', end);
      if (sentenceEnd > start + chunkSize * 0.5) {
        end = sentenceEnd + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - chunkOverlap;
    if (start < 0) start = 0;
    // 무한 루프 방지
    if (start >= text.length - chunkOverlap) break;
  }

  return chunks.filter((c) => c.length > 0);
}
