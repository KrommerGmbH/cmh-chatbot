// ─── Entity Registry ─────────────────────────────────────
// Mirrors AideWorks src/core/data/entity-registry.ts

import type { DataEntityDefinition } from './types.js';
import { EntityDefinition } from './entity.definition.js';

const registry = new Map<string, DataEntityDefinition>();

/**
 * Register an entity definition.
 *
 * Accepts either:
 * - An `EntityDefinition` subclass instance → converted via `toDataDefinition()`
 * - A plain `DataEntityDefinition` object (legacy/manual)
 */
export function registerEntityDefinition(
  definition: DataEntityDefinition | EntityDefinition,
): void {
  if (definition instanceof EntityDefinition) {
    const data = definition.toDataDefinition();
    registry.set(data.entity, data);
  } else {
    registry.set(definition.entity, definition);
  }
}

export function getEntityDefinition(entityName: string): DataEntityDefinition | undefined {
  return registry.get(entityName);
}

export function getAllEntityDefinitions(): DataEntityDefinition[] {
  return Array.from(registry.values());
}

/**
 * EntityRegistry — convenience namespace (AideWorks-compatible).
 *
 * @example
 * ```ts
 * EntityRegistry.register(new LlmProviderDefinition());
 * const def = EntityRegistry.get('cmh_llm_provider');
 * ```
 */
export const EntityRegistry = {
  register: registerEntityDefinition,
  get: getEntityDefinition,
  getAll: getAllEntityDefinitions,
};
