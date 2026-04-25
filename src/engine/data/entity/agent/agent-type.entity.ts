// ─── AgentType Entity ────────────────────────────────────
// Entity interface for AI agent type records (orchestrator, manager, worker, etc.)

import type { Entity } from '../../types.js';
import type { AgentTypeTranslation } from './agent-type-translation.entity.js';

/**
 * Agent category — high-level classification of agent roles.
 */
export type AgentCategory = 'orchestrator' | 'manager' | 'worker' | 'profiler' | 'supporter';

/**
 * AgentType — Shopware DAL-compatible entity for AI agent types.
 *
 * Entity name: `cmh_agent_type`
 *
 * Defines the role taxonomy used by the multi-agent system.
 *
 * | Category      | Description                                                     |
 * |---------------|-----------------------------------------------------------------|
 * | orchestrator  | Top-level coordinator — routes tasks to managers                |
 * | manager       | Mid-level coordinator — can delegate to workers or sub-managers |
 * | worker        | Leaf executor — handles up to 3 atomic tasks concurrently      |
 * | profiler      | Post-chat hook — analyzes user preferences & psychology         |
 * | supporter     | Utility agent — web search, RAG, tool execution                |
 */
export interface AgentType extends Entity {
  /** Display name: "오케스트레이터", "매니저", etc. */
  name: string;

  /** Machine-readable identifier (snake_case): "orchestrator", "manager", etc. */
  technicalName: AgentCategory;

  /** Human-readable description of this agent type's role */
  description: string;

  /**
   * Maximum number of concurrent tasks this agent type can handle.
   * - orchestrator: unlimited (0 = no limit)
   * - manager: 0 (delegates, doesn't execute)
   * - worker: 3 (atomic task limit)
   * - profiler: 1 (sequential analysis)
   * - supporter: 5 (parallel tool calls)
   */
  maxConcurrentTasks: number;

  /**
   * Whether this agent type can have child agents.
   * - orchestrator: true (has managers)
   * - manager: true (has workers or sub-managers)
   * - worker: false
   * - profiler: false
   * - supporter: false
   */
  canHaveChildren: boolean;

  /** Whether this agent type is active */
  isActive: boolean;

  /** Display ordering priority (lower = shown first) */
  priority: number;

  /** Agent-type-specific configuration */
  config?: Record<string, unknown> | null;

  /** Shopware translation entity association — 5 locales */
  translations?: AgentTypeTranslation[];

  /** ISO 8601 timestamp */
  createdAt?: string;

  /** ISO 8601 timestamp */
  updatedAt?: string;
}
