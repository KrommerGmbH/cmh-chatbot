/**
 * AI Client Service — Renderer 측 AI SDK 연동.
 *
 * Engine API (/api/chat)와 AI SDK Data Stream Protocol로 통신.
 * 기존 llm-client.service.ts의 수동 fetch + SSE 파싱을 대체.
 *
 * 2가지 모드:
 * 1. Engine API 사용 (POST /api/chat) — Engine 서버가 실행 중일 때
 * 2. Direct llama-server (POST /llm/v1/chat/completions) — 폴백 (기존 방식)
 */

import { parseAIStreamProtocol } from '../../../shared/ai-stream/protocol-parser'

// ── 타입 ─────────────────────────────────────────────────

export interface AIChatOptions {
  system?: string
  temperature?: number
  maxTokens?: number
  modelId?: string
  /** 실제 추론 모델명 (예: Qwen3.5-2B-Q4_K_M) */
  rawModelId?: string
  signal?: AbortSignal
  disableThinking?: boolean
  /** Engine API 사용 여부 (기본: true, 폴백 시 false) */
  useEngineApi?: boolean
  /** Provider 유형 — cloud-api 모델은 llama-server 폴백 금지 */
  providerType?: 'local-gguf' | 'cloud-api' | 'self-hosted' | string
  /** #7 Auth Token Passthrough — 클라이언트가 직접 전달하는 provider 인증 토큰 */
  providerAuthToken?: string
}

export interface AIChatDelta {
  content?: string
  reasoning?: string
  /** 노드 메타데이터 (LangGraph workflow 시) */
  nodeMetadata?: { type: string; node: string; agent: string }
}

export type ChatMessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>

export interface ChatMessage {
  role: string
  content: ChatMessageContent
}

function toTextOnlyMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') return m

    const text = m.content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n')

    return { ...m, content: text }
  })
}

function isImageOrPartTypeError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return msg.includes('image input is not supported')
    || msg.includes('mmproj')
    || msg.includes("cannot determine type of 'item'")
}

function isLikelyCloudModelId(modelId: string): boolean {
  const id = (modelId ?? '').toLowerCase().trim()
  if (!id) return false
  return id.startsWith('gemini')
    || id.startsWith('claude')
    || id.startsWith('gpt-')
    || id.startsWith('o1')
    || id.startsWith('o3')
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error && error.name === 'AbortError') return true
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return msg.includes('aborted') || msg.includes('aborterror')
}

// ── <think> 태그 스트리밍 파서 ───────────────────────────
// Qwen3.5 등 reasoning 모델은 reasoning_content 필드가 아닌
// content 안에 <think>...</think> 태그로 thinking을 출력한다.
// 스트리밍 청크가 태그 중간에 잘릴 수 있으므로 버퍼링 방식으로 파싱한다.

type ThinkParseChunk = { type: 'content' | 'reasoning'; text: string }

class ThinkTagStreamParser {
  private buf = ''
  private state: 'content' | 'reasoning' = 'content'

  push(chunk: string): ThinkParseChunk[] {
    this.buf += chunk
    const out: ThinkParseChunk[] = []

    while (true) {
      if (this.state === 'content') {
        const idx = this.buf.indexOf('<think>')
        if (idx === -1) {
          // 버퍼 끝이 '<think>' 의 앞부분인지 확인 (경계 잘림)
          const safeLen = this._safeOutputLen(this.buf, '<think>')
          if (safeLen > 0) out.push({ type: 'content', text: this.buf.slice(0, safeLen) })
          this.buf = this.buf.slice(safeLen)
          break
        }
        if (idx > 0) out.push({ type: 'content', text: this.buf.slice(0, idx) })
        this.buf = this.buf.slice(idx + '<think>'.length)
        this.state = 'reasoning'
      } else {
        const idx = this.buf.indexOf('</think>')
        if (idx === -1) {
          const safeLen = this._safeOutputLen(this.buf, '</think>')
          if (safeLen > 0) out.push({ type: 'reasoning', text: this.buf.slice(0, safeLen) })
          this.buf = this.buf.slice(safeLen)
          break
        }
        if (idx > 0) out.push({ type: 'reasoning', text: this.buf.slice(0, idx) })
        this.buf = this.buf.slice(idx + '</think>'.length)
        this.state = 'content'
      }
    }

    return out
  }

  /** 버퍼 끝이 pattern의 부분 접두사면 그 앞까지만 안전하게 출력 */
  private _safeOutputLen(text: string, pattern: string): number {
    for (let i = Math.min(pattern.length - 1, text.length); i > 0; i--) {
      if (text.endsWith(pattern.slice(0, i))) return text.length - i
    }
    return text.length
  }
}

// ── Engine API 스트리밍 ──────────────────────────────────

/**
 * Engine API (/api/chat) 통해 AI SDK Data Stream Protocol SSE 스트리밍.
 */
export async function* streamViaEngineApi(
  messages: ChatMessage[],
  opts: AIChatOptions = {},
): AsyncGenerator<AIChatDelta, void, undefined> {
  const tStart = performance.now()

  // #7 Auth Token Passthrough — provider별 사용자 토큰이 있으면 X-Provider-Auth로 전달
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.providerAuthToken) {
    headers['X-Provider-Auth'] = opts.providerAuthToken
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        id: crypto.randomUUID(),
      })),
      system: opts.system,
      temperature: opts.temperature ?? 0.7,
      maxTokens: opts.maxTokens ?? 4096,
      modelId: opts.modelId,
      rawModelId: opts.rawModelId,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Engine API error ${response.status}: ${errText}`)
  }

  console.log('[ai-client] stream started apiMs=%d', Math.round(performance.now() - tStart))

  for await (const part of parseAIStreamProtocol(response)) {
    if (part.content || part.reasoning || part.nodeMetadata) {
      yield {
        content: part.content,
        reasoning: part.reasoning,
        nodeMetadata: part.nodeMetadata,
      }
    }
  }
}

/**
 * Direct llama-server 호출 (폴백 — 기존 llm-client.service.ts 방식).
 */
export async function* streamViaLlamaServer(
  messages: ChatMessage[],
  modelId: string,
  opts: AIChatOptions = {},
): AsyncGenerator<AIChatDelta, void, undefined> {
  const tStart = performance.now()

  const systemMessage = opts.system ? [{ role: 'system', content: opts.system }] : []

  const requestBody: Record<string, unknown> = {
    model: modelId,
    messages: [...systemMessage, ...messages],
    stream: true,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
    cache_prompt: true,
    // 반복 루프 완화
    repeat_penalty: 1.15,
    repeat_last_n: 256,
    top_p: 0.9,
  }

  const lowerModelId = modelId.toLowerCase()
  const isQwen35Like = /qwen\s*3(?:\.5)?/i.test(lowerModelId)
  const shouldDisableThinking = !!opts.disableThinking || isQwen35Like

  // thinking 제한 — 모델별 파라미터:
  // - thinking_tokens: llama.cpp 빌트인 파라미터
  // - chat_template_kwargs: Qwen3.5 등 HF 템플릿 기반 모델용 (enable_thinking 제어)
  // - reasoning_effort: 일부 빌드에서만 동작
  if (shouldDisableThinking) {
    // fast mode: thinking 완전 비활성화
    requestBody.thinking_tokens = 0
    requestBody.reasoning_effort = 'none'
    requestBody.chat_template_kwargs = { enable_thinking: false }
  } else {
    // normal mode: thinking을 256 토큰으로 제한 (반복/지연 완화)
    requestBody.thinking_tokens = 256
    requestBody.chat_template_kwargs = { enable_thinking: true }
  }

  const response = await fetch('/llm/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`LLM API error ${response.status}: ${errText}`)
  }

  console.log('[ai-client:direct] stream started apiMs=%d', Math.round(performance.now() - tStart))

  // SSE 파싱 (OpenAI-compatible)
  // Qwen3.5 등 reasoning 모델은 content에 <think>...</think> 태그를 포함하므로
  // ThinkTagStreamParser로 실시간 분리한다.
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const thinkParser = new ThinkTagStreamParser()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data)
        const choice = parsed.choices?.[0]?.delta

        // reasoning_content: OpenAI-compatible thinking 필드 (일부 llama.cpp 버전)
        if (choice?.reasoning_content) {
          yield { reasoning: choice.reasoning_content }
        }

        // content: Qwen3.5는 <think>...</think> 포함하여 여기에 출력
        if (choice?.content) {
          const chunks = thinkParser.push(choice.content)
          for (const chunk of chunks) {
            if (chunk.text) yield { [chunk.type]: chunk.text }
          }
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
}

// ── Non-streaming 호출 ───────────────────────────────────

/**
 * 단건 completion (non-streaming) — Engine API 경유.
 */
export async function generateViaEngineApi(
  messages: ChatMessage[],
  opts: AIChatOptions = {},
): Promise<string> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content, id: crypto.randomUUID() })),
      system: opts.system,
      temperature: opts.temperature ?? 0.3,
      maxTokens: opts.maxTokens ?? 100,
      modelId: opts.modelId,
      rawModelId: opts.rawModelId,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Engine API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return (data.text ?? '').trim()
}

/**
 * 단건 completion — Direct llama-server (폴백).
 */
export async function generateViaLlamaServer(
  messages: ChatMessage[],
  modelId: string,
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const lowerModelId = modelId.toLowerCase()
  const isQwen35Like = /qwen\s*3(?:\.5)?/i.test(lowerModelId)

  const response = await fetch('/llm/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: opts.maxTokens ?? 100,
      temperature: opts.temperature ?? 0.3,
      stream: false,
      repeat_penalty: 1.15,
      repeat_last_n: 256,
      top_p: 0.9,
      chat_template_kwargs: { enable_thinking: !isQwen35Like },
      thinking_tokens: isQwen35Like ? 0 : 128,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`LLM API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

// ── 모델 서버 상태 ───────────────────────────────────────

/** llama-server에 모델이 로드되어 있는지 확인 */
export async function isModelLoadedOnServer(modelId: string): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3_000)
  try {
    const res = await fetch('/llm/v1/models', { signal: ctrl.signal })
    if (!res.ok) return false
    const json = await res.json().catch(() => ({ data: [] }))
    if (!Array.isArray(json?.data)) return false

    return json.data.some((m: { id?: string; status?: { value?: string } | string }) => {
      if (m?.id !== modelId) return false
      // llama-server 버전마다 status 형식이 다름:
      // - 신버전: { status: { value: 'loaded' } }
      // - 구버전: { status: 'loaded' } or status 필드 자체 없음 (모델이 있으면 로드된 것)
      if (!m.status) return true  // status 없으면 모델 목록에 있다는 것 자체가 로드됨을 의미
      if (typeof m.status === 'string') return m.status === 'loaded' || m.status === 'running'
      if (typeof m.status === 'object') {
        const v = (m.status as { value?: string }).value
        return !v || v === 'loaded' || v === 'running'
      }
      return true
    })
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * llama-server에서 현재 로드된 모델을 언로드한다.
 * 모델 전환 시 RAM을 확보하기 위해 사용.
 *
 * llama-server multi-model 모드: POST /v1/models/stop 으로 개별 모델 프로세스 종료.
 * 지원되지 않는 버전은 DELETE /v1/models/{id} 시도 후 폴백.
 */
export async function unloadCurrentModel(): Promise<void> {
  try {
    const res = await fetch('/llm/v1/models', { signal: AbortSignal.timeout(3_000) })
    if (!res.ok) return
    const json = await res.json().catch(() => ({ data: [] }))
    const loadedModels = (json?.data ?? []).filter(
      (m: { status?: { value?: string } }) => m?.status?.value === 'loaded',
    )
    for (const m of loadedModels) {
      // 방법 1: POST /v1/models/stop (llama-server multi-model)
      const stopRes = await fetch('/llm/v1/models/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({ id: m.id }),
      }).catch(() => null)

      if (!stopRes || !stopRes.ok) {
        // 방법 2: DELETE /v1/models/{id}
        await fetch(`/llm/v1/models/${encodeURIComponent(m.id)}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5_000),
        }).catch(() => {})
      }
    }
    if (loadedModels.length > 0) {
      console.log('[ai-client] unload requested for %d model(s), waiting 2s for RAM release', loadedModels.length)
      await new Promise(r => setTimeout(r, 2_000))
    }
  } catch {
    // 무시 — 언로드 실패해도 로드 시도는 진행
  }
}

/** 모델 warm-up (1-token ping) — 필요 시 기존 모델 언로드 후 로드 */
export async function warmupModelOnServer(modelId: string, timeoutMs = 35_000): Promise<boolean> {
  const alreadyLoaded = await isModelLoadedOnServer(modelId)
  if (alreadyLoaded) return true

  // 다른 모델이 로드되어 있으면 먼저 언로드하여 RAM 확보
  await unloadCurrentModel()

  // llama-server multi-model 모드: /v1/models/load API로 no-warmup 로드 시도
  // (지원하는 버전에서는 내부 empty-run warmup을 건너뜀)
  try {
    const loadRes = await fetch('/llm/v1/models/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ id: modelId, no_warmup: true }),
    })
    // 성공 시 로드 완료 대기 (최대 30초)
    if (loadRes.ok) {
      console.log('[ai-client] model load API called with no_warmup=true, waiting...')
      const waitStart = Date.now()
      while (Date.now() - waitStart < Math.min(timeoutMs, 30_000)) {
        await new Promise(r => setTimeout(r, 1_000))
        if (await isModelLoadedOnServer(modelId)) return true
      }
    }
  } catch {
    // /v1/models/load 미지원 버전 — 폴백으로 ping 방식 사용
  }

  // 폴백: 1-token ping으로 모델 로드 트리거 (기존 방식)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch('/llm/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        max_tokens: 1,
        temperature: 0,
        cache_prompt: false,
        // Qwen3 thinking 비활성화로 warmup 속도 향상
        chat_template_kwargs: { enable_thinking: false },
        thinking_tokens: 0,
      }),
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// ── Engine API 가용성 체크 ────────────────────────────────

let _engineApiAvailable: boolean | null = null

/**
 * Engine API가 사용 가능한지 확인 (/health 엔드포인트 체크).
 * 결과를 캐시하여 반복 호출 방지.
 */
export async function isEngineApiAvailable(forceRecheck = false): Promise<boolean> {
  if (_engineApiAvailable !== null && !forceRecheck) return _engineApiAvailable

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2_000)
    const res = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    _engineApiAvailable = res.ok
  } catch {
    _engineApiAvailable = false
  }

  return _engineApiAvailable
}

/**
 * 스마트 스트리밍 — Engine API 가용 시 사용, 아니면 direct llama-server 폴백.
 */
export async function* streamChat(
  messages: ChatMessage[],
  modelId: string,
  opts: AIChatOptions = {},
): AsyncGenerator<AIChatDelta, void, undefined> {
  const isCloud = opts.providerType === 'cloud-api' || isLikelyCloudModelId(modelId)
  const isLocal = opts.providerType === 'local-gguf'
  const useEngine = opts.useEngineApi ?? await isEngineApiAvailable()
  // Engine API는 DAL 모델 엔티티 ID를 기대함. (예: UUID)
  // opts.modelId(엔티티 ID)가 있으면 우선 사용, 없을 때만 raw modelId 사용.
  const engineModelId = opts.modelId ?? modelId

  // 로컬 모델은 direct llama-server 우선 (지연 및 UI stream 불일치 이슈 회피)
  if (isLocal) {
    try {
      yield* streamViaLlamaServer(messages, modelId, opts)
      return
    } catch (err) {
      if (isAbortError(err)) throw err
      // 모델 로드 실패 감지 — 즉시 사용자에게 알림 (fallback 불필요)
      const errMsg = (err as Error)?.message ?? ''
      if (errMsg.includes('failed to load')) {
        throw new Error(`모델 "${modelId}" 로드 실패. llama-server에서 이 모델을 시작할 수 없습니다. 다른 모델을 선택하거나 서버를 재시작하세요.`)
      }
      if (isImageOrPartTypeError(err)) {
        console.warn('[ai-client] Direct local stream image/part-type error, retry with text-only messages:', (err as Error)?.message)
        const textOnly = toTextOnlyMessages(messages)
        yield* streamViaLlamaServer(textOnly, modelId, opts)
        return
      }
      if (useEngine) {
        console.warn('[ai-client] Direct local stream failed, fallback to Engine:', (err as Error)?.message)
        try {
          yield* streamViaEngineApi(messages, { ...opts, modelId: engineModelId, rawModelId: modelId })
        } catch (engineErr) {
          if (isImageOrPartTypeError(engineErr)) {
            console.warn('[ai-client] Engine stream image/part-type error, retry with text-only messages:', (engineErr as Error)?.message)
            const textOnly = toTextOnlyMessages(messages)
            yield* streamViaEngineApi(textOnly, { ...opts, modelId: engineModelId, rawModelId: modelId })
            return
          }
          throw engineErr
        }
        return
      }
      throw err
    }
  }

  if (useEngine) {
    try {
      yield* streamViaEngineApi(messages, { ...opts, modelId: engineModelId, rawModelId: modelId })
    } catch (err) {
      if (isAbortError(err)) throw err
      if (isImageOrPartTypeError(err)) {
        console.warn('[ai-client] Engine stream image/part-type error, retry with text-only messages:', (err as Error)?.message)
        const textOnly = toTextOnlyMessages(messages)
        yield* streamViaEngineApi(textOnly, { ...opts, modelId: engineModelId, rawModelId: modelId })
        return
      }
      // direct llama-server는 local-gguf 전용
      if (!isLocal) throw err
      console.warn('[ai-client] Engine stream failed, fallback to direct llama-server:', (err as Error)?.message)
      yield* streamViaLlamaServer(messages, modelId, opts)
      return
    }
  } else if (isCloud) {
    // Cloud 모델은 Engine API 필수 — llama-server 폴백 금지
    throw new Error(`Engine API is not available. Cloud model "${modelId}" requires the Engine server (port 4000) to be running.`)
  } else {
    yield* streamViaLlamaServer(messages, modelId, opts)
  }
}

/**
 * 스마트 생성 — Engine API 가용 시 사용, 아니면 direct llama-server 폴백.
 */
export async function generateChat(
  messages: ChatMessage[],
  modelId: string,
  opts: AIChatOptions = {},
): Promise<string> {
  const isCloud = opts.providerType === 'cloud-api' || isLikelyCloudModelId(modelId)
  const isLocal = opts.providerType === 'local-gguf'
  const useEngine = opts.useEngineApi ?? await isEngineApiAvailable()
  const engineModelId = opts.modelId ?? modelId

  if (isLocal) {
    try {
      return await generateViaLlamaServer(messages, modelId, opts)
    } catch (err) {
      if (isAbortError(err)) throw err
      if (isImageOrPartTypeError(err)) {
        console.warn('[ai-client] Direct local generate image/part-type error, retry with text-only messages:', (err as Error)?.message)
        const textOnly = toTextOnlyMessages(messages)
        return await generateViaLlamaServer(textOnly, modelId, opts)
      }
      if (useEngine) {
        console.warn('[ai-client] Direct local generate failed, fallback to Engine:', (err as Error)?.message)
        try {
          return await generateViaEngineApi(messages, { ...opts, modelId: engineModelId, rawModelId: modelId })
        } catch (engineErr) {
          if (isImageOrPartTypeError(engineErr)) {
            console.warn('[ai-client] Engine generate image/part-type error, retry with text-only messages:', (engineErr as Error)?.message)
            const textOnly = toTextOnlyMessages(messages)
            return await generateViaEngineApi(textOnly, { ...opts, modelId: engineModelId, rawModelId: modelId })
          }
          throw engineErr
        }
      }
      throw err
    }
  }

  if (useEngine) {
    try {
      return await generateViaEngineApi(messages, { ...opts, modelId: engineModelId, rawModelId: modelId })
    } catch (err) {
      if (isAbortError(err)) throw err
      if (isImageOrPartTypeError(err)) {
        console.warn('[ai-client] Engine generate image/part-type error, retry with text-only messages:', (err as Error)?.message)
        const textOnly = toTextOnlyMessages(messages)
        return await generateViaEngineApi(textOnly, { ...opts, modelId: engineModelId, rawModelId: modelId })
      }
      // direct llama-server는 local-gguf 전용
      if (!isLocal) throw err
      console.warn('[ai-client] Engine generate failed, fallback to direct llama-server:', (err as Error)?.message)
      return generateViaLlamaServer(messages, modelId, opts)
    }
  } else if (isCloud) {
    throw new Error(`Engine API is not available. Cloud model "${modelId}" requires the Engine server (port 4000) to be running.`)
  } else {
    return generateViaLlamaServer(messages, modelId, opts)
  }
}
