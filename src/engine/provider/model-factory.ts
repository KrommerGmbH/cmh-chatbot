import type { LlmProvider } from '../data/entity/llm/llm-provider.entity.js';
import type { LlmModel } from '../data/entity/llm/llm-model.entity.js';
import type { Repository } from '../data/repository.js';
import { Criteria } from '../data/criteria.js';
import type { Logger } from '../core/logger.js';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  migrateProviderApiKeyToKeychain,
  resolveProviderApiKey,
} from '../security/provider-keychain.service.js';

export interface ResolvedModel {
  provider: LlmProvider;
  model: LlmModel;
  /** Effective base URL for inference (cloud API / self-hosted / llama-server) */
  baseUrl: string;
  /** API key if required */
  apiKey?: string;
}

/**
 * B-5: Model Instance Pool — reuses ChatOpenAI instances for identical configs.
 * Key = baseUrl + modelId + temperature + maxTokens + streaming
 */
const modelPool = new Map<string, { instance: BaseChatModel; lastUsed: number }>();
const MODEL_POOL_MAX = 32;
const MODEL_POOL_TTL_MS = 10 * 60 * 1000; // 10 min

function normalizeModelIdForProvider(providerNameRaw: string, modelIdRaw: string): string {
  const providerName = (providerNameRaw ?? '').toLowerCase();
  const modelId = (modelIdRaw ?? '').trim();
  if (!modelId) return modelId;

  if (providerName.includes('google') || providerName.includes('gemini')) {
    return modelId.replace(/^models\//i, '').replace(/^google\//i, '');
  }
  if (providerName.includes('anthropic') || providerName.includes('claude')) {
    return modelId.replace(/^anthropic\//i, '');
  }
  if (providerName.includes('openai')) {
    return modelId.replace(/^openai\//i, '');
  }
  return modelId;
}

function getPoolKey(baseUrl: string, modelId: string, opts?: { temperature?: number; maxTokens?: number; streaming?: boolean }): string {
  return `${baseUrl}|${modelId}|${opts?.temperature ?? 0.7}|${opts?.maxTokens ?? 2048}|${opts?.streaming ?? true}`;
}

function evictStalePoolEntries(): void {
  if (modelPool.size <= MODEL_POOL_MAX) return;
  const now = Date.now();
  for (const [key, entry] of modelPool) {
    if (now - entry.lastUsed > MODEL_POOL_TTL_MS) {
      modelPool.delete(key);
    }
  }
  // If still over limit, remove oldest
  if (modelPool.size > MODEL_POOL_MAX) {
    const sorted = [...modelPool.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (let i = 0; i < sorted.length - MODEL_POOL_MAX; i++) {
      modelPool.delete(sorted[i][0]);
    }
  }
}

/**
 * Phase 3.2 — ResolvedModel을 LangChain BaseChatModel로 변환하는 헬퍼.
 *
 * 현재 모든 provider가 OpenAI-compatible API를 사용하므로 ChatOpenAI로 통합.
 * (llama-server, vLLM, Ollama 등 모두 /v1/chat/completions 호환)
 *
 * B-5: Pooled — 동일 설정 인스턴스 재사용.
 */
export function createChatModel(
  resolved: ResolvedModel,
  options?: {
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
  },
): BaseChatModel {
  const { provider, model, baseUrl, apiKey } = resolved;
  const effectiveBaseUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
  const effectiveModelId = normalizeModelIdForProvider(provider.name ?? '', model.modelId ?? model.name);
  const poolKey = getPoolKey(effectiveBaseUrl, effectiveModelId, options);

  const cached = modelPool.get(poolKey);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.instance;
  }

  const chatModel = new ChatOpenAI({
    model: effectiveModelId,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 2048,
    streaming: options?.streaming ?? true,
    configuration: {
      baseURL: effectiveBaseUrl,
      apiKey: apiKey || 'not-needed',
    },
    openAIApiKey: apiKey || 'not-needed',
  });

  evictStalePoolEntries();
  modelPool.set(poolKey, { instance: chatModel, lastUsed: Date.now() });

  return chatModel;
}

/**
 * Model Factory — resolves a modelId to a fully-configured inference target.
 *
 * Now powered by Shopware DAL Repositories instead of ProviderRegistry interface.
 *
 * For local-gguf models, the base URL is the llama-server URL.
 * For cloud-api models, the base URL is the provider's API endpoint.
 * For self-hosted models, the base URL is the provider's custom endpoint.
 */
export class ModelFactory {
  constructor(
    private readonly providerRepo: Repository<LlmProvider>,
    private readonly modelRepo: Repository<LlmModel>,
    private readonly llamaServerUrl: string,
    private readonly logger: Logger,
  ) {}

  /**
   * Resolve a model ID to a fully-configured inference target.
   * Falls back to llama-server if no modelId is provided.
   */
  async resolve(modelId?: string): Promise<ResolvedModel | null> {
    if (!modelId) {
      return null; // Caller should use default llama-server
    }

    const model = await this.modelRepo.get(modelId);
    if (!model) {
      this.logger.warn({ modelId }, 'model-factory:model-not-found');
      return null;
    }

    const provider = await this.providerRepo.get(model.providerId);
    if (!provider) {
      this.logger.warn({ providerId: model.providerId }, 'model-factory:provider-not-found');
      return null;
    }

    return this.buildResolved(provider, model);
  }

  /**
   * Resolve the default model for a given provider.
   */
  async resolveDefault(providerId: string): Promise<ResolvedModel | null> {
    const provider = await this.providerRepo.get(providerId);
    if (!provider) return null;

    const criteria = new Criteria();
    criteria
      .addFilter(Criteria.equals('providerId', providerId))
      .addFilter(Criteria.equals('isDefault', true))
      .setLimit(1);

    const result = await this.modelRepo.search(criteria);
    const model = result.data[0] ?? null;
    if (!model) return null;

    return this.buildResolved(provider, model);
  }

  /**
   * Phase 3.2 — Resolve a model ID directly to a LangChain BaseChatModel instance.
   * Convenience method combining resolve() + createChatModel().
   */
  async resolveChatModel(
    modelId?: string,
    options?: { temperature?: number; maxTokens?: number; streaming?: boolean },
  ): Promise<BaseChatModel | null> {
    const resolved = await this.resolve(modelId);
    if (!resolved) {
      // Fallback: llama-server 기본 모델 → ChatOpenAI
      return new ChatOpenAI({
        model: 'default',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 2048,
        streaming: options?.streaming ?? true,
        configuration: {
          baseURL: this.llamaServerUrl.endsWith('/v1')
            ? this.llamaServerUrl
            : `${this.llamaServerUrl}/v1`,
          apiKey: 'not-needed',
        },
        openAIApiKey: 'not-needed',
      });
    }
    return createChatModel(resolved, options);
  }

  private async buildResolved(provider: LlmProvider, model: LlmModel): Promise<ResolvedModel> {
    let baseUrl: string;

    switch (provider.type) {
      case 'local-gguf':
        // Local models use the llama-server URL
        baseUrl = this.llamaServerUrl;
        break;
      case 'cloud-api':
        baseUrl = provider.baseUrl ?? '';
        break;
      case 'self-hosted':
        baseUrl = provider.baseUrl ?? '';
        break;
      default:
        baseUrl = this.llamaServerUrl;
    }

    const migratedApiKey = await migrateProviderApiKeyToKeychain(provider);
    if (migratedApiKey && migratedApiKey !== provider.apiKey) {
      provider.apiKey = migratedApiKey;
      await this.providerRepo.save({
        ...provider,
        apiKey: migratedApiKey,
        updatedAt: new Date().toISOString(),
      });
    }

    const resolvedApiKey = await resolveProviderApiKey(provider);

    return {
      provider,
      model,
      baseUrl,
      apiKey: resolvedApiKey ?? undefined,
    };
  }
}
