import { defineComponent, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAdminMenuStore } from '../../../store/admin-menu.store'
import { useUiPreferencesStore } from '../../../store/ui-preferences.store'
import type { NavigationEntryWithChildren } from '../../../factory/module.factory'
import template from './cmh-admin-menu.html?raw'
import './cmh-admin-menu.scss'

export default defineComponent({
  name: 'cmh-admin-menu',
  template,

  setup() {
    const adminMenuStore = useAdminMenuStore()
    const uiPreferencesStore = useUiPreferencesStore()
    const route = useRoute()
    const { t } = useI18n()

    const isExpanded = computed(() => adminMenuStore.isExpanded)

    const visibleMainMenuEntries = computed(() => {
      const entries = adminMenuStore.mainMenuEntries.filter(
        (entry) => (entry.children?.length ?? 0) > 0 || !!entry.path,
      )
      return entries
    })

    const menuClasses = computed(() => ({
      'is--expanded': adminMenuStore.isExpanded,
      'is--collapsed': adminMenuStore.isCollapsed,
    }))

    function onToggleSidebar(): void {
      adminMenuStore.toggleSidebar()
    }

    function onSwitchToChat(): void {
      uiPreferencesStore.setShellMode('chat')
    }

    /** 1레벨 메뉴 펼침/접힘 토글 */
    function onToggleMenuEntry(entryId: string): void {
      if (adminMenuStore.isEntryExpanded(entryId)) {
        adminMenuStore.collapseMenuEntry(entryId)
      } else {
        adminMenuStore.expandMenuEntry(entryId)
      }
    }

    /** 현재 라우트가 이 parent의 children 중 하나인지 확인 */
    function isActiveParent(entry: NavigationEntryWithChildren): boolean {
      if (!entry.children || entry.children.length === 0) return false
      const currentRouteName = route.name as string
      return entry.children.some((child) => child.path === currentRouteName)
    }

    return {
      t,
      isExpanded,
      visibleMainMenuEntries,
      menuClasses,
      adminMenuStore,
      onToggleSidebar,
      onSwitchToChat,
      onToggleMenuEntry,
      isActiveParent,
    }
  },
})
