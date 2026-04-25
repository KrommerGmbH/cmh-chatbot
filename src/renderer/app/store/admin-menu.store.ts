/**
 * Admin Menu Store
 *
 * 사이드바 확장/축소, 메뉴 항목 상태 관리.
 * AideWorks admin-menu.store 패턴 포팅.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NavigationEntryWithChildren } from '../factory/module.factory'
import ModuleFactory, { CORE_NAVIGATION } from '../factory/module.factory'

export const useAdminMenuStore = defineStore('adminMenu', () => {
  const isExpanded = ref(localStorage.getItem('cmh-admin-menu-expanded') !== 'false')
  const isOffCanvasShown = ref(false)
  const expandedEntries = ref<string[]>([])

  const isCollapsed = computed(() => !isExpanded.value)

  const mainMenuEntries = computed<NavigationEntryWithChildren[]>(() => {
    const entries = ModuleFactory.getMainMenuEntries()
    if (entries.length > 0) return entries
    return CORE_NAVIGATION.map((entry) => ({
      ...entry,
      level: 1,
      children: [] as NavigationEntryWithChildren[],
    })) as NavigationEntryWithChildren[]
  })

  function expandSidebar(): void {
    isExpanded.value = true
    localStorage.setItem('cmh-admin-menu-expanded', 'true')
  }

  function collapseSidebar(): void {
    isExpanded.value = false
    localStorage.setItem('cmh-admin-menu-expanded', 'false')
  }

  function toggleSidebar(): void {
    if (isExpanded.value) collapseSidebar()
    else expandSidebar()
  }

  function openOffCanvas(): void {
    isOffCanvasShown.value = true
  }

  function closeOffCanvas(): void {
    isOffCanvasShown.value = false
  }

  function toggleOffCanvas(): void {
    isOffCanvasShown.value = !isOffCanvasShown.value
  }

  function expandMenuEntry(entryId: string): void {
    if (!expandedEntries.value.includes(entryId)) {
      expandedEntries.value.push(entryId)
    }
  }

  function collapseMenuEntry(entryId: string): void {
    expandedEntries.value = expandedEntries.value.filter((id) => id !== entryId)
  }

  function isEntryExpanded(entryId: string): boolean {
    return expandedEntries.value.includes(entryId)
  }

  function clearExpandedMenuEntries(): void {
    expandedEntries.value = []
  }

  return {
    isExpanded,
    isCollapsed,
    isOffCanvasShown,
    expandedEntries,
    mainMenuEntries,
    expandSidebar,
    collapseSidebar,
    toggleSidebar,
    openOffCanvas,
    closeOffCanvas,
    toggleOffCanvas,
    expandMenuEntry,
    collapseMenuEntry,
    isEntryExpanded,
    clearExpandedMenuEntries,
  }
})
