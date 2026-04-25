import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import template from './cmh-model-detail.html?raw'
import './cmh-model-detail.scss'
import '@engine/data/entity/llm/llm-model.definition'
import '@engine/data/entity/llm/llm-provider.definition'

export default defineComponent({
  name: 'cmh-model-detail',
  template,

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    return {
      isLoading: false,
      isSaving: false,
      model: {
        id: '',
        name: '',
        description: '',
        providerId: '',
        modelId: '',
        contextLength: 4096,
        isActive: true,
        isDefault: false,
      },
      providers: [] as Array<{ id: string; name: string }>,
      repositoryFactory,
    }
  },

  created() {
    void this.createdComponent()
  },

  methods: {
    async createdComponent(): Promise<void> {
      const id = this.$route.params.id as string
      await this.loadProviders()
      if (id) {
        await this.loadModel(id)
      }
    },

    async loadProviders(): Promise<void> {
      const repo = this.repositoryFactory.create('cmh_llm_provider')
      const result = await repo.search({ limit: 500 })
      this.providers = result.data as Array<{ id: string; name: string }>
    },

    async loadModel(id: string): Promise<void> {
      this.isLoading = true
      try {
        const repo = this.repositoryFactory.create('cmh_llm_model')
        const result = await repo.search({ limit: 500 })
        const found = result.data.find((m: any) => m.id === id)
        if (found) {
          Object.assign(this.model, found)
        } else {
          this.model.id = id
        }
      } finally {
        this.isLoading = false
      }
    },

    async onSave(): Promise<void> {
      this.isSaving = true
      try {
        const repo = this.repositoryFactory.create('cmh_llm_model')

        // 기본 모델 단일 보장: isDefault=true 설정 시 다른 모델의 isDefault를 false로
        if (this.model.isDefault) {
          const allResult = await repo.search({ limit: 500 })
          for (const m of allResult.data as Array<{ id: string; isDefault: boolean }>) {
            if (m.id !== this.model.id && m.isDefault) {
              await repo.save({ ...m, isDefault: false })
            }
          }
        }

        await repo.upsert([{ ...this.model }])
        this.$router.back()
      } finally {
        this.isSaving = false
      }
    },
  },
})
