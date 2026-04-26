import type { Hono } from 'hono'
import {
  streamText,
  generateText,
  type UIMessage,
  type ModelMessage,
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { trimHistory, estimateTokens, calcMaxTokens } from '../../service/token-counter.js'
import { createAISdkModel } from '../../provider/ai-sdk-factory.js'
import { responseCache } from '../../service/response-cache.service.js'
import type { Repository } from '../../data/repository.js'
import type { LlmProvider } from '../../data/entity/llm/llm-provider.entity.js'
import type { RouteContext } from '../routes.js'
import type { ResolvedModel } from '../../provider/model-factory.js'
import { isUsableApiKey } from '../../../shared/security/is-usable-api-key.js'
import {
  migrateProviderApiKeyToKeychain,
  resolveProviderApiKey,
} from '../../security/provider-keychain.service.js'
import { createAllProvidersCriteria } from './criteria-factory.js'

type NormalizedContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; mediaType?: string }

type NormalizedModelMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | NormalizedContentPart[]
}

function getMessageTextContent(message: UIMessage | { content?: unknown }): string {
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .filter((p): p is { type?: unknown; text?: unknown } => typeof p === 'object' && p !== null)
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join(' ')
}

function getUsageTokens(usage: unknown): number | undefined {
  if (!usage || typeof usage !== 'object') return undefined
  const u = usage as { outputTokens?: unknown; completionTokens?: unknown }
  if (typeof u.outputTokens === 'number') return u.outputTokens
  if (typeof u.completionTokens === 'number') return u.completionTokens
  return undefined
}

interface RegisterChatGenerateDeps {
  ctx: RouteContext
  app: Hono
  providerRepo: Repository<LlmProvider>
}

interface ResolvedInferenceTarget {
  inferenceUrl: string
  apiKey: string
  resolvedModelId?: string
  resolved: ResolvedModel | null
  fallbackProvider: LlmProvider | null
}

interface ResolveInferenceTargetInput {
  ctx: RouteContext
  providerRepo: Repository<LlmProvider>
  modelId?: string
  rawModelId?: string
  clientProviderAuth?: string | null
  logTag: 'chat' | 'generate'
}

function isLikelyCloudRawModelId(rawModelId: string): boolean {
  const raw = (rawModelId ?? '').toLowerCase().trim()
  if (!raw) return false
  return raw.startsWith('gemini')
    || raw.startsWith('claude')
    || raw.startsWith('gpt-')
    || raw.startsWith('o1')
    || raw.startsWith('o3')
    || raw.startsWith('o4')
    || raw.includes('/')
}

function selectFallbackProvider(rawModelIdLower: string, providers: LlmProvider[]): LlmProvider | null {
  const withKey = providers.filter((p) => p.type === 'cloud-api' && p.isActive && isUsableApiKey(p.apiKey))
  const findByName = (keyword: 'google' | 'github' | 'anthropic' | 'openai'): LlmProvider | null => {
    return withKey.find((p) => {
      const n = (p.name ?? '').toLowerCase()
      if (keyword === 'google') return n.includes('google') || n.includes('gemini')
      if (keyword === 'github') return n.includes('github') || n.includes('copilot')
      if (keyword === 'anthropic') return n.includes('anthropic') || n.includes('claude')
      if (keyword === 'openai') return n.includes('openai')
      return false
    }) ?? null
  }

  if (rawModelIdLower.startsWith('gemini')) {
    return findByName('google')
  }

  if (rawModelIdLower.startsWith('google/')) {
    return findByName('google')
  }

  if (rawModelIdLower.startsWith('claude')) {
    return findByName('anthropic')
  }

  if (rawModelIdLower.startsWith('anthropic/')) {
    return findByName('anthropic')
  }

  // GitHub Models는 주로 vendor/model namespace(openai/gpt-4o, meta/...)를 사용
  if (rawModelIdLower.includes('/')) {
    const gh = findByName('github')
    if (gh) return gh
  }

  // OpenAI 네이티브 ID 우선 매칭
  if (
    rawModelIdLower.startsWith('gpt-')
    || rawModelIdLower.startsWith('o1')
    || rawModelIdLower.startsWith('o3')
    || rawModelIdLower.startsWith('o4')
  ) {
    const openai = findByName('openai')
    if (openai) return openai
  }

  return withKey.find(
    (p) => p.type === 'cloud-api' && p.isActive && isUsableApiKey(p.apiKey)
      && !((p.name ?? '').toLowerCase().includes('google')
        || (p.name ?? '').toLowerCase().includes('gemini')
        || (p.name ?? '').toLowerCase().includes('anthropic')
        || (p.name ?? '').toLowerCase().includes('claude')),
  ) ?? null
}

function normalizeModelIdForProvider(rawModelId: string, provider: LlmProvider): string {
  const input = (rawModelId ?? '').trim()
  if (!input) return input

  const providerName = (provider.name ?? '').toLowerCase()

  // Google SDK는 models/ 접두어 없이 gemini-* 형식을 기대함
  if (providerName.includes('google') || providerName.includes('gemini')) {
    return input.replace(/^models\//i, '').replace(/^google\//i, '')
  }

  // Anthropic SDK는 claude-* 형식을 기대함
  if (providerName.includes('anthropic') || providerName.includes('claude')) {
    return input.replace(/^anthropic\//i, '')
  }

  // OpenAI provider에서는 openai/gpt-4o 같은 namespace를 gpt-4o로 정규화
  if (providerName.includes('openai') && input.includes('/')) {
    const [, ...rest] = input.split('/')
    const normalized = rest.join('/')
    return normalized || input
  }

  // GitHub Models는 vendor/model namespace를 그대로 사용
  return input
}

async function resolveInferenceTarget({
  ctx,
  providerRepo,
  modelId,
  rawModelId,
  clientProviderAuth,
  logTag,
}: ResolveInferenceTargetInput): Promise<ResolvedInferenceTarget | { error: string }> {
  let inferenceUrl = ctx.llamaServerUrl
  let apiKey = clientProviderAuth ?? 'not-needed'
  let resolvedModelId: string | undefined
  let resolved: ResolvedModel | null = null
  let fallbackProvider: LlmProvider | null = null

  if (!modelId) {
    return { inferenceUrl, apiKey, resolvedModelId, resolved, fallbackProvider }
  }

  resolved = await ctx.modelFactory.resolve(modelId)
  if (resolved) {
    inferenceUrl = resolved.baseUrl
    resolvedModelId = resolved.model.modelId
    if (!clientProviderAuth && resolved.apiKey) {
      apiKey = resolved.apiKey
    }
    if (resolved.provider.type === 'cloud-api' && !isUsableApiKey(apiKey)) {
      return { error: 'Cloud provider API key is missing or mock key. Please set a valid API key.' }
    }
    return { inferenceUrl, apiKey, resolvedModelId, resolved, fallbackProvider }
  }

  resolvedModelId = rawModelId ?? modelId
  const raw = (rawModelId ?? '').toLowerCase()
  if (raw) {
    const providerCandidates = (await providerRepo.search(createAllProvidersCriteria(100))).data as LlmProvider[]
    fallbackProvider = selectFallbackProvider(raw, providerCandidates)

    if (fallbackProvider) {
      const migratedApiKey = await migrateProviderApiKeyToKeychain(fallbackProvider)
      if (migratedApiKey && migratedApiKey !== fallbackProvider.apiKey) {
        fallbackProvider.apiKey = migratedApiKey
        await providerRepo.save({
          ...fallbackProvider,
          apiKey: migratedApiKey,
          updatedAt: new Date().toISOString(),
        })
      }

      const fallbackApiKey = await resolveProviderApiKey(fallbackProvider)
      if (isUsableApiKey(fallbackApiKey)) {
        apiKey = fallbackApiKey as string
      } else if (fallbackProvider.type === 'cloud-api') {
        return {
          error: `Cloud provider API key is missing for "${fallbackProvider.name}". Please set a valid API key in Provider settings.`,
        }
      }
      inferenceUrl = fallbackProvider.baseUrl ?? inferenceUrl
      resolvedModelId = normalizeModelIdForProvider(resolvedModelId, fallbackProvider)
    } else if (isLikelyCloudRawModelId(raw)) {
      return {
        error: `Cloud model "${resolvedModelId}" requires an active provider with a valid API key. Please save API key in Provider settings first.`,
      }
    }
  }

  ctx.logger.warn({ modelId, rawModelId }, `${logTag}:model-resolve-fallback-to-raw-model-id`)
  return { inferenceUrl, apiKey, resolvedModelId, resolved, fallbackProvider }
}

export function registerChatAndGenerateRoutes({ ctx, app, providerRepo }: RegisterChatGenerateDeps): void {
  // ---- Chat (Vercel AI SDK Data Stream Protocol) ----
  app.post('/api/chat', async (c) => {
    const body = await c.req.json<{
      messages: UIMessage[]
      system?: string
      temperature?: number
      maxTokens?: number
      modelId?: string
      rawModelId?: string
    }>()

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    const clientProviderAuth = c.req.header('X-Provider-Auth')?.trim() || null

    const target = await resolveInferenceTarget({
      ctx,
      providerRepo,
      modelId: body.modelId,
      rawModelId: body.rawModelId,
      clientProviderAuth,
      logTag: 'chat',
    })
    if ('error' in target) {
      return c.json({ error: target.error }, 400)
    }

    const { inferenceUrl, apiKey, resolvedModelId, resolved, fallbackProvider } = target

    const systemPrompt = body.system
      ?? ctx.config.model.systemPrompt
      ?? 'You are a helpful AI assistant.'

    const contextLength = resolved?.model?.contextLength ?? 4096
    const extractText = (m: UIMessage): string => {
      const content = (m as UIMessage & { content?: unknown }).content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content
          .filter((p): p is { type?: unknown; text?: unknown } => typeof p === 'object' && p !== null)
          .filter((p) => p.type === 'text' && typeof p.text === 'string')
          .map((p) => p.text as string)
          .join(' ')
      }
      if (!m.parts) return ''
      return m.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map((p) => p.text).join(' ')
    }

    const normalizeToModelMessage = (msg: UIMessage): NormalizedModelMessage => {
      const roleRaw = msg.role
      const role: 'system' | 'user' | 'assistant' =
        roleRaw === 'system' || roleRaw === 'assistant' ? roleRaw : 'user'

      if (Array.isArray(msg.parts)) {
        const parts = msg.parts
          .flatMap((p): NormalizedContentPart[] => {
            if (p?.type === 'text' && typeof p.text === 'string') {
              return [{ type: 'text' as const, text: p.text }]
            }
            if (p?.type === 'file' && typeof p.url === 'string') {
              if ((p.mediaType ?? '').startsWith('image/')) {
                return [{
                  type: 'image' as const,
                  image: p.url,
                  mediaType: p.mediaType,
                }]
              }
            }
            return []
          })

        if (parts.length > 0) {
          return { role, content: parts }
        }
      }

      const msgContent = (msg as UIMessage & { content?: unknown }).content
      if (Array.isArray(msgContent)) {
        const parts = msgContent
          .flatMap((p): NormalizedContentPart[] => {
            if (
              typeof p === 'object'
              && p !== null
              && 'type' in p
              && (p as { type?: unknown }).type === 'text'
              && typeof (p as { text?: unknown }).text === 'string'
            ) {
              return [{ type: 'text' as const, text: (p as { text: string }).text }]
            }
            if (
              typeof p === 'object'
              && p !== null
              && 'type' in p
              && (p as { type?: unknown }).type === 'image_url'
              && typeof (p as { image_url?: { url?: unknown } }).image_url?.url === 'string'
            ) {
              return [{
                type: 'image' as const,
                image: (p as { image_url: { url: string } }).image_url.url,
              }]
            }
            return []
          })

        if (parts.length > 0) {
          return { role, content: parts }
        }
      }

      return {
        role,
        content: typeof msgContent === 'string' ? msgContent : '',
      }
    }

    const trimmedMessages = trimHistory(
      body.messages.map((m) => ({ role: m.role, content: extractText(m) })),
      { contextLength, systemPrompt },
    )

    const preservedMessages = body.messages.slice(-trimmedMessages.length)
    const normalizedMessages: NormalizedModelMessage[] = preservedMessages.map((m) => normalizeToModelMessage(m))

    let aiModel
    if (resolved) {
      aiModel = createAISdkModel(resolved)
    } else if (fallbackProvider?.apiKey && resolvedModelId) {
      const providerName = (fallbackProvider.name ?? '').toLowerCase()
      if (providerName.includes('google') || providerName.includes('gemini')) {
        const google = createGoogleGenerativeAI({ apiKey: fallbackProvider.apiKey })
        aiModel = google.languageModel(resolvedModelId)
      } else if (providerName.includes('anthropic') || providerName.includes('claude')) {
        const anthropic = createAnthropic({ apiKey: fallbackProvider.apiKey })
        aiModel = anthropic.languageModel(resolvedModelId)
      } else {
        const provider = createOpenAI({
          baseURL: `${inferenceUrl.replace(/\/v1\/?$/, '')}/v1`,
          apiKey,
        })
        if (providerName.includes('github') || providerName.includes('copilot')) {
          aiModel = provider.chat(resolvedModelId)
        } else {
          aiModel = provider.languageModel(resolvedModelId)
        }
      }
    } else {
      const provider = createOpenAI({
        baseURL: `${inferenceUrl}/v1`,
        apiKey,
      })
      aiModel = provider.languageModel(resolvedModelId ?? body.rawModelId ?? body.modelId ?? '')
    }

    const promptTokens = trimmedMessages.reduce((sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : ''), 0)
    const dynamicMaxTokens = body.maxTokens ?? calcMaxTokens(contextLength, promptTokens + estimateTokens(systemPrompt))

    try {
      const result = streamText({
        model: aiModel,
        system: systemPrompt,
        messages: normalizedMessages as unknown as ModelMessage[],
        maxOutputTokens: dynamicMaxTokens,
        temperature: body.temperature ?? ctx.config.model.temperature ?? 0.7,
        abortSignal: c.req.raw.signal,
        maxRetries: 0,
        onError: (error) => {
          ctx.logger.error({ error }, 'chat:stream-error')
        },
      })

      return result.toUIMessageStreamResponse()
    } catch (error) {
      ctx.logger.error({ error }, 'chat:error')
      const msg = error instanceof Error ? error.message : 'Internal error'
      return c.json({ error: msg }, 500)
    }
  })

  // ---- Generate (non-streaming, AI SDK) ----
  app.post('/api/generate', async (c) => {
    const body = await c.req.json<{
      messages: UIMessage[]
      system?: string
      temperature?: number
      maxTokens?: number
      modelId?: string
      rawModelId?: string
    }>()

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    const target = await resolveInferenceTarget({
      ctx,
      providerRepo,
      modelId: body.modelId,
      rawModelId: body.rawModelId,
      logTag: 'generate',
    })
    if ('error' in target) {
      return c.json({ error: target.error }, 400)
    }

    const { inferenceUrl, apiKey, resolvedModelId, fallbackProvider } = target

    const systemPrompt = body.system
      ?? ctx.config.model.systemPrompt
      ?? 'You are a helpful AI assistant.'

    const provider = createOpenAI({
      baseURL: `${inferenceUrl}/v1`,
      apiKey,
    })

    try {
      let sdkModel
      const effectiveModelId = resolvedModelId ?? body.rawModelId ?? body.modelId ?? ''
      if (fallbackProvider?.apiKey && effectiveModelId) {
        const providerName = (fallbackProvider.name ?? '').toLowerCase()
        if (providerName.includes('google') || providerName.includes('gemini')) {
          const google = createGoogleGenerativeAI({ apiKey: fallbackProvider.apiKey })
          sdkModel = google.languageModel(effectiveModelId)
        } else if (providerName.includes('anthropic') || providerName.includes('claude')) {
          const anthropic = createAnthropic({ apiKey: fallbackProvider.apiKey })
          sdkModel = anthropic.languageModel(effectiveModelId)
        } else if (providerName.includes('github') || providerName.includes('copilot')) {
          const gh = createOpenAI({
            baseURL: `${inferenceUrl.replace(/\/v1\/?$/, '')}/v1`,
            apiKey,
          })
          sdkModel = gh.chat(effectiveModelId)
        }
      }

      if (!sdkModel) {
        sdkModel = provider.languageModel(effectiveModelId)
      }

      if (!effectiveModelId || !effectiveModelId.trim()) {
        return c.json({ error: 'modelId or rawModelId is required' }, 400)
      }

      const cacheKey = responseCache.buildKey({
        modelId: effectiveModelId,
        messages: body.messages as unknown as Array<{ role: string; content: unknown }>,
        system: systemPrompt,
        temperature: body.temperature ?? ctx.config.model.temperature ?? 0.7,
      })
      const cached = responseCache.get(cacheKey)
      if (cached) {
        return c.json({
          text: cached.content,
          finishReason: 'stop',
          usage: cached.tokens ? { completionTokens: cached.tokens } : undefined,
          cached: true,
        })
      }

      const result = await generateText({
        model: sdkModel,
        system: systemPrompt,
        messages: body.messages.map((m) => ({
          role: m.role,
          content: getMessageTextContent(m),
        })),
        maxOutputTokens: body.maxTokens ?? ctx.config.model.maxTokens ?? 2048,
        temperature: body.temperature ?? ctx.config.model.temperature ?? 0.7,
        maxRetries: 0,
      })

      responseCache.set(cacheKey, {
        content: result.text,
        tokens: getUsageTokens(result.usage),
      })

      return c.json({
        text: result.text,
        finishReason: result.finishReason,
        usage: result.usage ?? undefined,
      })
    } catch (error) {
      ctx.logger.error({ error }, 'generate:error')
      return c.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        500,
      )
    }
  })
}
