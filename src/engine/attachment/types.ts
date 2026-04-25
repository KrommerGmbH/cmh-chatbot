/**
 * ── Attachment Types ─────────────────────────────────────
 * 파일 첨부 관련 타입 정의.
 * 웹 서버 / 로컬 설치 양쪽 모두 지원.
 */

/** 첨부 파일 환경 — 라이브러리 소비자가 설정 */
export type AttachmentMode = 'web' | 'local';

/** 클라이언트에서 올라오는 첨부 파일 메타 */
export interface AttachmentInput {
  /** 원본 파일명 (확장자 포함) */
  name: string;
  /** MIME type (e.g. 'application/pdf', 'image/png') */
  mimeType: string;
  /** 파일 크기 (bytes) */
  size: number;
  /**
   * 파일 데이터.
   * - web: base64 문자열 (Data URL 또는 순수 base64)
   * - local: 로컬 파일 절대 경로 (string) 또는 Buffer
   */
  data: string | Buffer;
}

/** 첨부 파일 처리 결과 */
export interface AttachmentResult {
  /** 고유 ID (UUID) */
  id: string;
  /** 원본 파일명 */
  name: string;
  /** MIME type */
  mimeType: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** 저장된 경로 (로컬) 또는 접근 URL (웹) */
  storagePath: string;
  /** 텍스트 추출 결과 (RAG용, optional) */
  extractedText?: string;
  /** 처리 타임스탬프 */
  createdAt: Date;
}

/** 첨부 전략 인터페이스 — 전략 패턴 */
export interface AttachmentStrategy {
  readonly mode: AttachmentMode;
  /** 파일을 저장/처리하고 결과 반환 */
  store(input: AttachmentInput): Promise<AttachmentResult>;
  /** 저장된 파일의 내용을 Buffer로 읽기 */
  read(result: AttachmentResult): Promise<Buffer>;
  /** 저장된 파일 삭제 */
  delete(result: AttachmentResult): Promise<void>;
}

/** 첨부 서비스 설정 */
export interface AttachmentConfig {
  /** web 또는 local */
  mode: AttachmentMode;
  /** 파일 저장 루트 디렉토리 (local 모드 시 필수) */
  storagePath?: string;
  /** 최대 파일 크기 (bytes, 기본 50MB) */
  maxFileSize?: number;
  /** 허용 MIME types (기본: 모두 허용) */
  allowedMimeTypes?: string[];
  /** 텍스트 추출 활성화 (RAG 파이프라인 연동) */
  extractText?: boolean;
}

/** 텍스트 추출기 인터페이스 (RAG 연동용) */
export interface TextExtractor {
  canExtract(mimeType: string): boolean;
  extract(data: Buffer, mimeType: string): Promise<string>;
}
