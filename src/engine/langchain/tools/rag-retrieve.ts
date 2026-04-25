// ─── RAG Retrieve Tool ───────────────────────────────────
// LangChain DynamicStructuredTool for RAG document retrieval.
// Integrates with EntityVectorStore for multi-vector similarity search.

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { EntityVectorStore } from '../rag/vector-store.adapter.js';

/**
 * Create a LangChain tool for RAG document retrieval.
 *
 * @param vectorStore - The EntityVectorStore instance
 * @param topK - Max results to return (default: 5)
 */
export function createRagRetrieveTool(
  vectorStore: EntityVectorStore,
  topK: number = 5,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'rag-retrieve',
    description: 'Search the knowledge base for relevant documents. Use this when you need information from uploaded documents, files, or the RAG index.',
    schema: z.object({
      query: z.string().describe('The search query to find relevant documents'),
      searchType: z.enum(['content', 'multi']).optional().default('multi')
        .describe('Search type: "content" for content-only, "multi" for weighted multi-vector search'),
    }),
    func: async ({ query, searchType }) => {
      const results = searchType === 'multi'
        ? await vectorStore.multiVectorSearch(query, topK)
        : await vectorStore.similaritySearch(query, topK, 'contentVector');

      if (!results.length) {
        return 'No relevant documents found in the knowledge base.';
      }

      return results
        .map((r, i) => {
          const meta = r.metadata;
          return `[${i + 1}] (score: ${r.score.toFixed(3)}) [${meta.theme}/${meta.section}]\n${r.content}`;
        })
        .join('\n\n---\n\n');
    },
  });
}
