/**
 * CMH Chatbot Vue Adapter
 *
 * Meteor 컴포넌트 등록, Iconify, i18n, 전역 컴포넌트 등록을 일괄 처리.
 * AideWorks VueAdapter 패턴 포팅.
 */
import type { App } from 'vue'
import { defineAsyncComponent } from 'vue'
import * as MeteorComponents from '@shopware-ag/meteor-component-library'
import { Icon } from '@iconify/vue/offline'
import { i18n } from '../init/i18n'
import '../init/iconify-icons'
import { registerDirectives } from '../directive'
import { registerFilters } from '../filter'
import CmhPagination from '../component/grid/cmh-pagination'

type ComponentConfig = Record<string, unknown>

export class VueAdapter {
  public app: App
  public i18n = i18n
  public resolvedComponentConfigs = new Map<string, ComponentConfig>()
  public vueComponents: Record<string, unknown> = {}

  constructor(app: App) {
    this.app = app
  }

  protected isComponentRegistered(name: string): boolean {
    return Boolean(this.app.component(name))
  }

  public init(): void {
    this.registerMeteorComponents()
    this.registerIconifyComponent()
    this.registerI18n()
    this.registerGlobalComponents()
    this.registerDirectives()
    this.registerFilters()
  }

  /** Mt* → mt-* 태그명 변환 후 글로벌 등록 */
  protected registerMeteorComponents(): void {
    Object.entries(MeteorComponents)
      .filter(([key]) => key.startsWith('Mt'))
      .forEach(([key, component]) => {
        if (!component) return
        const tagName = `mt-${key
          .replace(/^Mt/, '')
          .replace(/([A-Z])/g, '-$1')
          .replace(/^-/, '')
          .toLowerCase()}`
        this.app.component(tagName, component as never)
        this.vueComponents[tagName] = component
      })
  }

  protected registerIconifyComponent(): void {
    this.app.component('iconify-icon', Icon)
    this.vueComponents['iconify-icon'] = Icon
  }

  protected registerI18n(): void {
    this.app.use(this.i18n)
  }

  protected registerGlobalComponents(): void {
    // ── Sync registration ──
    this.registerComponent('cmh-pagination', CmhPagination)

    const importComponent = (name: string, importFn: () => Promise<{ default: unknown }>) => {
      if (this.isComponentRegistered(name)) return

      const asyncComp = defineAsyncComponent(importFn as () => Promise<{ default: never }>)
      this.app.component(name, asyncComp)
      this.vueComponents[name] = asyncComp
    }

    // ── base ──
    importComponent('cmh-button', () => import('../component/base/cmh-button'))
    importComponent('cmh-collapse', () => import('../component/base/cmh-collapse'))
    importComponent('cmh-empty-state', () => import('../component/base/cmh-empty-state'))

    // ── context-menu ──
    importComponent('cmh-context-menu', () => import('../component/context-menu/cmh-context-menu'))
    importComponent('cmh-context-menu-item', () => import('../component/context-menu/cmh-context-menu-item'))
    importComponent('cmh-context-menu-divider', () => import('../component/context-menu/cmh-context-menu-divider'))
    importComponent('cmh-context-button', () => import('../component/context-menu/cmh-context-button'))

    // ── modal ──
    importComponent('cmh-confirm-modal', () => import('../component/modal/cmh-confirm-modal'))

    // ── list ──
    importComponent('cmh-sortable-list', () => import('../component/list/cmh-sortable-list'))

    // ── data-grid ──
    importComponent('cmh-data-grid', () => import('../component/data-grid/cmh-data-grid'))
    importComponent('cmh-data-grid-column-boolean', () => import('../component/data-grid/cmh-data-grid-column-boolean'))
    importComponent('cmh-data-grid-column-position', () => import('../component/data-grid/cmh-data-grid-column-position'))
    importComponent('cmh-data-grid-inline-edit', () => import('../component/data-grid/cmh-data-grid-inline-edit'))
    importComponent('cmh-data-grid-settings', () => import('../component/data-grid/cmh-data-grid-settings'))

    // ── entity ──
    importComponent('cmh-entity-listing', () => import('../component/entity/cmh-entity-listing'))
    importComponent('cmh-one-to-many-grid', () => import('../component/entity/cmh-one-to-many-grid'))
    importComponent('cmh-many-to-many-assignment-card', () => import('../component/entity/cmh-many-to-many-assignment-card'))

    // ── sidebar ──
    importComponent('cmh-sidebar', () => import('../component/sidebar/cmh-sidebar'))
    importComponent('cmh-sidebar-item', () => import('../component/sidebar/cmh-sidebar-item'))
    importComponent('cmh-sidebar-collapse', () => import('../component/sidebar/cmh-sidebar-collapse'))

    // ── media ──
    importComponent('cmh-image-slider', () => import('../component/media/cmh-image-slider'))
    importComponent('cmh-media-preview-v2', () => import('../component/media/cmh-media-preview-v2'))
    importComponent('cmh-media-compact-upload-v2', () => import('../component/media/cmh-media-compact-upload-v2'))
    importComponent('cmh-media-upload-v2', () => import('../component/media/cmh-media-upload-v2'))
    importComponent('cmh-media-url-form', () => import('../component/media/cmh-media-url-form'))

    // ── filter ──
    importComponent('cmh-base-filter', () => import('../component/filter/cmh-base-filter'))
    importComponent('cmh-boolean-filter', () => import('../component/filter/cmh-boolean-filter'))
    importComponent('cmh-date-filter', () => import('../component/filter/cmh-date-filter'))
    importComponent('cmh-existence-filter', () => import('../component/filter/cmh-existence-filter'))
    importComponent('cmh-filter-panel', () => import('../component/filter/cmh-filter-panel'))
    importComponent('cmh-multi-select-filter', () => import('../component/filter/cmh-multi-select-filter'))
    importComponent('cmh-number-filter', () => import('../component/filter/cmh-number-filter'))
    importComponent('cmh-range-filter', () => import('../component/filter/cmh-range-filter'))
    importComponent('cmh-sidebar-filter-panel', () => import('../component/filter/cmh-sidebar-filter-panel'))

    // ── structure ──
    importComponent('cmh-modal', () => import('../component/structure/cmh-modal'))
    importComponent('cmh-modals-renderer', () => import('../component/structure/cmh-modals-renderer'))
    importComponent('cmh-search-bar', () => import('../component/structure/cmh-search-bar'))
    importComponent('cmh-search-bar-item', () => import('../component/structure/cmh-search-bar-item'))
    importComponent('cmh-search-more-results', () => import('../component/structure/cmh-search-more-results'))
    importComponent('cmh-sidebar-renderer', () => import('../component/structure/cmh-sidebar-renderer'))
    importComponent('cmh-notification-center', () => import('../component/structure/cmh-notification-center'))
    importComponent('cmh-card-view', () => import('../component/structure/cmh-card-view'))
    importComponent('cmh-split-pane', () => import('../component/structure/cmh-split-pane'))
    importComponent('cmh-language-switch', () => import('../component/structure/cmh-language-switch'))
    importComponent('cmh-language-info', () => import('../component/structure/cmh-language-info'))
    importComponent('cmh-admin-menu-item', () => import('../component/structure/cmh-admin-menu-item'))
    importComponent('cmh-skip-link', () => import('../component/structure/cmh-skip-link'))
    importComponent('cmh-error', () => import('../component/structure/cmh-error'))
    importComponent('cmh-discard-changes-modal', () => import('../component/structure/cmh-discard-changes-modal'))
    importComponent('cmh-block-override', () => import('../component/structure/cmh-block-override'))
    importComponent('cmh-inheritance-warning', () => import('../component/structure/cmh-inheritance-warning'))
    importComponent('cmh-hidden-iframes', () => import('../component/structure/cmh-hidden-iframes'))

    // ── utils ──
    importComponent('cmh-notifications', () => import('../component/utils/cmh-notifications'))
    importComponent('cmh-system-message', () => import('../component/utils/cmh-system-message'))
    importComponent('cmh-rating-sads', () => import('../component/utils/cmh-rating-sads'))
    importComponent('cmh-workflow-node', () => import('../component/utils/cmh-workflow-node'))
    importComponent('cmh-agent-core', () => import('../component/utils/cmh-agent-core'))
    importComponent('cmh-agent-block-node', () => import('../component/utils/cmh-agent-block-node'))
  }

  public registerComponent(name: string, component: unknown): void {
    if (this.isComponentRegistered(name)) {
      this.vueComponents[name] = this.app.component(name) as unknown
      return
    }
    this.app.component(name, component as never)
    this.vueComponents[name] = component
  }

  protected registerDirectives(): void {
    registerDirectives(this.app)
  }

  protected registerFilters(): void {
    registerFilters(this.app)
  }

  public mount(selector = '#app'): void {
    this.app.mount(selector)
  }
}
