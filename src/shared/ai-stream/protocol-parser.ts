export interface ToolEventDelta {
  /** tool call ID (서버 제공 또는 자동 생성) */
  id: string
  /** tool 이름 */
  name: string
  /** 이벤트 유형 */
  type: 'tool-start' | 'tool-end' | 'tool-error'
  /** tool 입력 파라미터 */
  input?: Record<string, unknown>
  /** tool 실행 결과 */
  output?: unknown
  /** 에러 메시지 */
  error?: string
}

export interface ParsedAIStreamDelta {
  content?: string
  reasoning?: string
  nodeMetadata?: { type: string; node: string; agent: string }
  /** #3 Hidden Message Policy — 서버가 이 메시지를 렌더링하지 말라고 지시 */
  hidden?: boolean
  /** #10 Tool Event Timeline — tool 호출 시작/종료/에러 이벤트 */
  toolEvent?: ToolEventDelta
}

/**
 * AI SDK UI Message Stream / Data Stream Protocol 파서.
 * - SSE JSON: data: { type: 'text-delta' | ... }
 * - Data Stream: 0:"..." / 2:[...] / g:"..." / 9:"..."
 */
export async function* parseAIStreamProtocol(response: Response): AsyncGenerator<ParsedAIStreamDelta, void, undefined> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const raw = line.trim()
      if (!raw) continue

      // Protocol A: SSE JSON
      if (raw.startsWith('data:')) {
        const payload = raw.slice(5).trim()
        if (!payload) continue
        if (payload === '[DONE]') return

        try {
          const part = JSON.parse(payload) as Record<string, unknown>
          const partType = String(part.type ?? '')

          switch (partType) {
            case 'text-delta': {
              const text = String(part.delta ?? '')
              if (text) yield { content: text }
              break
            }
            case 'reasoning-delta': {
              const reasoning = String(part.delta ?? '')
              if (reasoning) yield { reasoning }
              break
            }
            case 'data-node-enter': {
              const data = (part.data ?? null) as ParsedAIStreamDelta['nodeMetadata']
              if (data) yield { nodeMetadata: data }
              break
            }
            case 'hidden':
            case 'do-not-render': {
              yield { hidden: true }
              break
            }
            case 'tool-start': {
              const d = part.data as Record<string, unknown> ?? part
              yield { toolEvent: { id: String(d.toolCallId ?? d.id ?? crypto.randomUUID()), name: String(d.toolName ?? d.name ?? 'unknown'), type: 'tool-start', input: (d.args ?? d.input) as Record<string, unknown> | undefined } }
              break
            }
            case 'tool-end': {
              const d = part.data as Record<string, unknown> ?? part
              yield { toolEvent: { id: String(d.toolCallId ?? d.id ?? ''), name: String(d.toolName ?? d.name ?? 'unknown'), type: 'tool-end', output: d.result ?? d.output } }
              break
            }
            case 'tool-error': {
              const d = part.data as Record<string, unknown> ?? part
              yield { toolEvent: { id: String(d.toolCallId ?? d.id ?? ''), name: String(d.toolName ?? d.name ?? 'unknown'), type: 'tool-error', error: String(d.error ?? d.message ?? 'Unknown tool error') } }
              break
            }
            case 'error': {
              const errText = String(part.errorText ?? part.error ?? 'Unknown stream error')
              throw new Error(`Stream error: ${errText}`)
            }
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('Stream error:')) throw err
        }

        continue
      }

      // Protocol B: Data Stream
      const colonIndex = raw.indexOf(':')
      if (colonIndex < 0) continue

      const type = raw.slice(0, colonIndex)
      const payload = raw.slice(colonIndex + 1)

      try {
        switch (type) {
          case '0': {
            const text = JSON.parse(payload) as string
            if (text) yield { content: text }
            break
          }
          case '2': {
            const data = JSON.parse(payload) as unknown[]
            for (const item of data) {
              if (item && typeof item === 'object' && 'type' in item) {
                const obj = item as Record<string, unknown>
                if (obj.type === 'node-enter') {
                  yield { nodeMetadata: obj as ParsedAIStreamDelta['nodeMetadata'] }
                }
              }
            }
            break
          }
          case 'g': {
            const reasoning = JSON.parse(payload) as string
            if (reasoning) yield { reasoning }
            break
          }
          case 'h': {
            yield { hidden: true }
            break
          }
          case 't': {
            const d = JSON.parse(payload) as Record<string, unknown>
            const evtType = String(d.event ?? d.type ?? 'tool-start') as ToolEventDelta['type']
            yield { toolEvent: { id: String(d.toolCallId ?? d.id ?? crypto.randomUUID()), name: String(d.toolName ?? d.name ?? 'unknown'), type: evtType, input: (d.args ?? d.input) as Record<string, unknown> | undefined, output: d.result ?? d.output, error: d.error ? String(d.error) : undefined } }
            break
          }
          case '9': {
            const errMsg = JSON.parse(payload) as string
            throw new Error(`Stream error: ${errMsg}`)
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Stream error:')) throw err
      }
    }
  }
}
