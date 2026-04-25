// ─── Conversation Entity ─────────────────────────────────
// Entity interface for chat conversation sessions.

import type { Entity } from '../../types.js';

/**
 * Conversation — Shopware DAL-compatible entity for chat sessions.
 *
 * Entity name: `cmh_conversation`
 *
 * Relationship:
 * - Conversation 1 ──→ N Message (OneToMany)
 * - User 1 ──→ N Conversation (OneToMany)
 */
export interface Conversation extends Entity {
  /** Display title (auto-generated or user-edited) */
  title: string;

  /** FK → cmh_user.id */
  userId?: string | null;

  /** FK → cmh_agent.id — primary agent for this conversation */
  agentId?: string | null;

  /** FK → cmh_llm_model.id — model used (snapshot) */
  modelId?: string | null;

  /** System prompt snapshot at conversation start */
  systemPrompt?: string | null;

  /** Total message count (denormalized for list performance) */
  messageCount: number;

  /** Total token usage across all messages */
  totalTokens: number;

  /** Whether conversation is pinned */
  isPinned: boolean;

  /** Whether conversation is archived */
  isArchived: boolean;

  /** Arbitrary metadata (tags, workflow id, etc.) */
  metadata?: Record<string, unknown> | null;

  /** ISO 8601 timestamp */
  createdAt?: string;
  /** ISO 8601 timestamp */
  updatedAt?: string;
  /** ISO 8601 timestamp — last message time */
  lastMessageAt?: string | null;
}
