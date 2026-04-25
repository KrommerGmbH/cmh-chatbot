// ─── RAG Vector Store Adapter ────────────────────────────
// Entity-backed vector store that stores embeddings in the
// cmh_rag_document entity via the DAL RepositoryFactory.
// Supports multi-vector similarity search (theme, section, content).

import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';

/**
 * Vector similarity search result.
 */
export interface VectorSearchResult {
  /** RAG document entity ID */
  id: string;
  /** Chunk content */
  content: string;
  /** Cosine similarity score (0-1) */
  score: number;
  /** Source metadata */
  metadata: Record<string, unknown>;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Repository interface (matches DAL RepositoryFactory.create() output).
 */
interface Repository {
  search(criteria: any): Promise<{ data: any[] }>;
  save(entity: any): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * EntityVectorStore — uses cmh_rag_document entity as backend.
 *
 * This is NOT a LangChain VectorStore subclass because the multi-vector
 * schema (theme/section/content vectors) doesn't fit the standard
 * single-embedding interface. Instead, it provides a similar API.
 */
export class EntityVectorStore {
  constructor(
    private readonly embeddings: EmbeddingsInterface,
    private readonly repository: Repository,
  ) {}

  /**
   * Embed and store chunks into the entity store.
   */
  async addDocuments(
    documents: Array<{
      id: string;
      mediaId: string;
      theme: string;
      section: string;
      sectionPosition: number;
      content: string;
      contentHash: string;
      chunkStrategy: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void> {
    // Batch embed all content
    const contents = documents.map(d => d.content);
    const themes = documents.map(d => d.theme);
    const sections = documents.map(d => d.section);

    const [contentVectors, themeVectors, sectionVectors] = await Promise.all([
      this.embeddings.embedDocuments(contents),
      this.embeddings.embedDocuments(themes),
      this.embeddings.embedDocuments(sections),
    ]);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      await this.repository.save({
        id: doc.id,
        mediaId: doc.mediaId,
        theme: doc.theme,
        themeVector: themeVectors[i],
        section: doc.section,
        sectionVector: sectionVectors[i],
        sectionPosition: doc.sectionPosition,
        content: doc.content,
        contentVector: contentVectors[i],
        contentHash: doc.contentHash,
        chunkStrategy: doc.chunkStrategy,
        status: 'indexed',
        metadata: doc.metadata || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Similarity search using content vectors.
   */
  async similaritySearch(
    query: string,
    topK: number = 5,
    vectorField: 'contentVector' | 'themeVector' | 'sectionVector' = 'contentVector',
  ): Promise<VectorSearchResult[]> {
    const queryVector = await this.embeddings.embedQuery(query);

    // Load all indexed documents (for small-scale; production should use SQL/vector DB)
    const result = await this.repository.search({ limit: 10000 });
    const docs = result.data.filter((d: any) => d.status === 'indexed' && d[vectorField]);

    // Score and rank
    const scored = docs.map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      score: cosineSimilarity(queryVector, doc[vectorField]),
      metadata: {
        theme: doc.theme,
        section: doc.section,
        sectionPosition: doc.sectionPosition,
        mediaId: doc.mediaId,
        ...(doc.metadata || {}),
      },
    }));

    scored.sort((a: VectorSearchResult, b: VectorSearchResult) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Multi-vector search — combines scores from content, section, and theme vectors.
   * Weights: content=0.6, section=0.25, theme=0.15
   */
  async multiVectorSearch(
    query: string,
    topK: number = 5,
  ): Promise<VectorSearchResult[]> {
    const queryVector = await this.embeddings.embedQuery(query);

    const result = await this.repository.search({ limit: 10000 });
    const docs = result.data.filter((d: any) => d.status === 'indexed' && d.contentVector);

    const scored = docs.map((doc: any) => {
      const contentScore = doc.contentVector ? cosineSimilarity(queryVector, doc.contentVector) : 0;
      const sectionScore = doc.sectionVector ? cosineSimilarity(queryVector, doc.sectionVector) : 0;
      const themeScore = doc.themeVector ? cosineSimilarity(queryVector, doc.themeVector) : 0;

      return {
        id: doc.id,
        content: doc.content,
        score: contentScore * 0.6 + sectionScore * 0.25 + themeScore * 0.15,
        metadata: {
          theme: doc.theme,
          section: doc.section,
          sectionPosition: doc.sectionPosition,
          mediaId: doc.mediaId,
          contentScore,
          sectionScore,
          themeScore,
          ...(doc.metadata || {}),
        },
      };
    });

    scored.sort((a: VectorSearchResult, b: VectorSearchResult) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Convert to LangChain-compatible retriever format.
   */
  asRetriever(topK: number = 5, useMultiVector: boolean = true) {
    const store = this;
    return {
      async invoke(query: string): Promise<Document[]> {
        const results = useMultiVector
          ? await store.multiVectorSearch(query, topK)
          : await store.similaritySearch(query, topK);

        return results.map(r => new Document({
          pageContent: r.content,
          metadata: { ...r.metadata, score: r.score },
        }));
      },
    };
  }
}
