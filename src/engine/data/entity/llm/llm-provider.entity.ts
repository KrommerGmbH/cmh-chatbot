// ─── LlmProvider Entity ──────────────────────────────────
// Entity interface for LLM provider records (OpenAI, Anthropic, local-gguf, etc.)

import type { Entity, ProviderType } from '../../types.js';
import type { LlmProviderTranslation } from './llm-provider-translation.entity.js';

/**
 * LlmProvider — Shopware DAL-compatible entity for LLM providers.
 *
 * Entity name: `cmh_llm_provider`
 *
 * Replaces the old `ProviderConfig` interface with a proper entity type.
 */
export interface LlmProvider extends Entity {
  /** Display name: "OpenAI", "Local (llama.cpp)" (translatable) */
  name: string;
  /** 설명 (translatable) */
  description?: string;
  /** Provider type */
  type: ProviderType;
  /** API key (cloud providers) */
  apiKey?: string | null;
  /** Base URL for API requests */
  baseUrl?: string | null;
  /** Whether this provider is active */
  isActive: boolean;
  /** Priority for ordering (lower = higher priority) */
  priority: number;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown> | null;
  /** ISO 8601 timestamp */
  createdAt?: string;
  /** ISO 8601 timestamp */
  updatedAt?: string;

  /** 번역 목록 (Shopware _translation 패턴) */
  translations?: LlmProviderTranslation[];
}
