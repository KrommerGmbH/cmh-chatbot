// ─── Language Translation Entity ─────────────────────────
import type { TranslationEntity, SupportedLocale } from '../../types.js';

export interface LanguageTranslation extends TranslationEntity {
  /** FK → cmh_language.id */
  languageId: string;
  /** 번역된 이름 */
  name: string;
  locale: SupportedLocale;
}
