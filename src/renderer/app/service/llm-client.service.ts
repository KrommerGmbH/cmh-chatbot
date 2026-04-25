/**
 * LLM Client Service
 *
 * llama-server OpenAI-compatible API 직접 호출 (fetch + SSE 파싱).
 * Vite proxy: /llm → http://127.0.0.1:8080
 *
 * 재사용처: 챗봇 UI, cronJob, 외부 REST API 호출
 */

// ── 타입 ─────────────────────────────────────────────────

export interface StreamDelta {
  content?: string
  reasoning?: string
}

export interface StreamOptions {
  system?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  disableThinking?: boolean
}

export type ChatMessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>

export interface LlmApiMessage {
  role: string
  content: ChatMessageContent
}

// ── SSE 스트리밍 호출 ────────────────────────────────────

/**
 * /llm/v1/chat/completions SSE 스트리밍 호출
 *
 * @example
 * for await (const delta of streamChatCompletion(messages, 'model-id')) {
 *   if (delta.content) process.stdout.write(delta.content)
 * }
 */
export async function* streamChatCompletion(
  messages: LlmApiMessage[],
  modelId: string,
  opts: StreamOptions = {},
): AsyncGenerator<StreamDelta, void, undefined> {
  const tReqStart = performance.now()
  const systemMessage = opts.system
    ? [{ role: 'system', content: opts.system }]
    : []

  const requestBody: Record<string, unknown> = {
    model: modelId,
    messages: [...systemMessage, ...messages],
    stream: true,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
    cache_prompt: true,
  }

  // simple-fast 모드: reasoning(thinking) 비활성화 힌트
  if (opts.disableThinking) {
    requestBody.reasoning_effort = 'none'
    requestBody.extra_body = {
      enable_thinking: false,
      reasoning_effort: 'none',
    }
  }

  const response = await fetch('/llm/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify(requestBody),
  })

  console.log('[llm:sse] headers model=%s status=%d content-type=%s headerMs=%d',
    modelId, response.status, response.headers.get('content-type'),
    Math.round(performance.now() - tReqStart),
  )

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`LLM API error ${response.status}: ${errText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let gotFirstChunk = false
  let bytesTotal = 0
  const tStreamStart = performance.now()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    if (!gotFirstChunk) {
      gotFirstChunk = true
      console.log('[llm:sse] firstChunk model=%s firstChunkMs=%d', modelId, Math.round(performance.now() - tReqStart))
    }

    bytesTotal += value?.byteLength ?? 0
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
        const delta: StreamDelta = {}
        if (choice?.content) delta.content = choice.content
        if (choice?.reasoning_content) delta.reasoning = choice.reasoning_content
        if (delta.content || delta.reasoning) yield delta
      } catch {
        // skip malformed JSON
      }
    }
  }

  console.log('[llm:sse] end model=%s streamMs=%d bytes=%d', modelId, Math.round(performance.now() - tStreamStart), bytesTotal)
}

// ── Non-streaming 호출 ───────────────────────────────────

/**
 * 단건 completion (non-streaming) — 제목 생성, 요약 등
 */
export async function chatCompletion(
  messages: LlmApiMessage[],
  modelId: string,
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
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
  const t0 = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3_000)
  try {
    const res = await fetch('/llm/v1/models', { signal: ctrl.signal })
    if (!res.ok) return false
    const json = await res.json().catch(() => ({ data: [] }))
    const loaded = Array.isArray(json?.data) && json.data.some((m: { id?: string }) => m?.id === modelId)
    console.log('[llm:probe] model=%s loaded=%s elapsed=%dms', modelId, loaded, Math.round(performance.now() - t0))
    return loaded
  } catch {
    console.log('[llm:probe] model=%s loaded=false elapsed=%dms (probe fail)', modelId, Math.round(performance.now() - t0))
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** 모델 warm-up (1-token ping) */
export async function warmupModelOnServer(modelId: string, timeoutMs = 35_000): Promise<boolean> {
  const t0 = performance.now()
  console.log('[llm:warmup] start model=%s timeout=%dms', modelId, timeoutMs)

  const alreadyLoaded = await isModelLoadedOnServer(modelId)
  if (alreadyLoaded) {
    console.log('[llm:warmup] already loaded model=%s elapsed=%dms', modelId, Math.round(performance.now() - t0))
    return true
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch('/llm/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        max_tokens: 1,
        temperature: 0,
        cache_prompt: true,
      }),
    })

    if (res.ok) {
      console.log('[llm:warmup] ok model=%s elapsed=%dms', modelId, Math.round(performance.now() - t0))
      return true
    } else {
      console.warn('[llm:warmup] failed model=%s status=%d elapsed=%dms', modelId, res.status, Math.round(performance.now() - t0))
      return false
    }
  } catch (e: unknown) {
    if ((e as Error).name === 'AbortError') {
      console.info('[llm:warmup] timeout skip (%dms)', timeoutMs)
    } else {
      console.warn('[llm:warmup] error', e)
    }
    return false
  } finally {
    clearTimeout(timer)
  }
}
