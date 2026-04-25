// ─── RAG Document Loader Pipeline ────────────────────────
// Processes documents (PDF, DOCX, CSV, MD, TXT, XLSX) into
// chunked text with content hashing for deduplication.
// Uses LangChain document loaders + text splitters.

// @ts-ignore — optional dependency, types may not be installed
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Document } from '@langchain/core/documents';
import type { ChunkStrategy } from '../../data/entity/rag/rag-document.entity.js';

/**
 * Options for the document processing pipeline.
 */
export interface DocumentPipelineOptions {
  /** Chunking strategy */
  chunkStrategy?: ChunkStrategy;
  /** Max characters per chunk (default: 1000) */
  chunkSize?: number;
  /** Overlap between chunks (default: 200) */
  chunkOverlap?: number;
}

/**
 * Processed chunk output from the pipeline.
 */
export interface ProcessedChunk {
  /** Chunk text content */
  content: string;
  /** SHA-256 hash of content */
  contentHash: string;
  /** Detected theme/topic (placeholder — host app can override with LLM) */
  theme: string;
  /** Section heading or context */
  section: string;
  /** Section position (0-based) */
  sectionPosition: number;
  /** Chunking strategy used */
  chunkStrategy: ChunkStrategy;
  /** Extra metadata (page number, source, etc.) */
  metadata: Record<string, unknown>;
}

/**
 * Compute SHA-256 hash of a string.
 */
async function sha256(text: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buf = new TextEncoder().encode(text);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Node.js fallback
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Extract text content from raw file data based on MIME type.
 * Returns an array of LangChain Documents.
 */
async function loadDocumentFromBuffer(
  buffer: ArrayBuffer | Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<Document[]> {
  const { Document } = await import('@langchain/core/documents');
  const textDecoder = new TextDecoder('utf-8');

  // ---- Plain text / Markdown ----
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml'
  ) {
    const text = textDecoder.decode(buffer);
    return [new Document({ pageContent: text, metadata: { source: fileName } })];
  }

  // ---- PDF ----
  if (mimeType === 'application/pdf') {
    try {
      // @ts-ignore — optional dependency
      const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');
      const blob = new Blob([buffer] as any, { type: mimeType });
      const loader = new PDFLoader(blob, { splitPages: true });
      return await loader.load();
    } catch {
      // Fallback: try pdf-parse directly
      // @ts-ignore — optional dependency
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(Buffer.from(buffer as ArrayBuffer));
      return [new Document({ pageContent: result.text, metadata: { source: fileName, pages: result.numpages } })];
    }
  }

  // ---- DOCX ----
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    try {
      // @ts-ignore — optional dependency
      const { DocxLoader } = await import('@langchain/community/document_loaders/fs/docx');
      const blob = new Blob([buffer] as any, { type: mimeType });
      const loader = new DocxLoader(blob);
      return await loader.load();
    } catch {
      // Fallback mammoth
      // @ts-ignore — optional dependency
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer as ArrayBuffer) });
      return [new Document({ pageContent: result.value, metadata: { source: fileName } })];
    }
  }

  // ---- CSV ----
  if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
    const text = textDecoder.decode(buffer);
    return [new Document({ pageContent: text, metadata: { source: fileName, type: 'csv' } })];
  }

  // ---- XLSX ----
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    try {
      // @ts-ignore — optional dependency
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const docs: Document[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        docs.push(new Document({ pageContent: csv, metadata: { source: fileName, sheet: sheetName } }));
      }
      return docs;
    } catch {
      return [new Document({ pageContent: '[XLSX parsing failed]', metadata: { source: fileName } })];
    }
  }

  // ---- Fallback: treat as text ----
  try {
    const text = textDecoder.decode(buffer);
    return [new Document({ pageContent: text, metadata: { source: fileName } })];
  } catch {
    return [];
  }
}

/**
 * Extract section headings from text (Markdown headings, numbered sections, etc.)
 */
function extractSection(text: string): string {
  // Try Markdown headings
  const headingMatch = text.match(/^#{1,6}\s+(.+)/m);
  if (headingMatch) return headingMatch[1].trim();

  // First line as fallback section
  const firstLine = text.split('\n')[0]?.trim();
  return firstLine?.substring(0, 100) || 'untitled';
}

/**
 * DocumentPipeline — processes raw files into chunked, hashed text
 * ready for embedding and RAG indexing.
 */
export class DocumentPipeline {
  private splitter: RecursiveCharacterTextSplitter;
  private options: Required<DocumentPipelineOptions>;

  constructor(options: DocumentPipelineOptions = {}) {
    this.options = {
      chunkStrategy: options.chunkStrategy ?? 'recursive',
      chunkSize: options.chunkSize ?? 1000,
      chunkOverlap: options.chunkOverlap ?? 200,
    };

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.options.chunkSize,
      chunkOverlap: this.options.chunkOverlap,
    });
  }

  /**
   * Process a file buffer into chunked documents.
   */
  async process(
    buffer: ArrayBuffer | Uint8Array,
    mimeType: string,
    fileName: string,
    theme?: string,
  ): Promise<ProcessedChunk[]> {
    // 1. Load raw documents
    const rawDocs = await loadDocumentFromBuffer(buffer, mimeType, fileName);
    if (!rawDocs.length) return [];

    // 2. Split into chunks
    const chunks = await this.splitter.splitDocuments(rawDocs);

    // 3. Process each chunk
    const results: ProcessedChunk[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const content = chunk.pageContent;
      if (!content.trim()) continue;

      const contentHash = await sha256(content);
      const section = extractSection(content);

      results.push({
        content,
        contentHash,
        theme: theme || fileName.replace(/\.[^.]+$/, ''),
        section,
        sectionPosition: i,
        chunkStrategy: this.options.chunkStrategy,
        metadata: {
          ...chunk.metadata,
          source: fileName,
        },
      });
    }

    return results;
  }

  /**
   * Check if a content hash already exists (deduplication).
   * Host app should provide the actual check against the DB.
   */
  deduplicate(chunks: ProcessedChunk[], existingHashes: Set<string>): ProcessedChunk[] {
    return chunks.filter(c => !existingHashes.has(c.contentHash));
  }
}
