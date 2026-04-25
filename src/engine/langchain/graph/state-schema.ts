// ─── LangGraph State Schema ──────────────────────────────
// Phase 5.1 — Annotation.Root 기반 상태 스키마 정의.
// cmh-chatbot 멀티에이전트 그래프의 공유 상태.

import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

/**
 * 보안 레벨 — SecurityGate에서 판단.
 * - `auto`: 자동 실행 (승인 불필요)
 * - `notify`: 실행 후 사용자에게 알림
 * - `approve`: 실행 전 사용자 승인 필요 (HITL interrupt)
 */
export type SecurityLevel = 'auto' | 'notify' | 'approve';

/**
 * 에이전트 그래프 공유 상태 스키마.
 *
 * `MessagesAnnotation.spec`을 확장하여 메시지 히스토리 + 멀티에이전트 컨텍스트를 관리.
 */
export const AgentStateAnnotation = Annotation.Root({
  /** LangChain 메시지 히스토리 (reducer: messagesStateReducer) */
  ...MessagesAnnotation.spec,

  /** 현재 활성 에이전트 ID */
  currentAgent: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => 'supervisor',
  }),

  /** 대기 중인 작업 큐 (reducer: append) */
  taskQueue: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** 완료된 작업 목록 (reducer: append) */
  completedTasks: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** 보안 레벨 */
  securityLevel: Annotation<SecurityLevel>({
    reducer: (_prev, next) => next,
    default: () => 'auto',
  }),

  /** 사용자 ID (장기 메모리 검색 키) */
  userId: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** 대화 ID (Conversation entity FK) */
  conversationId: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Profiler 분석 결과 (사용자 선호도, 감정 등) */
  profileData: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => ({ ..._prev, ...next }),
    default: () => ({}),
  }),

  /** RAG 검색 결과 컨텍스트 */
  retrievedContext: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

/** 상태 타입 추론 헬퍼 */
export type AgentState = typeof AgentStateAnnotation.State;
export type AgentStateUpdate = typeof AgentStateAnnotation.Update;
