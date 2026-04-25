// Type declarations for optional peer dependencies (Document Loaders)

declare module 'pdf-parse' {
  interface PdfResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }
  function parse(buffer: Buffer): Promise<PdfResult>;
  export default parse;
}

declare module 'adm-zip' {
  class AdmZip {
    constructor(buffer?: Buffer | string);
    readAsText(entry: string): string;
    getEntries(): Array<{ entryName: string }>;
  }
  export = AdmZip;
}
