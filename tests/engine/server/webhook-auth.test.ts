import { describe, expect, it, vi } from 'vitest'
import { createWebhookAuthMiddleware, signPayload } from '../../../src/engine/server/middleware/webhook-auth'

describe('webhook-auth middleware', () => {
  it('accepts a valid signature', async () => {
    const secret = 'test-secret'
    const body = '{"hello":"world"}'
    const signature = signPayload(body, secret)

    const middleware = createWebhookAuthMiddleware({ secret })
    const next = vi.fn(async () => {})

    const c = {
      req: {
        header: (name: string) => name === 'X-Webhook-Signature' ? signature : undefined,
        text: async () => body,
      },
      json: (_payload: unknown, _status?: number) => ({ ok: false }),
    } as any

    await middleware(c, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects an invalid signature', async () => {
    const secret = 'test-secret'
    const body = '{"hello":"world"}'

    const middleware = createWebhookAuthMiddleware({ secret })
    const next = vi.fn(async () => {})

    const c = {
      req: {
        header: (name: string) => name === 'X-Webhook-Signature' ? 'sha256=deadbeef' : undefined,
        text: async () => body,
      },
      json: (_payload: unknown, _status?: number) => ({ ok: false }),
    } as any

    await middleware(c, next)
    expect(next).not.toHaveBeenCalled()
  })
})
