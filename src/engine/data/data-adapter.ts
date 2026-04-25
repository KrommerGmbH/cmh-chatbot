// ─── DataAdapter — storage abstraction layer ─────────────
// The host app (AideWorks/Shopware/standalone) injects a DataAdapter implementation.
// cmh-chatbot provides InMemoryDataAdapter as default for Phase 1.

import type { Entity, SearchResult } from './types.js';
import type { Criteria, CriteriaFilter, CriteriaSorting } from './criteria.js';

/**
 * DataAdapter — abstract storage interface for Shopware DAL compatibility.
 *
 * Host implementations:
 * - **InMemoryDataAdapter** (default) — Phase 1, in-process Map storage
 * - **AideWorks** — SQLite via tRPC bridge (`window.aideworks.dataSearch/dataSave/…`)
 * - **Shopware Plugin** — MySQL via Shopware DAL REST API
 *
 * @example
 * ```ts
 * // Host app provides adapter
 * const adapter: DataAdapter = new SqliteDataAdapter(db);
 * const server = await createChatServer({ dataAdapter: adapter, ... });
 * ```
 */
export interface DataAdapter {
  search<T extends Entity>(entityName: string, criteria: Criteria): Promise<SearchResult<T>>;
  save<T extends Entity>(entityName: string, entity: T): Promise<T>;
  get<T extends Entity>(entityName: string, id: string): Promise<T | null>;
  delete(entityName: string, id: string): Promise<boolean>;
}

// ─── InMemoryDataAdapter ────────────────────────────────

/**
 * In-memory DataAdapter — stores entities in Maps.
 * Supports full Criteria evaluation (filters, sorting, pagination).
 * Used as default adapter for development/testing (Phase 1).
 */
export class InMemoryDataAdapter implements DataAdapter {
  private store = new Map<string, Map<string, Entity>>();

  /**
   * Seed initial data for an entity.
   * Useful for loading mock/default data at startup.
   */
  seed<T extends Entity>(entityName: string, data: T[]): void {
    const entityStore = this.getEntityStore(entityName);
    for (const entity of data) {
      entityStore.set(entity.id, { ...entity });
    }
  }

  async search<T extends Entity>(
    entityName: string,
    criteria: Criteria,
  ): Promise<SearchResult<T>> {
    const entityStore = this.getEntityStore(entityName);
    let items = Array.from(entityStore.values()) as T[];

    // Defensive defaults for plain-object criteria
    const filters = criteria.filters ?? [];
    const sortings = criteria.sortings ?? [];
    const page = criteria.page ?? 1;
    const limit = criteria.limit ?? 25;

    // Apply filters
    if (filters.length > 0) {
      items = items.filter((item) =>
        evaluateFilters(item as Record<string, unknown>, filters, 'AND'),
      );
    }

    const total = items.length;

    // Apply sorting
    if (sortings.length > 0) {
      items.sort((a, b) => compareBySortings(a, b, sortings));
    }

    // Apply pagination
    const start = (page - 1) * limit;
    items = items.slice(start, start + limit);

    return { data: items, total };
  }

  async save<T extends Entity>(entityName: string, entity: T): Promise<T> {
    const entityStore = this.getEntityStore(entityName);
    const saved = { ...entity };
    entityStore.set(entity.id, saved);
    return saved;
  }

  async get<T extends Entity>(entityName: string, id: string): Promise<T | null> {
    const entityStore = this.getEntityStore(entityName);
    const entity = entityStore.get(id);
    return (entity as T) ?? null;
  }

  async delete(entityName: string, id: string): Promise<boolean> {
    const entityStore = this.getEntityStore(entityName);
    return entityStore.delete(id);
  }

  /** Get all entity IDs for a given entity name (testing helper). */
  getIds(entityName: string): string[] {
    return Array.from(this.getEntityStore(entityName).keys());
  }

  private getEntityStore(entityName: string): Map<string, Entity> {
    let entityStore = this.store.get(entityName);
    if (!entityStore) {
      entityStore = new Map();
      this.store.set(entityName, entityStore);
    }
    return entityStore;
  }
}

// ─── Criteria evaluation engine ─────────────────────────

function evaluateFilter(
  entity: Record<string, unknown>,
  filter: CriteriaFilter,
): boolean {
  switch (filter.type) {
    case 'equals':
      return entity[filter.field!] === filter.value;

    case 'equalsAny':
      return (
        Array.isArray(filter.value) &&
        (filter.value as unknown[]).includes(entity[filter.field!])
      );

    case 'contains':
      return String(entity[filter.field!] ?? '')
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());

    case 'range': {
      const val = entity[filter.field!] as number;
      const p = filter.parameters ?? {};
      if (p.gte !== undefined && val < (p.gte as number)) return false;
      if (p.lte !== undefined && val > (p.lte as number)) return false;
      if (p.gt !== undefined && val <= (p.gt as number)) return false;
      if (p.lt !== undefined && val >= (p.lt as number)) return false;
      return true;
    }

    case 'not': {
      const sub = evaluateFilters(
        entity,
        filter.queries ?? [],
        filter.operator ?? 'AND',
      );
      return !sub;
    }

    case 'multi':
      return evaluateFilters(
        entity,
        filter.queries ?? [],
        filter.operator ?? 'AND',
      );

    default:
      return true;
  }
}

function evaluateFilters(
  entity: Record<string, unknown>,
  filters: CriteriaFilter[],
  operator: string,
): boolean {
  if (filters.length === 0) return true;
  const op = operator.toUpperCase();
  if (op === 'OR') return filters.some((f) => evaluateFilter(entity, f));
  return filters.every((f) => evaluateFilter(entity, f));
}

function compareBySortings(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  sortings: CriteriaSorting[],
): number {
  for (const s of sortings) {
    const aVal = a[s.field];
    const bVal = b[s.field];
    if (aVal === bVal) continue;

    const dir = s.order === 'DESC' ? -1 : 1;

    if (aVal == null) return dir;
    if (bVal == null) return -dir;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * dir;
    }

    return String(aVal).localeCompare(String(bVal)) * dir;
  }
  return 0;
}

// ─── LocalStorageDataAdapter ────────────────────────────

/**
 * Extends InMemoryDataAdapter with localStorage persistence.
 * On every write (save/delete), the affected entity table is serialized to localStorage.
 * On construction, previously persisted data is restored from localStorage.
 *
 * Key format: `cmh:{entityName}`
 */
export class LocalStorageDataAdapter extends InMemoryDataAdapter {
  private readonly prefix: string;

  constructor(prefix = 'cmh') {
    super();
    this.prefix = prefix;
    this._restoreAll();
  }

  override seed<T extends Entity>(entityName: string, data: T[]): void {
    const key = `${this.prefix}:${entityName}`;
    const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (existing) {
      // Merge: 기존 데이터 유지 + seed에만 있는 새 항목 추가
      try {
        const persisted: T[] = JSON.parse(existing);
        const existingIds = new Set(persisted.map((e) => e.id));
        const newItems = data.filter((d) => !existingIds.has(d.id));
        if (newItems.length > 0) {
          super.seed(entityName, [...persisted, ...newItems]);
          this._persist(entityName);
        } else {
          // 모든 항목이 이미 존재 — 그냥 복원
        }
      } catch {
        // parse 실패 — 전체 덮어쓰기
        super.seed(entityName, data);
        this._persist(entityName);
      }
      return;
    }
    super.seed(entityName, data);
    this._persist(entityName);
  }

  override async save<T extends Entity>(entityName: string, entity: T): Promise<T> {
    const result = await super.save(entityName, entity);
    this._persist(entityName);
    return result;
  }

  override async delete(entityName: string, id: string): Promise<boolean> {
    const result = await super.delete(entityName, id);
    this._persist(entityName);
    return result;
  }

  /** Serialize entity table to localStorage */
  private _persist(entityName: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const ids = this.getIds(entityName);
      const items: Entity[] = [];
      const entityStore = (this as any).store.get(entityName) as Map<string, Entity> | undefined;
      if (entityStore) {
        for (const id of ids) {
          const entity = entityStore.get(id);
          if (entity) items.push(entity);
        }
      }
      const key = `${this.prefix}:${entityName}`;
      const json = JSON.stringify(items);
      try {
        localStorage.setItem(key, json);
      } catch {
        // QuotaExceeded — evict other entities and retry once
        this._evictOldest(key);
        try {
          localStorage.setItem(key, json);
        } catch {
          // Still fails — skip silently
        }
      }
    } catch (e) {
      console.warn(`[LocalStorageDataAdapter] persist failed for ${entityName}:`, e);
    }
  }

  /** Remove the largest localStorage entry (except current key) to free space */
  private _evictOldest(exceptKey: string): void {
    if (typeof localStorage === 'undefined') return;
    let largestKey = '';
    let largestSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === exceptKey || !k.startsWith(this.prefix)) continue;
      const size = (localStorage.getItem(k) ?? '').length;
      if (size > largestSize) {
        largestSize = size;
        largestKey = k;
      }
    }
    if (largestKey) {
      localStorage.removeItem(largestKey);
    }
  }

  /** Restore all known entity tables from localStorage */
  private _restoreAll(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(`${this.prefix}:`)) continue;
        const entityName = key.slice(this.prefix.length + 1);
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const items = JSON.parse(raw) as Entity[];
        super.seed(entityName, items);
      }
    } catch (e) {
      console.warn('[LocalStorageDataAdapter] restore failed:', e);
    }
  }
}

// ─── AideWorksBridgeDataAdapter ───────────────────────

type BridgeApi = {
  dataSearch: <T>(entity: string, criteria: Record<string, unknown>) => Promise<{ data: T[]; total: number }>;
  dataGet: <T>(entity: string, id: string) => Promise<T | null>;
  dataSave: <T>(entity: string, payload: T) => Promise<T>;
  dataDelete: (entity: string, id: string) => Promise<boolean>;
};

/**
 * AideWorks preload bridge 기반 DataAdapter.
 * - 저장소는 main-process SQLite (`aideworks.sqlite`)
 * - renderer는 `window.aideworks.data*` API를 통해 접근
 */
export class AideWorksBridgeDataAdapter implements DataAdapter {
  constructor(private readonly bridge: BridgeApi) {}

  async search<T extends Entity>(entityName: string, criteria: Criteria): Promise<SearchResult<T>> {
    const payload: Record<string, unknown> = {
      page: criteria.page ?? 1,
      limit: criteria.limit ?? 25,
      filters: criteria.filters ?? [],
      sortings: criteria.sortings ?? [],
    };
    return this.bridge.dataSearch<T>(entityName, payload);
  }

  async save<T extends Entity>(entityName: string, entity: T): Promise<T> {
    return this.bridge.dataSave<T>(entityName, entity);
  }

  async get<T extends Entity>(entityName: string, id: string): Promise<T | null> {
    return this.bridge.dataGet<T>(entityName, id);
  }

  async delete(entityName: string, id: string): Promise<boolean> {
    return this.bridge.dataDelete(entityName, id);
  }
}

/** AideWorks preload bridge 사용 가능 여부 */
export function hasAideWorksBridge(): boolean {
  const w = globalThis as unknown as {
    aideworks?: Partial<BridgeApi>;
  };
  return !!(
    w.aideworks
    && typeof w.aideworks.dataSearch === 'function'
    && typeof w.aideworks.dataGet === 'function'
    && typeof w.aideworks.dataSave === 'function'
    && typeof w.aideworks.dataDelete === 'function'
  );
}
