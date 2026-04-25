// ─── Supporter Node ──────────────────────────────────────
// Phase 5.2 — RAG + 웹 검색 지원 노드.
// 지식 기반에서 관련 컨텍스트를 검색하여 상태에 추가.

import { Command } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentState } from './state-schema.js';

const SUPPORTER_PROMPT = `You are a research assistant. Based on the user's question, generate a search query
that would help find relevant information. Summarize any retrieved context.

If no additional context is needed, respond with "NO_CONTEXT_NEEDED".`;

export function createSupporterNode(chatModel: BaseChatModel) {
  return async (state: AgentState): Promise<Command> => {
    const messages = [
      new SystemMessage(SUPPORTER_PROMPT),
      ...state.messages,
    ];

    const response = await chatModel.invoke(messages);
    const content = typeof response.content === 'string' ? response.content : '';

    // TODO: Phase 6+ — 실제 RAG VectorStore 검색 연동
    // 현재는 LLM 응답을 그대로 컨텍스트로 사용 (placeholder)
    const retrievedContext = content === 'NO_CONTEXT_NEEDED' ? null : content;

    return new Command({
      goto: 'supervisor',
      update: {
        currentAgent: 'supporter',
        retrievedContext,
        messages: [response],
      },
    });
  };
}
