// ─── Supervisor Node ─────────────────────────────────────
// Phase 5.2 — 의도 분류 + 에이전트 라우팅.
// 사용자 메시지를 분석하여 적절한 하위 에이전트로 라우팅.

import { Command } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentState } from './state-schema.js';

const SUPERVISOR_PROMPT = `You are a supervisor agent that routes user requests to the appropriate specialist.
Analyze the user's latest message and decide which agent should handle it.

Available agents:
- "manager": For complex multi-step tasks that need decomposition
- "worker": For straightforward single-step tasks (default for most queries)
- "supporter": For questions requiring knowledge retrieval (RAG) or web search
- "profiler": For post-processing analysis of conversation quality

Respond with ONLY the agent name (one word).
If the conversation is complete or the user says goodbye, respond with "__end__".`;

export function createSupervisorNode(chatModel: BaseChatModel) {
  return async (state: AgentState): Promise<Command> => {
    const messages = [
      new SystemMessage(SUPERVISOR_PROMPT),
      ...state.messages,
    ];

    const response = await chatModel.invoke(messages);
    const content = typeof response.content === 'string'
      ? response.content.trim().toLowerCase()
      : '';

    // 유효한 에이전트 이름 매핑
    const validTargets = ['manager', 'worker', 'supporter', 'profiler', '__end__'];
    const target = validTargets.includes(content) ? content : 'worker';

    return new Command({
      goto: target,
      update: {
        currentAgent: 'supervisor',
        messages: [response],
      },
    });
  };
}
