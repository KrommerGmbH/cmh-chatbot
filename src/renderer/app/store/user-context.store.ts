/**
 * userContext Store — Pinia Composition Store
 *
 * Phase 10.5: UI 상태 (프로필, 설정, 권한) 관리
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserProfile {
  id: string
  name: string
  email?: string
  avatar?: string
  locale: string
  timezone: string
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'auto'
  fontSize: 'sm' | 'base' | 'lg'
  sidebarCollapsed: boolean
  notificationsEnabled: boolean
  defaultModelId?: string
  /** 세션 동안 유지되는 선택된 모델 ID */
  selectedModelId?: string
  /** 세션 동안 유지되는 선택된 에이전트 ID */
  selectedAgentId?: string
}

export interface UserPermissions {
  canManageAgents: boolean
  canManageWorkflows: boolean
  canManageMedia: boolean
  canManageMcp: boolean
  isAdmin: boolean
}

export const useUserContextStore = defineStore('userContext', () => {
  // ── State ──
  const profile = ref<UserProfile>({
    id: crypto.randomUUID(),
    name: 'User',
    locale: 'ko-KR',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  const settings = ref<UserSettings>({
    theme: 'dark',
    fontSize: 'base',
    sidebarCollapsed: false,
    notificationsEnabled: true,
  })

  const permissions = ref<UserPermissions>({
    canManageAgents: true,
    canManageWorkflows: true,
    canManageMedia: true,
    canManageMcp: true,
    isAdmin: true,
  })

  const isInitialized = ref(false)

  // ── Getters ──
  const displayName = computed(() => profile.value.name)
  const currentLocale = computed(() => profile.value.locale)
  const isDarkTheme = computed(() => {
    if (settings.value.theme === 'auto') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
    }
    return settings.value.theme === 'dark'
  })

  // ── Actions ──
  function updateProfile(partial: Partial<UserProfile>): void {
    profile.value = { ...profile.value, ...partial }
    persistState()
  }

  function updateSettings(partial: Partial<UserSettings>): void {
    settings.value = { ...settings.value, ...partial }
    persistState()
  }

  function initialize(): void {
    const stored = localStorage.getItem('cmh_user_context')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.profile) profile.value = { ...profile.value, ...parsed.profile }
        if (parsed.settings) settings.value = { ...settings.value, ...parsed.settings }
      } catch {
        // ignore corrupt data
      }
    }
    isInitialized.value = true
  }

  function persistState(): void {
    localStorage.setItem('cmh_user_context', JSON.stringify({
      profile: profile.value,
      settings: settings.value,
    }))
  }

  return {
    profile,
    settings,
    permissions,
    isInitialized,
    displayName,
    currentLocale,
    isDarkTheme,
    updateProfile,
    updateSettings,
    initialize,
  }
})
