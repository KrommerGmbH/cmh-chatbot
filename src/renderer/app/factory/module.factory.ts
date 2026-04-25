/**
 * CMH Chatbot Module Factory
 *
 * AideWorks ModuleFactory 포팅 — 모듈/플러그인 등록, 라우트/네비게이션 수집.
 */
import { FlatTree } from './flattree.helper'

// ── 타입 ─────────────────────────────────────────────────────────────

export type ModuleType = 'core' | 'plugin'

export interface ModuleNavigation {
  id: string
  label: string
  icon?: string
  color?: string
  path?: string
  parent?: string
  position?: number
  moduleType?: ModuleType
  badge?: () => number
  children?: NavigationEntryWithChildren[]
  level?: number
}

export interface NavigationEntryWithChildren extends ModuleNavigation {
  children: NavigationEntryWithChildren[]
  level: number
  [key: string]: unknown
}

export interface ModuleRoute {
  name: string
  path: string
  component: () => Promise<unknown>
  meta?: Record<string, unknown>
  children?: ModuleRoute[]
  redirect?: { name: string }
}

export interface ModuleManifest {
  name: string
  title?: string
  type?: ModuleType
  color?: string
  icon?: string
  routes?: ModuleRoute[]
  navigation?: ModuleNavigation[]
  settingsItem?: SettingsItem | SettingsItem[]
}

export interface SettingsItem {
  group: string
  to: string
  icon: string
  label: string
  description?: string
  privilege?: string
}

// ── 코어 1레벨 메뉴 (cmh-chatbot 전용) ─────────────────────────────

export const CORE_NAVIGATION: ModuleNavigation[] = [
  {
    id: 'cmh-chat',
    label: 'cmh-global.navigation.chat',
    icon: 'ph:chats-thin',
    color: '#189EFF',
    position: 0,
    moduleType: 'core',
  },
  {
    id: 'cmh-ai',
    label: 'cmh-global.navigation.aiManagement',
    icon: 'ph:brain',
    color: '#9C27B0',
    position: 10,
    moduleType: 'core',
  },
  {
    id: 'cmh-settings',
    label: 'cmh-global.navigation.settings',
    icon: 'ph:gear',
    color: '#607D8B',
    position: 100,
    moduleType: 'core',
  },
]

// ── Registry ─────────────────────────────────────────────────────────

const registry = new Map<string, ModuleManifest>()

function register(manifest: ModuleManifest): void {
  const type: ModuleType = manifest.type ?? 'core'

  // navigation 항목에 moduleType 자동 설정
  if (manifest.navigation) {
    for (const nav of manifest.navigation) {
      nav.moduleType = nav.moduleType ?? type
    }
  }

  // route meta 자동 주입
  if (manifest.routes) {
    for (const route of manifest.routes) {
      route.meta = {
        ...route.meta,
        $module: manifest.name,
        moduleColor: manifest.color,
        moduleIcon: manifest.icon,
      }
    }
  }

  registry.set(manifest.name, { ...manifest, type })
}

function get(name: string): ModuleManifest | undefined {
  return registry.get(name)
}

function has(name: string): boolean {
  return registry.has(name)
}

function getRegistry(): Map<string, ModuleManifest> {
  return registry
}

function getAllRoutes(): ModuleRoute[] {
  const routes: ModuleRoute[] = []
  for (const manifest of registry.values()) {
    if (manifest.routes) routes.push(...manifest.routes)
  }
  return routes
}

function getAllNavigation(): ModuleNavigation[] {
  const navItems: ModuleNavigation[] = [...CORE_NAVIGATION]
  for (const manifest of registry.values()) {
    if (manifest.navigation) navItems.push(...manifest.navigation)
  }
  return navItems
}

function getMainMenuEntries(): NavigationEntryWithChildren[] {
  const tree = new FlatTree<NavigationEntryWithChildren>(
    (a, b) => (a.position ?? 99) - (b.position ?? 99),
  )
  getAllNavigation().forEach((nav) =>
    tree.add({
      ...nav,
      children: (nav.children ?? []) as NavigationEntryWithChildren[],
      level: nav.level ?? (nav.parent ? 2 : 1),
    } as NavigationEntryWithChildren),
  )
  return tree.convertToTree() as NavigationEntryWithChildren[]
}

function getAllSettingsItems(): SettingsItem[] {
  const items: SettingsItem[] = []
  for (const manifest of registry.values()) {
    if (!manifest.settingsItem) continue
    const arr = Array.isArray(manifest.settingsItem)
      ? manifest.settingsItem
      : [manifest.settingsItem]
    items.push(...arr)
  }
  return items
}

async function loadModulesAsync(
  globResult: Record<string, () => Promise<unknown>>,
): Promise<void> {
  await Promise.all(Object.values(globResult).map((loader) => loader()))
}

async function loadPluginsAsync(
  globResult: Record<string, () => Promise<unknown>>,
): Promise<void> {
  await Promise.all(Object.values(globResult).map((loader) => loader()))
}

const ModuleFactory = {
  register,
  get,
  has,
  getRegistry,
  getAllRoutes,
  getAllNavigation,
  getMainMenuEntries,
  getAllSettingsItems,
  loadModulesAsync,
  loadPluginsAsync,
  CORE_NAVIGATION,
}

export default ModuleFactory
