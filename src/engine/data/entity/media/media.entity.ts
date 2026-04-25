// ─── Media Entity ─────────────────────────────────────────
// Entity interface for uploaded media files (documents, images, etc.)
// Migrated from aideworks aw-media — no alphabet subfolder sharding.

import type { Entity } from '../../types.js';

/**
 * Media — Shopware DAL-compatible entity for uploaded files.
 *
 * Entity name: `cmh_media`
 *
 * Relationship:
 * - MediaFolder 1 ──→ N Media (OneToMany)
 *
 * Storage path uses flat UUID-based naming:
 *   `{storageRoot}/{folderId}/{uuid}.{ext}`
 * NO Shopware alphabet-based directory sharding.
 */
export interface Media extends Entity {
  /** Original file name (without extension) */
  fileName: string;

  /** File extension (e.g. 'pdf', 'png') */
  fileExtension: string;

  /** MIME type (e.g. 'application/pdf') */
  mimeType: string;

  /** File size in bytes */
  fileSize: number;

  /** User-defined title */
  title?: string | null;

  /** Alt text / description */
  alt?: string | null;

  /** Absolute storage path */
  path: string;

  /** Content hash (SHA-256) for deduplication */
  hash?: string | null;

  /** FK → cmh_media_folder.id */
  folderId?: string | null;

  /** Tags (JSON array of strings) */
  tags: string[];
}
