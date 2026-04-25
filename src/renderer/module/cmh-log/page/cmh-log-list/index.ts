import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import { useNotificationStore } from '../../../../app/store/notification.store'
import { Criteria } from '@engine/data/criteria'
import template from './cmh-log-list.html?raw'
import './cmh-log-list.scss'

interface LogEntry extends Record<string, unknown> {
  id: string
  level: 'info' | 'warning' | 'error' | 'debug'
  source: string
  message: string
  context: Record<string, unknown> | null
  createdAt: string
}

export default defineComponent({
  name: 'cmh-log-list',
  template,

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    const notificationStore = useNotificationStore()
    return {
      repositoryFactory,
      notificationStore,
      isLoading: false,
      logs: [] as LogEntry[],
      total: 0,
      page: 1,
      limit: 50,
      sortBy: 'createdAt',
      sortDirection: 'DESC',
      filterLevel: '',
      searchTerm: '',
    }
  },

  computed: {
    logColumns() {
      return [
        {
          property: 'level',
          label: this.$t('cmh-log.list.columns.level'),
          sortable: true,
          width: '100px',
        },
        {
          property: 'source',
          label: this.$t('cmh-log.list.columns.source'),
          sortable: true,
          width: '180px',
        },
        {
          property: 'message',
          label: this.$t('cmh-log.list.columns.message'),
          sortable: false,
          primary: true,
          routerLink: 'cmh.log.detail',
        },
        {
          property: 'createdAt',
          label: this.$t('cmh-log.list.columns.createdAt'),
          sortable: true,
          width: '180px',
        },
      ]
    },

    filteredLogs(): LogEntry[] {
      let result = this.logs
      if (this.filterLevel) {
        result = result.filter(l => l.level === this.filterLevel)
      }
      if (this.searchTerm) {
        const q = this.searchTerm.toLowerCase()
        result = result.filter(l =>
          l.message.toLowerCase().includes(q)
          || l.source.toLowerCase().includes(q),
        )
      }
      return result
    },
  },

  created() {
    this.createdComponent()
  },

  methods: {
    createdComponent(): void {
      void this.loadLogs()
    },

    async loadLogs(): Promise<void> {
      this.isLoading = true
      try {
        // notification store에서 히스토리를 로그로 활용
        const store = this.notificationStore
        this.logs = store.notifications.map((n): LogEntry => ({
          id: n.id,
          level: (n.variant === 'error' ? 'error'
            : n.variant === 'warning' ? 'warning'
            : 'info') as LogEntry['level'],
          source: 'notification',
          message: `${n.title ?? ''} ${n.message ?? ''}`.trim(),
          context: null,
          createdAt: n.timestamp instanceof Date ? n.timestamp.toISOString() : String(n.timestamp),
        })).reverse()
        this.total = this.logs.length
      } finally {
        this.isLoading = false
      }
    },

    getLevelClass(level: string): string {
      return `cmh-log-list__level is--${level}`
    },

    formatDate(iso: string): string {
      if (!iso) return '—'
      const d = new Date(iso)
      return d.toLocaleString()
    },

    onColumnSort(column: Record<string, unknown>, direction: string): void {
      this.sortBy = (column.property as string) ?? 'createdAt'
      this.sortDirection = direction
    },

    onPageChange({ page, limit }: { page: number; limit: number }): void {
      this.page = page
      this.limit = limit
    },

    onFilterLevel(level: string): void {
      this.filterLevel = level
    },

    onClearAll(): void {
      this.notificationStore.clearAll()
      this.logs = []
      this.total = 0
    },

    openDetail(id: string): void {
      this.$router.push({ name: 'cmh.log.detail', params: { id } })
    },
  },
})
