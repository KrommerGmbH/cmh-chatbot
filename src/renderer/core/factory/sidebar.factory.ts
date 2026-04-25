/**
 * CMH Sidebar Factory
 *
 * 모듈이 우측 사이드바 항목을 동적으로 등록하는 팩토리.
 * AideWorks sidebar.factory 패턴 이식.
 */

/** 사이드바 아이템 정의 */
export interface SidebarItemDefinition {
  id: string
  entityName?: string
  moduleName?: string
  component: string | (() => Promise<unknown>)
  icon: string
  label: string
  pluginName: string
  position?: number
  badge?: () => number
  disabled?: () => boolean
}

const registry = new Map<string, SidebarItemDefinition>()

function register(item: SidebarItemDefinition): void {
  if (registry.has(item.id)) {
    console.warn(`[CMH:Sidebar] "${item.id}" already registered. Overwriting.`)
  }
  registry.set(item.id, item)
}

function unregister(id: string): void {
  registry.delete(id)
}

function get(id: string): SidebarItemDefinition | undefined {
  return registry.get(id)
}

function has(id: string): boolean {
  return registry.has(id)
}

function getRegistry(): Map<string, SidebarItemDefinition> {
  return registry
}

function getAll(): SidebarItemDefinition[] {
  return [...registry.values()].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
}

function getByModule(moduleName: string): SidebarItemDefinition[] {
  return getAll().filter((item) => item.moduleName === moduleName)
}

function getByEntity(entityName: string): SidebarItemDefinition[] {
  return getAll().filter((item) => item.entityName === entityName)
}

export default {
  register,
  unregister,
  get,
  has,
  getRegistry,
  getAll,
  getByModule,
  getByEntity,
}
