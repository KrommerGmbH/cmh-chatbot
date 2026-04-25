// ─── Language Entity ──────────────────────────────────────
// 시스템 지원 언어 (ko-KR, en-GB, de-DE, zh-CN, ja-JP, fr-FR)
// Shopware translation 패턴 적용 — name은 _translation 테이블에 존재.
import type { Entity, TranslationEntity, SupportedLocale } from '../../types.js';

export interface LanguageEntity extends Entity {
  /** BCP-47 locale 코드 (ko-KR, en-GB, …) — 변경 불가 식별자 */
  code: string;
  /** 해당 언어의 네이티브 이름 (한국어, English, …) */
  nativeName: string;
  /** 국기 아이콘 또는 Phosphor 아이콘 */
  icon: string;
  /** 정렬 순서 */
  position: number;
  /** 기본 언어 여부 */
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // ── Translatable fields (runtime resolved) ──
  /** 표시 이름 (현재 locale 기준 — DAL resolve 후 채워짐) */
  name?: string;

  /** 번역 목록 (association) */
  translations?: LanguageTranslation[];
}

/** Language 번역 행 (Shopware _translation 패턴) */
export interface LanguageTranslation extends TranslationEntity {
  /** FK → cmh_language.id */
  languageId: string;
  /** 번역된 이름 */
  name: string;
  locale: SupportedLocale;
}
