// ─── RepositoryFactory — Shopware DAL-compatible factory ─
// Mirrors AideWorks src/core/data/repository-factory.ts

import type { Entity } from './types.js';
import type { DataAdapter } from './data-adapter.js';
import { getEntityDefinition } from './entity-registry.js';
import { Repository } from './repository.js';

/**
 * RepositoryFactory — creates typed Repository instances for registered entities.
 *
 * Unlike AideWorks (singleton relying on window.aideworks bridge),
 * cmh-chatbot uses instance-scoped RepositoryFactory with injected DataAdapter.
 * This allows multiple ChatBot instances with different adapters.
 *
 * Compatible API with AideWorks RepositoryFactory:
 * - `create<T>(entityName)` → `Repository<T>`
 *
 * @example
 * ```ts
 * import { InMemoryDataAdapter, RepositoryFactory } from '@krommergmbh/cmh-chatbot';
 *
 * const adapter = new InMemoryDataAdapter();
 * const factory = new RepositoryFactory(adapter);
 *
 * const providerRepo = factory.create<LlmProvider>('cmh_llm_provider');
 * const modelRepo    = factory.create<LlmModel>('cmh_llm_model');
 *
 * const result = await providerRepo.search(new Criteria());
 * ```
 */
export class RepositoryFactory {
  constructor(private readonly adapter: DataAdapter) {}

  /**
   * Create a typed Repository for the given entity name.
   * Entity must be registered via EntityRegistry.register() first.
   *
   * @throws Error if entity is not registered
   */
  create<T extends Entity>(entityName: string): Repository<T> {
    const definition = getEntityDefinition(entityName);
    if (!definition) {
      throw new Error(
        `[cmh-chatbot:RepositoryFactory] Entity "${entityName}" is not registered. ` +
        `Call EntityRegistry.register() or import entity definitions first.`,
      );
    }
    return new Repository<T>(entityName, this.adapter);
  }

  /** Get the underlying DataAdapter. */
  get dataAdapter(): DataAdapter {
    return this.adapter;
  }
}
