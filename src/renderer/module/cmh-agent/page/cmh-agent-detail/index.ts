import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import template from './cmh-agent-detail.html?raw'
import './cmh-agent-detail.scss'
import '@engine/data/entity/agent/agent.definition'
import '@engine/data/entity/agent/agent-type.definition'

/**
 * cmh-agent-detail — 에이전트 상세/편집 페이지
 * Agent Core Component(cmh-agent-core)를 호스팅하고 저장/취소 처리
 */
export default defineComponent({
  name: 'cmh-agent-detail',
  template,

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    return {
      isLoading: false,
      isSaving: false,
      agent: null as Record<string, unknown> | null,
      repositoryFactory,
    }
  },

  computed: {
    agentId(): string {
      return this.$route.params.id as string
    },
  },

  watch: {
    agentId: {
      handler() {
        void this.loadAgent()
      },
      immediate: false,
    },
  },

  created() {
    void this.createdComponent()
  },

  methods: {
    async createdComponent(): Promise<void> {
      await this.loadAgent()
    },

    async loadAgent(): Promise<void> {
      if (!this.agentId) return
      this.isLoading = true
      try {
        const repository = this.repositoryFactory.create('cmh_agent')
        const result = await repository.search({ limit: 1000 })
        this.agent = result.data.find((a: Record<string, unknown>) => a.id === this.agentId) ?? null
      } finally {
        this.isLoading = false
      }
    },

    onAgentUpdate(updated: Record<string, unknown>): void {
      this.agent = { ...this.agent, ...updated }
    },

    async onSave(): Promise<void> {
      if (!this.agent) return
      this.isSaving = true
      try {
        const repository = this.repositoryFactory.create('cmh_agent')
        await repository.save({
          ...this.agent,
          updatedAt: new Date().toISOString(),
        })
        this.$router.push({ name: 'cmh.agent.list' })
      } finally {
        this.isSaving = false
      }
    },

    onCancel(): void {
      this.$router.push({ name: 'cmh.agent.list' })
    },
  },
})
