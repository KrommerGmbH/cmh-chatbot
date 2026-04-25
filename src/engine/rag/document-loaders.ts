/**
 * B-2: Document Loaders — extracts text from PDF, CSV, DOCX files.
 *
 * Uses lightweight, zero-native-dependency approaches:
 * - PDF: pdf-parse (if available) or raw text extraction
 * - CSV: built-in line parser
 * - DOCX: xml extraction from zip
 *
 * Each loader returns an array of Document chunks.
 */

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface DocumentLoader {
  load(input: Buffer | string, filename: string): Promise<Document[]>;
  supports(filename: string): boolean;
}

// ─── CSV Loader ─────────────────────────────────────────

export class CsvLoader implements DocumentLoader {
  supports(filename: string): boolean {
    return filename.toLowerCase().endsWith('.csv');
  }

  async load(input: Buffer | string, filename: string): Promise<Document[]> {
    const text = typeof input === 'string' ? input : input.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];

    const header = lines[0];
    const docs: Document[] = [];

    for (let i = 1; i < lines.length; i++) {
      docs.push({
        id: `${filename}:row-${i}`,
        content: `${header}\n${lines[i]}`,
        metadata: { source: filename, row: i, type: 'csv' },
      });
    }

    return docs;
  }
}

// ─── Plain Text / Markdown Loader ───────────────────────

export class TextLoader implements DocumentLoader {
  private extensions = ['.txt', '.md', '.markdown', '.log'];

  supports(filename: string): boolean {
    const lower = filename.toLowerCase();
    return this.extensions.some((ext) => lower.endsWith(ext));
  }

  async load(input: Buffer | string, filename: string): Promise<Document[]> {
    const text = typeof input === 'string' ? input : input.toString('utf-8');
    // Split into ~1000 char chunks with overlap
    const chunks = chunkText(text, 1000, 200);
    return chunks.map((chunk, i) => ({
      id: `${filename}:chunk-${i}`,
      content: chunk,
      metadata: { source: filename, chunk: i, type: 'text' },
    }));
  }
}

// ─── PDF Loader (requires pdf-parse) ────────────────────

export class PdfLoader implements DocumentLoader {
  supports(filename: string): boolean {
    return filename.toLowerCase().endsWith('.pdf');
  }

  async load(input: Buffer | string, filename: string): Promise<Document[]> {
    const buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;

    let text: string;
    try {
      // Dynamic import — pdf-parse is an optional dependency
      // @ts-ignore — optional peer dependency
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      text = result.text;
    } catch {
      throw new Error('pdf-parse not installed. Run: pnpm add pdf-parse');
    }

    const chunks = chunkText(text, 1000, 200);
    return chunks.map((chunk, i) => ({
      id: `${filename}:chunk-${i}`,
      content: chunk,
      metadata: { source: filename, chunk: i, type: 'pdf' },
    }));
  }
}

// ─── DOCX Loader (requires adm-zip or jszip) ───────────

export class DocxLoader implements DocumentLoader {
  supports(filename: string): boolean {
    return filename.toLowerCase().endsWith('.docx');
  }

  async load(input: Buffer | string, filename: string): Promise<Document[]> {
    const buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;

    let text: string;
    try {
      // Dynamic import — adm-zip is an optional dependency
      // @ts-ignore — optional peer dependency
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(buffer);
      const docXml = zip.readAsText('word/document.xml');
      // Strip XML tags, keep text content
      text = docXml
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
    } catch {
      throw new Error('adm-zip not installed. Run: pnpm add adm-zip');
    }

    const chunks = chunkText(text, 1000, 200);
    return chunks.map((chunk, i) => ({
      id: `${filename}:chunk-${i}`,
      content: chunk,
      metadata: { source: filename, chunk: i, type: 'docx' },
    }));
  }
}

// ─── Loader Registry ────────────────────────────────────

const defaultLoaders: DocumentLoader[] = [
  new CsvLoader(),
  new TextLoader(),
  new PdfLoader(),
  new DocxLoader(),
];

export function getLoaderForFile(filename: string, loaders = defaultLoaders): DocumentLoader | null {
  return loaders.find((l) => l.supports(filename)) ?? null;
}

export async function loadDocument(input: Buffer | string, filename: string): Promise<Document[]> {
  const loader = getLoaderForFile(filename);
  if (!loader) {
    throw new Error(`No loader found for file: ${filename}`);
  }
  return loader.load(input, filename);
}

// ─── Utility ────────────────────────────────────────────

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}
