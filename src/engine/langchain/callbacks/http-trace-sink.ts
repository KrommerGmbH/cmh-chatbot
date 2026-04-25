/**
 * B-3: HTTP Trace Sink — sends TraceSpans to LangSmith or LangFuse via HTTP.
 *
 * Supports batching (flush every 5s or 50 spans) for efficiency.
 *
 * Config via environment variables:
 *   LANGSMITH_API_KEY + LANGSMITH_ENDPOINT → LangSmith
 *   LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY + LANGFUSE_HOST → LangFuse
 */
import type { TraceSpan, TraceSink } from './tracing.handler.js';

export interface HttpSinkConfig {
  type: 'langsmith' | 'langfuse';
  endpoint: string;
  apiKey: string;
  secretKey?: string; // LangFuse only
  batchSize?: number;
  flushIntervalMs?: number;
}

export function createHttpTraceSink(config: HttpSinkConfig): TraceSink {
  const buffer: TraceSpan[] = [];
  const batchSize = config.batchSize ?? 50;
  const flushInterval = config.flushIntervalMs ?? 5000;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);

    try {
      if (config.type === 'langsmith') {
        await sendToLangSmith(config, batch);
      } else {
        await sendToLangFuse(config, batch);
      }
    } catch (e) {
      // Silently drop on failure — observability should not break app
      console.warn('[HttpTraceSink] flush failed:', (e as Error).message);
    }
  }

  // Start periodic flush
  timer = setInterval(() => { void flush(); }, flushInterval);
  // Allow process to exit
  if (timer && typeof timer === 'object' && 'unref' in timer) {
    (timer as any).unref();
  }

  const sink: TraceSink = (span: TraceSpan) => {
    buffer.push(span);
    if (buffer.length >= batchSize) {
      void flush();
    }
  };

  return sink;
}

async function sendToLangSmith(config: HttpSinkConfig, spans: TraceSpan[]): Promise<void> {
  const runs = spans.map((s) => ({
    id: s.spanId,
    trace_id: s.traceId,
    parent_run_id: s.parentSpanId,
    name: s.name,
    start_time: new Date(s.startTime).toISOString(),
    end_time: s.endTime ? new Date(s.endTime).toISOString() : undefined,
    status: s.status === 'error' ? 'error' : 'success',
    extra: s.metadata,
    run_type: s.name === 'llm' ? 'llm' : s.name === 'chain' ? 'chain' : 'tool',
  }));

  await fetch(`${config.endpoint}/runs/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({ post: runs, patch: [] }),
  });
}

async function sendToLangFuse(config: HttpSinkConfig, spans: TraceSpan[]): Promise<void> {
  const events = spans.map((s) => ({
    id: s.spanId,
    traceId: s.traceId,
    parentObservationId: s.parentSpanId,
    name: s.name,
    startTime: new Date(s.startTime).toISOString(),
    endTime: s.endTime ? new Date(s.endTime).toISOString() : undefined,
    level: s.status === 'error' ? 'ERROR' : 'DEFAULT',
    metadata: s.metadata,
    type: s.endTime ? 'span-update' : 'span-create',
  }));

  const authToken = Buffer.from(`${config.apiKey}:${config.secretKey ?? ''}`).toString('base64');

  await fetch(`${config.endpoint}/api/public/ingestion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authToken}`,
    },
    body: JSON.stringify({ batch: events }),
  });
}

/**
 * Auto-detect and create sink from environment variables.
 * Returns null if no configuration found.
 */
export function createSinkFromEnv(): TraceSink | null {
  const lsKey = process.env.LANGSMITH_API_KEY;
  const lsEndpoint = process.env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com';

  if (lsKey) {
    return createHttpTraceSink({
      type: 'langsmith',
      endpoint: lsEndpoint,
      apiKey: lsKey,
    });
  }

  const lfPublic = process.env.LANGFUSE_PUBLIC_KEY;
  const lfSecret = process.env.LANGFUSE_SECRET_KEY;
  const lfHost = process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com';

  if (lfPublic && lfSecret) {
    return createHttpTraceSink({
      type: 'langfuse',
      endpoint: lfHost,
      apiKey: lfPublic,
      secretKey: lfSecret,
    });
  }

  return null;
}
