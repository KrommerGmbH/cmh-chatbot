/**
 * B-1: In-Memory VectorStore implementation with cosine similarity.
 *
 * Suitable for small-to-medium document sets (< 100k vectors).
 * For production-scale, replace with SQLite-VSS or FAISS binding.
 */
import type { VectorStore, SearchResult } from '../types/index.js';

interface VectorEntry {
  id: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

export class InMemoryVectorStore implements VectorStore {
  private store = new Map<string, VectorEntry>();

  async upsert(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void> {
    this.store.set(id, { id, embedding, metadata });
  }

  async search(query: number[], topK: number, filter?: Record<string, unknown>): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const entry of this.store.values()) {
      // Apply filter
      if (filter) {
        let match = true;
        for (const [key, value] of Object.entries(filter)) {
          if (entry.metadata[key] !== value) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      const score = cosineSimilarity(query, entry.embedding);
      results.push({
        id: entry.id,
        score,
        metadata: entry.metadata,
        content: entry.metadata.content as string | undefined,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  /** Returns number of stored vectors */
  get size(): number {
    return this.store.size;
  }

  /** Clear all entries */
  clear(): void {
    this.store.clear();
  }
}
