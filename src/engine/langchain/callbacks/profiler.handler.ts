// ─── Profiler Callback Handler ───────────────────────────
// Phase 7.1 — 대화 완료 후 사용자 취향/심리 분석.
// LLM 호출이 끝날 때마다 응답을 분석하여 프로필 데이터를 수집한다.

import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import { CallbackHandlerRegistry } from './registry.js';

export interface ProfileAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
  preferences: Record<string, string>;
  timestamp: string;
}

export type ProfileSink = (analysis: ProfileAnalysis, runId: string) => void | Promise<void>;

export class ProfilerCallbackHandler extends BaseCallbackHandler {
  name = 'cmh-profiler';

  private sink: ProfileSink;

  constructor(sink: ProfileSink) {
    super();
    this.sink = sink;
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    try {
      const text = output.generations?.[0]?.[0]?.text ?? '';
      if (!text || text.length < 20) return;

      // 간단한 휴리스틱 분석 (Phase 8에서 LLM 기반 분석으로 교체 가능)
      const analysis: ProfileAnalysis = {
        sentiment: this.detectSentiment(text),
        topics: this.extractTopics(text),
        preferences: {},
        timestamp: new Date().toISOString(),
      };

      await this.sink(analysis, runId);
    } catch {
      // 프로파일링 실패는 무시 (메인 플로우 방해 금지)
    }
  }

  private detectSentiment(text: string): ProfileAnalysis['sentiment'] {
    const positive = /좋|감사|훌륭|완벽|great|good|thanks|excellent|perfect/i;
    const negative = /나쁜|실패|에러|문제|bad|fail|error|problem|sorry/i;
    if (positive.test(text)) return 'positive';
    if (negative.test(text)) return 'negative';
    return 'neutral';
  }

  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const patterns: [RegExp, string][] = [
      [/코드|프로그래밍|개발|code|programming|develop/i, 'development'],
      [/디자인|UI|UX|레이아웃|design|layout/i, 'design'],
      [/데이터|분석|통계|data|analytics|statistics/i, 'data'],
      [/비즈니스|마케팅|세일즈|business|marketing|sales/i, 'business'],
      [/학습|교육|튜토리얼|learn|education|tutorial/i, 'education'],
    ];
    for (const [re, topic] of patterns) {
      if (re.test(text)) topics.push(topic);
    }
    return topics;
  }
}

// ── 레지스트리 자동 등록 ──
CallbackHandlerRegistry.register({
  id: 'cmh-profiler',
  name: 'Profiler',
  description: 'Analyzes user sentiment, topics, and preferences after each LLM response',
  factory: () => new ProfilerCallbackHandler(() => {}),
  autoAttach: false,
  priority: 90,
});
