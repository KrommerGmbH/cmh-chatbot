/**
 * Workflow Store — Pinia Composition Store
 *
 * Phase 6.5: Vue Flow 워크플로우 JSON 저장/로드.
 * WorkflowDef를 Repository(DAL)로 영속화하고 Vue Flow 상태와 동기화한다.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Node, Edge } from '@vue-flow/core'

// ── Workflow JSON 스키마 (PLAN §15.6 기반) ───────────

export interface WorkflowNodeData {
  blockType: 'agent' | 'tool' | 'mcp' | 'control' | 'transform'
  label: string
  icon: string
  agentTypeId?: string
  agentId?: string
  modelId?: string
  subModelId?: string
  rolePrompt?: string
  missionPrompt?: string
  userPrompt?: string
  tools?: string[]
  callbacks?: string[]
  outputParser?: string
  mcpServerId?: string
  conditionExpression?: string
  loopMaxIterations?: number
  status?: 'idle' | 'running' | 'success' | 'error'
}

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  version: number
  nodes: WorkflowNodeDef[]
  edges: WorkflowEdgeDef[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

export interface WorkflowNodeDef {
  id: string
  type: string
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdgeDef {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type: 'default' | 'step' | 'smoothstep'
  label?: string
  animated?: boolean
}

// ── Store ──────────────────────────────────────────────

export const useWorkflowStore = defineStore('workflow', () => {
  // ── State ──
  const workflows = ref<WorkflowDefinition[]>([])
  const currentWorkflowId = ref<string | null>(null)
  const isDirty = ref(false)
  const selectedNodeId = ref<string | null>(null)

  // ── Getters ──
  const currentWorkflow = computed(() =>
    workflows.value.find((w) => w.id === currentWorkflowId.value) ?? null,
  )

  const currentNodes = computed<Node[]>(() => {
    const wf = currentWorkflow.value
    if (!wf) return []
    return wf.nodes.map((n) => ({
      id: n.id,
      type: 'cmh-workflow-node',
      position: n.position,
      data: n.data,
    }))
  })

  const currentEdges = computed<Edge[]>(() => {
    const wf = currentWorkflow.value
    if (!wf) return []
    return wf.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
      label: e.label,
      animated: e.animated,
    }))
  })

  const selectedNode = computed(() => {
    const wf = currentWorkflow.value
    if (!wf || !selectedNodeId.value) return null
    return wf.nodes.find((n) => n.id === selectedNodeId.value) ?? null
  })

  // ── Actions ──

  function createWorkflow(name: string, description?: string): WorkflowDefinition {
    const now = new Date().toISOString()
    const wf: WorkflowDefinition = {
      id: crypto.randomUUID(),
      name,
      description,
      version: 1,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: now,
      updatedAt: now,
    }
    workflows.value.push(wf)
    currentWorkflowId.value = wf.id
    isDirty.value = true
    return wf
  }

  function loadWorkflow(id: string): void {
    currentWorkflowId.value = id
    selectedNodeId.value = null
  }

  function deleteWorkflow(id: string): void {
    workflows.value = workflows.value.filter((w) => w.id !== id)
    if (currentWorkflowId.value === id) {
      currentWorkflowId.value = null
    }
  }

  function addNode(nodeDef: WorkflowNodeDef): void {
    const wf = currentWorkflow.value
    if (!wf) return
    wf.nodes.push(nodeDef)
    isDirty.value = true
  }

  function updateNodeData(nodeId: string, data: Partial<WorkflowNodeData>): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (node) {
      Object.assign(node.data, data)
      isDirty.value = true
    }
  }

  function updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (node) {
      node.position = position
      isDirty.value = true
    }
  }

  function removeNode(nodeId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    wf.nodes = wf.nodes.filter((n) => n.id !== nodeId)
    wf.edges = wf.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
    if (selectedNodeId.value === nodeId) selectedNodeId.value = null
    isDirty.value = true
  }

  function addEdge(edgeDef: WorkflowEdgeDef): void {
    const wf = currentWorkflow.value
    if (!wf) return
    // 중복 방지
    const exists = wf.edges.some((e) => e.source === edgeDef.source && e.target === edgeDef.target)
    if (!exists) {
      wf.edges.push(edgeDef)
      isDirty.value = true
    }
  }

  function removeEdge(edgeId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    wf.edges = wf.edges.filter((e) => e.id !== edgeId)
    isDirty.value = true
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  function updateViewport(viewport: { x: number; y: number; zoom: number }): void {
    const wf = currentWorkflow.value
    if (!wf) return
    wf.viewport = viewport
  }

  function save(): void {
    const wf = currentWorkflow.value
    if (!wf) return
    wf.version += 1
    wf.updatedAt = new Date().toISOString()
    isDirty.value = false
    // TODO: Phase 10에서 Repository DAL 영속화 연동
  }

  /**
   * WorkflowDefinition → engine의 WorkflowDef 변환 (LangGraph 실행용)
   */
  function toEngineWorkflowDef() {
    const wf = currentWorkflow.value
    if (!wf) return null

    const agentTypeMap: Record<string, string> = {
      supervisor: 'supervisor',
      manager: 'manager',
      worker: 'worker',
      profiler: 'profiler',
      supporter: 'supporter',
    }

    return {
      id: wf.id,
      name: wf.name,
      nodes: wf.nodes
        .filter((n) => n.data.blockType === 'agent' || n.data.blockType === 'control')
        .map((n) => ({
          id: n.id,
          type: agentTypeMap[n.data.agentTypeId ?? ''] ?? 'custom',
          ends: wf.edges.filter((e) => e.source === n.id).map((e) => e.target),
        })),
      edges: wf.edges.map((e) => ({
        source: e.source,
        target: e.target,
        condition: e.label,
      })),
      entryNode: wf.nodes[0]?.id ?? '',
    }
  }

  return {
    // state
    workflows,
    currentWorkflowId,
    isDirty,
    selectedNodeId,
    // getters
    currentWorkflow,
    currentNodes,
    currentEdges,
    selectedNode,
    // actions
    createWorkflow,
    loadWorkflow,
    deleteWorkflow,
    addNode,
    updateNodeData,
    updateNodePosition,
    removeNode,
    addEdge,
    removeEdge,
    selectNode,
    updateViewport,
    save,
    toEngineWorkflowDef,
  }
})
