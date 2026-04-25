/**
 * TTS Service — Text-to-Speech
 *
 * 지원 엔진:
 * 1. Edge TTS — Microsoft Edge Neural TTS (기본, 무료, 고품질)
 * 2. Web Speech API — 브라우저 내장 speechSynthesis (fallback)
 *
 * 성능 최적화:
 *   - 문장 단위 스트리밍 + 프리페치 (TTFB 최소화)
 *   - 첫 문장만 합성 → 즉시 재생, 다음 문장은 백그라운드 프리페치
 *   - 서버: Communicate.stream() chunked transfer, 클라이언트: sentence pipeline
 *
 * 엔드포인트:
 *   POST /tts/stream     — Communicate.stream() (chunked, 기본)
 *   POST /tts/synthesize — EdgeTTS.synthesize() (하위 호환)
 */

// ── 타입 ────────────────────────────────────────────────

export type TtsStatus = 'idle' | 'speaking' | 'paused' | 'loading-model' | 'error'
export type TtsStatusCallback = (status: TtsStatus, message?: string) => void
export type TtsEngine = 'web-speech-api' | 'edge-tts'

export interface TtsVoiceInfo {
  name: string
  lang: string
  default: boolean
}

export interface TtsOptions {
  /** 음성 속도 (0.1 ~ 10, 기본 1.0) */
  rate?: number
  /** 피치 (0 ~ 2, 기본 1.0) */
  pitch?: number
  /** 볼륨 (0 ~ 1, 기본 1.0) */
  volume?: number
  /** BCP-47 언어 코드 (예: 'ko-KR'), 자동 감지 시 생략 */
  lang?: string
  /** 음성 이름 */
  voice?: string
}

export interface TtsModelConfig {
  /** TTS 엔진 종류 */
  engine: TtsEngine
  /** 모델 ID (e.g. 'edge-tts', 'web-speech-api') */
  modelId: string
  /** 모델 파라미터 */
  parameters?: Record<string, unknown>
}

// ── Edge TTS 언어별 기본 음성 ──────────────────────────

const EDGE_DEFAULT_VOICES: Record<string, string> = {
  'ko-KR': 'ko-KR-SunHiNeural',
  'en-GB': 'en-GB-SoniaNeural',
  'de-DE': 'de-DE-KatjaNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
}

// ── Web Speech API 언어별 선호 음성 매핑 ───────────────

const PREFERRED_VOICES: Record<string, string[]> = {
  'ko-KR': ['Sohee', 'Google 한국어', 'Microsoft Heami', 'Korean'],
  'en-GB': ['Google UK English Female', 'Microsoft Hazel', 'English'],
  'de-DE': ['Google Deutsch', 'Microsoft Katja', 'German'],
  'zh-CN': ['Google 普通话', 'Microsoft Huihui', 'Chinese'],
  'ja-JP': ['Google 日本語', 'Microsoft Haruka', 'Japanese'],
  'fr-FR': ['Google français', 'Microsoft Julie', 'French'],
}

// ── 언어 감지 매핑 ──────────────────────────────────────

const LANG_PATTERNS: [RegExp, string][] = [
  [/[\uAC00-\uD7AF\u1100-\u11FF]/, 'ko-KR'],
  [/[\u4E00-\u9FFF\u3400-\u4DBF]/, 'zh-CN'],
  [/[\u3040-\u309F\u30A0-\u30FF]/, 'ja-JP'],
  [/[äöüÄÖÜß]/, 'de-DE'],
  [/[a-zA-Z]/, 'en-GB'],
]

// ── 상태 ────────────────────────────────────────────────

let statusCallback: TtsStatusCallback | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null
let currentAudioElement: HTMLAudioElement | null = null
let isAutoReadEnabled = false
let cachedVoices: SpeechSynthesisVoice[] = []
let defaultOptions: TtsOptions = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
}

/** 현재 활성 TTS 엔진 */
let activeEngine: TtsEngine = 'edge-tts'

/** Edge TTS 모델 설정 */
let edgeTtsConfig: TtsModelConfig | null = null

/** 문장 스트리밍 취소용 AbortController */
let currentAbortController: AbortController | null = null

/** speak() 호출 세대 — 새 speak() 호출 시 이전 비동기 파이프라인 무효화 */
let speakGeneration = 0

// ── 초기화 ──────────────────────────────────────────────

function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices()
    if (voices.length > 0) {
      cachedVoices = voices
      resolve(voices)
      return
    }
    speechSynthesis.onvoiceschanged = () => {
      cachedVoices = speechSynthesis.getVoices()
      resolve(cachedVoices)
    }
    setTimeout(() => {
      cachedVoices = speechSynthesis.getVoices()
      resolve(cachedVoices)
    }, 300)
  })
}

// ── 공개 API ────────────────────────────────────────────

/**
 * 상태 콜백 등록
 */
export function onTtsStatus(cb: TtsStatusCallback): void {
  statusCallback = cb
}

/**
 * 자동 읽기 모드 활성/비활성
 */
export function setAutoRead(enabled: boolean): void {
  isAutoReadEnabled = enabled
}

export function getAutoRead(): boolean {
  return isAutoReadEnabled
}

/**
 * TTS 기본 옵션 설정
 */
export function setTtsOptions(opts: Partial<TtsOptions>): void {
  defaultOptions = { ...defaultOptions, ...opts }
}

export function getTtsOptions(): TtsOptions {
  return { ...defaultOptions }
}

/**
 * 사용 가능한 음성 목록 반환 (Web Speech API)
 */
export async function getAvailableVoices(): Promise<TtsVoiceInfo[]> {
  const voices = await ensureVoicesLoaded()
  return voices.map((v) => ({
    name: v.name,
    lang: v.lang,
    default: v.default,
  }))
}

/**
 * 특정 언어에 맞는 최적의 Web Speech API 음성 찾기
 */
async function findBestVoice(lang: string): Promise<SpeechSynthesisVoice | null> {
  const voices = await ensureVoicesLoaded()
  if (voices.length === 0) return null

  const preferred = PREFERRED_VOICES[lang]
  if (preferred) {
    for (const pref of preferred) {
      const match = voices.find((v) =>
        v.name.includes(pref) && v.lang.startsWith(lang.split('-')[0]),
      )
      if (match) return match
    }
  }

  const exact = voices.find((v) => v.lang === lang)
  if (exact) return exact

  const langCode = lang.split('-')[0]
  const partial = voices.find((v) => v.lang.startsWith(langCode))
  if (partial) return partial

  const defaultVoice = voices.find((v) => v.default)
  return defaultVoice ?? voices[0] ?? null
}

/**
 * 텍스트의 주요 언어를 자동 감지
 */
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 100)
  for (const [pattern, lang] of LANG_PATTERNS) {
    if (pattern.test(sample)) return lang
  }
  return 'en-GB'
}

// ── Edge TTS 유틸 ──────────────────────────────────────

/**
 * TtsOptions.rate (0.1~10) → Edge TTS rate 문자열 ('+0%', '-50%', '+100%')
 */
function toEdgeRate(rate: number): string {
  const percent = Math.round((rate - 1) * 100)
  return percent >= 0 ? `+${percent}%` : `${percent}%`
}

/**
 * TtsOptions.pitch (0~2) → Edge TTS pitch 문자열 ('+0Hz', '-100Hz')
 */
function toEdgePitch(pitch: number): string {
  const hz = Math.round((pitch - 1) * 100)
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`
}

/**
 * TtsOptions.volume (0~1) → Edge TTS volume 문자열 ('+0%', '-100%')
 */
function toEdgeVolume(volume: number): string {
  const percent = Math.round((volume - 1) * 100)
  return percent >= 0 ? `+${percent}%` : `${percent}%`
}

/**
 * 언어 코드에 맞는 Edge TTS 기본 음성 반환
 */
function getEdgeVoiceForLang(lang: string): string {
  return EDGE_DEFAULT_VOICES[lang]
    ?? EDGE_DEFAULT_VOICES[lang.split('-')[0] + '-' + lang.split('-')[1]]
    ?? 'en-GB-SoniaNeural'
}

// ── 텍스트를 음성으로 읽기 ──────────────────────────────

/**
 * 텍스트를 음성으로 읽기 — 엔진에 따라 분기
 */
export async function speak(text: string, opts?: TtsOptions): Promise<void> {
  if (!text.trim()) return

  // 이전 파이프라인 중단 (idle emit 없이 — 새 speak이 즉시 시작하므로)
  cancelPrevious()

  const cleanText = stripMarkdown(text)
  if (!cleanText.trim()) return

  const generation = ++speakGeneration
  const mergedOpts = { ...defaultOptions, ...opts }
  const lang = mergedOpts.lang ?? detectLanguage(cleanText)

  if (activeEngine === 'edge-tts') {
    await speakEdgeTts(cleanText, lang, mergedOpts, generation)
  } else {
    await speakWebSpeech(cleanText, lang, mergedOpts)
  }
}

/**
 * Edge TTS — 문장 단위 스트리밍 + 프리페치
 *
 * 1. 텍스트를 문장 단위로 분할
 * 2. 첫 문장을 즉시 합성 → 재생 시작 (TTFB ≈ 300–500ms)
 * 3. 현재 문장 재생 중에 다음 문장을 백그라운드 프리페치
 * 4. 재생 완료 → 프리페치된 다음 문장 즉시 이어 재생 (갭 없음)
 */
async function speakEdgeTts(
  text: string,
  lang: string,
  opts: TtsOptions,
  generation: number,
): Promise<void> {
  const voice = opts.voice ?? getEdgeVoiceForLang(lang)

  emitStatus('loading-model', `Edge TTS: ${voice}`)

  // 이전 스트리밍 취소
  if (currentAbortController) {
    currentAbortController.abort()
  }
  const controller = new AbortController()
  currentAbortController = controller

  /** 세대 불일치 또는 abort → 취소 판정 */
  const isCancelled = () => controller.signal.aborted || speakGeneration !== generation

  try {
    const sentences = splitSentences(text)
    if (sentences.length === 0) {
      emitStatus('idle')
      return
    }

    let prefetchPromise: Promise<TtsAudioData | null> | null = null

    for (let i = 0; i < sentences.length; i++) {
      if (isCancelled()) break

      // ── 현재 문장 오디오 가져오기 (프리페치 or 새로 fetch) ──
      let audioData: TtsAudioData | null = null

      if (prefetchPromise) {
        audioData = await prefetchPromise
        prefetchPromise = null
      }

      if (isCancelled()) {
        if (audioData?.url) URL.revokeObjectURL(audioData.url)
        break
      }

      // 프리페치가 없거나 null 반환 시 직접 fetch
      if (!audioData) {
        try {
          audioData = await fetchTtsAudio(sentences[i], voice, opts, controller.signal)
        } catch {
          if (isCancelled()) break
          // 네트워크 오류 등 — 다음 문장으로 스킵
          console.warn(`[TTS] 문장 ${i} fetch 실패, 스킵`)
          continue
        }
      }

      if (isCancelled()) {
        if (audioData?.url) URL.revokeObjectURL(audioData.url)
        break
      }

      // ── 다음 문장 프리페치 (현재 재생과 병렬) ──
      if (i + 1 < sentences.length && !isCancelled()) {
        prefetchPromise = fetchTtsAudio(sentences[i + 1], voice, opts, controller.signal)
          .catch(() => null)
      }

      // ── 현재 문장 재생 (완료될 때까지 대기) ──
      await playTtsAudio(audioData, opts, controller.signal)
    }

    // 남은 프리페치 정리
    if (prefetchPromise) {
      try {
        const leftover = await prefetchPromise
        if (leftover?.url) URL.revokeObjectURL(leftover.url)
      } catch { /* 무시 */ }
    }

    if (!isCancelled()) {
      currentAudioElement = null
      emitStatus('idle')
    }
  } catch (err) {
    // 취소(abort/세대 불일치)로 인한 모든 에러 → 조용히 종료
    // ⚠️ WebSpeech 폴백 금지: null audioData TypeError 등이 여기로 올 수 있음
    if (isCancelled()) return
    if ((err as Error).name === 'AbortError') return

    console.error('[TTS] Edge TTS 실패:', err)
    console.warn('[TTS] Web Speech API로 전환합니다')
    emitStatus('idle')
    await speakWebSpeech(text, lang, opts)
  } finally {
    if (currentAbortController === controller) {
      currentAbortController = null
    }
  }
}

// ── 문장 분할 ─────────────────────────────────────────

/** 최소 청크 길이 (너무 짧은 문장은 병합) */
const MIN_SENTENCE_LENGTH = 40

/**
 * 텍스트를 문장 단위로 분할 (한국어·영어·중국어·일본어 구두점 지원)
 * 짧은 문장은 병합하여 API 호출 횟수를 줄인다.
 */
/** 순수 구두점/공백만으로 구성된 텍스트인지 확인 */
const PUNCTUATION_ONLY_RE = /^[\s.!?,;:。！？，；：…\-–—]+$/

function splitSentences(text: string): string[] {
  // 문장 종결 부호 또는 줄바꿈 기준 분할 — 고아 구두점 제거
  const raw = text.split(/(?<=[.!?。！？\n])\s*/).filter(
    s => s.trim() && !PUNCTUATION_ONLY_RE.test(s.trim()),
  )

  if (raw.length <= 1) return raw

  // 짧은 문장 병합
  const merged: string[] = []
  let buf = ''

  for (const s of raw) {
    buf += (buf ? ' ' : '') + s
    if (buf.length >= MIN_SENTENCE_LENGTH) {
      merged.push(buf)
      buf = ''
    }
  }
  if (buf.trim()) merged.push(buf)

  return merged
}

// ── Edge TTS 오디오 페치 + 재생 ───────────────────────

interface TtsAudioData {
  blob: Blob
  url: string
}

/**
 * 서버 `/tts/stream` 엔드포인트에서 오디오 Blob 가져오기
 */
async function fetchTtsAudio(
  text: string,
  voice: string,
  opts: TtsOptions,
  signal: AbortSignal,
): Promise<TtsAudioData> {
  const response = await fetch('/tts/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice,
      rate: toEdgeRate(opts.rate ?? 1.0),
      pitch: toEdgePitch(opts.pitch ?? 1.0),
      volume: toEdgeVolume(opts.volume ?? 1.0),
    }),
    signal,
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Edge TTS HTTP ${response.status}: ${errBody}`)
  }

  const blob = await response.blob()
  if (!blob || blob.size === 0) {
    throw new Error('Empty audio response from Edge TTS')
  }

  const url = URL.createObjectURL(blob)
  return { blob, url }
}

/**
 * Audio 요소로 오디오 재생 (완료까지 Promise 대기)
 *
 * - 속도(rate)는 Edge TTS SSML에서 이미 적용 → playbackRate 이중 적용 않음
 * - 볼륨만 Audio 요소에서 적용
 */
function playTtsAudio(
  data: TtsAudioData,
  opts: TtsOptions,
  signal: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      URL.revokeObjectURL(data.url)
      resolve()
      return
    }

    const audio = new Audio(data.url)
    audio.volume = opts.volume ?? 1.0
    // rate는 Edge TTS SSML에서 처리 → playbackRate 미설정 (이중 적용 방지)

    currentAudioElement = audio

    audio.onplay = () => emitStatus('speaking')

    audio.onended = () => {
      currentAudioElement = null
      URL.revokeObjectURL(data.url)
      resolve()
    }

    audio.onerror = () => {
      currentAudioElement = null
      URL.revokeObjectURL(data.url)
      console.error('[TTS] Edge TTS 재생 오류')
      resolve() // 오류 시에도 다음 문장으로 진행
    }

    // 취소 시 즉시 중단
    const onAbort = () => {
      audio.pause()
      audio.currentTime = 0
      currentAudioElement = null
      URL.revokeObjectURL(data.url)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })

    audio.play().catch(() => {
      URL.revokeObjectURL(data.url)
      resolve()
    })
  })
}

/**
 * Web Speech API를 통한 음성 합성 (fallback)
 */
async function speakWebSpeech(text: string, lang: string, opts: TtsOptions): Promise<void> {
  try {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = opts.rate ?? 1.0
    utterance.pitch = opts.pitch ?? 1.0
    utterance.volume = opts.volume ?? 1.0
    utterance.lang = lang

    const voice = await findBestVoice(lang)
    if (voice) utterance.voice = voice

    utterance.onstart = () => emitStatus('speaking')
    utterance.onend = () => {
      currentUtterance = null
      emitStatus('idle')
    }
    utterance.onerror = (e) => {
      currentUtterance = null
      if (e.error === 'interrupted' || e.error === 'canceled') {
        emitStatus('idle')
      } else {
        console.error('[TTS] Web Speech 오류:', e.error)
        emitStatus('error', `TTS 오류: ${e.error}`)
      }
    }
    utterance.onpause = () => emitStatus('paused')
    utterance.onresume = () => emitStatus('speaking')

    currentUtterance = utterance
    speechSynthesis.speak(utterance)
  } catch (err) {
    console.error('[TTS] Web Speech 실패:', err)
    emitStatus('error', `TTS 실패: ${(err as Error).message}`)
  }
}

/**
 * AI 메시지를 자동 읽기 (auto-read 모드일 때 호출)
 */
export async function speakIfAutoRead(text: string, opts?: TtsOptions): Promise<void> {
  if (!isAutoReadEnabled) return
  await speak(text, opts)
}

/**
 * 내부: 이전 파이프라인 중단 (상태 emit 없이)
 * speak() 시작 시 사용 — idle 깜빡임 방지
 */
function cancelPrevious(): void {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
  if (currentAudioElement) {
    currentAudioElement.pause()
    currentAudioElement.currentTime = 0
    currentAudioElement = null
  }
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel()
    currentUtterance = null
  }
}

/**
 * 재생 중단 (외부 호출용)
 */
export function stop(): void {
  ++speakGeneration // 진행 중인 speak() 비동기 파이프라인 무효화
  cancelPrevious()
  emitStatus('idle')
}

/**
 * 일시정지
 */
export function pause(): void {
  if (currentAudioElement && !currentAudioElement.paused) {
    currentAudioElement.pause()
    emitStatus('paused')
    return
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.pause()
  }
}

/**
 * 재개
 */
export function resume(): void {
  if (currentAudioElement?.paused) {
    currentAudioElement.play()
    emitStatus('speaking')
    return
  }
  if (speechSynthesis.paused) {
    speechSynthesis.resume()
  }
}

/**
 * 현재 재생 중인지 여부
 */
export function isSpeaking(): boolean {
  const audioPlaying = currentAudioElement !== null && !currentAudioElement.paused
  return speechSynthesis.speaking || audioPlaying
}

/**
 * 토글: 재생 중이면 중단, 아니면 텍스트 읽기
 */
export async function toggleSpeak(text: string, opts?: TtsOptions): Promise<void> {
  if (isSpeaking()) {
    stop()
  } else {
    await speak(text, opts)
  }
}

// ── Edge TTS 건강 상태 확인 ────────────────────────────

/**
 * Edge TTS 서버가 사용 가능한지 확인
 */
export async function checkEdgeTtsHealth(): Promise<{
  available: boolean
  engine: string
}> {
  try {
    const res = await fetch('/tts/health')
    if (res.ok) {
      const data = await res.json()
      return { available: true, engine: data.engine ?? 'edge-tts' }
    }
    return { available: false, engine: 'edge-tts' }
  } catch {
    return { available: false, engine: 'edge-tts' }
  }
}

// ── 내부 유틸 ───────────────────────────────────────────

function emitStatus(status: TtsStatus, message?: string): void {
  statusCallback?.(status, message)
}

/**
 * 마크다운/HTML 태그 제거 + 구어체에서 읽지 않는 요소 제거
 */
function stripMarkdown(text: string): string {
  return text
    // ── 코드 블록 / 인라인 코드 ──
    .replace(/```[\s\S]*?```/g, '')      // 코드 블록 전체 제거
    .replace(/`[^`]+`/g, '')              // 인라인 코드 제거
    // ── HTML 태그 ──
    .replace(/<[^>]+>/g, '')
    // ── 이미지 ──
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // ── 링크: 텍스트만 유지, URL 제거 ──
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // ── URL 직접 노출 제거 ──
    .replace(/https?:\/\/\S+/g, '')
    // ── 인용 번호 [1], [2] 등 제거 ──
    .replace(/\[\d+\]/g, '')
    // ── Bold / Italic 마커 ──
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // ── 제목 마커 ──
    .replace(/^#{1,6}\s+/gm, '')
    // ── 인용 마커 ──
    .replace(/^>\s?/gm, '')
    // ── 수평선 ──
    .replace(/^---$/gm, '')
    // ── 리스트 마커 ──
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // ── 테이블 구분선 + 파이프 ──
    .replace(/\|[-:| ]+\|/g, '')
    .replace(/\|/g, ', ')
    // ── 템플릿/코드 플레이스홀더 ──
    .replace(/\{[^}]*\}/g, '')
    // ── 이모지 단독 라인 제거 (텍스트 포함 이모지는 유지) ──
    .replace(/^[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/gmu, '')
    // ── 구어체에서 읽지 않는 특수문자 제거 ──
    // 남은 마크다운 마커 (* _ ~ ^ ` #) + 장식용 특수문자
    .replace(/[*_~^`#]/g, '')
    // 괄호류 내부가 비었거나 숫자만 있으면 제거 (예: (), [], (3))
    .replace(/\(\s*\d*\s*\)/g, '')
    .replace(/\[\s*\d*\s*\]/g, '')
    // 연속된 특수문자 (===, ---, ***, ···, …) 제거
    .replace(/([=\-*.·…])\1{2,}/g, '')
    // 화살표 (→ ← ↔ => -> <-) 제거
    .replace(/[→←↔⇒⇐]|=>|->|<-|<>/g, '')
    // 불릿/데코 기호 (•◦▪▸►▶◆◇○●■□▷) 제거
    .replace(/[•◦▪▸►▶◆◇○●■□▷▹△▽⊙⊕⊗✓✗✔✘✕✖☐☑☒]/g, '')
    // ── 정리 ──
    // 종결 부호 뒤 줄바꿈 → 공백만 (이중 구두점 방지)
    .replace(/([.!?。！？])\s*\n{2,}/g, '$1 ')
    // 종결 부호 없는 줄바꿈 → 마침표 + 공백
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // 이중 구두점 정리: ".." → ".", "!." → "!", "?." → "?"
    .replace(/\.{2,}/g, '.')
    .replace(/([!?。！？])\./g, '$1')
    // 고아 쉼표 정리
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*/g, '')
    .replace(/,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── 스트리밍 TTS (AI 응답 생성과 동시 읽기) ────────────

/**
 * 스트리밍 TTS 핸들 — chat.store에서 토큰 도착 시 사용
 */
export interface StreamingTtsHandle {
  /** LLM에서 도착한 토큰(delta) 전달 */
  feedDelta(delta: string): void
  /** 스트리밍 완료 신호 — 남은 텍스트 flush */
  finish(): void
  /** 전체 취소 */
  cancel(): void
}

/**
 * 문장 누적기 — 토큰 스트림에서 문장 경계를 감지하고 클린 텍스트 반환
 *
 * - 코드 블록(```) 내부는 자동 스킵
 * - 문장 종결 부호(.!?。！？) 또는 줄바꿈에서 분할
 * - stripMarkdown으로 클리닝 후 반환
 */
class SentenceAccumulator {
  private fullText = ''
  private emittedUpTo = 0
  /** 마지막 emit 시각 (타임아웃 flush용) */
  private lastEmitTime = Date.now()

  /** 토큰 추가 → 완성된 문장 배열 반환 */
  feed(delta: string): string[] {
    this.fullText += delta
    return this.tryExtract(false)
  }

  /** 스트리밍 종료 → 남은 텍스트 전부 반환 */
  flush(): string[] {
    return this.tryExtract(true)
  }

  reset(): void {
    this.fullText = ''
    this.emittedUpTo = 0
    this.lastEmitTime = Date.now()
  }

  private tryExtract(isFinal: boolean): string[] {
    // 열린 코드 블록이면 대기 (코드 블록 완료까지 문장 추출 보류)
    const codeMarkers = (this.fullText.match(/```/g) || []).length
    if (codeMarkers % 2 !== 0 && !isFinal) return []

    const remaining = this.fullText.slice(this.emittedUpTo)
    if (!remaining.trim()) return []

    if (isFinal) {
      this.emittedUpTo = this.fullText.length
      this.lastEmitTime = Date.now()
      const cleaned = stripMarkdown(remaining)
      if (!cleaned || PUNCTUATION_ONLY_RE.test(cleaned)) return []
      return this.splitCleanSentences(cleaned)
    }

    // ── 1단계: 강한 경계 — 문장 종결 부호 + 줄바꿈 ──
    let lastEnd = -1
    const hardRegex = /[.!?。！？]\s*|\n+/g
    let m: RegExpExecArray | null
    while ((m = hardRegex.exec(remaining)) !== null) {
      lastEnd = m.index + m[0].length
    }

    // ── 2단계: 소프트 경계 — 80자 이상 누적 시 쉼표/콜론/세미콜론 ──
    if (lastEnd <= 0 && remaining.length >= 80) {
      const softRegex = /[,;:，；：]\s*/g
      while ((m = softRegex.exec(remaining)) !== null) {
        lastEnd = m.index + m[0].length
      }
    }

    // ── 3단계: 타임아웃 flush — 2초 이상 emit 없이 텍스트 누적 ──
    if (lastEnd <= 0 && remaining.length >= 20 && (Date.now() - this.lastEmitTime) > 2000) {
      // 경계 없이 오래 쌓인 텍스트 → 전부 flush
      lastEnd = remaining.length
    }

    if (lastEnd <= 0) return []

    const toProcess = remaining.slice(0, lastEnd)
    this.emittedUpTo += lastEnd
    this.lastEmitTime = Date.now()

    const cleaned = stripMarkdown(toProcess)
    if (!cleaned || PUNCTUATION_ONLY_RE.test(cleaned)) return []

    return this.splitCleanSentences(cleaned)
  }

  /** 클린 텍스트를 문장 단위로 분할 (짧은 문장 병합) */
  private splitCleanSentences(text: string): string[] {
    const raw = text.split(/(?<=[.!?。！？\n])\s*/).filter(
      s => s.trim().length > 0 && !PUNCTUATION_ONLY_RE.test(s.trim()),
    )
    if (raw.length <= 1) return raw.length === 1 ? [raw[0]] : []

    // 짧은 문장 병합 (MIN 40자)
    const merged: string[] = []
    let buf = ''
    for (const s of raw) {
      buf += (buf ? ' ' : '') + s
      if (buf.length >= 40) {
        merged.push(buf)
        buf = ''
      }
    }
    if (buf.trim()) merged.push(buf)
    return merged
  }
}

/**
 * 스트리밍 TTS 시작 — AI 응답 생성과 동시에 음성 출력
 *
 * 플로우:
 *   LLM token → feedDelta() → SentenceAccumulator → 큐 → fetch TTS → 재생
 *                                                       ↑ 프리페치   ↑ 끊김없이 이어 재생
 *
 * @returns StreamingTtsHandle — feedDelta/finish/cancel 메서드
 */
export function startStreamingSpeak(opts?: TtsOptions): StreamingTtsHandle {
  cancelPrevious()

  const generation = ++speakGeneration
  const controller = new AbortController()
  currentAbortController = controller

  const accumulator = new SentenceAccumulator()
  const queue: string[] = []
  let finished = false
  let processing = false
  let langDetected = false
  let actualVoice = ''

  const mergedOpts = { ...defaultOptions, ...opts }
  const isCancelled = () => controller.signal.aborted || speakGeneration !== generation

  // 큐에 문장이 추가되었을 때 대기 중인 processQueue를 깨우는 콜백
  let queueResolve: (() => void) | null = null

  function enqueue(sentences: string[]): void {
    if (sentences.length === 0 || isCancelled()) return
    queue.push(...sentences)
    if (queueResolve) {
      const r = queueResolve
      queueResolve = null
      r()
    }
    if (!processing) processQueue().catch(console.error)
  }

  async function processQueue(): Promise<void> {
    if (processing || isCancelled()) return
    processing = true

    try {
      while (!isCancelled()) {
        // ── 큐에서 문장 꺼내기 (없으면 대기) ──
        if (queue.length === 0) {
          if (finished) break
          // 새 문장 도착 또는 타임아웃까지 대기
          await new Promise<void>((resolve) => {
            queueResolve = resolve
            setTimeout(() => { if (queueResolve === resolve) { queueResolve = null; resolve() } }, 300)
          })
          continue
        }

        const sentence = queue.shift()!

        // ── 첫 문장에서 언어 자동 감지 ──
        if (!langDetected) {
          const detectedLang = detectLanguage(sentence)
          actualVoice = mergedOpts.voice ?? getEdgeVoiceForLang(detectedLang)
          langDetected = true
          emitStatus('loading-model', `Edge TTS: ${actualVoice}`)
        }

        // ── 오디오 fetch (첫 문장은 1회 재시도) ──
        let audioData: TtsAudioData | null = null
        try {
          audioData = await fetchTtsAudio(sentence, actualVoice, mergedOpts, controller.signal)
        } catch (fetchErr) {
          // 첫 문장 실패 시 200ms 후 재시도 (서버 cold start 대응)
          if (!isCancelled() && queue.length === 0 && !finished) {
            await new Promise(r => setTimeout(r, 200))
            try {
              audioData = await fetchTtsAudio(sentence, actualVoice, mergedOpts, controller.signal)
            } catch { /* 재시도도 실패 → 아래에서 스킵 */ }
          }
          if (!audioData) {
            if (isCancelled()) break
            console.warn('[TTS] Streaming fetch 실패, 스킵:', sentence.slice(0, 30))
            continue
          }
        }

        if (isCancelled()) {
          URL.revokeObjectURL(audioData.url)
          break
        }

        // ── 다음 문장 프리페치 (재생과 병렬) ──
        let prefetch: Promise<TtsAudioData | null> | null = null
        const nextSentence = queue[0]
        if (nextSentence && !isCancelled()) {
          prefetch = fetchTtsAudio(nextSentence, actualVoice, mergedOpts, controller.signal)
            .catch(() => null)
        }

        // ── 재생 (완료 대기) ──
        emitStatus('speaking')
        await playTtsAudio(audioData, mergedOpts, controller.signal)

        // ── 프리페치 결과 사용 ──
        if (prefetch && queue.length > 0 && !isCancelled()) {
          const prefetched = await prefetch
          if (prefetched && !isCancelled()) {
            queue.shift() // 프리페치한 문장 제거
            await playTtsAudio(prefetched, mergedOpts, controller.signal)
          } else if (prefetched) {
            URL.revokeObjectURL(prefetched.url)
          }
        } else if (prefetch) {
          prefetch.then(d => { if (d?.url) URL.revokeObjectURL(d.url) }).catch(() => {})
        }
      }

      if (!isCancelled()) {
        currentAudioElement = null
        emitStatus('idle')
      }
    } finally {
      processing = false
      queueResolve = null
    }
  }

  return {
    feedDelta(delta: string): void {
      if (isCancelled()) return
      const sentences = accumulator.feed(delta)
      enqueue(sentences)
    },
    finish(): void {
      if (isCancelled()) return
      const sentences = accumulator.flush()
      finished = true
      enqueue(sentences)
      // 큐가 비어있고 처리 중이 아니면 즉시 idle
      if (queue.length === 0 && !processing && !isCancelled()) {
        currentAudioElement = null
        emitStatus('idle')
      }
    },
    cancel(): void {
      stop()
    },
  }
}

// ── TTS 엔진 관리 ──────────────────────────────────────

/**
 * 현재 활성 TTS 엔진 조회
 */
export function getActiveEngine(): TtsEngine {
  return activeEngine
}

/**
 * TTS 엔진 변경
 * - 'edge-tts': Microsoft Edge Neural TTS (기본)
 * - 'web-speech-api': 브라우저 내장 TTS (fallback)
 */
export function setActiveEngine(engine: TtsEngine): void {
  activeEngine = engine
  console.info('[TTS] Engine changed to:', engine)
}

/**
 * Edge TTS 설정
 * @param config 모델 설정 (engine, modelId, parameters)
 */
export function configureEdgeTts(config: TtsModelConfig): void {
  edgeTtsConfig = config
  activeEngine = 'edge-tts'
  console.info('[TTS] Edge TTS configured & engine activated:', config.modelId)
}

/**
 * 현재 Edge TTS 설정 조회
 */
export function getEdgeTtsConfig(): TtsModelConfig | null {
  return edgeTtsConfig
}
