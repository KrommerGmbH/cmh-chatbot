// ─── Monitoring Callback Handler ─────────────────────────
// Phase 7.2 — 메트릭 수집 콜백.
// LLM 호출 레이턴시, 토큰 사용량, 도구 호출 횟수 등을 추적한다.

import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import { CallbackHandlerRegistry } from './registry.js';

export interface MonitoringMetrics {
  llmCalls: number;
  llmErrors: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalLatencyMs: number;
  toolCalls: number;
  toolErrors: number;
  chainRuns: number;
}

export type MetricsSink = (metrics: Readonly<MonitoringMetrics>) => void;

export class MonitoringCallbackHandler extends BaseCallbackHandler {
  name = 'cmh-monitoring';

  private metrics: MonitoringMetrics = {
    llmCalls: 0,
    llmErrors: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalLatencyMs: 0,
    toolCalls: 0,
    toolErrors: 0,
    chainRuns: 0,
  };

  /** runId → startTime */
  private timers = new Map<string, number>();
  private sink?: MetricsSink;

  constructor(sink?: MetricsSink) {
    super();
    this.sink = sink;
  }

  /** 현재까지 수집된 메트릭 스냅샷 반환 */
  getMetrics(): Readonly<MonitoringMetrics> {
    return { ...this.metrics };
  }

  /** 메트릭 초기화 */
  reset(): void {
    this.metrics = {
      llmCalls: 0, llmErrors: 0, totalTokens: 0, promptTokens: 0,
      completionTokens: 0, totalLatencyMs: 0, toolCalls: 0, toolErrors: 0, chainRuns: 0,
    };
    this.timers.clear();
  }

  // ── LLM ──

  async handleLLMStart(
    _llm: Serialized,
    _prompts: string[],
    runId: string,
  ): Promise<void> {
    this.metrics.llmCalls++;
    this.timers.set(runId, Date.now());
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
  ): Promise<void> {
    const start = this.timers.get(runId);
    if (start) {
      this.metrics.totalLatencyMs += Date.now() - start;
      this.timers.delete(runId);
    }

    const usage = output.llmOutput?.tokenUsage ?? output.llmOutput?.usage;
    if (usage) {
      this.metrics.totalTokens += usage.totalTokens ?? 0;
      this.metrics.promptTokens += usage.promptTokens ?? 0;
      this.metrics.completionTokens += usage.completionTokens ?? 0;
    }

    this.sink?.(this.getMetrics());
  }

  async handleLLMError(
    _err: Error,
    runId: string,
  ): Promise<void> {
    this.metrics.llmErrors++;
    this.timers.delete(runId);
    this.sink?.(this.getMetrics());
  }

  // ── Tool ──

  async handleToolStart(
    _tool: Serialized,
    _input: string,
    _runId: string,
  ): Promise<void> {
    this.metrics.toolCalls++;
  }

  async handleToolError(
    _err: Error,
    _runId: string,
  ): Promise<void> {
    this.metrics.toolErrors++;
    this.sink?.(this.getMetrics());
  }

  // ── Chain ──

  async handleChainStart(): Promise<void> {
    this.metrics.chainRuns++;
  }
}

// ── 레지스트리 자동 등록 ──
CallbackHandlerRegistry.register({
  id: 'cmh-monitoring',
  name: 'Monitoring',
  description: 'Collects LLM latency, token usage, tool call counts, and error metrics',
  factory: () => new MonitoringCallbackHandler(),
  autoAttach: true,
  priority: 10,
});
