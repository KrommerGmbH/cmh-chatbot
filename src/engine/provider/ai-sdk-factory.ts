// ─── AI SDK Provider Factory ─────────────────────────────
// ResolvedModel → AI SDK LanguageModel 변환.
// provider.type별 분기: openai, anthropic, google, local-gguf, ollama, self-hosted

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ResolvedModel } from './model-factory.js';

function normalizeModelIdForProvider(providerNameRaw: string, modelIdRaw: string): string {
  const providerName = (providerNameRaw ?? '').toLowerCase();
  const modelId = (modelIdRaw ?? '').trim();
  if (!modelId) return modelId;

  // Google SDK는 models/ 및 google/ 접두어를 제거한 gemini-* 형식을 기대
  if (providerName.includes('google') || providerName.includes('gemini')) {
    return modelId.replace(/^models\//i, '').replace(/^google\//i, '');
  }

  // Anthropic SDK는 anthropic/ 접두어 없이 claude-* 형식을 기대
  if (providerName.includes('anthropic') || providerName.includes('claude')) {
    return modelId.replace(/^anthropic\//i, '');
  }

  // OpenAI native provider는 openai/ 접두어를 제거한 gpt-* 형식을 기대
  if (providerName.includes('openai')) {
    return modelId.replace(/^openai\//i, '');
  }

  // GitHub Models(또는 기타 OpenAI-compatible)는 vendor/model namespace를 그대로 사용
  return modelId;
}

/**
 * ResolvedModel → AI SDK LanguageModelV1 인스턴스 생성.
 *
 * @example
 * ```ts
 * const resolved = await modelFactory.resolve(modelId);
 * const model = createAISdkModel(resolved);
 * const result = await streamText({ model, messages });
 * ```
 */
export function createAISdkModel(
  resolved: ResolvedModel,
  options?: { structuredOutputs?: boolean },
): LanguageModel {
  const { provider, model, baseUrl, apiKey } = resolved;
  const modelId = normalizeModelIdForProvider(provider.name ?? '', model.modelId ?? model.name);

  switch (provider.type) {
    // ── OpenAI (cloud) ──
    case 'cloud-api': {
      // provider.baseUrl에 따라 OpenAI / Anthropic / Google 분기
      const providerName = (provider.name ?? '').toLowerCase();

      if (providerName.includes('anthropic') || providerName.includes('claude')) {
        const anthropic = createAnthropic({
          apiKey: apiKey ?? '',
        });
        return anthropic.languageModel(modelId);
      }

      if (providerName.includes('google') || providerName.includes('gemini')) {
        const google = createGoogleGenerativeAI({
          apiKey: apiKey ?? '',
        });
        return google.languageModel(modelId);
      }

      // GitHub Copilot / GitHub Models — OpenAI-compatible
      if (providerName.includes('github') || providerName.includes('copilot')) {
        const openai = createOpenAI({
          baseURL: baseUrl ? `${baseUrl.replace(/\/v1\/?$/, '')}/v1` : 'https://models.github.ai/inference/v1',
          apiKey: apiKey ?? '',
        });
        // GitHub Models는 /responses 미지원 환경이 있어 chat-completions 경로를 강제한다.
        return openai.chat(modelId);
      }

      // Default: OpenAI or OpenAI-compatible cloud
      const openai = createOpenAI({
        baseURL: baseUrl ? `${baseUrl.replace(/\/v1\/?$/, '')}/v1` : undefined,
        apiKey: apiKey ?? '',
      });
      return openai.languageModel(modelId);
    }

    // ── Local GGUF (llama-server) ──
    case 'local-gguf': {
      const openai = createOpenAI({
        baseURL: `${baseUrl.replace(/\/v1\/?$/, '')}/v1`,
        apiKey: 'not-needed',
      });
      return openai.languageModel(modelId);
    }

    // ── Self-hosted (vLLM, TGI, Ollama 등 — OpenAI-compatible) ──
    case 'self-hosted':
    default: {
      const openai = createOpenAI({
        baseURL: `${baseUrl.replace(/\/v1\/?$/, '')}/v1`,
        apiKey: apiKey || 'not-needed',
      });
      return openai.languageModel(modelId);
    }
  }
}

/**
 * provider.type 문자열 → 사람이 읽을 수 있는 SDK 이름.
 */
export function getProviderSdkName(providerType: string): string {
  switch (providerType) {
    case 'cloud-api': return 'AI SDK (cloud)';
    case 'local-gguf': return 'AI SDK (llama-server)';
    case 'self-hosted': return 'AI SDK (self-hosted)';
    default: return 'AI SDK';
  }
}
