/**
 * Stream Event Monitor — LangGraph streamEvents → Vue Flow 노드 상태 실시간 연동
 *
 * Phase 10.1: CompiledGraph.streamEvents() 출력을 파싱하여
 * WorkflowStore 노드 상태(running/success/error)와 성능 메트릭을 업데이트.
 */

// ── Store adapter interface (decoupled from renderer) ──

export interface WorkflowStoreAdapter {
  updateNodeData(nodeId: string, data: Record<string, unknown>): void
}

// ── Event 타입 (LangGraph streamEvents v2 스키마) ──

export interface StreamEvent {
  event: string
  name: string
  run_id: string
  parent_ids?: string[]
  tags?: string[]
  metadata?: Record<string, unknown>
  data: Record<string, unknown>
}

// ── 노드 실행 메트릭 ──

export interface NodeMetrics {
  nodeId: string
  startTime: number
  endTime?: number
  duration?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  toolCalls: ToolCallRecord[]
  status: 'running' | 'success' | 'error'
  error?: string
}

export interface ToolCallRecord {
  toolName: string
  input: unknown
  output?: unknown
  startTime: number
  endTime?: number
  duration?: number
  error?: string
}

// ── 실행 스냅샷 (time-travel용) ──

export interface ExecutionSnapshot {
  timestamp: number
  nodeStates: Map<string, 'idle' | 'running' | 'success' | 'error'>
  metrics: Map<string, NodeMetrics>
}

/**
 * StreamEventMonitor — streamEvents 이터레이터를 소비하여 UI 상태를 업데이트
 */
export class StreamEventMonitor {
  /** nodeId → metrics */
  private metricsMap = new Map<string, NodeMetrics>()

  /** runId → nodeId 매핑 (LangGraph 내부 run_id ↔ 워크플로우 노드 ID) */
  private runIdToNodeId = new Map<string, string>()

  /** 실행 히스토리 (time-travel) */
  private snapshots: ExecutionSnapshot[] = []

  /** 현재 도구 호출 추적: runId → ToolCallRecord */
  private activeToolCalls = new Map<string, ToolCallRecord>()

  /** Workflow store adapter (optional, 직접 연결 시) */
  private store: WorkflowStoreAdapter | null = null

  /** 외부 콜백 */
  private onNodeUpdate?: (nodeId: string, status: string, metrics: NodeMetrics) => void
  private onToolCall?: (record: ToolCallRecord) => void
  private onSnapshot?: (snapshot: ExecutionSnapshot) => void

  constructor(options?: {
    store?: WorkflowStoreAdapter
    onNodeUpdate?: (nodeId: string, status: string, metrics: NodeMetrics) => void
    onToolCall?: (record: ToolCallRecord) => void
    onSnapshot?: (snapshot: ExecutionSnapshot) => void
  }) {
    this.store = options?.store ?? null
    this.onNodeUpdate = options?.onNodeUpdate
    this.onToolCall = options?.onToolCall
    this.onSnapshot = options?.onSnapshot
  }

  /**
   * streamEvents AsyncIterator를 소비하며 실시간 상태 업데이트
   */
  async consume(eventStream: AsyncIterable<StreamEvent>): Promise<Map<string, NodeMetrics>> {
    this.reset()

    for await (const event of eventStream) {
      this.processEvent(event)
    }

    // 최종 스냅샷
    this.captureSnapshot()
    return this.metricsMap
  }

  /** 단일 이벤트 처리 */
  processEvent(event: StreamEvent): void {
    const { event: eventType, name, run_id, data } = event

    switch (eventType) {
      case 'on_chain_start':
        this.handleNodeStart(name, run_id)
        break

      case 'on_chain_end':
        this.handleNodeEnd(name, run_id, data)
        break

      case 'on_chain_error':
        this.handleNodeError(name, run_id, data)
        break

      case 'on_tool_start':
        this.handleToolStart(name, run_id, data)
        break

      case 'on_tool_end':
        this.handleToolEnd(name, run_id, data)
        break

      case 'on_tool_error':
        this.handleToolError(name, run_id, data)
        break

      case 'on_llm_start':
      case 'on_chat_model_start':
        // LLM 시작 — 토큰 카운트 준비
        break

      case 'on_llm_end':
      case 'on_chat_model_end':
        this.handleLlmEnd(run_id, data)
        break
    }
  }

  // ── 노드 이벤트 핸들러 ──

  private handleNodeStart(name: string, runId: string): void {
    const nodeId = name // LangGraph에서 name = 노드 ID
    this.runIdToNodeId.set(runId, nodeId)

    const metrics: NodeMetrics = {
      nodeId,
      startTime: Date.now(),
      toolCalls: [],
      status: 'running',
    }
    this.metricsMap.set(nodeId, metrics)

    this.updateStoreNodeStatus(nodeId, 'running')
    this.onNodeUpdate?.(nodeId, 'running', metrics)
    this.captureSnapshot()
  }

  private handleNodeEnd(name: string, runId: string, data: Record<string, unknown>): void {
    const nodeId = this.runIdToNodeId.get(runId) ?? name
    const metrics = this.metricsMap.get(nodeId)
    if (metrics) {
      metrics.endTime = Date.now()
      metrics.duration = metrics.endTime - metrics.startTime
      metrics.status = 'success'
    }

    this.updateStoreNodeStatus(nodeId, 'success')
    if (metrics) this.onNodeUpdate?.(nodeId, 'success', metrics)
    this.captureSnapshot()
  }

  private handleNodeError(name: string, runId: string, data: Record<string, unknown>): void {
    const nodeId = this.runIdToNodeId.get(runId) ?? name
    const metrics = this.metricsMap.get(nodeId)
    if (metrics) {
      metrics.endTime = Date.now()
      metrics.duration = metrics.endTime - metrics.startTime
      metrics.status = 'error'
      metrics.error = String(data.error ?? 'Unknown error')
    }

    this.updateStoreNodeStatus(nodeId, 'error')
    if (metrics) this.onNodeUpdate?.(nodeId, 'error', metrics)
    this.captureSnapshot()
  }

  // ── 도구 이벤트 핸들러 ──

  private handleToolStart(toolName: string, runId: string, data: Record<string, unknown>): void {
    const record: ToolCallRecord = {
      toolName,
      input: data.input,
      startTime: Date.now(),
    }
    this.activeToolCalls.set(runId, record)

    // 부모 노드에 연결
    const parentNodeId = this.findParentNodeId(runId)
    if (parentNodeId) {
      const metrics = this.metricsMap.get(parentNodeId)
      metrics?.toolCalls.push(record)
    }
  }

  private handleToolEnd(toolName: string, runId: string, data: Record<string, unknown>): void {
    const record = this.activeToolCalls.get(runId)
    if (record) {
      record.output = data.output
      record.endTime = Date.now()
      record.duration = record.endTime - record.startTime
      this.activeToolCalls.delete(runId)
      this.onToolCall?.(record)
    }
  }

  private handleToolError(toolName: string, runId: string, data: Record<string, unknown>): void {
    const record = this.activeToolCalls.get(runId)
    if (record) {
      record.error = String(data.error ?? 'Tool error')
      record.endTime = Date.now()
      record.duration = record.endTime - record.startTime
      this.activeToolCalls.delete(runId)
      this.onToolCall?.(record)
    }
  }

  // ── LLM 토큰 카운트 ──

  private handleLlmEnd(runId: string, data: Record<string, unknown>): void {
    const usage = (data.output as any)?.usage_metadata ?? (data.output as any)?.llmOutput?.tokenUsage
    if (!usage) return

    // 부모 노드 찾기
    const parentNodeId = this.findParentNodeId(runId)
    if (!parentNodeId) return

    const metrics = this.metricsMap.get(parentNodeId)
    if (metrics) {
      metrics.inputTokens = (metrics.inputTokens ?? 0) + (usage.input_tokens ?? usage.promptTokens ?? 0)
      metrics.outputTokens = (metrics.outputTokens ?? 0) + (usage.output_tokens ?? usage.completionTokens ?? 0)
      metrics.totalTokens = (metrics.inputTokens ?? 0) + (metrics.outputTokens ?? 0)
    }
  }

  // ── Pinia Store 연동 ──

  private updateStoreNodeStatus(nodeId: string, status: 'running' | 'success' | 'error'): void {
    if (!this.store) return
    this.store.updateNodeData(nodeId, { status })
  }

  // ── Time-Travel 스냅샷 ──

  private captureSnapshot(): void {
    const nodeStates = new Map<string, 'idle' | 'running' | 'success' | 'error'>()
    for (const [nodeId, metrics] of this.metricsMap) {
      nodeStates.set(nodeId, metrics.status)
    }

    const snapshot: ExecutionSnapshot = {
      timestamp: Date.now(),
      nodeStates: new Map(nodeStates),
      metrics: new Map(this.metricsMap),
    }
    this.snapshots.push(snapshot)
    this.onSnapshot?.(snapshot)
  }

  // ── 유틸 ──

  private findParentNodeId(runId: string): string | undefined {
    // 직접 매핑 확인
    if (this.runIdToNodeId.has(runId)) return this.runIdToNodeId.get(runId)
    // 가장 최근 running 노드 반환
    for (const [nodeId, metrics] of this.metricsMap) {
      if (metrics.status === 'running') return nodeId
    }
    return undefined
  }

  /** 전체 메트릭 조회 */
  getMetrics(): Map<string, NodeMetrics> {
    return this.metricsMap
  }

  /** 스냅샷 히스토리 (time-travel) */
  getSnapshots(): ExecutionSnapshot[] {
    return this.snapshots
  }

  /** 특정 스냅샷으로 UI 복원 */
  restoreSnapshot(index: number): void {
    const snapshot = this.snapshots[index]
    if (!snapshot || !this.store) return

    for (const [nodeId, status] of snapshot.nodeStates) {
      this.store.updateNodeData(nodeId, { status })
    }
  }

  /** 리셋 */
  reset(): void {
    this.metricsMap.clear()
    this.runIdToNodeId.clear()
    this.activeToolCalls.clear()
    this.snapshots = []
  }
}
