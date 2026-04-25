// ─── Agent Entity ────────────────────────────────────────
// Entity interface for AI agent instances

import type { Entity } from '../../types.js';

/**
 * Agent operational status.
 */
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'terminated';

/**
 * Agent — Shopware DAL-compatible entity for AI agent instances.
 *
 * Entity name: `cmh_agent`
 *
 * Each agent belongs to exactly one AgentType (FK → cmh_agent_type).
 * Agents of type "manager" can reference a parent agent to form a hierarchy.
 *
 * Relationship:
 * - AgentType 1 ──→ N Agent  (OneToMany)
 * - Agent (parent) 1 ──→ N Agent (children)  (self-referencing, manager/orchestrator only)
 */
export interface Agent extends Entity {
  /** FK → cmh_agent_type.id */
  agentTypeId: string;

  /** Display name: "Main Orchestrator", "Code Worker #1" */
  name: string;

  /** Current operational status */
  status: AgentStatus;

  /** FK → cmh_agent.id (self-reference for hierarchy) — null for top-level agents */
  parentAgentId?: string | null;

  /** Role Prompt — 에이전트의 역할 정의 (mt-text-editor) */
  rolePrompt?: string | null;

  /** Mission Prompt — 에이전트의 미션/목표 정의 (mt-text-editor) */
  missionPrompt?: string | null;

  /** User Prompt — 사용자에게 보여줄 기본 프롬프트 (mt-text-editor) */
  userPrompt?: string | null;

  /** System prompt / instruction set for this agent (legacy — rolePrompt 우선) */
  systemPrompt?: string | null;

  /** FK → cmh_llm_model.id — Main Model */
  modelId?: string | null;

  /** FK → cmh_llm_model.id — Sub Model (보조 모델) */
  subModelId?: string | null;

  /** Temperature, maxTokens, etc. — overrides model defaults */
  parameters?: Record<string, unknown> | null;

  /**
   * Current task assignments (worker agents).
   * Max 3 for worker type, tracked as JSON array of task IDs.
   */
  currentTasks?: string[] | null;

  /** Agent-specific capabilities / tool bindings */
  capabilities?: string[] | null;

  /**
   * LangChain block configuration — 레고블록 조합.
   * 어떤 LangChain 기능을 사용하는지 JSON으로 저장.
   * e.g. { tools: [...], outputParsers: [...], embeddings: true, callbacks: [...], tracing: true }
   */
  langchainConfig?: Record<string, unknown> | null;

  /** Runtime configuration & metadata */
  config?: Record<string, unknown> | null;

  /** Whether this agent is active */
  isActive: boolean;

  /** Whether this agent can be deleted by user (false for default managers) */
  isDeletable?: boolean;

  /** Display ordering (lower = first) */
  position?: number;

  /** Icon identifier (Phosphor Icons) */
  icon?: string | null;

  /** Theme color hex */
  color?: string | null;

  /** Domain identifier: shopping, finance, health, etc. */
  domain?: string | null;

  /** ISO 8601 timestamp */
  createdAt?: string;

  /** ISO 8601 timestamp */
  updatedAt?: string;
}
