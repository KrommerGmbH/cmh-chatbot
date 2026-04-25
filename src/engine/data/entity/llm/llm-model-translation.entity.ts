// ─── LlmModel Translation Entity ────────────────────────
// Shopware _translation 패턴 — name, description 번역
import type { TranslationEntity, SupportedLocale } from '../../types.js';

export interface LlmModelTranslation extends TranslationEntity {
  /** FK → cmh_llm_model.id */
  modelId: string;
  /** 번역된 이름 */
  name: string;
  /** 번역된 설명 */
  description: string;
  locale: SupportedLocale;
}
