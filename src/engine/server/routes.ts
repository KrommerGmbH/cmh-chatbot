import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  streamText,
  generateText,
  createUIMessageStreamResponse,
} from 'ai';
import type { Logger } from '../core/logger.js';
import type { ChatServerConfig } from '../types/index.js';
import type { QueueManager } from '../queue/manager.js';
import type { ModelFactory } from '../provider/model-factory.js';
import type { RepositoryFactory } from '../data/repository-factory.js';
import type { Repository } from '../data/repository.js';
import type { LlmProvider } from '../data/entity/llm/llm-provider.entity.js';
import type { LlmModel } from '../data/entity/llm/llm-model.entity.js';
import { ENTITY_CMH_LLM_PROVIDER, ENTITY_CMH_LLM_MODEL } from '../data/seed.js';
import { getHealthStatus } from './health.js';
import { AttachmentService, createAttachmentRoutes } from '../attachment/index.js';
import { createAISdkModel } from '../provider/ai-sdk-factory.js';
import { buildDefaultGraph } from '../langchain/graph/builder.js';
import { createLangGraphStream } from '../langchain/graph/stream-bridge.js';
import { HumanMessage } from '@langchain/core/messages';
import { responseCache } from '../service/response-cache.service.js';
import { isUsableApiKey } from '../../shared/security/is-usable-api-key.js';
import {
  deleteProviderApiKey,
  migrateProviderApiKeyToKeychain,
  resolveProviderApiKey,
  storeProviderApiKey,
} from '../security/provider-keychain.service.js';
import { registerChatAndGenerateRoutes } from './routes/chat-generate.route.js';
import { createProviderModelsCriteria, createProviderSearchCriteria } from './routes/criteria-factory.js';
import { createOpenApiDocument, createSwaggerUiHtml } from './routes/openapi.js';

export interface RouteContext {
  config: ChatServerConfig;
  /** llama-server base URL for OpenAI API calls */
  llamaServerUrl: string;
  logger: Logger;
  queue: QueueManager | null;
  /** Model factory for multi-provider support (DAL-powered) */
  modelFactory: ModelFactory;
  /** Shopware DAL-compatible repository factory */
  repositoryFactory: RepositoryFactory;
  startedAt: Date;
  /** 파일 첨부 서비스 (optional — 없으면 upload 라우트 미등록) */
  attachmentService?: AttachmentService;
  /** LangGraph orchestrator (optional — 없으면 /api/workflow 미지원) */
  orchestrator?: { runWorkflow(id: string, input: Record<string, unknown>): Promise<{ output?: unknown; stream?: { toUIMessageStreamResponse(): Response }; status?: string }> };
}

/**
 * Build the Hono application with all routes.
 * Chat endpoint proxies llama-server SSE → Vercel AI SDK Data Stream Protocol.
 */
export function createRoutes(ctx: RouteContext): Hono {
  const app = new Hono();

  const rateWindowMs = 60_000;
  const maxRequestsPerWindow = 60;
  const rateBucket = new Map<string, { count: number; windowStart: number }>();

  const getRateLimitKey = (c: { req: { header(name: string): string | undefined } }): string => {
    const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = c.req.header('x-real-ip')?.trim();
    const cfConnectingIp = c.req.header('cf-connecting-ip')?.trim();
    return forwardedFor || realIp || cfConnectingIp || 'unknown-client';
  };

  const isRateLimited = (key: string, now: number): boolean => {
    const current = rateBucket.get(key);
    if (!current || now - current.windowStart >= rateWindowMs) {
      rateBucket.set(key, { count: 1, windowStart: now });
      return false;
    }

    current.count += 1;
    if (current.count > maxRequestsPerWindow) return true;
    rateBucket.set(key, current);
    return false;
  };

  const cleanupRateLimitBucket = (now: number): void => {
    if (rateBucket.size < 1000) return;
    for (const [k, v] of rateBucket.entries()) {
      if (now - v.windowStart >= rateWindowMs * 3) {
        rateBucket.delete(k);
      }
    }
  };

  // ---- Middleware ----
  app.use('*', cors({ origin: ctx.config.cors?.origin ?? '*' }));
  app.use('/api/chat', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      await next();
      return;
    }

    const now = Date.now();
    cleanupRateLimitBucket(now);
    const key = getRateLimitKey(c);
    if (isRateLimited(key, now)) {
      return c.json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: maxRequestsPerWindow,
        windowMs: rateWindowMs,
      }, 429);
    }

    await next();
  });
  app.use('/api/generate', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      await next();
      return;
    }

    const now = Date.now();
    cleanupRateLimitBucket(now);
    const key = getRateLimitKey(c);
    if (isRateLimited(key, now)) {
      return c.json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: maxRequestsPerWindow,
        windowMs: rateWindowMs,
      }, 429);
    }

    await next();
  });

  // ---- Health ----
  app.get('/health', async (c) => {
    const status = await getHealthStatus(ctx.queue, ctx.startedAt);
    return c.json(status);
  });
  // Alias for Vite proxy (/api → port 4000, so /api/health → /api/health here)
  app.get('/api/health', async (c) => {
    const status = await getHealthStatus(ctx.queue, ctx.startedAt);
    return c.json(status);
  });

  // ---- API Docs (OpenAPI + Swagger UI) ----
  app.get('/api/openapi.json', (c) => {
    const origin = c.req.header('origin') ?? `${c.req.url.startsWith('https://') ? 'https' : 'http'}://${c.req.header('host') ?? '127.0.0.1:4000'}`;
    return c.json(createOpenApiDocument({ origin }));
  });

  app.get('/api/docs', (c) => {
    const html = createSwaggerUiHtml('/api/openapi.json');
    return c.html(html);
  });

  // ---- Provider / Model Repositories (DAL-powered) ----
  const providerRepo = ctx.repositoryFactory.create(ENTITY_CMH_LLM_PROVIDER) as Repository<LlmProvider>;
  const modelRepo = ctx.repositoryFactory.create(ENTITY_CMH_LLM_MODEL) as Repository<LlmModel>;
  registerChatAndGenerateRoutes({ app, ctx, providerRepo });

  // ---- Cache admin endpoints (B-4) ----
  app.get('/api/cache/stats', (c) => c.json(responseCache.stats()));
  app.post('/api/cache/clear', (c) => { responseCache.clear(); return c.json({ ok: true }); });

  // ---- Metrics endpoint (B-6) ----
  app.get('/api/metrics', async (c) => {
    const { metrics } = await import('../service/metrics.service.js');
    c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return c.text(metrics.export());
  });

  // ---- Queue-based inference (if Redis available) ----
  app.post('/api/queue/infer', async (c) => {
    if (!ctx.queue) {
      return c.json({ error: 'Queue not available (Redis not configured)' }, 503);
    }

    const body = await c.req.json<{
      messages: Array<{ role: string; content: string }>;
      system?: string;
      priority?: number;
    }>();

    if (!body.messages || !Array.isArray(body.messages)) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    try {
      const jobId = await ctx.queue.addJob(
        { messages: body.messages, system: body.system },
        { priority: body.priority },
      );
      return c.json({ jobId, status: 'queued' }, 202);
    } catch (error) {
      ctx.logger.error({ error }, 'queue:add-error');
      return c.json(
        { error: error instanceof Error ? error.message : 'Queue error' },
        500,
      );
    }
  });

  // ---- Provider / Model CRUD endpoints (DAL-powered) ----

  app.get('/api/providers', async (c) => {
    try {
      const type = c.req.query('type');
      const isActive = c.req.query('isActive');

      const criteria = createProviderSearchCriteria({ type, isActive, limit: 100 });

      const result = await providerRepo.search(criteria);
      const providers = await Promise.all(result.data.map(async (p) => {
        const migratedApiKey = await migrateProviderApiKeyToKeychain(p);
        if (migratedApiKey && migratedApiKey !== p.apiKey) {
          await providerRepo.save({
            ...p,
            apiKey: migratedApiKey,
            updatedAt: new Date().toISOString(),
          } as LlmProvider);
          p.apiKey = migratedApiKey;
        }

        const resolvedApiKey = await resolveProviderApiKey(p);
        return {
          ...p,
          apiKey: null,
          hasApiKey: isUsableApiKey(resolvedApiKey),
        };
      }));
      return c.json({ providers, total: result.total });
    } catch (error) {
      ctx.logger.error({ error }, 'providers:list-error');
      return c.json({ providers: [], total: 0, warning: 'provider list unavailable' }, 200);
    }
  });

  app.post('/api/providers/secure-save', async (c) => {
    try {
      const body = await c.req.json<Partial<LlmProvider> & { clearApiKey?: boolean }>();
      const providerId = (body.id ?? '').trim();
      if (!providerId) {
        return c.json({ error: 'provider id is required' }, 400);
      }

      const existing = await providerRepo.get(providerId);
      const nowIso = new Date().toISOString();
      let nextApiKey = existing?.apiKey ?? null;

      if (body.clearApiKey) {
        await deleteProviderApiKey(providerId);
        nextApiKey = null;
      } else if (typeof body.apiKey === 'string' && isUsableApiKey(body.apiKey)) {
        nextApiKey = await storeProviderApiKey(providerId, body.apiKey);
      }

      const payload: LlmProvider = {
        ...(existing ?? {} as LlmProvider),
        ...(body as LlmProvider),
        id: providerId,
        apiKey: nextApiKey,
        createdAt: existing?.createdAt ?? body.createdAt ?? nowIso,
        updatedAt: nowIso,
      };

      const saved = await providerRepo.save(payload);
      const resolvedApiKey = await resolveProviderApiKey(saved);

      return c.json({
        provider: {
          ...saved,
          apiKey: null,
          hasApiKey: isUsableApiKey(resolvedApiKey),
        },
      });
    } catch (error) {
      ctx.logger.error({ error }, 'providers:secure-save-error');
      return c.json({
        error: 'Failed to save provider securely',
        detail: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  app.get('/api/providers/:providerId/models', async (c) => {
    try {
      const providerId = c.req.param('providerId');

      const criteria = createProviderModelsCriteria(providerId, 100);

      const result = await modelRepo.search(criteria);
      return c.json({ models: result.data, total: result.total });
    } catch (error) {
      ctx.logger.error({ error }, 'providers:models-list-error');
      return c.json({ models: [], total: 0, warning: 'provider model list unavailable' }, 200);
    }
  });

  app.get('/api/models/:modelId', async (c) => {
    const modelId = c.req.param('modelId');
    const model = await modelRepo.get(modelId);
    if (!model) return c.json({ error: 'Model not found' }, 404);
    return c.json({ model });
  });

  // ---- Cloud Model Discovery (실시간 provider API 모델 목록 조회) ----
  app.get('/api/providers/:providerId/remote-models', async (c) => {
    const providerId = c.req.param('providerId');
    const provider = await providerRepo.get(providerId);
    if (!provider) return c.json({ error: 'Provider not found' }, 404);
    if (provider.type !== 'cloud-api') {
      return c.json({ error: 'Only cloud-api providers are supported' }, 400);
    }

    const providerName = (provider.name ?? '').toLowerCase();
    const providerKey = providerName.includes('google') || providerName.includes('gemini')
      ? 'google'
      : providerName.includes('github') || providerName.includes('copilot')
        ? 'github'
        : 'openai';

    const migratedApiKey = await migrateProviderApiKeyToKeychain(provider);
    if (migratedApiKey && migratedApiKey !== provider.apiKey) {
      provider.apiKey = migratedApiKey;
      await providerRepo.save({ ...provider, updatedAt: new Date().toISOString() });
    }

    const providerApiKeyResolved = await resolveProviderApiKey(provider);

    // API key가 없어도 400을 내지 않고, UI가 렌더링 가능한 안전 기본 목록을 반환.
    if (!isUsableApiKey(providerApiKeyResolved)) {
      return c.json({
        models: [],
        provider: providerKey,
        requiresApiKey: true,
        warning: 'API key is missing. Add a real key in Provider settings to fetch remote model list.',
      }, 200);
    }

    const providerApiKey = providerApiKeyResolved as string;

    try {
      // Google Gemini — generativelanguage API
      if (providerName.includes('google') || providerName.includes('gemini')) {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${providerApiKey}`,
        );
        if (!resp.ok) {
          // UI 콘솔에 502 리소스 오류를 남기지 않도록 빈 목록으로 응답
          return c.json({
            models: [],
            provider: 'google',
            warning: `Google API error: ${resp.status}`,
          });
        }
        const data = await resp.json() as { models?: Array<{ name: string; displayName: string; description?: string; supportedGenerationMethods?: string[] }> };
        const models = (data.models ?? []).map((m) => ({
          modelId: m.name.replace('models/', ''),
          name: m.displayName,
          description: m.description ?? '',
          capabilities: m.supportedGenerationMethods ?? [],
        }));
        return c.json({ models, provider: 'google' });
      }

      // GitHub Copilot / GitHub Models — 공식 Catalog API
      if (providerName.includes('github') || providerName.includes('copilot')) {
        const resp = await fetch('https://models.github.ai/catalog/models', {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${providerApiKey}`,
            'X-GitHub-Api-Version': '2026-03-10',
          },
        });
        if (!resp.ok) {
          return c.json({
            models: [],
            provider: 'github',
            warning: `GitHub Models API error: ${resp.status}`,
          });
        }
        const data = await resp.json() as Array<{
          id: string;
          name?: string;
          summary?: string;
          capabilities?: string[];
        }>;
        const models = (data ?? []).map((m) => ({
          modelId: m.id,
          name: m.name ?? m.id,
          description: m.summary ?? '',
          capabilities: m.capabilities ?? [],
        }));
        return c.json({ models, provider: 'github' });
      }

      // OpenAI / OpenAI-compatible — /v1/models
      const baseUrl = provider.baseUrl ?? 'https://api.openai.com';
      const resp = await fetch(`${baseUrl.replace(/\/v1\/?$/, '')}/v1/models`, {
        headers: { Authorization: `Bearer ${providerApiKey}` },
      });
      if (!resp.ok) {
        return c.json({
          models: [],
          provider: 'openai',
          warning: `API error: ${resp.status}`,
        });
      }
      const data = await resp.json() as { data?: Array<{ id: string; object?: string }> };
      const models = (data.data ?? []).map((m) => ({
        modelId: m.id,
        name: m.id,
        description: '',
        capabilities: [],
      }));
      return c.json({ models, provider: 'openai' });
    } catch (error) {
      ctx.logger.error({ error, providerId }, 'remote-models:fetch-error');
      return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch remote models' }, 500);
    }
  });

  // ---- Attachment (file upload / download) ----
  if (ctx.attachmentService) {
    app.route('/api', createAttachmentRoutes(ctx.attachmentService));
  }

  // ---- Workflow (LangGraph Multi-Agent) ----
  app.post('/api/workflow', async (c) => {
    const body = await c.req.json<{
      message: string;
      modelId?: string;
      conversationId?: string;
      userId?: string;
    }>();

    if (!body.message) {
      return c.json({ error: 'message is required' }, 400);
    }

    // Resolve model → LangChain BaseChatModel
    const chatModel = await ctx.modelFactory.resolveChatModel(body.modelId);
    if (!chatModel) {
      return c.json({ error: 'Model not available' }, 503);
    }

    // Build default graph
    const compiledGraph = buildDefaultGraph(chatModel) as unknown as Parameters<typeof createLangGraphStream>[0];

    // Create LangGraph → AI SDK Data Stream bridge
    const stream = createLangGraphStream(
      compiledGraph,
      {
        messages: [new HumanMessage(body.message)],
        conversationId: body.conversationId ?? null,
        userId: body.userId ?? null,
      },
      { logger: ctx.logger, sendNodeMetadata: true },
    );

    return createUIMessageStreamResponse({ stream });
  });

  // ---- RAG Query ----
  app.post('/api/rag', async (c) => {
    const body = await c.req.json<{
      query: string;
      modelId?: string;
      sources?: ('conversation' | 'document')[];
      topK?: number;
      maxTokens?: number;
    }>();

    if (!body.query) {
      return c.json({ error: 'query is required' }, 400);
    }

    // RAG pipeline은 host app에서 주입하므로 여기서는 간단한 skeleton
    // 실제 구현은 RAGPipeline.retrieve() + generateText()
    const resolved = await ctx.modelFactory.resolve(body.modelId);
    if (!resolved) {
      return c.json({ error: 'Model not available' }, 503);
    }

    const model = createAISdkModel(resolved);

    // TODO: 실제 RAG pipeline.retrieve() 연동 — 현재는 직접 응답
    const result = await generateText({
      model,
      system: 'Answer the question based on available knowledge. If you don\'t know, say so.',
      messages: [{ role: 'user' as const, content: body.query }],
      maxOutputTokens: body.maxTokens ?? 2048,
    });

    return c.json({
      answer: result.text,
      usage: result.usage,
      sources: [], // RAG pipeline 연동 시 검색된 소스 반환
    });
  });

  // ---- Webhook (External Trigger) ----
  app.post('/api/webhook/chat', async (c) => {
    const body = await c.req.json<{
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      modelId?: string;
      system?: string;
      maxTokens?: number;
      /** 응답 형식: 'stream' | 'json' (기본: 'json') */
      responseFormat?: 'stream' | 'json';
    }>();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    const resolved = await ctx.modelFactory.resolve(body.modelId);
    if (!resolved) {
      return c.json({ error: 'Model not available' }, 503);
    }

    const model = createAISdkModel(resolved);
    const systemPrompt = body.system ?? 'You are a helpful AI assistant.';

    if (body.responseFormat === 'stream') {
      const result = streamText({
        model,
        system: systemPrompt,
        messages: body.messages,
        maxOutputTokens: body.maxTokens ?? 2048,
      });
      return result.toUIMessageStreamResponse();
    }

    // Non-streaming JSON response
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: body.messages,
      maxOutputTokens: body.maxTokens ?? 2048,
    });

    return c.json({
      text: result.text,
      finishReason: result.finishReason,
      usage: result.usage,
    });
  });

  // ---- B-10: /api/workflow — Dedicated workflow endpoint ----
  app.post('/api/workflow', async (c) => {
    const body = await c.req.json<{
      workflowId: string;
      input: Record<string, unknown>;
      modelId?: string;
      stream?: boolean;
    }>();

    if (!body.workflowId) {
      return c.json({ error: 'workflowId is required' }, 400);
    }

    const resolved = body.modelId ? await ctx.modelFactory.resolve(body.modelId) : null;
    const model = resolved ? createAISdkModel(resolved) : null;

    // Delegate to orchestration layer if available
    if (ctx.orchestrator) {
      try {
        const result = await ctx.orchestrator.runWorkflow(body.workflowId, {
          ...body.input,
          model,
        });

        if (body.stream && result.stream) {
          return result.stream.toUIMessageStreamResponse();
        }

        return c.json({
          workflowId: body.workflowId,
          output: result.output,
          status: result.status ?? 'completed',
        });
      } catch (error) {
        ctx.logger.error({ error, workflowId: body.workflowId }, 'workflow:error');
        return c.json(
          { error: error instanceof Error ? error.message : 'Workflow execution failed' },
          500,
        );
      }
    }

    return c.json({ error: 'Orchestrator not configured' }, 503);
  });

  return app;
}
