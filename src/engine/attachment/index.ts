/**
 * ── Attachment Module ────────────────────────────────────
 * 파일 첨부 엔진: 웹 서버 + 로컬 설치 양쪽 지원
 */

// Types
export type {
  AttachmentMode,
  AttachmentInput,
  AttachmentResult,
  AttachmentStrategy,
  AttachmentConfig,
  TextExtractor,
} from './types.js';

// Service
export { AttachmentService } from './attachment.service.js';

// Strategies
export { LocalFsStrategy } from './strategies/local-fs.strategy.js';
export { WebUploadStrategy } from './strategies/web-upload.strategy.js';

// Route factory
export { createAttachmentRoutes } from './attachment.routes.js';
