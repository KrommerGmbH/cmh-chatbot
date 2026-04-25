// ─── LlmModel Entity ────────────────────────────────────
// Entity interface for LLM model records (GPT-4o, Gemma 3, Claude 3.5, etc.)

import type { Entity, ModelType } from '../../types.js';
import type { LlmModelTranslation } from './llm-model-translation.entity.js';

/**
 * LlmModel — Shopware DAL-compatible entity for LLM models.
 *
 * Entity name: `cmh_llm_model`
 *
 * Replaces the old `ModelConfig` interface with a proper entity type.
 */
export interface LlmModel extends Entity {
  /** FK → cmh_llm_provider.id */
  providerId: string;
  /** FK → cmh_model_type.id (ManyToOne) */
  modelTypeId: string;
  /** Display name: "GPT-4o", "Gemma 3 4B IT (Q4_K_M)" (translatable) */
  name: string;
  /** 설명 (translatable) */
  description?: string;
  /** API identifier: "gpt-4o", "hf:bartowski/google_gemma-3-4b-it-GGUF" */
  modelId: string;
  /** Model type (legacy — modelTypeId 사용 권장) */
  type: ModelType;
  /** Context window size in tokens */
  contextLength: number;
  /** Whether this is the default model for its provider */
  isDefault: boolean;
  /** Whether this model is active */
  isActive: boolean;
  /** Generation parameters (temperature, topP, maxTokens, etc.) */
  parameters?: Record<string, unknown> | null;
  /** Local GGUF file path (local-gguf type only) */
  filePath?: string | null;
  /** Model file size in bytes */
  fileSize?: number | null;
  /** Whether the model file has been downloaded locally */
  isDownloaded: boolean;
  /** HuggingFace or remote URL for downloading the model */
  downloadUrl?: string | null;
  /** ISO 8601 timestamp */
  createdAt?: string;
  /** ISO 8601 timestamp */
  updatedAt?: string;

  /** 번역 목록 (Shopware _translation 패턴) */
  translations?: LlmModelTranslation[];
}
