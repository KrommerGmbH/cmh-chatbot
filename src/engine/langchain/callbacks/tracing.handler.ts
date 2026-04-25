// ─── Tracing Callback Handler ────────────────────────────
// Phase 7.4 — LangSmith/LangFuse 연동 트레이싱 콜백.
// 환경 변수 기반으로 외부 트레이싱 서비스를 자동 감지하여 연결한다.

import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import { CallbackHandlerRegistry } from './registry.js';

/** 트레이스 스팬 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
  status: 'running' | 'ok' | 'error';
}

export type TraceSink = (span: TraceSpan) => void | Promise<void>;

export class TracingCallbackHandler extends BaseCallbackHandler {
  name = 'cmh-tracing';

  private sink: TraceSink;
  private spans = new Map<string, TraceSpan>();
  private traceId: string;

  constructor(sink: TraceSink, traceId?: string) {
    super();
    this.sink = sink;
    this.traceId = traceId ?? crypto.randomUUID();
  }

  private startSpan(name: string, runId: string, parentRunId?: string, metadata?: Record<string, unknown>): void {
    const span: TraceSpan = {
      traceId: this.traceId,
      spanId: runId,
      parentSpanId: parentRunId,
      name,
      startTime: Date.now(),
      metadata,
      status: 'running',
    };
    this.spans.set(runId, span);
    this.sink(span);
  }

  private endSpan(runId: string, status: 'ok' | 'error' = 'ok', metadata?: Record<string, unknown>): void {
    const span = this.spans.get(runId);
    if (!span) return;
    span.endTime = Date.now();
    span.status = status;
    if (metadata) span.metadata = { ...span.metadata, ...metadata };
    this.sink(span);
    this.spans.delete(runId);
  }

  // ── LLM ──

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.startSpan('llm', runId, parentRunId, {
      model: (llm as any)?.id?.join('/'),
      promptCount: prompts.length,
    });
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    this.endSpan(runId, 'ok', {
      tokenUsage: output.llmOutput?.tokenUsage ?? output.llmOutput?.usage,
    });
  }

  async handleLLMError(_err: Error, runId: string): Promise<void> {
    this.endSpan(runId, 'error', { error: _err.message });
  }

  // ── Tool ──

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.startSpan('tool', runId, parentRunId, {
      tool: (tool as any)?.id?.join('/'),
      inputLength: input.length,
    });
  }

  async handleToolEnd(_output: string, runId: string): Promise<void> {
    this.endSpan(runId, 'ok');
  }

  async handleToolError(_err: Error, runId: string): Promise<void> {
    this.endSpan(runId, 'error', { error: _err.message });
  }

  // ── Chain ──

  async handleChainStart(
    chain: Serialized,
    _inputs: Record<string, unknown>,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.startSpan('chain', runId, parentRunId, {
      chain: (chain as any)?.id?.join('/'),
    });
  }

  async handleChainEnd(_outputs: Record<string, unknown>, runId: string): Promise<void> {
    this.endSpan(runId, 'ok');
  }

  async handleChainError(_err: Error, runId: string): Promise<void> {
    this.endSpan(runId, 'error', { error: _err.message });
  }
}

/**
 * 환경 변수 기반 트레이싱 팩토리.
 * - LANGSMITH_API_KEY → LangSmith (향후 연동)
 * - LANGFUSE_PUBLIC_KEY → LangFuse (향후 연동)
 * - 둘 다 없으면 → 콘솔 로그
 */
function createTracingHandler(): TracingCallbackHandler {
  // TODO: Phase 10에서 LangSmith/LangFuse SDK 실제 연동
  const consoleSink: TraceSink = (span) => {
    if (span.endTime) {
      console.debug(`[trace] ${span.name} ${span.status} (${span.endTime - span.startTime}ms)`, span.spanId);
    }
  };
  return new TracingCallbackHandler(consoleSink);
}

// ── 레지스트리 자동 등록 ──
CallbackHandlerRegistry.register({
  id: 'cmh-tracing',
  name: 'Tracing',
  description: 'Distributed tracing with span tracking (LangSmith/LangFuse ready)',
  factory: createTracingHandler,
  autoAttach: false,
  priority: 20,
});
