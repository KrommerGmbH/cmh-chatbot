import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import { Criteria } from '@engine/data/criteria'
import { MixinFactory } from '@core/factory/mixin.factory'
import { loadModelsFromDAL } from '../../../../app/service/llm-model.service'
import template from './cmh-model-list.html?raw'
import './cmh-model-list.scss'
import '@engine/data/entity/llm/llm-model.definition'
import '@engine/data/entity/llm/llm-provider.definition'

interface ModelRecord extends Record<string, unknown> {
  id: string
  name: string
  description: string | null
  providerId: string
  modelId: string
  contextLength: number
  isActive: boolean
  isDefault: boolean
}

interface ProviderRecord extends Record<string, unknown> {
  id: string
  name: string
}

export default defineComponent({
  name: 'cmh-model-list',
  template,

  mixins: [
    MixinFactory.getByName('notification'),
  ],

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    return {
      repositoryFactory,
      isLoading: false,
      models: [] as ModelRecord[],
      providers: [] as ProviderRecord[],
      total: 0,
      page: 1,
      limit: 25,
      sortBy: 'name',
      sortDirection: 'ASC',
      searchTerm: '',
      filterProvider: '',
    }
  },

  computed: {
    modelRepository() {
      return this.repositoryFactory.create('cmh_llm_model')
    },

    providerRepository() {
      return this.repositoryFactory.create('cmh_llm_provider')
    },

    modelCriteria(): Criteria {
      const criteria = new Criteria(this.page, this.limit)
      criteria.addSorting(Criteria.sort(this.sortBy, this.sortDirection))

      if (this.searchTerm) {
        criteria.addFilter(Criteria.contains('name', this.searchTerm))
      }
      if (this.filterProvider) {
        criteria.addFilter(Criteria.equals('providerId', this.filterProvider))
      }

      return criteria
    },

    modelColumns() {
      return [
        {
          property: 'name',
          label: this.$t('cmh-model.list.columns.name'),
          sortable: true,
          primary: true,
          routerLink: 'cmh.model.detail',
        },
        {
          property: 'modelId',
          label: this.$t('cmh-model.list.columns.modelId'),
          sortable: true,
        },
        {
          property: 'providerId',
          label: this.$t('cmh-model.list.columns.provider'),
          sortable: true,
        },
        {
          property: 'contextLength',
          label: this.$t('cmh-model.list.columns.contextLength'),
          sortable: true,
          align: 'right' as const,
        },
        {
          property: 'isActive',
          label: this.$t('cmh-model.list.columns.status'),
          sortable: true,
          align: 'center' as const,
        },
        {
          property: 'isDefault',
          label: this.$t('cmh-model.list.columns.default'),
          sortable: true,
          align: 'center' as const,
        },
      ]
    },
  },

  created() {
    this.createdComponent()
  },

  methods: {
    createdComponent(): void {
      void this.loadProviders()
      void this.getModelList()
    },

    async onSyncRemote(): Promise<void> {
      this.isLoading = true
      try {
        await loadModelsFromDAL()
        await this.loadProviders()
        await this.getModelList()
        this.createNotificationSuccess({
          message: this.$t('cmh-model.list.syncRemoteSuccess') as string,
        })
      } catch (err) {
        this.createNotificationError({
          message: this.$t('cmh-model.list.syncRemoteError') as string,
        })
      } finally {
        this.isLoading = false
      }
    },

    async loadProviders(): Promise<void> {
      try {
        const result = await this.providerRepository.search(new Criteria(1, 500))
        this.providers = result.data as ProviderRecord[]
      } catch (err) {
        this.createNotificationError({
          message: this.$t('cmh-model.list.loadError') as string,
        })
      }
    },

    async getModelList(): Promise<void> {
      this.isLoading = true
      try {
        const result = await this.modelRepository.search(this.modelCriteria)
        const rows = result.data as ModelRecord[]
        const unique = new Map<string, ModelRecord>()
        for (const row of rows) {
          const providerId = String(row.providerId ?? '')
          const modelId = String(row.modelId ?? '')
          const fallbackId = String(row.id ?? '')
          const dedupeKey = providerId && modelId ? `${providerId}::${modelId}` : fallbackId
          if (!unique.has(dedupeKey)) {
            unique.set(dedupeKey, row)
          }
        }

        this.models = [...unique.values()]
        this.total = result.total ?? this.models.length
      } catch (err) {
        this.createNotificationError({
          message: this.$t('cmh-model.list.loadError') as string,
        })
      } finally {
        this.isLoading = false
      }
    },

    getProviderName(providerId: string): string {
      const p = this.providers.find(pr => pr.id === providerId)
      return p ? p.name : providerId
    },

    formatContextLength(tokens: number): string {
      if (!tokens) return '—'
      if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`
      if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`
      return String(tokens)
    },

    onSearch(term: string): void {
      this.searchTerm = term
      this.page = 1
      void this.getModelList()
    },

    onFilterProvider(providerId: string): void {
      this.filterProvider = providerId
      this.page = 1
      void this.getModelList()
    },

    onColumnSort(column: Record<string, unknown>, direction: string): void {
      this.sortBy = (column.property as string) ?? 'name'
      this.sortDirection = direction
      void this.getModelList()
    },

    onPageChange({ page, limit }: { page: number; limit: number }): void {
      this.page = page
      this.limit = limit
      void this.getModelList()
    },

    onAdd(): void {
      const id = crypto.randomUUID()
      this.$router.push({ name: 'cmh.model.detail', params: { id } })
    },
  },
})
