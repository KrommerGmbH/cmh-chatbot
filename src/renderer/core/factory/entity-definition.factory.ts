/**
 * CMH Entity Definition Factory
 *
 * Entity 정의를 중앙 레지스트리에서 관리.
 * AideWorks entity-definition.factory 패턴 이식.
 */

export interface AnyEntityDefinition {
  name: string
  type?: string
  entity?: string
  [key: string]: unknown
}

const registry = new Map<string, AnyEntityDefinition>()

function add(name: string, definition: AnyEntityDefinition): void {
  if (registry.has(name)) {
    console.warn(`[CMH:EntityDefinition] "${name}" already registered. Overwriting.`)
  }
  registry.set(name, { ...definition, name })
}

function get(name: string): AnyEntityDefinition | undefined {
  return registry.get(name)
}

function has(name: string): boolean {
  return registry.has(name)
}

function remove(name: string): void {
  registry.delete(name)
}

function getRegistry(): Map<string, AnyEntityDefinition> {
  return registry
}

/** 타입별 필터링 */
function getByType<T extends AnyEntityDefinition>(type: T['type']): Map<string, T> {
  const result = new Map<string, T>()
  registry.forEach((def, name) => {
    if (def.type === type) result.set(name, def as T)
  })
  return result
}

export default {
  add,
  get,
  has,
  remove,
  getRegistry,
  getByType,
}
