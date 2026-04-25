/**
 * cmh-workflow-detail — Vue Flow 워크플로우 에디터
 *
 * Phase 6.1: 3패널 레이아웃 (palette + canvas + settings)
 * Phase 6.3: 사이드바 블록 팔레트 (드래그 앤 드롭)
 * Phase 6.4: Settings Panel (노드 CRUD)
 */
import { defineComponent } from 'vue'
import { VueFlow, Panel } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/controls/dist/style.css'
import { Background } from '@vue-flow/background'
import type { Connection } from '@vue-flow/core'
import { useWorkflowStore } from '../../../../app/store/workflow.store'
import type { WorkflowNodeData, WorkflowNodeDef, WorkflowEdgeDef } from '../../../../app/store/workflow.store'
import type { NodeMetrics, ToolCallRecord, ExecutionSnapshot } from '../../../../../engine/langchain/monitoring/stream-event-monitor.js'
import template from './cmh-workflow-detail.html?raw'
import './cmh-workflow-detail.scss'

// ── 블록 팔레트 정의 (PLAN §15.2) ──

interface PaletteBlock {
  type: string
  blockType: WorkflowNodeData['blockType']
  label: string
  icon: string
  category: string
}

const PALETTE_BLOCKS: PaletteBlock[] = [
  // Agents
  { type: 'supervisor', blockType: 'agent', label: 'Supervisor', icon: 'ph:crown', category: 'agents' },
  { type: 'manager', blockType: 'agent', label: 'Manager', icon: 'ph:users-three', category: 'agents' },
  { type: 'worker', blockType: 'agent', label: 'Worker', icon: 'ph:hammer', category: 'agents' },
  { type: 'profiler', blockType: 'agent', label: 'Profiler', icon: 'ph:brain', category: 'agents' },
  { type: 'supporter', blockType: 'agent', label: 'Supporter', icon: 'ph:magnifying-glass', category: 'agents' },
  // Tools
  { type: 'tool', blockType: 'tool', label: 'Tool', icon: 'ph:wrench', category: 'langchain' },
  { type: 'output-parser', blockType: 'tool', label: 'Output Parser', icon: 'ph:funnel', category: 'langchain' },
  { type: 'embeddings', blockType: 'tool', label: 'Embeddings', icon: 'ph:vector-three', category: 'langchain' },
  { type: 'callbacks', blockType: 'tool', label: 'Callbacks', icon: 'ph:bell', category: 'langchain' },
  // MCP
  { type: 'mcp-server', blockType: 'mcp', label: 'MCP Server', icon: 'ph:plug', category: 'mcp' },
  // Control
  { type: 'condition', blockType: 'control', label: 'Condition', icon: 'ph:git-branch', category: 'control' },
  { type: 'loop', blockType: 'control', label: 'Loop', icon: 'ph:arrows-clockwise', category: 'control' },
  { type: 'hitl-gate', blockType: 'control', label: 'HITL Gate', icon: 'ph:hand-palm', category: 'control' },
  { type: 'input', blockType: 'control', label: 'Input', icon: 'ph:sign-in', category: 'control' },
  { type: 'output', blockType: 'control', label: 'Output', icon: 'ph:sign-out', category: 'control' },
  // Transform
  { type: 'data-transform', blockType: 'transform', label: 'Data Transform', icon: 'ph:shuffle', category: 'transform' },
  { type: 'text-splitter', blockType: 'transform', label: 'Text Splitter', icon: 'ph:scissors', category: 'transform' },
  { type: 'merger', blockType: 'transform', label: 'Merger', icon: 'ph:git-merge', category: 'transform' },
]

const PALETTE_CATEGORIES = [
  { key: 'agents', label: 'cmh-workflow.detail.palette.agents', icon: 'ph:robot' },
  { key: 'langchain', label: 'cmh-workflow.detail.palette.langchain', icon: 'ph:link' },
  { key: 'mcp', label: 'cmh-workflow.detail.palette.mcp', icon: 'ph:plug' },
  { key: 'control', label: 'cmh-workflow.detail.palette.control', icon: 'ph:gear' },
  { key: 'transform', label: 'cmh-workflow.detail.palette.transform', icon: 'ph:shuffle' },
]

export default defineComponent({
  name: 'cmh-workflow-detail',
  template,
  components: { VueFlow, Panel, Controls, Background },

  data() {
    return {
      isLoading: false,
      paletteCategories: PALETTE_CATEGORIES,
      paletteBlocks: PALETTE_BLOCKS,
      collapsedCategories: {} as Record<string, boolean>,
      // Settings panel
      editingNodeData: null as WorkflowNodeData | null,
      // ── Monitoring (Phase 10) ──
      showMonitoringPanel: false,
      nodeMetrics: new Map<string, NodeMetrics>(),
      toolCallHistory: [] as ToolCallRecord[],
      executionSnapshots: [] as ExecutionSnapshot[],
      selectedSnapshotIndex: -1,
      isExecuting: false,
    }
  },

  computed: {
    workflowStore() {
      return useWorkflowStore()
    },

    nodes() {
      return this.workflowStore.currentNodes
    },

    edges() {
      return this.workflowStore.currentEdges
    },

    selectedNode() {
      return this.workflowStore.selectedNode
    },

    showSettingsPanel(): boolean {
      return this.selectedNode !== null
    },

    workflowName(): string {
      return this.workflowStore.currentWorkflow?.name ?? ''
    },

    isDirty(): boolean {
      return this.workflowStore.isDirty
    },
  },

  created() {
    this.createdComponent()
  },

  methods: {
    createdComponent(): void {
      const id = this.$route?.params?.id as string | undefined
      if (id && id !== 'create') {
        this.workflowStore.loadWorkflow(id)
      } else {
        this.workflowStore.createWorkflow(this.$t('cmh-workflow.detail.newWorkflow'))
      }
    },

    // ── Palette DnD ──
    getBlocksByCategory(categoryKey: string): PaletteBlock[] {
      return this.paletteBlocks.filter((b) => b.category === categoryKey)
    },

    toggleCategory(key: string): void {
      this.collapsedCategories[key] = !this.collapsedCategories[key]
    },

    isCategoryCollapsed(key: string): boolean {
      return !!this.collapsedCategories[key]
    },

    onDragStart(event: DragEvent, block: PaletteBlock): void {
      if (!event.dataTransfer) return
      event.dataTransfer.setData('application/cmh-workflow-block', JSON.stringify(block))
      event.dataTransfer.effectAllowed = 'move'
    },

    onDragOver(event: DragEvent): void {
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
    },

    onDrop(event: DragEvent): void {
      event.preventDefault()
      const raw = event.dataTransfer?.getData('application/cmh-workflow-block')
      if (!raw) return

      const block = JSON.parse(raw) as PaletteBlock

      // VueFlow 캔버스 좌표로 변환
      const canvasEl = (this.$refs.vueFlowRef as any)?.$el as HTMLElement | undefined
      const bounds = canvasEl?.getBoundingClientRect()
      const x = bounds ? event.clientX - bounds.left : event.clientX
      const y = bounds ? event.clientY - bounds.top : event.clientY

      const nodeDef: WorkflowNodeDef = {
        id: crypto.randomUUID(),
        type: 'cmh-workflow-node',
        position: { x, y },
        data: {
          blockType: block.blockType,
          label: block.label,
          icon: block.icon,
          agentTypeId: block.type,
          status: 'idle',
        },
      }
      this.workflowStore.addNode(nodeDef)
    },

    // ── Vue Flow 이벤트 ──
    onNodeClick(_event: MouseEvent, node: { id: string }): void {
      this.workflowStore.selectNode(node.id)
      if (this.selectedNode) {
        this.editingNodeData = { ...this.selectedNode.data }
      }
    },

    onPaneClick(): void {
      this.workflowStore.selectNode(null)
      this.editingNodeData = null
    },

    onConnect(connection: Connection): void {
      const edgeDef: WorkflowEdgeDef = {
        id: crypto.randomUUID(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'default',
      }
      this.workflowStore.addEdge(edgeDef)
    },

    onNodeDragStop(_event: MouseEvent, node: { id: string; position: { x: number; y: number } }): void {
      this.workflowStore.updateNodePosition(node.id, node.position)
    },

    // ── Settings Panel ──
    saveNodeSettings(): void {
      if (!this.selectedNode || !this.editingNodeData) return
      this.workflowStore.updateNodeData(this.selectedNode.id, this.editingNodeData)
      this.editingNodeData = null
      this.workflowStore.selectNode(null)
    },

    cancelNodeSettings(): void {
      this.editingNodeData = null
      this.workflowStore.selectNode(null)
    },

    deleteSelectedNode(): void {
      if (!this.selectedNode) return
      this.workflowStore.removeNode(this.selectedNode.id)
      this.editingNodeData = null
    },

    // ── Toolbar ──
    saveWorkflow(): void {
      this.workflowStore.save()
    },

    exportWorkflow(): void {
      const wf = this.workflowStore.currentWorkflow
      if (!wf) return
      const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${wf.name}.workflow.json`
      a.click()
      URL.revokeObjectURL(url)
    },

    // ── Monitoring (Phase 10) ──

    toggleMonitoring(): void {
      this.showMonitoringPanel = !this.showMonitoringPanel
    },

    /** streamEvents 소비 시작 (외부에서 호출) */
    onMonitorNodeUpdate(nodeId: string, status: string, metrics: NodeMetrics): void {
      this.nodeMetrics.set(nodeId, metrics)
    },

    onMonitorToolCall(record: ToolCallRecord): void {
      this.toolCallHistory.push(record)
    },

    onMonitorSnapshot(snapshot: ExecutionSnapshot): void {
      this.executionSnapshots.push(snapshot)
    },

    /** 노드 메트릭 조회 */
    getNodeMetrics(nodeId: string): NodeMetrics | undefined {
      return this.nodeMetrics.get(nodeId)
    },

    /** 실행 시간 포맷 */
    formatDuration(ms?: number): string {
      if (ms == null) return '-'
      if (ms < 1000) return `${ms}ms`
      return `${(ms / 1000).toFixed(1)}s`
    },

    /** 토큰 수 포맷 */
    formatTokens(n?: number): string {
      if (n == null) return '-'
      return n.toLocaleString()
    },

    /** Time-travel: 스냅샷 선택 */
    selectSnapshot(index: number): void {
      this.selectedSnapshotIndex = index
      const snapshot = this.executionSnapshots[index]
      if (!snapshot) return
      for (const [nodeId, status] of snapshot.nodeStates) {
        this.workflowStore.updateNodeData(nodeId, { status })
      }
    },

    /** 도구 호출 이력 초기화 */
    clearToolHistory(): void {
      this.toolCallHistory = []
    },
  },
})

