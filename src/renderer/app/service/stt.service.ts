/**
 * STT Service — Speech-to-Text using Whisper (Transformers.js)
 *
 * 순수 브라우저 환경에서 마이크 입력을 받아 Whisper 모델로 텍스트 변환.
 * - 모델: onnx-community/whisper-small (ONNX, 다국어 지원)
 * - 엔진: @huggingface/transformers (WASM)
 * - 모델 저장: models/onnx/ (로컬 서버 서빙) + 브라우저 Cache API 자동 캐시
 * - 오디오: MediaRecorder + AudioContext (16kHz 리샘플링)
 */

import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// ── 모델 경로 설정 ──────────────────────────────────────
// Vite dev server / production 모두 /models/onnx/ 경로에서 모델을 서빙.
// models/onnx/onnx-community/whisper-small/ 에 미리 다운로드해 둔 모델을 사용.
// 로컬에 없으면 HuggingFace Hub에서 자동 다운로드 (브라우저 Cache API에 캐시).
env.localModelPath = '/models/onnx/'
env.allowLocalModels = true

const WHISPER_MODEL = 'onnx-community/whisper-small'

// ── 상태 ────────────────────────────────────────────────

let transcriber: AutomaticSpeechRecognitionPipeline | null = null
let isModelLoading = false
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let isRecording = false

export type SttStatus = 'idle' | 'loading-model' | 'ready' | 'recording' | 'transcribing' | 'error'
export type SttStatusCallback = (status: SttStatus, message?: string) => void
export type SttResultCallback = (text: string) => void
export type SttProgressCallback = (progress: number) => void

let statusCallback: SttStatusCallback | null = null
let resultCallback: SttResultCallback | null = null
let progressCallback: SttProgressCallback | null = null

// ── 공개 API ────────────────────────────────────────────

/**
 * 콜백 등록
 */
export function onSttStatus(cb: SttStatusCallback): void {
  statusCallback = cb
}

export function onSttResult(cb: SttResultCallback): void {
  resultCallback = cb
}

export function onSttProgress(cb: SttProgressCallback): void {
  progressCallback = cb
}

/**
 * Whisper 모델 사전 로드 (최초 1회).
 * 모델 다운로드가 필요하면 시간이 걸릴 수 있음.
 */
export async function loadWhisperModel(): Promise<void> {
  if (transcriber) return
  if (isModelLoading) return

  isModelLoading = true
  emitStatus('loading-model', 'Whisper 모델 로딩 중...')

  try {
    transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
      dtype: 'q4',  // 4-bit 양자화 (메모리 절약)
      device: 'wasm',
      progress_callback: (data: { progress?: number; status?: string }) => {
        if (data.progress !== undefined && progressCallback) {
          progressCallback(Math.round(data.progress))
        }
      },
    }) as AutomaticSpeechRecognitionPipeline

    emitStatus('ready', 'Whisper 모델 준비 완료')
  } catch (err) {
    console.error('[STT] Whisper 모델 로드 실패:', err)
    emitStatus('error', `모델 로드 실패: ${(err as Error).message}`)
    transcriber = null
  } finally {
    isModelLoading = false
  }
}

/**
 * 마이크 녹음 시작
 */
export async function startRecording(): Promise<void> {
  if (isRecording) return

  // 모델이 없으면 먼저 로드
  if (!transcriber) {
    await loadWhisperModel()
    if (!transcriber) return // 로드 실패
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    audioChunks = []
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: getSupportedMimeType(),
    })

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      // 스트림 트랙 정리
      stream.getTracks().forEach((track) => track.stop())

      if (audioChunks.length === 0) {
        emitStatus('ready')
        return
      }

      emitStatus('transcribing', '음성 변환 중...')

      try {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder!.mimeType })
        const audioBuffer = await blobToFloat32Array(audioBlob)
        const result = await transcriber!({
          // Whisper는 Float32Array (16kHz, mono) 입력
          ...audioBuffer,
        })

        const text = typeof result === 'string'
          ? result
          : (result as { text: string }).text ?? ''

        if (text.trim()) {
          resultCallback?.(text.trim())
        }

        emitStatus('ready')
      } catch (err) {
        console.error('[STT] 변환 실패:', err)
        emitStatus('error', `변환 실패: ${(err as Error).message}`)
      }
    }

    mediaRecorder.start(250) // 250ms 청크
    isRecording = true
    emitStatus('recording', '녹음 중...')
  } catch (err) {
    console.error('[STT] 마이크 접근 실패:', err)
    emitStatus('error', `마이크 접근 실패: ${(err as Error).message}`)
  }
}

/**
 * 녹음 중단 → 자동으로 Whisper 변환 실행
 */
export function stopRecording(): void {
  if (!isRecording || !mediaRecorder) return

  mediaRecorder.stop()
  isRecording = false
}

/**
 * 녹음 토글 (시작/중지)
 */
export async function toggleRecording(): Promise<void> {
  if (isRecording) {
    stopRecording()
  } else {
    await startRecording()
  }
}

/**
 * 현재 녹음 중인지 여부
 */
export function getIsRecording(): boolean {
  return isRecording
}

/**
 * 모델 로드 상태
 */
export function getIsModelLoaded(): boolean {
  return transcriber !== null
}

// ── 내부 유틸 ───────────────────────────────────────────

function emitStatus(status: SttStatus, message?: string): void {
  statusCallback?.(status, message)
}

/**
 * 브라우저 지원 MIME 타입 확인
 */
function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return 'audio/webm'
}

/**
 * Blob → Float32Array (16kHz mono) 변환
 * Whisper 모델 입력 형식에 맞춤
 */
async function blobToFloat32Array(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext({ sampleRate: 16000 })

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // mono 채널 추출
    const channelData = audioBuffer.getChannelData(0)

    // 16kHz 리샘플링 (AudioContext가 이미 처리)
    if (audioBuffer.sampleRate !== 16000) {
      const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000)
      const source = offlineCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(offlineCtx.destination)
      source.start(0)
      const resampled = await offlineCtx.startRendering()
      return resampled.getChannelData(0)
    }

    return channelData
  } finally {
    await audioContext.close()
  }
}
