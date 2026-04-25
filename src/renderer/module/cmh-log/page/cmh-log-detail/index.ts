import { defineComponent } from 'vue'
import { useNotificationStore } from '../../../../app/store/notification.store'
import template from './cmh-log-detail.html?raw'

export default defineComponent({
  name: 'cmh-log-detail',
  template,

  data() {
    const notificationStore = useNotificationStore()
    return {
      notificationStore,
      logEntry: null as Record<string, unknown> | null,
    }
  },

  created() {
    this.createdComponent()
  },

  methods: {
    createdComponent(): void {
      const id = this.$route.params.id as string
      if (!id) return

      const entry = this.notificationStore.notifications.find(n => n.id === id)
      if (entry) {
        this.logEntry = {
          id: entry.id,
          level: entry.variant,
          title: entry.title ?? '',
          message: entry.message ?? '',
          timestamp: entry.timestamp,
          visited: entry.visited,
        }
      }
    },

    onBack(): void {
      this.$router.push({ name: 'cmh.log.list' })
    },
  },
})
