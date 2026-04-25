import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import template from './cmh-agent-list.html?raw'
import './cmh-agent-list.scss'
import '@engine/data/entity/agent/agent.definition'
import '@engine/data/entity/agent/agent-type.definition'

interface AgentRecord extends Record<string, unknown> {
  id: string
  agentTypeId: string
  name: string
  status: string
  parentAgentId: string | null
  rolePrompt: string | null
  isActive: boolean
  isDeletable: boolean
  position: number
  icon: string | null
  color: string | null
  domain: string | null
  createdAt: string
}

/**
 * cmh-agent-list — 에이전트 목록 (계층 트리 뷰)
 */
export default defineComponent({
  name: 'cmh-agent-list',
  template,

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    return {
      isLoading: false,
      agents: [] as AgentRecord[],
      repositoryFactory,
      searchTerm: '',
      expandedNodes: new Set<string>(),
    }
  },

  computed: {
    /** 오케스트레이터 (최상위 에이전트) */
    orchestrator(): AgentRecord | null {
      return this.agents.find(a => !a.parentAgentId) ?? null
    },

    /** 검색 필터링된 에이전트 목록 */
    filteredAgents(): AgentRecord[] {
      if (!this.searchTerm) return this.agents
      const term = this.searchTerm.toLowerCase()
      return this.agents.filter(a =>
        a.name.toLowerCase().includes(term) ||
        (a.domain && a.domain.toLowerCase().includes(term)),
      )
    },

    /** 계층 트리: orchestrator → managers → sub-managers → workers */
    agentTree(): AgentRecord[] {
      if (this.searchTerm) return this.filteredAgents
      // 최상위 에이전트만 반환 (children은 template에서 재귀)
      return this.agents.filter(a => !a.parentAgentId).sort((a, b) => a.position - b.position)
    },
  },

  created() {
    void this.createdComponent()
  },

  methods: {
    async createdComponent(): Promise<void> {
      await this.loadAgents()
    },

    async loadAgents(): Promise<void> {
      this.isLoading = true
      try {
        const repository = this.repositoryFactory.create('cmh_agent')
        const result = await repository.search({ limit: 1000 })
        this.agents = result.data
        // 기본적으로 orchestrator 펼침
        if (this.orchestrator) {
          this.expandedNodes.add(this.orchestrator.id)
        }
      } finally {
        this.isLoading = false
      }
    },

    /** 특정 에이전트의 자식 목록 */
    getChildren(parentId: string): AgentRecord[] {
      return this.agents
        .filter(a => a.parentAgentId === parentId)
        .sort((a, b) => a.position - b.position)
    },

    /** 트리 노드 펼침/접기 */
    toggleExpand(id: string): void {
      if (this.expandedNodes.has(id)) {
        this.expandedNodes.delete(id)
      } else {
        this.expandedNodes.add(id)
      }
    },

    isExpanded(id: string): boolean {
      return this.expandedNodes.has(id)
    },

    hasChildren(id: string): boolean {
      return this.agents.some(a => a.parentAgentId === id)
    },

    /** 에이전트 상세 페이지로 이동 */
    openDetail(id: string): void {
      this.$router.push({ name: 'cmh.agent.detail', params: { id } })
    },

    /** 활성/비활성 토글 */
    async toggleActive(agent: AgentRecord): Promise<void> {
      const repository = this.repositoryFactory.create('cmh_agent')
      await repository.save({
        ...agent,
        isActive: !agent.isActive,
        updatedAt: new Date().toISOString(),
      })
      agent.isActive = !agent.isActive
    },

    /** 새 에이전트 생성 */
    async createAgent(parentId: string | null): Promise<void> {
      const id = crypto.randomUUID()
      const repository = this.repositoryFactory.create('cmh_agent')
      await repository.save({
        id,
        agentTypeId: '00000000-0000-4000-a000-000000000002', // manager type
        name: this.$t('cmh-agent.list.newAgent'),
        status: 'idle',
        parentAgentId: parentId,
        isActive: true,
        isDeletable: true,
        position: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await this.loadAgents()
      this.openDetail(id)
    },

    /** 에이전트 삭제 (isDeletable=true만) */
    async deleteAgent(agent: AgentRecord): Promise<void> {
      if (!agent.isDeletable) return
      const repository = this.repositoryFactory.create('cmh_agent')
      await repository.delete(agent.id)
      await this.loadAgents()
    },

    getStatusColor(status: string): string {
      const map: Record<string, string> = {
        idle: 'var(--color-text-secondary)',
        running: 'var(--color-success, #27AE60)',
        paused: 'var(--color-warning, #F39C12)',
        error: 'var(--color-danger, #E74C3C)',
        terminated: 'var(--color-text-disabled)',
      }
      return map[status] ?? 'var(--color-text-secondary)'
    },
  },
})
