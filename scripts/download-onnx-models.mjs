#!/usr/bin/env node
/**
 * ONNX 모델 사전 다운로드 스크립트
 *
 * Whisper STT 모델을 models/onnx/ 에 다운로드하여
 * Vite dev server에서 로컬 서빙할 수 있도록 준비.
 *
 * 사용법:
 *   pnpm download:onnx
 *   node scripts/download-onnx-models.mjs
 *
 * 옵션:
 *   --model <id>   HuggingFace 모델 ID (기본: onnx-community/whisper-small)
 *   --force        이미 존재하는 파일도 다시 다운로드
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODELS_BASE = resolve(__dirname, '..', 'models', 'onnx')

// ── 설정 ────────────────────────────────────────────────

const DEFAULT_MODEL = 'onnx-community/whisper-small'
const HF_BASE = 'https://huggingface.co'

/**
 * Whisper STT에 필요한 최소 파일 목록 (q4 양자화).
 * 전체 파일 목록이 아닌, Transformers.js pipeline 동작에 필요한 파일만 포함.
 */
const REQUIRED_FILES = [
  // 설정 파일
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',

  // ONNX 모델 (q4 양자화)
  'onnx/encoder_model_q4.onnx',
  'onnx/decoder_model_merged_q4.onnx',

  // ONNX 외부 데이터 (큰 모델은 .onnx_data 파일로 분리)
  'onnx/encoder_model_q4.onnx_data',
  'onnx/decoder_model_merged_q4.onnx_data',
]

// ── CLI 인자 파싱 ───────────────────────────────────────

const args = process.argv.slice(2)
const force = args.includes('--force')
const modelIdx = args.indexOf('--model')
const modelId = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : DEFAULT_MODEL

// ── 유틸리티 ────────────────────────────────────────────

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function downloadFile(url, dest) {
  await mkdir(dirname(dest), { recursive: true })

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    // .onnx_data 파일이 없는 모델도 있으므로 404는 경고만
    if (res.status === 404) {
      return { skipped: true, reason: '404 (파일 없음 — 선택적 파일일 수 있음)' }
    }
    throw new Error(`HTTP ${res.status}: ${url}`)
  }

  const contentLength = res.headers.get('content-length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null
  let downloaded = 0

  const reader = res.body.getReader()
  const chunks = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    downloaded += value.length

    if (totalBytes) {
      const pct = Math.round((downloaded / totalBytes) * 100)
      const sizeMB = (downloaded / 1024 / 1024).toFixed(1)
      const totalMB = (totalBytes / 1024 / 1024).toFixed(1)
      process.stdout.write(`\r  ↓ ${sizeMB}MB / ${totalMB}MB (${pct}%)`)
    } else {
      const sizeMB = (downloaded / 1024 / 1024).toFixed(1)
      process.stdout.write(`\r  ↓ ${sizeMB}MB`)
    }
  }

  const buffer = Buffer.concat(chunks)
  await writeFile(dest, buffer)
  process.stdout.write('\n')

  return { skipped: false, bytes: downloaded }
}

// ── 메인 ────────────────────────────────────────────────

async function main() {
  const modelDir = resolve(MODELS_BASE, modelId)

  console.log('╔══════════════════════════════════════════════╗')
  console.log('║     ONNX 모델 사전 다운로드 (Whisper STT)      ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log()
  console.log(`  모델: ${modelId}`)
  console.log(`  경로: ${modelDir}`)
  console.log(`  강제: ${force ? 'Yes' : 'No'}`)
  console.log()

  let downloadCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const file of REQUIRED_FILES) {
    const url = `${HF_BASE}/${modelId}/resolve/main/${file}`
    const dest = resolve(modelDir, file)
    const relPath = file

    // 이미 존재하면 건너뜀 (--force 제외)
    if (!force && await fileExists(dest)) {
      console.log(`  ✓ ${relPath} (이미 존재)`)
      skipCount++
      continue
    }

    console.log(`  📥 ${relPath}`)
    try {
      const result = await downloadFile(url, dest)
      if (result.skipped) {
        console.log(`    ⚠ ${result.reason}`)
        skipCount++
      } else {
        const mb = (result.bytes / 1024 / 1024).toFixed(1)
        console.log(`    ✅ ${mb}MB`)
        downloadCount++
      }
    } catch (err) {
      console.error(`    ❌ ${err.message}`)
      errorCount++
    }
  }

  console.log()
  console.log('─────────────────────────────────────────')
  console.log(`  완료: ${downloadCount}개 다운로드, ${skipCount}개 건너뜀, ${errorCount}개 오류`)

  if (errorCount > 0) {
    console.log()
    console.log('  ⚠ 일부 파일 다운로드에 실패했습니다.')
    console.log('    필수 파일이 누락된 경우, 브라우저에서 첫 로드 시 자동 다운로드됩니다.')
    process.exit(1)
  }

  console.log()
  console.log('  💡 팁: dev 서버 실행 후 /models/onnx/ 경로로 로컬 서빙됩니다.')
  console.log('       pnpm dev:renderer → STT 사용 시 로컬 모델 우선 로드')
}

main().catch(err => {
  console.error('치명적 오류:', err)
  process.exit(1)
})
