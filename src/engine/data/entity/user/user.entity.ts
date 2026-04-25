// ─── User Entity ─────────────────────────────────────────
// 사용자 정보 — languageId로 선호 언어를 참조.
import type { Entity } from '../../types.js';
import type { LanguageEntity } from '../language/language.entity.js';

export interface UserEntity extends Entity {
  /** 사용자 표시 이름 */
  name: string;
  /** 이메일 주소 */
  email?: string;
  /** FK → cmh_language.id — 사용자 선호 언어 */
  languageId: string;
  /** 아바타 아이콘 (Phosphor icon 이름) */
  avatarIcon?: string;
  /** 활성 여부 */
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // ── Association (runtime resolved) ──
  language?: LanguageEntity;
}
