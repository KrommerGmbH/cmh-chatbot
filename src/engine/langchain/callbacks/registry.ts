// ─── Callback Handler Registry ───────────────────────────
// Phase 7.0 — 중앙 레지스트리.
// 모듈/프로세스에서 CallbackHandler를 등록·해제·조회할 수 있는 싱글톤.

import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export type CallbackHandlerFactory = () => BaseCallbackHandler;

interface RegisteredHandler {
  id: string;
  name: string;
  description?: string;
  factory: CallbackHandlerFactory;
  /** 자동으로 모든 LLM 호출에 주입할지 여부 */
  autoAttach: boolean;
  /** 등록 순서 (우선순위) */
  priority: number;
}

class CallbackHandlerRegistryClass {
  private handlers = new Map<string, RegisteredHandler>();

  /**
   * 콜백 핸들러를 레지스트리에 등록.
   * 모듈이나 외부 프로세스에서 `register()`로 자유롭게 추가 가능.
   */
  register(entry: {
    id: string;
    name: string;
    description?: string;
    factory: CallbackHandlerFactory;
    autoAttach?: boolean;
    priority?: number;
  }): void {
    this.handlers.set(entry.id, {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      factory: entry.factory,
      autoAttach: entry.autoAttach ?? false,
      priority: entry.priority ?? 100,
    });
  }

  /** 핸들러 등록 해제 */
  unregister(id: string): boolean {
    return this.handlers.delete(id);
  }

  /** 등록된 모든 핸들러 메타 정보 조회 */
  list(): RegisteredHandler[] {
    return [...this.handlers.values()].sort((a, b) => a.priority - b.priority);
  }

  /** ID로 핸들러 팩토리 조회 */
  get(id: string): RegisteredHandler | undefined {
    return this.handlers.get(id);
  }

  /** autoAttach=true 인 핸들러 인스턴스 배열 반환 */
  createAutoAttachHandlers(): BaseCallbackHandler[] {
    return this.list()
      .filter((h) => h.autoAttach)
      .map((h) => h.factory());
  }

  /** 지정 ID 목록의 핸들러 인스턴스 배열 반환 */
  createHandlers(ids: string[]): BaseCallbackHandler[] {
    return ids
      .map((id) => this.handlers.get(id))
      .filter((h): h is RegisteredHandler => !!h)
      .sort((a, b) => a.priority - b.priority)
      .map((h) => h.factory());
  }

  /** 전체 초기화 */
  clear(): void {
    this.handlers.clear();
  }
}

/** 싱글톤 레지스트리 */
export const CallbackHandlerRegistry = new CallbackHandlerRegistryClass();
