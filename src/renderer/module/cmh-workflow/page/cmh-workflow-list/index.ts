import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import template from './cmh-workflow-list.html?raw'
import './cmh-workflow-list.scss'
import '@engine/data/entity/agent/agent.definition'

interface WorkflowRecord {
  id: string
  name: string
  description: string | null
  isActive: boolean
  agentCount: number
}

export default defineComponent({
  name: 'cmh-workflow-list',
  template,

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    return {
      isLoading: false,
      workflows: [] as WorkflowRecord[],
      repositoryFactory,
    }
  },

  created() {
    void this.createdComponent()
  },

  methods: {
    async createdComponent(): Promise<void> {
      await this.loadData()
    },

    async loadData(): Promise<void> {
      this.isLoading = true
      try {
        const agentRepo = this.repositoryFactory.create('cmh_agent')
        const result = await agentRepo.search({ limit: 500 })
        // Agents with parentId = null are top-level "workflows"
        const topLevel = result.data.filter((a: any) => !a.parentId)
        const allAgents = result.data
        this.workflows = topLevel.map((a: any) => ({
          id: a.id,
          name: a.name || 'Unnamed Workflow',
          description: a.description || null,
          isActive: a.isActive ?? true,
          agentCount: allAgents.filter((c: any) => c.parentId === a.id).length,
        }))
      } finally {
        this.isLoading = false
      }
    },

    openDetail(id: string): void {
      this.$router.push({ name: 'cmh.workflow.detail', params: { id } })
    },

    onAdd(): void {
      const id = crypto.randomUUID()
      this.$router.push({ name: 'cmh.workflow.detail', params: { id } })
    },
  },
})
