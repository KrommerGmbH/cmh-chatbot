# 모델 다운로드 UI/로직 — 기능 스펙

> **프로젝트**: cmh-chatbot Renderer
> **작성일**: 2026-04-18
> **우선순위**: High

---

## 1. 개요

HuggingFace에서 GGUF 모델을 다운로드하고, 다운로드 진행률을 실시간 표시하며, 완료 시 entity를 자동 업데이트하는 기능.

## 2. 유저 스토리

- **US-1**: 사용자가 모델 목록에서 미다운로드 모델을 보고, "다운로드" 버튼을 클릭하면 다운로드가 시작된다.
- **US-2**: 다운로드 중 진행률(%, 속도, ETA)이 실시간으로 표시된다.
- **US-3**: 다운로드 완료 시 `isDownloaded: true`로 자동 업데이트되고 즉시 사용 가능하다.
- **US-4**: 다운로드 중 취소할 수 있다.
- **US-5**: 앱 재시작 후에도 다운로드 상태(완료/미완료)가 유지된다.

## 3. 기술 설계

### 3.1 데이터 모델 (이미 존재)

`LlmModel` entity에 이미 다음 필드가 있음:
- `downloadUrl?: string | null` — HuggingFace URL
- `fileSize?: number | null` — 파일 크기 (bytes)
- `isDownloaded: boolean` — 다운로드 완료 여부
- `filePath?: string | null` — 로컬 파일 경로

### 3.2 다운로드 서비스

```typescript
// src/renderer/app/service/model-download.service.ts
interface DownloadProgress {
  modelId: string
  percent: number       // 0-100
  bytesDownloaded: number
  totalBytes: number
  speed: number         // bytes/sec
  eta: number           // seconds
  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error'
  error?: string
}
```

- `fetch()` + `ReadableStream` 사용 (Content-Length 기반 진행률)
- 취소: `AbortController`
- 저장: `models/` 디렉토리에 스트리밍 저장
- 완료 후: DAL entity `isDownloaded = true` 자동 save

### 3.3 UI 위치

모델 피커 드롭다운 내에서:
- `isDownloaded === false` 모델: "⬇️" 다운로드 아이콘 표시
- 클릭 시 다운로드 시작 → progress bar 표시
- 다운로드 중: 원형 프로그레스 + 퍼센트 + 취소 버튼

### 3.4 Pinia Store 확장

`chat.store.ts`에 다운로드 상태 관리 추가:
```typescript
const downloadProgress = ref<Map<string, DownloadProgress>>(new Map())
function startDownload(modelEntityId: string): void
function cancelDownload(modelEntityId: string): void
```

## 4. 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `src/renderer/app/service/model-download.service.ts` | 신규 |
| `src/renderer/app/store/chat.store.ts` | 수정 (download actions) |
| `cmh-chat-input/cmh-chat-input.html` | 수정 (모델 목록에 다운로드 버튼) |
| `cmh-chat-input/cmh-chat-input.scss` | 수정 (progress 스타일) |
| `cmh-chat-input/index.ts` | 수정 (download 이벤트 핸들러) |

## 5. 제약 사항

- 브라우저 환경에서는 파일 시스템 직접 접근 불가 → Electron의 경우 IPC 사용, Docker의 경우 서버 사이드 다운로드
- 현재 Renderer-only 구현이므로 `fetch()` → Blob → 서버 `/api/models/download` 엔드포인트 필요
- 대용량 파일(5~12GB): 청크 다운로드 + 재시작 지원 필요 (Range 헤더)

## 6. 구현 순서 (Tasks)

1. `model-download.service.ts` 생성 — 다운로드 로직 + 진행률 계산
2. `chat.store.ts` — `downloadProgress`, `startDownload`, `cancelDownload` 추가
3. `cmh-chat-input.html` — 모델 목록에 다운로드 상태 표시
4. `cmh-chat-input.scss` — progress bar 스타일
5. 완료 시 entity auto-save 로직
