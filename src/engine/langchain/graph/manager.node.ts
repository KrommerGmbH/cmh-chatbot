// ─── Manager Node ────────────────────────────────────────
// Phase 5.2 — 복잡한 작업을 하위 태스크로 분해하여 Worker에 위임.

import { Command } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentState } from './state-schema.js';

const MANAGER_PROMPT = `You are a task manager agent. Break down complex user requests into smaller, actionable sub-tasks.
For each sub-task, describe it clearly in one line.
Return the sub-tasks as a JSON array of strings.

Example: ["Search for product information", "Compare prices", "Generate recommendation"]

If the task is already simple enough, return a single-item array.`;

export function createManagerNode(chatModel: BaseChatModel) {
  return async (state: AgentState): Promise<Command> => {
    const messages = [
      new SystemMessage(MANAGER_PROMPT),
      ...state.messages,
    ];

    const response = await chatModel.invoke(messages);
    const content = typeof response.content === 'string' ? response.content : '';

    // 태스크 파싱 시도
    let tasks: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) tasks = parsed;
    } catch {
      // JSON 파싱 실패 시 전체 내용을 단일 태스크로
      tasks = [content];
    }

    return new Command({
      goto: 'worker',
      update: {
        currentAgent: 'manager',
        taskQueue: tasks,
        messages: [response],
      },
    });
  };
}
