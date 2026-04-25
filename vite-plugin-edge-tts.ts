/**
 * Vite Plugin — Edge TTS (Microsoft Edge Neural TTS)
 *
 * `edge-tts-universal` 패키지를 사용하여 Vite dev server 미들웨어로
 * Edge TTS 음성 합성 API를 제공한다.
 *
 * - 별도 서버 프로세스 불필요 (Vite에 내장)
 * - 무료, API 키 불필요
 * - DRM/MUID 인증 자동 처리 (edge-tts-universal 내장)
 * - 5개 국어 Neural 음성 지원 (ko, en, de, zh, ja)
 *
 * 엔드포인트:
 *   POST /tts/synthesize — 텍스트 → MP3 오디오
 *   GET  /tts/health     — 상태 확인
 *   GET  /tts/voices     — 사용 가능한 음성 목록
 */
import type { Plugin } from 'vite'

// ── 음성 목록 ──────────────────────────────────────────

export interface EdgeTtsVoice {
  name: string
  gender: 'Female' | 'Male'
  label: string
}

export const EDGE_TTS_VOICES: Record<string, EdgeTtsVoice[]> = {
  'ko-KR': [
    { name: 'ko-KR-SunHiNeural', gender: 'Female', label: '선희' },
    { name: 'ko-KR-InJoonNeural', gender: 'Male', label: '인준' },
    { name: 'ko-KR-BongJinNeural', gender: 'Male', label: '봉진' },
    { name: 'ko-KR-JiMinNeural', gender: 'Female', label: '지민' },
    { name: 'ko-KR-SeoHyeonNeural', gender: 'Female', label: '서현' },
    { name: 'ko-KR-SoonBokNeural', gender: 'Female', label: '순복' },
    { name: 'ko-KR-YuJinNeural', gender: 'Female', label: '유진' },
  ],
  'en-GB': [
    { name: 'en-GB-SoniaNeural', gender: 'Female', label: 'Sonia' },
    { name: 'en-GB-RyanNeural', gender: 'Male', label: 'Ryan' },
    { name: 'en-GB-LibbyNeural', gender: 'Female', label: 'Libby' },
    { name: 'en-GB-MaisieNeural', gender: 'Female', label: 'Maisie' },
    { name: 'en-GB-ThomasNeural', gender: 'Male', label: 'Thomas' },
  ],
  'de-DE': [
    { name: 'de-DE-KatjaNeural', gender: 'Female', label: 'Katja' },
    { name: 'de-DE-ConradNeural', gender: 'Male', label: 'Conrad' },
    { name: 'de-DE-AmalaNeural', gender: 'Female', label: 'Amala' },
    { name: 'de-DE-KillianNeural', gender: 'Male', label: 'Killian' },
  ],
  'zh-CN': [
    { name: 'zh-CN-XiaoxiaoNeural', gender: 'Female', label: '晓晓' },
    { name: 'zh-CN-YunxiNeural', gender: 'Male', label: '云希' },
    { name: 'zh-CN-XiaoyiNeural', gender: 'Female', label: '晓依' },
    { name: 'zh-CN-YunjianNeural', gender: 'Male', label: '云健' },
  ],
  'ja-JP': [
    { name: 'ja-JP-NanamiNeural', gender: 'Female', label: 'ナナミ' },
    { name: 'ja-JP-KeitaNeural', gender: 'Male', label: 'ケイタ' },
    { name: 'ja-JP-AoiNeural', gender: 'Female', label: 'アオイ' },
    { name: 'ja-JP-DaichiNeural', gender: 'Male', label: 'ダイチ' },
  ],
}

/** 언어별 기본 음성 */
export const DEFAULT_VOICES: Record<string, string> = {
  'ko-KR': 'ko-KR-SunHiNeural',
  'en-GB': 'en-GB-SoniaNeural',
  'de-DE': 'de-DE-KatjaNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
}

// ── Vite Plugin ────────────────────────────────────────

// ── 요청 본문 파싱 ─────────────────────────────────────

interface TtsRequestBody {
  text: string
  voice?: string
  rate?: string
  pitch?: string
  volume?: string
}

async function parseJsonBody(req: import('http').IncomingMessage): Promise<TtsRequestBody> {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return JSON.parse(raw)
}

// ── Vite Plugin ────────────────────────────────────────

export function edgeTtsPlugin(): Plugin {
  return {
    name: 'edge-tts',
    configureServer(server) {

      // ── POST /tts/stream — 스트리밍 (TTFB 최소화) ──────
      server.middlewares.use('/tts/stream', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const { text, voice, rate, pitch, volume } = await parseJsonBody(req)

          if (!text?.trim()) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'text is required' }))
            return
          }

          const selectedVoice = voice || 'en-GB-SoniaNeural'
          console.log(`[Edge TTS] Stream: voice=${selectedVoice}, len=${text.length}`)

          const { Communicate } = await import('edge-tts-universal')

          const communicate = new Communicate(text, {
            voice: selectedVoice,
            rate: rate || '+0%',
            pitch: pitch || '+0Hz',
            volume: volume || '+0%',
          })

          // Transfer-Encoding: chunked — 브라우저가 첫 청크부터 수신
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Transfer-Encoding', 'chunked')
          res.setHeader('Cache-Control', 'no-cache')

          let totalBytes = 0

          for await (const chunk of communicate.stream()) {
            if (chunk.type === 'audio' && chunk.data) {
              const buf = Buffer.isBuffer(chunk.data) ? chunk.data : Buffer.from(chunk.data)
              res.write(buf)
              totalBytes += buf.length
            }
          }

          console.log(`[Edge TTS] Stream done: ${totalBytes} bytes`)
          res.end()
        } catch (err) {
          console.error('[Edge TTS] Stream error:', (err as Error).message)
          if (!res.headersSent) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: (err as Error).message }))
          } else {
            res.end()
          }
        }
      })

      // ── POST /tts/synthesize — 일괄 합성 (하위 호환) ──
      server.middlewares.use('/tts/synthesize', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const { text, voice, rate, pitch, volume } = await parseJsonBody(req)

          if (!text?.trim()) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'text is required' }))
            return
          }

          const selectedVoice = voice || 'en-GB-SoniaNeural'
          console.log(`[Edge TTS] Synth: voice=${selectedVoice}, len=${text.length}`)

          const { EdgeTTS } = await import('edge-tts-universal')

          const tts = new EdgeTTS(text, selectedVoice, {
            rate: rate || '+0%',
            pitch: pitch || '+0Hz',
            volume: volume || '+0%',
          })

          const result = await tts.synthesize()
          const audioBuffer = Buffer.from(await result.audio.arrayBuffer())

          if (audioBuffer.length === 0) {
            throw new Error('Empty audio response from Edge TTS')
          }

          console.log(`[Edge TTS] Synth done: ${audioBuffer.length} bytes`)

          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Content-Length', audioBuffer.length.toString())
          res.end(audioBuffer)
        } catch (err) {
          console.error('[Edge TTS] Error:', (err as Error).message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: (err as Error).message }))
        }
      })

      // GET /tts/health
      server.middlewares.use('/tts/health', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ status: 'ok', engine: 'edge-tts', streaming: true }))
      })

      // GET /tts/voices — 사용 가능한 음성 목록
      server.middlewares.use('/tts/voices', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ voices: EDGE_TTS_VOICES, defaults: DEFAULT_VOICES }))
      })
    },
  }
}
