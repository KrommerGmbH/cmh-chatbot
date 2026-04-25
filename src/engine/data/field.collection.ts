// ─── FieldCollection — entity schema builder ────────────
// Mirrors AideWorks src/core/data/field.collection.ts

import type { EntityFieldType } from './types.js';

export interface FieldFlags {
  primaryKey?: boolean;
  required?: boolean;
  nullable?: boolean;
  /** Shopware translation pattern — 이 필드는 _translation 테이블에 존재 */
  translatable?: boolean;
}

export interface FieldEntry {
  name: string;
  type: EntityFieldType;
  flags?: FieldFlags;
  defaultValue?: unknown;
  reference?: string;
}

/**
 * FieldCollection — fluent builder for entity field definitions.
 *
 * @example
 * ```ts
 * const fields = new FieldCollection()
 *   .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
 *   .add({ name: 'name', type: 'string', flags: { required: true } })
 *   .add({ name: 'metadata', type: 'json', flags: { nullable: true } });
 * ```
 */
export class FieldCollection {
  private fields: FieldEntry[] = [];

  add(field: FieldEntry): this {
    this.fields.push(field);
    return this;
  }

  toArray(): FieldEntry[] {
    return [...this.fields];
  }

  has(name: string): boolean {
    return this.fields.some((f) => f.name === name);
  }

  get(name: string): FieldEntry | undefined {
    return this.fields.find((f) => f.name === name);
  }

  get length(): number {
    return this.fields.length;
  }
}
