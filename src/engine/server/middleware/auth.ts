// ─── Auth Middleware ──────────────────────────────────────
// Phase 7 — API key 기반 인증 미들웨어.
// 외부 REST API / Webhook 호출 시 인증 처리.

import type { Context, Next } from 'hono';

export interface AuthConfig {
  /** API keys 목록 (설정 또는 환경변수에서 로드) */
  apiKeys: string[];
  /** 인증 제외 경로 패턴 */
  excludePaths?: string[];
}

/**
 * Bearer token 또는 X-API-Key 헤더 기반 인증 미들웨어.
 *
 * @example
 * ```ts
 * app.use('/api/webhook/*', createAuthMiddleware({ apiKeys: ['secret-key'] }));
 * ```
 */
export function createAuthMiddleware(config: AuthConfig) {
  const { apiKeys, excludePaths = [] } = config;

  return async (c: Context, next: Next) => {
    const path = c.req.path;

    // 제외 경로 확인
    if (excludePaths.some((p) => path.startsWith(p))) {
      return next();
    }

    // API key 추출 (Bearer token 또는 X-API-Key 헤더)
    const authHeader = c.req.header('Authorization');
    const xApiKey = c.req.header('X-API-Key');

    let providedKey: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7).trim();
    } else if (xApiKey) {
      providedKey = xApiKey.trim();
    }

    if (!providedKey || !apiKeys.includes(providedKey)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
}
