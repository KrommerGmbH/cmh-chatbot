# AI SDK + LangGraph + LangChain 통합 — 구현 계획

> **프로젝트**: cmh-chatbot  
> **작성일**: 2026-04-18  
> **스펙 참조**: [ai-sdk-langgraph-architecture.spec.md](ai-sdk-langgraph-architecture.spec.md)  
> **상태**: Draft

---

## Phase 1 — Engine API 서버 + AI SDK streamText (P0)

> **목표**: Hono 기반 `/api/chat` 라우트에서 AI SDK `streamText()` → Data Stream Protocol SSE 응답

### 1.1 태스크

| # | 태스크 | 파일 | 설명 |
|---|--------|------|------|
| 1.1 | 패키지 설치 | `package.json` | `ai`, `@ai-sdk/openai`, `hono` 추가 |
| 1.2 | Engine API 서버 생성 | `engine/server/app.ts` | Hono 앱 인스턴스 + CORS + JSON body parser |
| 1.3 | Chat 라우트 | `engine/server/routes/chat.route.ts` | `POST /api/chat` → DAL resolve → `streamText()` → SSE |
| 1.4 | AI SDK Provider Factory | `engine/provider/ai-sdk-factory.ts` | `ResolvedModel` → AI SDK provider 변환 (`createOpenAI({ baseURL })`) |
| 1.5 | Token Counter | `engine/service/token-counter.ts` | `countTokens(text)`, `trimHistory(messages, maxTokens)` |
| 1.6 | 서버 엔트리 | `engine/server/index.ts` | Docker: `serve(app, { port })`, Electron: export for Main Process |

### 1.2 기술 결정

- **llama-server 호환**: `@ai-sdk/openai`의 `createOpenAI({ baseURL: 'http://127.0.0.1:8080/v1', apiKey: 'not-needed' })` 
- **Token counting**: 우선 llama-server `/tokenize` 엔드포인트, 폴백으로 문자열 길이 추정 (`chars / 3.5`)
- **Hono 포트**: `3100` (llama-server 8080과 분리)

### 1.3 검증

```
curl -X POST http://localhost:3100/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hello"}],"modelId":"gemma-3-4b-it"}'
# → SSE stream with Data Stream Protocol
```

---

## Phase 2 — Renderer AI SDK 클라이언트 마이그레이션 (P0)

> **목표**: `llm-client.service.ts` 수동 fetch를 AI SDK Data Stream 파싱으로 교체

### 2.1 태스크

| # | 태스크 | 파일 | 설명 |
|---|--------|------|------|
| 2.1 | AI SDK client wrapper | `renderer/app/service/ai-client.service.ts` | `streamChat()` — fetch + AI SDK `parseDataStreamPart()` |
| 2.2 | chat.store 연동 | `renderer/app/store/chat.store.ts` | `sendMessage()`에서 새 `streamChat()` 사용 |
| 2.3 | 기존 llm-client.service.ts 제거 | — | deprecated 후 삭제 |
| 2.4 | Vite proxy 변경 | `vite.config.ts` | `/api` → `http://localhost:3100` 프록시 추가 |

### 2.2 Vue 호환 전략

AI SDK `useChat()`는 React 전용이므로:
- **방식 A** (채택): `fetch('/api/chat')` + AI SDK `readDataStream()` / `parseDataStreamPart()` 직접 사용
- 방식 B: 커뮤니티 `ai-sdk-vue` 래퍼 (성숙도 미확인)

### 2.3 검증

- Renderer에서 채팅 메시지 전송 → 스트리밍 응답 수신 확인
- reasoning/thinking 파싱 동작 확인
- 첨부파일 (이미지/텍스트) 전달 확인

---

## Phase 3 — Token-Aware History Trimming (P0)

> **목표**: contextLength 기반 토큰 예산으로 히스토리 자동 트리밍

### 3.1 태스크

| # | 태스크 | 파일 | 설명 |
|---|--------|------|------|
| 3.1 | trimHistory 구현 | `engine/service/token-counter.ts` | 시스템 프롬프트 + 최신 메시지 우선, 예산 초과 시 오래된 메시지 제거 |
| 3.2 | chat 라우트 적용 | `engine/server/routes/chat.route.ts` | resolve 후 `model.contextLength`로 trimming |

### 3.2 토큰 예산 분배

```
contextLength (e.g., 4096)
├── systemPrompt: ~200 tokens (고정)
├── responseReserve: min(contextLength * 0.25, 4096)
└── historyBudget: contextLength - systemPrompt - responseReserve
    → 오래된 메시지부터 제거하여 budget 이내로 유지
```

---

## Phase 4 — Multi-Provider 지원 (P1)

> **목표**: Anthropic Claude, Google Gemini 네이티브 SDK 연동

### 4.1 태스크

| # | 태스크 | 파일 | 설명 |
|---|--------|------|------|
| 4.1 | 패키지 추가 | `package.json` | `@ai-sdk/anthropic`, `@ai-sdk/google` |
| 4.2 | Provider Factory 확장 | `engine/provider/ai-sdk-factory.ts` | `provider.type`별 분기: openai, anthropic, google, local-gguf |
| 4.3 | API Key 관리 | `engine/data/entity/llm-provider.entity.ts` | `apiKey` 필드 암호화 저장 |

### 4.2 Provider 매핑

| provider.type | AI SDK Factory | baseURL |
|---------------|---------------|---------|
| `openai` | `createOpenAI()` | `https://api.openai.com/v1` |
| `anthropic` | `createAnthropic()` | 기본값 |
| `google` | `createGoogleGenerativeAI()` | 기본값 |
| `local-gguf` | `createOpenAI({ baseURL })` | `http://127.0.0.1:8080/v1` |
| `ollama` | `createOpenAI({ baseURL })` | `http://127.0.0.1:11434/v1` |

---

## Phase 5 — LangGraph + AI SDK 스트리밍 통합 (P1)

> **목표**: 기존 LangGraph StateGraph 노드에서 AI SDK `streamText()` 사용 + 결과를 Data Stream으로 전달

### 5.1 태스크

| # | 태스크 | 파일 | 설명 |
|---|--------|------|------|
| 5.1 | Workflow 라우트 | `engine/server/routes/workflow.route.ts` | `POST /api/workflow` → LangGraph graph.invoke() |
| 5.2 | Worker 노드 AI SDK 연동 | `engine/langchain/graph/worker.node.ts` | `streamText()` 호출 → 노드 출력 |
| 5.3 | Streaming bridge | `engine/langchain/graph/stream-bridge.ts` | LangGraph 노드 출력 → AI SDK Data Stream 변환 |
| 5.4 | HITL interrupt 연동 | `engine/langchain/graph/human-gate.node.ts` | SecurityLevel `approve` 시 스트림 일시 정지 |

### 5.2 접근 방식

LangGraph의 `graph.stream()` → 각 노드 이벤트를 AI SDK Data Stream 포맷으로 변환하여 SSE 전송:

```typescript
// 개념적 코드
const stream = graph.stream(input, { streamMode: 'values' })
for await (const event of stream) {
  // AI SDK Data Stream Protocol로 인코딩하여 SSE 전송
  controller.enqueue(encodeDataStreamPart('text', event.messages.at(-1).content))
}
```

---

## Phase 6 — RAG 파이프라인 확장 (P1)

> **목표**: 첨부파일 + SQLite DB → 임베딩 → 벡터 검색 → 컨텍스트 주입

### 6.1 태스크

| # | 태스크 | 파일 | 설명 |
|---|--------|------|------|
| 6.1 | Embedding provider | `engine/rag/embedding.ts` | AI SDK + LangChain 임베딩 (로컬: llama.cpp, 클라우드: OpenAI) |
| 6.2 | Vector store | `engine/rag/vector-store.ts` | SQLite-VSS 또는 in-memory FAISS |
| 6.3 | RAG chain | `engine/rag/pipeline.ts` | 확장 — `RetrievalQAChain` + context stuffing |
| 6.4 | RAG 라우트 | `engine/server/routes/rag.route.ts` | `POST /api/rag` → query + retrieve + generate |
| 6.5 | 첨부파일 인덱싱 | `engine/rag/indexer.ts` | 업로드 시 자동 chunking + embedding 저장 |

---

## Phase 7 — 다중 트리거 (P2)

> **목표**: cronJob, REST API가 동일 Orchestration Layer 사용

### 7.1 태스크

| # | 태스크 | 파일 | 설명 |
|---|--------|------|------|
| 7.1 | Scheduler 서비스 | `engine/service/scheduler.ts` | node-cron 기반, DAL에서 스케줄 로드 |
| 7.2 | REST API 인증 | `engine/server/middleware/auth.ts` | API key 기반 인증 미들웨어 |
| 7.3 | Webhook 라우트 | `engine/server/routes/webhook.route.ts` | 외부 시스템 → LLM 호출 |

---

## 의존성 그래프

```
Phase 1 (Engine API + AI SDK)
    ├── Phase 2 (Renderer 마이그레이션) — Phase 1 완료 후
    ├── Phase 3 (Token Trimming) — Phase 1과 병렬 가능
    └── Phase 4 (Multi-Provider) — Phase 1 완료 후
         └── Phase 5 (LangGraph 통합) — Phase 1+4 완료 후
              └── Phase 6 (RAG) — Phase 5와 병렬 가능
                   └── Phase 7 (다중 트리거) — Phase 1 완료 후
```

---

## 예상 일정

| Phase | 예상 소요 | 비고 |
|-------|----------|------|
| Phase 1 | 1 세션 | Hono + AI SDK 기본 라우트 |
| Phase 2 | 1 세션 | Renderer fetch 교체 |
| Phase 3 | 0.5 세션 | Token counter + trimming |
| Phase 4 | 0.5 세션 | Provider 분기 추가 |
| Phase 5 | 2 세션 | LangGraph + 스트리밍 브릿지 복잡도 |
| Phase 6 | 2 세션 | RAG 파이프라인 + 인덱싱 |
| Phase 7 | 1 세션 | Scheduler + Auth |

**총 예상**: ~8 세션

---

## 다음 단계

Phase 1부터 순차 진행. 각 Phase 완료 시 동작 검증 후 다음 Phase로 이동.

> **즉시 실행 가능**: Phase 1 (Engine API + AI SDK streamText 기본 라우트 구축)

---

## 구현 현황 스냅샷 (2026-04-19)

### 완료

1. `/api/chat` 멀티모달 보존 경로 반영
2. 공용 스트림 파서 도입 및 renderer/client 파싱 정합화
3. Google provider fallback 가시성 보강
4. 구조화 UI 블록 스키마/렌더링 확장
5. 채팅 개발 실행 기준(3 프로세스) 정렬

### 진행 중

1. LangGraph/RAG/다중 트리거의 운영 검증 및 관측성 강화

---

## 파일 단위 리팩터 순서 (실행 순서 고정)

아래 순서는 중복 로직 제거와 회귀 리스크 최소화를 위한 고정 순서다.

1. **Engine 경계 정리 (소스 오브 트루스 고정)**
  - `src/engine/server/routes.ts`
  - 목적: `/api/chat`, provider/model API 에러 계약, 멀티모달 보존 규칙 확정

2. **공용 스트림 파서 단일화**
  - `src/shared/ai-stream/protocol-parser.ts`
  - 목적: 프로토콜 파싱 규칙 단일 소스화

3. **Renderer/Client 파서 중복 제거**
  - `src/renderer/app/service/ai-client.service.ts`
  - `src/client/chat-client.ts`
  - 목적: 공용 파서로 통일, abort/timeout 처리 정합화

4. **모델/프로바이더 가시성 안정화**
  - `src/renderer/app/service/llm-model.service.ts`
  - 목적: cache-first + Google fallback 모델 유지

5. **메시지 전송 UX/타임아웃 정책 정리**
  - `src/renderer/app/store/chat.store.ts`
  - 목적: cloud/multimodal OCR 경로의 adaptive timeout, abort fallback 정책 고정

6. **구조화 응답 렌더러 확장 및 보안 가드**
  - `src/renderer/app/component/structure/cmh-chat-shell/sub/cmh-chat-message/index.ts`
  - `src/renderer/app/component/structure/cmh-chat-shell/sub/cmh-chat-message/cmh-chat-message.html`
  - `src/renderer/app/component/structure/cmh-chat-shell/sub/cmh-chat-message/cmh-chat-message.scss`
  - 목적: 확장 블록 타입 지원 + iframe/component allowlist 적용

7. **개발 런타임 정렬**
  - `package.json`
  - 목적: `dev:chat` 실행 시 llm+engine+ui 동시 기동 보장

8. **문서/규칙 동기화**
  - `.github/copilot-instructions.md`
  - `specs/ai-sdk-langgraph-architecture.spec.md`
  - `specs/ai-sdk-langgraph-architecture.plan.md`
  - 목적: 구현-문서 불일치 제거

---

## 검증 체크포인트

1. `/api/providers` 실패 상황에서도 selector에서 Google provider 그룹이 유지되는지 확인
2. 이미지 첨부 채팅에서 multipart 입력이 실제 모델 요청까지 유지되는지 로그 검증
3. HTTP(`/api/chat`)와 WS(`/ws`) 경로의 응답 의미가 동일 파서 기준으로 일치하는지 확인
4. Engine 미기동 시 proxy 오류가 코드 버그가 아닌 프로세스 누락으로 식별되는지 확인

---

## Agent Chat UI 패턴 반영 매트릭스 (2026-04-20)

> 목적: `@langchain/agent-chat-ui`의 **전체 UI 이식이 아닌**, 재사용 가치가 높은 패턴만 선택 반영한다.

| # | 패턴 | 범주 | 상태 | 근거(대표 파일) |
| --- | --- | --- | --- | --- |
| 1 | Artifact Panel (사이드 패널 분리 렌더링) | App UX | ❌ 미반영 | 현재 채팅 본문 렌더링 중심 |
| 2 | Interrupt → Resume (HITL 승인 재개) | Engine Workflow | ✅ 완료 | `src/engine/langchain/graph/human-gate.node.ts` |
| 3 | Hidden Message Policy (`do-not-render`) | Rendering Policy | ✅ 완료 | `chat.store.ts` hidden 필터 + `protocol-parser.ts` hidden/h 시그널 |
| 4 | Thread Restore / Hydration | State Persistence | ✅ 완료 | `src/renderer/app/store/chat.store.ts`, `src/renderer/app/service/conversation.service.ts` |
| 5 | Time Travel/Fork (대화 분기 UX) | App UX | ⚠️ 부분 반영 | 워크플로우 중심 스냅샷/재생은 존재, 채팅 분기 UX는 미완 |
| 6 | Tool Call/Result 카드 UX | Explainability UX | ✅ 완료 | `cmh-chat-message` tool-card 렌더링 + `chat.store.ts` nodeMetadata→toolEvents |
| 7 | Auth Token Passthrough 표준화 | Transport/Auth | ⚠️ 부분 반영 | `src/engine/server/middleware/auth.ts` 기반 인증은 존재 |
| 8 | Streaming 제어 UX (abort/timeout/status) | Chat UX | ✅ 완료 | `src/renderer/app/store/chat.store.ts` |
| 9 | Structured Block 확장 렌더 (`cmh-ui`) | Rendering | ⚠️ 부분 반영 | `src/renderer/app/component/structure/cmh-chat-shell/sub/cmh-chat-message/*` |
| 10 | Tool Event Timeline (start/end/error) | Observability UX | ❌ 미반영 | 채팅 본문 기준 타임라인 UI는 미구현 |
| 11 | Artifact 메타 동기화(`thread.meta.artifact`) | Conversation Meta | ✅ 완료 | `Conversation.meta` + `addArtifact()` + DAL metadata 연동 |

### 요약

- 완료: **6개** (2, 3, 4, 6, 8, 11)
- 부분 반영: **2개** (5, 7)
- 미반영: **3개** (1, 9, 10)

### 우선순위 반영 순서

1. **P1**: `1` Artifact Panel + `11` Artifact 메타 동기화
2. **P1**: `3` Hidden Message Policy (보안/정책 일관성)
3. **P2**: `6`, `10` 채팅 영역 Tool Explainability UX 강화
4. **P2**: `5` 채팅 Thread Fork UX 정식 도입
