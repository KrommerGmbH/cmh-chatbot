// ─── Human Gate Node ─────────────────────────────────────
// Phase 5.4 — SecurityGate → interrupt() + HITL 통합.
// 위험한 작업 실행 전 사용자 승인을 대기하는 노드.

import { interrupt, Command, END } from '@langchain/langgraph';
import type { AgentState } from './state-schema.js';

/**
 * Human-in-the-Loop 게이트 노드.
 *
 * `securityLevel === 'approve'`일 때 Worker에서 라우팅됨.
 * `interrupt()`로 그래프 실행을 중단하고 UI에 승인 요청을 보냄.
 * 사용자가 `Command({ resume: 'approve' | 'reject' })`로 재개.
 */
export async function humanGateNode(state: AgentState): Promise<Command> {
  // 마지막 메시지에서 승인 대상 내용 추출
  const lastMessage = state.messages[state.messages.length - 1];
  const content = typeof lastMessage?.content === 'string' ? lastMessage.content : '';

  // interrupt() — 그래프 실행 중단, UI에 승인 요청 전달
  const approval = interrupt({
    action: content,
    reason: 'This action requires user approval before execution.',
    securityLevel: state.securityLevel,
    options: ['approve', 'reject'],
  });

  if (approval === 'approve') {
    return new Command({
      goto: 'worker',
      update: {
        securityLevel: 'auto',
        currentAgent: 'human_gate',
      },
    });
  }

  // reject → 대화 종료
  return new Command({
    goto: END,
    update: {
      currentAgent: 'human_gate',
    },
  });
}
