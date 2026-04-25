import { defineComponent, markRaw, type PropType } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { Connection } from '@vue-flow/core'
import { useAgentStore } from '../../../store/agent.store'
import { useChatStore } from '../../../store/chat.store'
import CmhAgentBlockNodeRaw from '../cmh-agent-block-node/index'

const CmhAgentBlockNode = markRaw(CmhAgentBlockNodeRaw)
import template from './cmh-agent-core.html?raw'
import './cmh-agent-core.scss'

/**
 * 에이전트 코어 컴포넌트 — Vue Flow 미니에디터 + 프롬프트 편집
 *
 * LangChain 블록을 노드로 배치하고, 엣지로 연결하여 LCEL 파이프라인을 구성한다.
 * 결과는 langchainConfig.nodes / langchainConfig.edges 에 저장된다.
 */

interface BlockDef {
  id: string
  label: string
  icon: string
  category: string
}

interface FlowNodeSerialized {
  id: string
  blockId: string
  position: { x: number; y: number }
}

interface FlowEdgeSerialized {
  id: string
  source: string
  target: string
}

interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, string>
}

interface FlowEdge {
  id: string
  source: string
  target: string
  animated?: boolean
}

let nodeCounter = 0

export default defineComponent({
  name: 'cmh-agent-core',
  template,
  components: { VueFlow, Background, CmhAgentBlockNode },

  props: {
    agent: {
      type: Object as PropType<Record<string, unknown>>,
      required: true,
    },
  },

  emits: ['update'],

  data() {
    return {
      /** LangChain 블록 팔레트 */
      blockPalette: [
        { id: 'messages', label: 'cmh-agent.core.block.messages', icon: '💬', category: 'core' },
        { id: 'tools', label: 'cmh-agent.core.block.tools', icon: '🔧', category: 'core' },
        { id: 'output-parsers', label: 'cmh-agent.core.block.outputParsers', icon: '📋', category: 'core' },
        { id: 'embeddings', label: 'cmh-agent.core.block.embeddings', icon: '🧮', category: 'rag' },
        { id: 'callbacks', label: 'cmh-agent.core.block.callbacks', icon: '📡', category: 'monitoring' },
        { id: 'tracing', label: 'cmh-agent.core.block.tracing', icon: '🔍', category: 'monitoring' },
      ] as BlockDef[],
      /** 팔레트 표시 여부 (모바일 토글) */
      showPalette: false,
      /** 드래그 중인 블록 ID */
      draggingBlockId: null as string | null,
      /** Vue Flow nodes */
      flowNodes: [] as FlowNode[],
      /** Vue Flow edges */
      flowEdges: [] as FlowEdge[],
    }
  },

  computed: {
    langchainConfig(): Record<string, unknown> {
      return (this.agent.langchainConfig as Record<string, unknown>) ?? {}
    },

    /** Vue Flow에 등록할 커스텀 노드 타입 매핑 */
    nodeTypes() {
      return markRaw({
        'agent-block': CmhAgentBlockNode,
      })
    },

    /** Agent types from store */
    agentTypes(): unknown[] {
      const store = useAgentStore()
      return store.activeAgentTypes
    },

    /** Active chat models from chat store */
    chatModels(): unknown[] {
      const store = useChatStore()
      return store.availableModels ?? []
    },

    /** Temperature from agent.parameters */
    temperatureValue(): number {
      const params = (this.agent.parameters as Record<string, unknown>) ?? {}
      return (params.temperature as number) ?? 0.7
    },

    /** Max tokens from agent.parameters */
    maxTokensValue(): number {
      const params = (this.agent.parameters as Record<string, unknown>) ?? {}
      return (params.maxTokens as number) ?? 2048
    },
  },

  watch: {
    agent: {
      handler() {
        this.syncFromConfig()
      },
      immediate: true,
      deep: true,
    },
  },

  methods: {
    /** langchainConfig → flowNodes / flowEdges 동기화 */
    syncFromConfig(): void {
      const config = this.langchainConfig
      const savedNodes = (config.nodes as FlowNodeSerialized[]) ?? []
      const savedEdges = (config.edges as FlowEdgeSerialized[]) ?? []

      this.flowNodes = savedNodes.map(n => {
        const block = this.blockPalette.find(b => b.id === n.blockId)
        return {
          id: n.id,
          type: 'agent-block',
          position: n.position,
          data: {
            blockId: n.blockId,
            label: block?.label ?? n.blockId,
            icon: block?.icon ?? '?',
            category: block?.category ?? 'core',
          },
        }
      })

      this.flowEdges = savedEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
      }))

      // nodeCounter 동기화
      const maxId = savedNodes.reduce((max, n) => {
        const num = parseInt(n.id.replace('ab-', ''), 10)
        return isNaN(num) ? max : Math.max(max, num)
      }, 0)
      nodeCounter = Math.max(nodeCounter, maxId)
    },

    /** flowNodes/flowEdges → langchainConfig 으로 emit */
    emitConfigUpdate(): void {
      const nodes: FlowNodeSerialized[] = this.flowNodes.map(n => ({
        id: n.id,
        blockId: (n.data as Record<string, string>).blockId,
        position: { x: n.position.x, y: n.position.y },
      }))

      const edges: FlowEdgeSerialized[] = this.flowEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }))

      // 기존 blocks 배열도 호환 유지
      const blocks = nodes.map(n => n.blockId)

      this.$emit('update', {
        langchainConfig: {
          ...this.langchainConfig,
          nodes,
          edges,
          blocks,
        },
      })
    },

    updateField(field: string, value: unknown): void {
      this.$emit('update', { [field]: value })
    },

    onInput(field: string, event: Event): void {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      this.updateField(field, target.value)
    },

    onTemperatureChange(event: Event): void {
      const val = parseFloat((event.target as HTMLInputElement).value)
      const params = { ...((this.agent.parameters as Record<string, unknown>) ?? {}), temperature: val }
      this.$emit('update', { parameters: params })
    },

    onMaxTokensChange(event: Event): void {
      const val = parseInt((event.target as HTMLInputElement).value, 10)
      if (isNaN(val)) return
      const params = { ...((this.agent.parameters as Record<string, unknown>) ?? {}), maxTokens: val }
      this.$emit('update', { parameters: params })
    },

    /* ── Palette Drag → Canvas Drop ── */
    onPaletteDragStart(blockId: string, event: DragEvent): void {
      this.draggingBlockId = blockId
      event.dataTransfer?.setData('application/cmh-block', blockId)
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy'
      }
    },

    onCanvasDragOver(event: DragEvent): void {
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    },

    onCanvasDrop(event: DragEvent): void {
      event.preventDefault()
      const blockId = event.dataTransfer?.getData('application/cmh-block') ?? this.draggingBlockId
      if (!blockId) return

      const block = this.blockPalette.find(b => b.id === blockId)
      if (!block) return

      // 캔버스 좌표 변환
      const canvasEl = (this.$refs.flowRef as any)?.$el as HTMLElement | undefined
      const rect = canvasEl?.getBoundingClientRect()
      const x = rect ? event.clientX - rect.left : 100
      const y = rect ? event.clientY - rect.top : 100

      nodeCounter++
      const nodeId = `ab-${nodeCounter}`

      this.flowNodes = [
        ...this.flowNodes,
        {
          id: nodeId,
          type: 'agent-block',
          position: { x, y },
          data: {
            blockId: block.id,
            label: block.label,
            icon: block.icon,
            category: block.category,
          },
        },
      ]

      this.draggingBlockId = null
      this.emitConfigUpdate()
    },

    /** 엣지 연결 */
    onConnect(connection: Connection): void {
      if (!connection.source || !connection.target) return
      const edgeId = `e-${connection.source}-${connection.target}`
      if (this.flowEdges.some(e => e.id === edgeId)) return

      this.flowEdges = [
        ...this.flowEdges,
        {
          id: edgeId,
          source: connection.source,
          target: connection.target,
          animated: true,
        },
      ]
      this.emitConfigUpdate()
    },

    /** 노드 위치 변경 */
    onNodeDragStop(): void {
      this.emitConfigUpdate()
    },

    /** 노드 삭제 (더블클릭) */
    onNodeDoubleClick(event: { node: FlowNode }): void {
      this.flowNodes = this.flowNodes.filter(n => n.id !== event.node.id)
      this.flowEdges = this.flowEdges.filter(e => e.source !== event.node.id && e.target !== event.node.id)
      this.emitConfigUpdate()
    },

    /** 엣지 클릭 삭제 */
    onEdgeClick(_event: MouseEvent, edge: FlowEdge): void {
      this.flowEdges = this.flowEdges.filter(e => e.id !== edge.id)
      this.emitConfigUpdate()
    },

    togglePalette(): void {
      this.showPalette = !this.showPalette
    },
  },
})
