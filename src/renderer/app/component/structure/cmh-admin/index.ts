import { defineComponent, computed } from 'vue'
import { useAdminMenuStore } from '../../../store/admin-menu.store'
import { useUiPreferencesStore } from '../../../store/ui-preferences.store'
import template from './cmh-admin.html?raw'
import './cmh-admin.scss'

export default defineComponent({
  name: 'cmh-admin',
  template,

  setup() {
    const adminMenuStore = useAdminMenuStore()
    const uiPreferencesStore = useUiPreferencesStore()

    const adminClasses = computed(() => ({
      'is--sidebar-expanded': adminMenuStore.isExpanded,
      'is--sidebar-collapsed': adminMenuStore.isCollapsed,
      'is--chat-mode': uiPreferencesStore.shellMode === 'chat',
      'is--admin-mode': uiPreferencesStore.shellMode === 'admin',
    }))

    return { adminClasses, uiPreferencesStore }
  },
})
