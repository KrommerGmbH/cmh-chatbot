// ─── Abstract EntityDefinition ───────────────────────────
// Mirrors AideWorks src/core/data/entity.definition.ts

import type { Entity, DataEntityDefinition, EntityFieldDefinition } from './types.js';
import { FieldCollection } from './field.collection.js';

/**
 * Abstract base for entity definitions.
 * Subclass this to define a new entity schema.
 *
 * Compatible with AideWorks EntityDefinition pattern.
 *
 * @example
 * ```ts
 * class LlmProviderDefinition extends EntityDefinition<LlmProvider> {
 *   getEntityName() { return 'cmh_llm_provider'; }
 *   getLabel() { return 'LLM Provider'; }
 *   defineFields() {
 *     return new FieldCollection()
 *       .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
 *       .add({ name: 'name', type: 'string', flags: { required: true } });
 *   }
 * }
 * ```
 */
export abstract class EntityDefinition<T extends Entity = Entity> {
  abstract getEntityName(): string;
  abstract defineFields(): FieldCollection;

  getLabel(): string {
    return this.getEntityName();
  }

  getModuleName(): string | undefined {
    return undefined;
  }

  getDefaults(): Partial<T> {
    return {};
  }

  /**
   * Create a new entity instance with a generated UUID.
   */
  create(initial: Partial<T> = {}): T {
    return {
      id: crypto.randomUUID(),
      ...this.getDefaults(),
      ...initial,
    } as T;
  }

  /**
   * Convert to DataEntityDefinition (flat format for registry storage).
   * Compatible with AideWorks toDataDefinition().
   */
  toDataDefinition(): DataEntityDefinition {
    const fields = this.defineFields().toArray();

    return {
      entity: this.getEntityName(),
      label: this.getLabel(),
      module: this.getModuleName(),
      fields: fields.map(
        (f): EntityFieldDefinition => ({
          name: f.name,
          type: f.type,
          required: f.flags?.required,
          primary: f.flags?.primaryKey,
          nullable: f.flags?.nullable,
          defaultValue: f.defaultValue != null ? String(f.defaultValue) : undefined,
          reference: f.reference,
        }),
      ),
    };
  }
}

export { FieldCollection };
