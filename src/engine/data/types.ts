// ─── Shopware DAL-compatible base types ─────────────────
// Mirrors AideWorks src/core/data/types.ts for cross-project compatibility.

/** Base entity interface — all entities must have a UUID id. */
export interface Entity {
  id: string;
  [key: string]: unknown;
}

// ─── Provider / Model domain types ──────────────────────

export type ProviderType = 'cloud-api' | 'local-gguf' | 'self-hosted';
export type ModelType = 'chat' | 'embedding' | 'image' | 'tts' | 'stt' | 'code' | 'multimodal' | 'vision';

// ─── Locale / Translation ───────────────────────────────

/** 지원 locale (Shopware translation 패턴) */
export type SupportedLocale = 'ko-KR' | 'en-GB' | 'de-DE' | 'zh-CN' | 'ja-JP';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['ko-KR', 'en-GB', 'de-DE', 'zh-CN', 'ja-JP'];

/** 번역 테이블 행 인터페이스 (Shopware _translation 테이블 패턴) */
export interface TranslationEntity extends Entity {
  /** FK → 부모 entity.id */
  entityId: string;
  /** Locale code (ko-KR, en-GB, …) */
  locale: SupportedLocale;
  [key: string]: unknown;
}

// ─── Schema types ───────────────────────────────────────

export type EntityFieldType =
  | 'uuid'
  | 'string'
  | 'text'
  | 'boolean'
  | 'integer'
  | 'float'
  | 'datetime'
  | 'json';

export interface EntityFieldDefinition {
  name: string;
  type: EntityFieldType;
  required?: boolean;
  primary?: boolean;
  nullable?: boolean;
  defaultValue?: string;
  reference?: string;
}

export interface EntityIndexDefinition {
  name: string;
  fields: string[];
  unique?: boolean;
}

export interface DataEntityDefinition {
  entity: string;
  label: string;
  collection?: string;
  module?: string;
  fields: EntityFieldDefinition[];
  indexes?: EntityIndexDefinition[];
}

// ─── Query result ───────────────────────────────────────

export interface SearchResult<T> {
  data: T[];
  total: number;
}
