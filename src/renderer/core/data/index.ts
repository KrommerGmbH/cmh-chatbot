/**
 * CMH Core Data barrel — renderer ↔ engine 연결 레이어
 *
 * '@core/data' 경로로 import 되며, engine/data 모듈을 re-export 합니다.
 * 마이그레이션된 컴포넌트가 '@core/data'로 import하는 심볼을 제공합니다.
 */

// Criteria
export { Criteria } from '@engine/data/criteria'
export type { CriteriaFilter, CriteriaSorting } from '@engine/data/criteria'

// Repository
export { Repository } from '@engine/data/repository'
export { RepositoryFactory, RepositoryFactory as repositoryFactory } from '@engine/data/repository-factory'

// Entity
export { EntityDefinition } from '@engine/data/entity.definition'
export { FieldCollection } from '@engine/data/field.collection'
export {
  registerEntityDefinition,
  getEntityDefinition,
  getAllEntityDefinitions,
  EntityRegistry,
} from '@engine/data/entity-registry'

// Types
export type {
  Entity,
  ProviderType,
  ModelType,
  EntityFieldType,
  EntityFieldDefinition,
  EntityIndexDefinition,
  DataEntityDefinition,
  SearchResult,
} from '@engine/data/types'

// ── EntityCollection (lightweight stub) ──
// cmh-chatbot engine에 EntityCollection이 없으므로 최소 인터페이스를 제공합니다.
export class EntityCollection<T = Record<string, unknown>> extends Array<T> {
  public entity: string
  public source: string
  public criteria: unknown
  public total: number

  constructor(
    source = '',
    entity = '',
    criteria: unknown = null,
    items: T[] = [],
    total?: number,
  ) {
    super(...items)
    this.source = source
    this.entity = entity
    this.criteria = criteria
    this.total = total ?? items.length
    Object.setPrototypeOf(this, EntityCollection.prototype)
  }

  add(item: T): void {
    this.push(item)
    this.total = this.length
  }

  remove(id: string): void {
    const idx = this.findIndex((i: any) => i.id === id)
    if (idx >= 0) {
      this.splice(idx, 1)
      this.total = this.length
    }
  }

  has(id: string): boolean {
    return this.some((i: any) => i.id === id)
  }

  getById(id: string): T | undefined {
    return this.find((i: any) => i.id === id)
  }

  getIds(): string[] {
    return this.map((i: any) => i.id).filter(Boolean)
  }
}
