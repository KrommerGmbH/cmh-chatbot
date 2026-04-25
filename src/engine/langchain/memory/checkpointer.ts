// ─── Checkpointer Factory ────────────────────────────────
// Phase 5.5 — 환경별 체크포인터 팩토리.

import { MemorySaver } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph';

export type CheckpointerType = 'memory' | 'sqlite' | 'postgres';

export interface CheckpointerOptions {
  type: CheckpointerType;
  /** SQLite DB 파일 경로 (sqlite 전용) */
  dbPath?: string;
  /** Postgres 연결 문자열 (postgres 전용) */
  connectionString?: string;
}

/**
 * 환경별 체크포인터 생성.
 *
 * - `memory`: 개발/테스트용 (MemorySaver)
 * - `sqlite`: Electron 배포용 (Phase 5.5+ 에서 @langchain/langgraph-checkpoint-sqlite 설치 후)
 * - `postgres`: Docker 배포용 (Phase 5.5+ 에서 @langchain/langgraph-checkpoint-postgres 설치 후)
 *
 * 현재는 MemorySaver만 구현. SQLite/Postgres는 패키지 설치 후 동적 import로 확장.
 */
export async function createCheckpointer(
  options: CheckpointerOptions = { type: 'memory' },
): Promise<BaseCheckpointSaver> {
  switch (options.type) {
    case 'sqlite': {
      // TODO: pnpm add @langchain/langgraph-checkpoint-sqlite 후 활성화
      // const { SqliteSaver } = await import('@langchain/langgraph-checkpoint-sqlite');
      // return SqliteSaver.fromConnString(options.dbPath ?? ':memory:');
      console.warn('[checkpointer] SQLite not yet available, falling back to MemorySaver');
      return new MemorySaver();
    }
    case 'postgres': {
      // TODO: pnpm add @langchain/langgraph-checkpoint-postgres 후 활성화
      // const { PostgresSaver } = await import('@langchain/langgraph-checkpoint-postgres');
      // return PostgresSaver.fromConnString(options.connectionString!);
      console.warn('[checkpointer] Postgres not yet available, falling back to MemorySaver');
      return new MemorySaver();
    }
    case 'memory':
    default:
      return new MemorySaver();
  }
}
