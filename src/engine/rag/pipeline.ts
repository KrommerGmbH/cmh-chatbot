import type {
  RAGContext,
  RAGRetrieveOptions,
  ConversationStore,
  VectorStore,
  DocumentProcessor,
  WebSearchProvider,
  DocumentChunk,
} from '../types/index.js';
import type { Logger } from '../core/logger.js';

export interface RAGPipelineConfig {
  conversationStore?: ConversationStore;
  vectorStore?: VectorStore;
  documentProcessor?: DocumentProcessor;
  webSearchProvider?: WebSearchProvider;
  logger: Logger;
}

/**
 * RAG Pipeline — Retrieval-Augmented Generation.
 * Assembles context from multiple sources (conversation history,
 * document vectors, web search) before sending to LLM.
 *
 * Host app provides the actual store implementations;
 * this class provides the orchestration pipeline.
 */
export class RAGPipeline {
  constructor(private readonly config: RAGPipelineConfig) {}

  /**
   * Retrieve context from configured sources.
   */
  async retrieve(
    query: string,
    queryEmbedding: number[],
    options: RAGRetrieveOptions,
  ): Promise<RAGContext> {
    const chunks: RAGContext['chunks'] = [];
    let totalTokens = 0;

    const { sources, topK, maxTokens } = options;

    // ---- Conversation history ----
    if (sources.includes('conversation') && this.config.conversationStore) {
      const similar = await this.config.conversationStore.searchSimilar(
        queryEmbedding,
        Math.ceil(topK / 2),
      );

      for (const msg of similar) {
        const tokenEstimate = Math.ceil(msg.content.length / 4);
        if (totalTokens + tokenEstimate > maxTokens) break;

        chunks.push({
          content: msg.content,
          source: `conversation:${msg.conversationId}`,
          score: 1.0, // conversation store doesn't always return scores
        });
        totalTokens += tokenEstimate;
      }
    }

    // ---- Document vectors ----
    if (sources.includes('document') && this.config.vectorStore) {
      const results = await this.config.vectorStore.search(
        queryEmbedding,
        topK,
      );

      for (const result of results) {
        const content = result.content ?? String(result.metadata?.content ?? '');
        const tokenEstimate = Math.ceil(content.length / 4);
        if (totalTokens + tokenEstimate > maxTokens) break;

        chunks.push({
          content,
          source: `document:${result.id}`,
          score: result.score,
        });
        totalTokens += tokenEstimate;
      }
    }

    // ---- Web search ----
    if (sources.includes('web') && this.config.webSearchProvider) {
      const webResults = await this.config.webSearchProvider.search(query, 5);

      for (const wr of webResults) {
        const content = wr.content ?? wr.snippet;
        const tokenEstimate = Math.ceil(content.length / 4);
        if (totalTokens + tokenEstimate > maxTokens) break;

        chunks.push({
          content: `[${wr.title}](${wr.url})\n${content}`,
          source: `web:${wr.url}`,
          score: 0.5, // web results have no explicit score
        });
        totalTokens += tokenEstimate;
      }
    }

    // Sort by score descending
    chunks.sort((a, b) => b.score - a.score);

    this.config.logger.debug(
      { chunkCount: chunks.length, totalTokens },
      'rag:retrieve-complete',
    );

    return { chunks, totalTokens };
  }

  /**
   * Build a system prompt augmentation from RAG context.
   */
  formatContext(context: RAGContext): string {
    if (context.chunks.length === 0) return '';

    const parts = context.chunks.map((c, i) => {
      return `[Source ${i + 1}: ${c.source}]\n${c.content}`;
    });

    return `<context>\n${parts.join('\n\n')}\n</context>`;
  }

  /**
   * Index a document into the vector store.
   * Requires both documentProcessor and vectorStore.
   */
  async indexDocument(
    file: Buffer,
    mimeType: string,
    documentId: string,
    embedFn: (text: string) => Promise<number[]>,
  ): Promise<{ chunkCount: number }> {
    const { documentProcessor, vectorStore, logger } = this.config;

    if (!documentProcessor) throw new Error('DocumentProcessor not configured');
    if (!vectorStore) throw new Error('VectorStore not configured');

    const parsed = await documentProcessor.parse(file, mimeType);
    const chunks = await documentProcessor.chunk(parsed, 'semantic');

    let indexed = 0;
    for (const chunk of chunks) {
      const embedding = await embedFn(chunk.content);
      await vectorStore.upsert(chunk.id, embedding, {
        documentId,
        sectionTitle: chunk.sectionTitle,
        content: chunk.content,
        orderIndex: chunk.orderIndex,
        tokenCount: chunk.tokenCount,
      });
      indexed++;
    }

    logger.info({ documentId, chunkCount: indexed }, 'rag:indexed');
    return { chunkCount: indexed };
  }

  /**
   * Index a document using the LangChain DocumentPipeline + EntityVectorStore.
   * This is the Phase 8 recommended path.
   *
   * @param file - Raw file buffer
   * @param mimeType - MIME type of the file
   * @param mediaId - cmh_media entity ID (source file)
   * @param fileName - Original file name
   * @param entityVectorStore - EntityVectorStore instance
   * @param documentPipeline - LangChain DocumentPipeline instance
   * @param existingHashes - Set of already-indexed content hashes (for dedup)
   */
  async indexWithLangChain(
    file: ArrayBuffer | Uint8Array,
    mimeType: string,
    mediaId: string,
    fileName: string,
    entityVectorStore: import('../langchain/rag/vector-store.adapter.js').EntityVectorStore,
    documentPipeline: import('../langchain/rag/document-pipeline.js').DocumentPipeline,
    existingHashes?: Set<string>,
  ): Promise<{ chunkCount: number; deduplicatedCount: number }> {
    const { logger } = this.config;

    // 1. Process file into chunks
    let chunks = await documentPipeline.process(file, mimeType, fileName);

    // 2. Deduplicate
    const originalCount = chunks.length;
    if (existingHashes && existingHashes.size > 0) {
      chunks = documentPipeline.deduplicate(chunks, existingHashes);
    }
    const deduplicatedCount = originalCount - chunks.length;

    // 3. Store with embeddings
    if (chunks.length > 0) {
      await entityVectorStore.addDocuments(
        chunks.map(c => ({
          id: crypto.randomUUID(),
          mediaId,
          theme: c.theme,
          section: c.section,
          sectionPosition: c.sectionPosition,
          content: c.content,
          contentHash: c.contentHash,
          chunkStrategy: c.chunkStrategy,
          metadata: c.metadata,
        })),
      );
    }

    logger.info(
      { mediaId, chunkCount: chunks.length, deduplicatedCount },
      'rag:indexed-langchain',
    );
    return { chunkCount: chunks.length, deduplicatedCount };
  }
}

// ─── B-8: Factory with default InMemoryVectorStore ──────

import { InMemoryVectorStore } from './vector-store.memory.js';

/**
 * Create a RAG pipeline with InMemoryVectorStore as default.
 * Pass custom vectorStore to override.
 */
export function createDefaultRAGPipeline(
  logger: Logger,
  overrides?: Partial<RAGPipelineConfig>,
): RAGPipeline {
  return new RAGPipeline({
    vectorStore: new InMemoryVectorStore(),
    logger,
    ...overrides,
  });
}
