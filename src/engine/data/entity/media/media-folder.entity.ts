// ─── MediaFolder Entity ──────────────────────────────────
// Logical folder structure for organizing media files.

import type { Entity } from '../../types.js';

/**
 * MediaFolder — Shopware DAL-compatible entity for media folders.
 *
 * Entity name: `cmh_media_folder`
 *
 * Supports nested folders via self-referencing parentId.
 */
export interface MediaFolder extends Entity {
  /** Folder display name */
  name: string;

  /** Parent folder ID (null = root) */
  parentId?: string | null;
}
