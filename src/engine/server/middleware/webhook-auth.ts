/**
 * B-9: Webhook HMAC signature verification middleware.
 *
 * External triggers (GitHub, Shopware, custom) sign payloads with HMAC-SHA256.
 * This middleware verifies the signature before allowing the request.
 *
 * Headers: X-Webhook-Signature: sha256=<hex>
 */
import type { Context, Next } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookAuthConfig {
  /** Shared secret for HMAC computation */
  secret: string;
  /** Header name containing the signature (default: X-Webhook-Signature) */
  signatureHeader?: string;
  /** Algorithm (default: sha256) */
  algorithm?: string;
}

/**
 * HMAC signature verification middleware for webhook endpoints.
 */
export function createWebhookAuthMiddleware(config: WebhookAuthConfig) {
  const { secret, signatureHeader = 'X-Webhook-Signature', algorithm = 'sha256' } = config;

  return async (c: Context, next: Next) => {
    const signature = c.req.header(signatureHeader);
    if (!signature) {
      return c.json({ error: 'Missing webhook signature' }, 401);
    }

    // Parse "sha256=<hex>" format
    const [algo, hash] = signature.split('=');
    if (!algo || !hash) {
      return c.json({ error: 'Invalid signature format' }, 401);
    }

    // Read raw body for verification
    const body = await c.req.text();

    const expected = createHmac(algorithm, secret)
      .update(body, 'utf8')
      .digest('hex');

    const sigBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return c.json({ error: 'Invalid webhook signature' }, 401);
    }

    // Store parsed body for downstream handlers
    (c as any)._webhookBody = body;

    return next();
  };
}

/**
 * Utility: Generate a webhook signature for testing.
 */
export function signPayload(payload: string, secret: string, algorithm = 'sha256'): string {
  const hash = createHmac(algorithm, secret).update(payload, 'utf8').digest('hex');
  return `${algorithm}=${hash}`;
}
