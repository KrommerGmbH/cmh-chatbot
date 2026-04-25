// ─── Dynamic Graph Builder ───────────────────────────────
// Phase 5.6 — Workflow JSON → StateGraph 변환.
// Vue Flow 에디터에서 저장한 JSON 워크플로우를 실행 가능한 LangGraph로 빌드.

import { StateGraph, START, END } from '@langchain/langgraph';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseCheckpointSaver } from '@langchain/langgraph';
import { AgentStateAnnotation, type AgentState } from './state-schema.js';
import { createSupervisorNode } from './supervisor.node.js';
import { createManagerNode } from './manager.node.js';
import { createWorkerNode } from './worker.node.js';
import { createProfilerNode } from './profiler.node.js';
import { createSupporterNode } from './supporter.node.js';
import { humanGateNode } from './human-gate.node.js';

// ── Workflow JSON 스키마 ────────────────────────────────

export interface WorkflowNodeDef {
  id: string;
  type: 'supervisor' | 'manager' | 'worker' | 'profiler' | 'supporter' | 'human_gate' | 'custom';
  /** 이 노드에서 이동 가능한 대상 노드 ID 목록 */
  ends?: string[];
}

export interface WorkflowEdgeDef {
  source: string;
  target: string;
  /** 조건부 엣지일 경우 조건 키 */
  condition?: string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  /** 그래프 시작 노드 ID */
  entryNode: string;
}

// ── 노드 팩토리 매핑 ───────────────────────────────────

type NodeFactory = (chatModel: BaseChatModel) => (state: AgentState) => Promise<any>;

const NODE_FACTORIES: Record<string, NodeFactory | ((state: AgentState) => Promise<any>)> = {
  supervisor: createSupervisorNode,
  manager: createManagerNode,
  worker: createWorkerNode,
  profiler: createProfilerNode,
  supporter: createSupporterNode,
  human_gate: humanGateNode as any,
};

/**
 * Workflow JSON 정의를 컴파일된 StateGraph로 변환.
 */
export function buildGraphFromWorkflow(
  workflow: WorkflowDef,
  chatModel: BaseChatModel,
  checkpointer?: BaseCheckpointSaver,
) {
  const builder = new StateGraph(AgentStateAnnotation);

  // 노드 등록
  for (const nodeDef of workflow.nodes) {
    const factory = NODE_FACTORIES[nodeDef.type];
    if (!factory) {
      throw new Error(`Unknown node type: ${nodeDef.type}`);
    }

    const nodeFunction = typeof factory === 'function' && nodeDef.type !== 'human_gate'
      ? (factory as NodeFactory)(chatModel)
      : factory;

    const opts = nodeDef.ends ? { ends: nodeDef.ends } : undefined;
    builder.addNode(nodeDef.id, nodeFunction as any, opts as any);
  }

  // 엣지 등록
  for (const edge of workflow.edges) {
    const source = edge.source === '__start__' ? START : edge.source;
    const target = edge.target === '__end__' ? END : edge.target;

    if (!edge.condition) {
      builder.addEdge(source as any, target as any);
    }
    // 조건부 엣지는 노드의 Command 반환으로 처리되므로 별도 등록 불필요
  }

  // 시작 엣지
  if (!workflow.edges.some((e) => e.source === '__start__')) {
    builder.addEdge(START, workflow.entryNode as any);
  }

  return builder.compile({ checkpointer });
}

/**
 * 기본 5-노드 워크플로우 생성 (PLAN.md §14.3.1 기준).
 */
export function buildDefaultGraph(
  chatModel: BaseChatModel,
  checkpointer?: BaseCheckpointSaver,
) {
  const defaultWorkflow: WorkflowDef = {
    id: 'default',
    name: 'Default Multi-Agent',
    entryNode: 'supervisor',
    nodes: [
      { id: 'supervisor', type: 'supervisor', ends: ['manager', 'profiler', '__end__'] },
      { id: 'manager', type: 'manager', ends: ['worker', 'supervisor'] },
      { id: 'worker', type: 'worker', ends: ['supervisor', 'human_gate'] },
      { id: 'profiler', type: 'profiler', ends: ['__end__'] },
      { id: 'supporter', type: 'supporter', ends: ['supervisor'] },
      { id: 'human_gate', type: 'human_gate', ends: ['worker', '__end__'] },
    ],
    edges: [
      { source: '__start__', target: 'supervisor' },
    ],
  };

  return buildGraphFromWorkflow(defaultWorkflow, chatModel, checkpointer);
}
