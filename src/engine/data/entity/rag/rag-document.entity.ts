// ─── RAG Document Entity ─────────────────────────────────
// Entity for RAG-indexed document chunks with multi-vector schema.
// Supports theme-level, section-level, and content-level embeddings
// with content hash deduplication.

import type { Entity } from '../../types.js';

/**
 * RAG indexing status.
 */
export type RagDocumentStatus = 'pending' | 'processing' | 'indexed' | 'error';

/**
 * Chunking strategy used to split the document.
 */
export type ChunkStrategy = 'index' | 'semantic' | 'recursive' | 'page';

/**
 * RagDocument — multi-vector RAG chunk entity.
 *
 * Entity name: `cmh_rag_document`
 *
 * Each row represents a single chunk from a source document.
 * Three embedding vectors enable hierarchical retrieval:
 * - themeVector:   topic/category embedding of the chunk
 * - sectionVector: heading/section context embedding
 * - contentVector: actual chunk content embedding
 *
 * contentHash (SHA-256) enables deduplication across re-ingestions.
 *
 * Relationship:
 * - Media 1 ──→ N RagDocument (source file → chunks)
 */
export interface RagDocument extends Entity {
  /** FK → cmh_media.id (source file) */
  mediaId: string;

  /** Theme / topic label of this chunk */
  theme: string;

  /** Theme-level embedding vector */
  themeVector?: number[] | null;

  /** Section heading / context */
  section: string;

  /** Section-level embedding vector */
  sectionVector?: number[] | null;

  /** Position of this section within the document (0-based) */
  sectionPosition: number;

  /** Actual chunk text content */
  content: string;

  /** Content-level embedding vector */
  contentVector?: number[] | null;

  /** SHA-256 hash of content for deduplication */
  contentHash: string;

  /** Chunking strategy used */
  chunkStrategy: ChunkStrategy;

  /** Processing status */
  status: RagDocumentStatus;

  /** Error message if status = 'error' */
  errorMessage?: string | null;

  /** Extra metadata (page number, heading path, etc.) */
  metadata?: Record<string, unknown> | null;
}
