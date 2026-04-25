// ─── Logging Callback Handler ────────────────────────────
// Phase 7.3 — 구조화 로깅 콜백.
// 모든 LLM/Tool/Chain 이벤트를 구조화된 로그로 출력한다.

import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import { CallbackHandlerRegistry } from './registry.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  event: string;
  runId: string;
  parentRunId?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export type LogSink = (entry: LogEntry) => void;

export class LoggingCallbackHandler extends BaseCallbackHandler {
  name = 'cmh-logging';

  private sink: LogSink;
  private minLevel: LogLevel;
  private static LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  constructor(sink?: LogSink, minLevel: LogLevel = 'info') {
    super();
    this.sink = sink ?? ((e) => console.log(`[${e.level}] ${e.event}`, e.data ?? ''));
    this.minLevel = minLevel;
  }

  private log(level: LogLevel, event: string, runId: string, parentRunId?: string, data?: Record<string, unknown>): void {
    const li = LoggingCallbackHandler.LEVEL_ORDER.indexOf(level);
    const mi = LoggingCallbackHandler.LEVEL_ORDER.indexOf(this.minLevel);
    if (li < mi) return;

    this.sink({
      level,
      event,
      runId,
      parentRunId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // ── LLM ──

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('info', 'llm:start', runId, parentRunId, {
      model: (llm as any)?.id?.join('/'),
      promptCount: prompts.length,
      promptChars: prompts.reduce((s, p) => s + p.length, 0),
    });
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('info', 'llm:end', runId, parentRunId, {
      generations: output.generations?.length,
      tokenUsage: output.llmOutput?.tokenUsage ?? output.llmOutput?.usage,
    });
  }

  async handleLLMError(
    err: Error,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('error', 'llm:error', runId, parentRunId, {
      message: err.message,
      name: err.name,
    });
  }

  // ── Tool ──

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('info', 'tool:start', runId, parentRunId, {
      tool: (tool as any)?.id?.join('/'),
      inputLength: input.length,
    });
  }

  async handleToolEnd(
    output: string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('debug', 'tool:end', runId, parentRunId, {
      outputLength: output.length,
    });
  }

  async handleToolError(
    err: Error,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('error', 'tool:error', runId, parentRunId, {
      message: err.message,
    });
  }

  // ── Chain ──

  async handleChainStart(
    chain: Serialized,
    _inputs: Record<string, unknown>,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('debug', 'chain:start', runId, parentRunId, {
      chain: (chain as any)?.id?.join('/'),
    });
  }

  async handleChainEnd(
    _outputs: Record<string, unknown>,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('debug', 'chain:end', runId, parentRunId);
  }

  async handleChainError(
    err: Error,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.log('error', 'chain:error', runId, parentRunId, {
      message: err.message,
    });
  }
}

// ── 레지스트리 자동 등록 ──
CallbackHandlerRegistry.register({
  id: 'cmh-logging',
  name: 'Logging',
  description: 'Structured logging for all LLM, tool, and chain events',
  factory: () => new LoggingCallbackHandler(),
  autoAttach: true,
  priority: 5,
});
