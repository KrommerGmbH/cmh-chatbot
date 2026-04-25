// ─── Worker Node ─────────────────────────────────────────
// Phase 5.2 — 실제 작업 수행 노드. LLM 추론 + 도구 호출.

import { Command } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentState, SecurityLevel } from './state-schema.js';

const WORKER_PROMPT = `You are a helpful AI assistant. Answer the user's question directly and helpfully.
If you need to perform an action that could have real-world consequences (payments, deletions, etc.),
indicate this by starting your response with "[APPROVE_NEEDED]".

Be concise, accurate, and helpful.`;

export function createWorkerNode(chatModel: BaseChatModel) {
  return async (state: AgentState): Promise<Command> => {
    // RAG 컨텍스트가 있으면 시스템 프롬프트에 포함
    const contextPart = state.retrievedContext
      ? `\n\nRelevant context:\n${state.retrievedContext}`
      : '';

    const messages = [
      new SystemMessage(WORKER_PROMPT + contextPart),
      ...state.messages,
    ];

    const response = await chatModel.invoke(messages);
    const content = typeof response.content === 'string' ? response.content : '';

    // 승인 필요 여부 판단
    let securityLevel: SecurityLevel = 'auto';
    let goto = 'supervisor';

    if (content.startsWith('[APPROVE_NEEDED]')) {
      securityLevel = 'approve';
      goto = 'human_gate';
    }

    // 태스크 큐에서 완료 처리
    const completedTask = state.taskQueue[0] ?? null;

    return new Command({
      goto,
      update: {
        currentAgent: 'worker',
        securityLevel,
        completedTasks: completedTask ? [completedTask] : [],
        messages: [response],
      },
    });
  };
}
