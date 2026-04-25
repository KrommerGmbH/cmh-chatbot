import type { InferenceResult } from '../types/index.js';
import { ProviderError } from '../types/errors.js';
import type { Logger } from './logger.js';

export interface InferenceOptions {
  /** llama-server base URL (e.g. http://127.0.0.1:8080) */
  serverUrl: string;
  /** OpenAI-format messages */
  messages: Array<{ role: string; content: string }>;
  /** Temperature (default: 0.7) */
  temperature?: number;
  /** Max tokens (default: 2048) */
  maxTokens?: number;
  /** Abort signal */
  abortSignal?: AbortSignal;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onFinish?: (result: InferenceResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Inference engine — calls llama-server's OpenAI-compatible API.
 * Handles SSE streaming, token collection, and error normalization.
 *
 * @deprecated Phase 3.6 — LangChain `ChatOpenAI.stream()` / `.invoke()`로 대체됨.
 * `ModelFactory.resolveChatModel()` 또는 `createChatModel()`을 사용하세요.
 * 하위호환을 위해 코드는 유지하지만, 신규 코드에서 사용하지 마세요.
 * @see {@link ../agent/model-factory.ts}
 */
export class InferenceEngine {
  constructor(private readonly logger: Logger) {}

  /**
   * Run a streaming inference call via llama-server's /v1/chat/completions SSE API.
   *
   * @deprecated LangChain `ChatOpenAI.stream()`으로 대체. `createChatModel()` 참조.
   */
  async stream(
    options: InferenceOptions,
    callbacks?: StreamCallbacks,
  ): Promise<InferenceResult> {
    this.logger.debug('inference:stream:start');

    try {
      const response = await fetch(`${options.serverUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: options.messages,
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: options.abortSignal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new ProviderError(`llama-server responded ${response.status}: ${errText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      let usage: InferenceResult['usage'] | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              callbacks?.onToken?.(delta);
            }
            // Capture usage from final chunk (llama.cpp includes it)
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: parsed.usage.completion_tokens ?? 0,
                totalTokens: parsed.usage.total_tokens ?? 0,
              };
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      const result: InferenceResult = {
        text: fullText,
        finishReason: 'stop',
        usage,
      };

      this.logger.debug('inference:stream:complete');
      callbacks?.onFinish?.(result);
      return result;
    } catch (error) {
      this.logger.error({ error }, 'inference:stream:error');
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw error instanceof ProviderError
        ? error
        : new ProviderError(`Inference failed: ${err.message}`, error);
    }
  }

  /**
   * Non-streaming inference via llama-server's /v1/chat/completions.
   *
   * @deprecated LangChain `ChatOpenAI.invoke()`로 대체. `createChatModel()` 참조.
   */
  async generate(options: InferenceOptions): Promise<InferenceResult> {
    this.logger.debug('inference:generate:start');

    try {
      const response = await fetch(`${options.serverUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: options.messages,
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          stream: false,
        }),
        signal: options.abortSignal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new ProviderError(`llama-server responded ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content ?? '';

      return {
        text,
        finishReason: data.choices?.[0]?.finish_reason ?? 'stop',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error({ error }, 'inference:generate:error');
      throw error instanceof ProviderError
        ? error
        : new ProviderError(
            `Generate failed: ${error instanceof Error ? error.message : String(error)}`,
            error,
          );
    }
  }
}
