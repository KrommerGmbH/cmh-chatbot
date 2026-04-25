// ─── Repository — Shopware DAL-compatible CRUD ──────────
// Mirrors AideWorks src/core/data/repository.ts

import type { Entity, SearchResult } from './types.js';
import { Criteria } from './criteria.js';
import type { DataAdapter } from './data-adapter.js';
import { getEntityDefinition } from './entity-registry.js';

/**
 * Repository — generic CRUD access for a single entity type.
 *
 * API is compatible with:
 * - AideWorks `Repository<T>` (create, search, save, get, delete)
 * - Shopware Admin `repository` pattern
 *
 * Storage is delegated to the injected DataAdapter.
 *
 * @example
 * ```ts
 * const repo = repositoryFactory.create<LlmProvider>('cmh_llm_provider');
 *
 * // Create
 * const provider = repo.create({ name: 'OpenAI', type: 'cloud-api' });
 * await repo.save(provider);
 *
 * // Search
 * const criteria = new Criteria();
 * criteria.addFilter(Criteria.equals('isActive', true));
 * const result = await repo.search(criteria);
 *
 * // Get by ID
 * const found = await repo.get(provider.id);
 *
 * // Delete
 * await repo.delete(provider.id);
 * ```
 */
export class Repository<T extends Entity> {
  constructor(
    private readonly entityName: string,
    private readonly adapter: DataAdapter,
  ) {}

  /** Entity name this repository manages. */
  get entity(): string {
    return this.entityName;
  }

  /**
   * Create a new entity instance with a generated UUID.
   * Does NOT persist — call `save()` afterwards.
   */
  create(initial: Partial<T> = {}): T {
    return {
      id: crypto.randomUUID(),
      ...initial,
    } as unknown as T;
  }

  /**
   * Search entities by Criteria (filters, sorting, pagination).
   */
  async search(criteria: Criteria): Promise<SearchResult<T>> {
    const definition = getEntityDefinition(this.entityName);
    if (!definition) {
      throw new Error(`[cmh-chatbot:Repository] Unknown entity: ${this.entityName}`);
    }
    return this.adapter.search<T>(this.entityName, criteria);
  }

  /**
   * Persist (upsert) an entity.
   */
  async save(entity: T): Promise<T> {
    return this.adapter.save<T>(this.entityName, entity);
  }

  /**
   * Get a single entity by ID.
   */
  async get(id: string): Promise<T | null> {
    return this.adapter.get<T>(this.entityName, id);
  }

  /**
   * Delete an entity by ID.
   */
  async delete(id: string): Promise<boolean> {
    return this.adapter.delete(this.entityName, id);
  }

  /**
   * Alias for delete() — Shopware compatibility.
   */
  async remove(id: string): Promise<boolean> {
    return this.delete(id);
  }
}
