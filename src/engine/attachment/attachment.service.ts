/**
 * ── Attachment Service ───────────────────────────────────
 * 파일 첨부 메인 서비스.
 * 전략 패턴(web / local)으로 환경에 맞는 파일 처리를 위임한다.
 *
 * Usage:
 * ```ts
 * // 웹 서버 환경
 * const svc = new AttachmentService({
 *   mode: 'web',
 *   storagePath: '/var/data/chatbot',
 * });
 *
 * // 로컬 (Electron) 환경
 * const svc = new AttachmentService({
 *   mode: 'local',
 *   storagePath: '/home/user/.cmh-chatbot',
 * });
 *
 * const result = await svc.upload({ name: 'doc.pdf', ... });
 * const buf    = await svc.download(result);
 * await svc.remove(result);
 * ```
 */

import type {
  AttachmentConfig,
  AttachmentInput,
  AttachmentResult,
  AttachmentStrategy,
  TextExtractor,
} from './types.js';
import { LocalFsStrategy } from './strategies/local-fs.strategy.js';
import { WebUploadStrategy } from './strategies/web-upload.strategy.js';

/** 기본 최대 파일 크기: 50 MB */
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

/** 기본 허용 MIME types (오피스 문서 + 이미지 + 텍스트) */
const DEFAULT_ALLOWED_MIME_TYPES = [
  // 문서
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/csv',
  // 이미지
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // 코드
  'application/json',
  'application/xml',
  'text/html',
  'text/css',
  'text/javascript',
  'application/typescript',
];

export class AttachmentService {
  private readonly strategy: AttachmentStrategy;
  private readonly config: Required<
    Pick<AttachmentConfig, 'maxFileSize' | 'allowedMimeTypes' | 'extractText'>
  >;
  private textExtractor?: TextExtractor;

  constructor(config: AttachmentConfig) {
    // 전략 선택
    const storagePath = config.storagePath ?? './data';
    if (config.mode === 'local') {
      this.strategy = new LocalFsStrategy(storagePath);
    } else {
      this.strategy = new WebUploadStrategy(storagePath);
    }

    this.config = {
      maxFileSize: config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      allowedMimeTypes: config.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES,
      extractText: config.extractText ?? false,
    };
  }

  /** 텍스트 추출기 주입 (RAG 파이프라인 연동) */
  setTextExtractor(extractor: TextExtractor): void {
    this.textExtractor = extractor;
  }

  /** 현재 전략 모드 반환 */
  get mode() {
    return this.strategy.mode;
  }

  /**
   * 파일 업로드 (저장 + 검증 + 선택적 텍스트 추출)
   * @throws Error 파일 크기 초과, MIME 타입 불허, 저장 실패 시
   */
  async upload(input: AttachmentInput): Promise<AttachmentResult> {
    // ── 검증 ──
    this.validateSize(input);
    this.validateMimeType(input);

    // ── 저장 ──
    const result = await this.strategy.store(input);

    // ── 텍스트 추출 (옵션) ──
    if (this.config.extractText && this.textExtractor?.canExtract(input.mimeType)) {
      try {
        const buffer = await this.strategy.read(result);
        result.extractedText = await this.textExtractor.extract(buffer, input.mimeType);
      } catch {
        // 텍스트 추출 실패는 파일 저장 자체를 막지 않음
      }
    }

    return result;
  }

  /**
   * 여러 파일 일괄 업로드
   * @returns 성공/실패 결과 배열
   */
  async uploadBatch(
    inputs: AttachmentInput[],
  ): Promise<{ results: AttachmentResult[]; errors: { input: AttachmentInput; error: Error }[] }> {
    const results: AttachmentResult[] = [];
    const errors: { input: AttachmentInput; error: Error }[] = [];

    for (const input of inputs) {
      try {
        const result = await this.upload(input);
        results.push(result);
      } catch (err) {
        errors.push({ input, error: err instanceof Error ? err : new Error(String(err)) });
      }
    }

    return { results, errors };
  }

  /** 저장된 파일 다운로드 (Buffer 반환) */
  async download(result: AttachmentResult): Promise<Buffer> {
    return this.strategy.read(result);
  }

  /** 저장된 파일 삭제 */
  async remove(result: AttachmentResult): Promise<void> {
    return this.strategy.delete(result);
  }

  // ── Private: 검증 ──

  private validateSize(input: AttachmentInput): void {
    if (input.size > this.config.maxFileSize) {
      const maxMB = Math.round(this.config.maxFileSize / 1024 / 1024);
      throw new Error(
        `[AttachmentService] File "${input.name}" exceeds max size (${maxMB}MB). ` +
        `Got ${Math.round(input.size / 1024 / 1024)}MB.`,
      );
    }
  }

  private validateMimeType(input: AttachmentInput): void {
    if (
      this.config.allowedMimeTypes.length > 0 &&
      !this.config.allowedMimeTypes.includes(input.mimeType)
    ) {
      throw new Error(
        `[AttachmentService] MIME type "${input.mimeType}" is not allowed for file "${input.name}". ` +
        `Allowed: ${this.config.allowedMimeTypes.join(', ')}`,
      );
    }
  }
}
