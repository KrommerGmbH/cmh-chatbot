import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import { Criteria } from '@engine/data/criteria'
import { MixinFactory } from '@core/factory/mixin.factory'
import template from './cmh-provider-list.html?raw'
import './cmh-provider-list.scss'
import '@engine/data/entity/llm/llm-provider.definition'
import '@engine/data/entity/llm/llm-model.definition'

interface ProviderRecord extends Record<string, unknown> {
  id: string
  name: string
  description: string | null
  type: string
  apiKey: string | null
  baseUrl: string | null
  isActive: boolean
  priority: number
  createdAt: string
}

export default defineComponent({
  name: 'cmh-provider-list',
  template,

  mixins: [
    MixinFactory.getByName('notification'),
  ],

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    return {
      repositoryFactory,
      isLoading: false,
      providers: [] as ProviderRecord[],
      models: [] as Record<string, unknown>[],
      total: 0,
      page: 1,
      limit: 25,
      sortBy: 'priority',
      sortDirection: 'ASC',
      searchTerm: '',
    }
  },

  computed: {
    providerRepository() {
      return this.repositoryFactory.create('cmh_llm_provider')
    },

    modelRepository() {
      return this.repositoryFactory.create('cmh_llm_model')
    },

    providerCriteria(): Criteria {
      const criteria = new Criteria(this.page, this.limit)
      criteria.addSorting(Criteria.sort(this.sortBy, this.sortDirection))
      if (this.searchTerm) {
        criteria.addFilter(Criteria.contains('name', this.searchTerm))
      }
      return criteria
    },

    providerColumns() {
      return [
        {
          property: 'name',
          label: this.$t('cmh-provider.list.columns.name'),
          sortable: true,
          primary: true,
          routerLink: 'cmh.provider.detail',
        },
        {
          property: 'type',
          label: this.$t('cmh-provider.list.columns.type'),
          sortable: true,
        },
        {
          property: 'baseUrl',
          label: this.$t('cmh-provider.list.columns.baseUrl'),
          sortable: false,
        },
        {
          property: 'priority',
          label: this.$t('cmh-provider.list.columns.priority'),
          sortable: true,
          align: 'center' as const,
        },
        {
          property: 'modelCount',
          label: this.$t('cmh-provider.list.columns.modelCount'),
          sortable: false,
          align: 'center' as const,
        },
        {
          property: 'isActive',
          label: this.$t('cmh-provider.list.columns.status'),
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
      void this.getProviderList()
    },

    async getProviderList(): Promise<void> {
      this.isLoading = true
      try {
        const [providerResult, modelResult] = await Promise.all([
          this.providerRepository.search(this.providerCriteria),
          this.modelRepository.search(new Criteria()),
        ])
        this.providers = providerResult.data as ProviderRecord[]
        this.models = modelResult.data
        this.total = providerResult.total ?? providerResult.data.length
      } catch (err: any) {
        (this as any).createNotificationError({
          message: this.$t('cmh-provider.list.loadError') as string,
        })
        console.error('[cmh-provider-list] load error:', err)
      } finally {
        this.isLoading = false
      }
    },

    getModelCount(providerId: string): number {
      return this.models.filter((m: any) => m.providerId === providerId).length
    },

    onColumnSort(column: Record<string, unknown>, direction: string): void {
      this.sortBy = (column.property as string) ?? 'priority'
      this.sortDirection = direction || 'ASC'
      void this.getProviderList()
    },

    onPageChange({ page, limit }: { page: number; limit: number }): void {
      this.page = page
      if (limit) {
        this.limit = limit
      }
      void this.getProviderList()
    },

    onSearch(term: string): void {
      this.searchTerm = term
      this.page = 1
      void this.getProviderList()
    },

    onAdd(): void {
      const id = crypto.randomUUID()
      this.$router.push({ name: 'cmh.provider.detail', params: { id } })
    },
  },
})
