// ─── Message Entity ──────────────────────────────────────
// Entity interface for individual chat messages.

import type { Entity } from '../../types.js';

/**
 * Message role type.
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Token usage breakdown for a single message.
 */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * Message — Shopware DAL-compatible entity for chat messages.
 *
 * Entity name: `cmh_message`
 *
 * Relationship:
 * - Conversation 1 ──→ N Message (OneToMany)
 */
export interface Message extends Entity {
  /** FK → cmh_conversation.id */
  conversationId: string;

  /** Message role */
  role: MessageRole;

  /** Message content (text) */
  content: string;

  /** LLM thinking/reasoning trace (if available) */
  thinking?: string | null;

  /** Tool call metadata (LangChain tool invocations) */
  toolCalls?: Record<string, unknown>[] | null;

  /** FK → cmh_user.id (for user messages) */
  userId?: string | null;

  /** Model name/id snapshot at generation time */
  modelName?: string | null;

  /** 불만족 점수 (dissatisfaction score): 0 (만족) – 100 (완전 불만족), null = 미평가 */
  rating?: number | null;

  /** Embedding vector for RAG similarity search */
  embeddingVector?: number[] | null;

  /** Token usage for this message */
  tokenUsage?: TokenUsage | null;

  /** Inference latency in milliseconds */
  latencyMs?: number | null;

  /** Arbitrary metadata */
  metadata?: Record<string, unknown> | null;

  /** ISO 8601 timestamp */
  createdAt?: string;
  /** ISO 8601 timestamp */
  updatedAt?: string;
}
