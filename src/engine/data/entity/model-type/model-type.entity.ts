// ─── ModelType Entity ────────────────────────────────────
// 모델의 용도별 분류 (chat, tts, stt, embedding, vision, code, multimodal, image)
// Shopware translation 패턴 적용 — name, description은 _translation 테이블에 존재.
import type { Entity, TranslationEntity, SupportedLocale } from '../../types.js';

export interface ModelTypeEntity extends Entity {
  /** 기술 이름 (chat, tts, stt, …) — 변경 불가 식별자 */
  technicalName: string;
  /** 아이콘 (Phosphor icon 이름) */
  icon: string;
  /** 정렬 순서 */
  position: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // ── Translatable fields (runtime resolved) ──
  /** 표시 이름 (현재 locale 기준 — DAL resolve 후 채워짐) */
  name?: string;
  /** 설명 (현재 locale 기준) */
  description?: string;

  /** 번역 목록 (association) */
  translations?: ModelTypeTranslation[];
}

/** ModelType 번역 행 (Shopware _translation 패턴) */
export interface ModelTypeTranslation extends TranslationEntity {
  /** FK → cmh_model_type.id */
  modelTypeId: string;
  /** 번역된 이름 */
  name: string;
  /** 번역된 설명 */
  description: string;
  locale: SupportedLocale;
}
