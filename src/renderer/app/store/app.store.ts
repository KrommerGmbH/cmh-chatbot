import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const loading = ref(false)
  const currentTheme = ref<'light' | 'dark'>('light')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  function setTheme(theme: 'light' | 'dark') {
    currentTheme.value = theme
    document.documentElement.setAttribute('data-theme', theme)
  }

  return {
    sidebarCollapsed,
    loading,
    currentTheme,
    toggleSidebar,
    setLoading,
    setTheme
  }
})
