// ─── Profiler Node ───────────────────────────────────────
// Phase 5.2 — 대화 후처리 분석 노드.
// 사용자 선호도, 감정, 대화 품질을 분석하여 장기 메모리에 저장.

import { END } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentState } from './state-schema.js';

const PROFILER_PROMPT = `You are a conversation analysis agent. Analyze the conversation and extract:
1. User sentiment (positive/neutral/negative)
2. Key topics discussed
3. User preferences or patterns
4. Conversation quality score (1-10)

Return your analysis as a JSON object:
{
  "sentiment": "positive",
  "topics": ["topic1", "topic2"],
  "preferences": { "key": "value" },
  "qualityScore": 8
}`;

export function createProfilerNode(chatModel: BaseChatModel) {
  return async (state: AgentState) => {
    const messages = [
      new SystemMessage(PROFILER_PROMPT),
      ...state.messages,
    ];

    const response = await chatModel.invoke(messages);
    const content = typeof response.content === 'string' ? response.content : '';

    // 프로필 데이터 파싱
    let profileUpdate: Record<string, unknown> = {};
    try {
      profileUpdate = JSON.parse(content);
    } catch {
      profileUpdate = { rawAnalysis: content };
    }

    return {
      currentAgent: 'profiler',
      profileData: profileUpdate,
      messages: [response],
    };
  };
}
