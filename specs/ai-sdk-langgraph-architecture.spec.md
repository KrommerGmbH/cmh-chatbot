# AI SDK + LangGraph + LangChain 통합 아키텍처 스펙

> **프로젝트**: cmh-chatbot  
> **작성일**: 2026-04-18  
> **상태**: Draft  
> **관련**: PLAN.md §14, §17

---

## 1. 배경 및 동기

### 1.1 현재 상태 (AS-IS)

| 레이어 | 구현 | 문제점 |
|--------|------|--------|
| **Renderer → LLM** | `llm-client.service.ts` — 수동 `fetch()` + SSE 파싱 | Provider 추상화 없음, 스트리밍 에러 핸들링 수동, 토큰 카운팅 없음 |
| **Engine LangChain** | `engine/langchain/` — LangGraph StateGraph 노드 정의 | Renderer에서 사용 불가 (engine은 Node.js 전용) |
| **Engine Provider** | `engine/provider/model-factory.ts` — `ChatOpenAI` 래핑 | Renderer 측 fetch와 이중 구현, Anthropic/Google 네이티브 미지원 |
| **History Trimming** | 메시지 수 기반 (`slice(-(6|16))`) | 토큰 기반 아님 → context overflow 에러 발생 |
| **트리거** | Chat UI만 지원 | cronJob, REST API 트리거 미구현 |

### 1.2 목표 (TO-BE)

1. **AI SDK** — Renderer↔LLM 통신을 Vercel AI SDK `useChat()` / `streamText()` 으로 교체
2. **LangGraph** — 멀티에이전트 워크플로우 오케스트레이션 (기존 engine/langchain/graph 확장)
3. **LangChain** — RAG 파이프라인, Tool 호출, Memory 관리
4. **3중 트리거** — Chat UI, cronJob, REST API가 동일 서비스 레이어를 공유

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-01 | Chat UI에서 AI SDK `useChat()` 기반 스트리밍 | P0 |
| FR-02 | 로컬 llama-server (llama.cpp) OpenAI-compatible 연동 유지 | P0 |
| FR-03 | Cloud provider (OpenAI, Anthropic, Google) 네이티브 SDK 지원 | P1 |
| FR-04 | LangGraph 멀티에이전트 워크플로우 (Supervisor→Manager→Worker) | P1 |
| FR-05 | RAG: 첨부파일 + SQLite DB 소스 → 벡터 검색 → 컨텍스트 주입 | P1 |
| FR-06 | Token-aware history trimming (contextLength 기반) | P0 |
| FR-07 | cronJob 트리거 — 스케줄 기반 LLM 호출 (보고서 생성 등) | P2 |
| FR-08 | REST API 트리거 — 외부 시스템에서 LLM 호출 | P2 |
| FR-09 | Tool 호출 (Function Calling) — 계산, DB 쿼리, 웹 검색 | P1 |
| FR-10 | 프로파일러 에이전트 — 대화 분석/사용자 성향 기록 | P2 |

### 2.2 비기능 요구사항

| ID | 요구사항 |
|----|----------|
| NFR-01 | Renderer는 브라우저 환경 — Node.js API 직접 사용 불가 |
| NFR-02 | Engine은 Node.js 환경 — LangChain/LangGraph 직접 실행 |
| NFR-03 | Docker 배포 시 Engine이 HTTP 서버로 동작 |
| NFR-04 | AideWorks(Electron) 배포 시 Main Process에서 Engine 실행 |
| NFR-05 | 첫 토큰 응답 지연(TTFT) 현재 수준 유지 또는 개선 |

---

## 3. 아키텍처 설계

### 3.1 레이어 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer (Vue 3)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ useChat()   │  │ chat.store   │  │ workflow UI   │  │
│  │ (AI SDK)    │  │ (Pinia)      │  │ (Vue Flow)    │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│         └────────┬───────┴───────────────────┘          │
│                  ▼                                       │
│         AI SDK Data Stream Protocol                      │
│         (SSE / fetch / WebSocket)                        │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────────────────┐
│              Engine API Layer (Hono)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  POST /api/chat     — AI SDK streamText() 응답    │   │
│  │  POST /api/workflow  — LangGraph invoke           │   │
│  │  POST /api/rag       — RAG query                  │   │
│  │  GET  /api/models    — 모델 목록                   │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │           Orchestration Layer                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │ AI SDK   │  │ LangGraph│  │ LangChain    │   │   │
│  │  │ Core     │  │ Runtime  │  │ (RAG/Tools)  │   │   │
│  │  │ (stream) │  │ (graph)  │  │              │   │   │
│  │  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │   │
│  │       └──────────────┼───────────────┘           │   │
│  │                      ▼                            │   │
│  │            Model Adapter Layer                    │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │ OpenAI  │ │Anthropic │ │ llama-server     │  │   │
│  │  │ SDK     │ │ SDK      │ │ (local, OpenAI-  │  │   │
│  │  │         │ │          │ │  compatible)     │  │   │
│  │  └─────────┘ └──────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  DAL (Repository + Criteria)                      │   │
│  │  LlmProvider / LlmModel / Conversation / Message  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 3.2 트리거 통합 모델

```
Trigger Sources                    Shared Service Layer
─────────────                      ────────────────────
Chat UI ──→ POST /api/chat ──┐
cronJob ──→ engine.invoke() ──┼──→ Orchestration Layer ──→ LLM
REST API ──→ POST /api/chat ──┘
```

모든 트리거는 동일한 Orchestration Layer를 호출. Renderer는 HTTP 경유, cronJob/내부는 직접 함수 호출.

### 3.3 역할 분담

| 라이브러리 | 역할 | 사용 위치 |
|------------|------|-----------|
| **AI SDK (`ai`)** | 스트리밍 전송 프로토콜, `streamText()`, `generateText()`, Data Stream Protocol | Engine API → Renderer |
| **AI SDK Provider** | `@ai-sdk/openai` (OpenAI + llama-server), `@ai-sdk/anthropic`, `@ai-sdk/google` | Engine Model Adapter |
| **LangGraph** | 멀티에이전트 StateGraph, Supervisor/Manager/Worker 노드, HITL interrupt | Engine Orchestration |
| **LangChain** | RAG 파이프라인 (embedding → vector store → retrieval chain), Tool 정의, Memory | Engine Orchestration |
| **Hono** | 경량 HTTP 서버 (Engine API 라우트) | Engine API Layer |

---

## 4. 주요 변경 사항

### 4.1 Renderer 측 (마이그레이션)

| 현재 | 변경 후 |
|------|---------|
| `llm-client.service.ts` — 수동 fetch + SSE 파싱 (230줄) | AI SDK `useChat()` 또는 커스텀 `fetch` + AI SDK Data Stream 파싱 |
| `chat.store.ts` — 직접 `streamChatCompletion()` 호출 | `useChat({ api: '/api/chat' })` 또는 store에서 AI SDK client 사용 |
| 메시지 수 기반 history trimming | 제거 — Engine 측에서 토큰 기반 trimming |

### 4.2 Engine 측 (신규 + 확장)

| 모듈 | 변경 |
|------|------|
| `engine/server/` | Hono 라우트 추가: `POST /api/chat`, `POST /api/workflow` |
| `engine/provider/` | AI SDK provider 어댑터로 교체 (`createOpenAI()`, `createAnthropic()`) |
| `engine/langchain/graph/` | 기존 LangGraph 노드 유지 + AI SDK `streamText` 연동 |
| `engine/rag/` | LangChain RAG 파이프라인 확장 (임베딩 → 벡터 스토어 → 검색 체인) |
| `engine/service/token-counter.ts` | 신규 — tiktoken 기반 토큰 카운팅 + history trimming |

### 4.3 호스트별 배포

| 호스트 | Engine API 실행 방식 |
|--------|---------------------|
| **AideWorks (Electron)** | Main Process에서 Hono 서버 실행, Renderer는 `http://localhost:PORT/api/*` 호출 |
| **Docker** | Hono 독립 HTTP 서버 (포트 3000) |
| **Shopware App** | Renderer만 배포, Engine API는 외부 Docker 인스턴스로 연결 |

---

## 5. 데이터 흐름 (Chat 시나리오)

```
1. User types message → chat.store.sendMessage()
2. Renderer → POST /api/chat { messages, modelId, conversationId }
3. Engine Hono route:
   a. DAL에서 모델/프로바이더 정보 resolve
   b. AI SDK createOpenAI({ baseURL }) 로 provider 생성
   c. Token counter로 history trim (contextLength 기반)
   d. streamText({ model, messages, system, tools? })
   e. AI SDK Data Stream → SSE response
4. Renderer receives SSE stream → reactive update
5. Stream 완료 → message persist (DAL)
```

### 5.1 LangGraph 워크플로우 시나리오

```
1. User sends complex request → POST /api/workflow
2. Engine:
   a. Supervisor 노드 — 의도 분류
   b. Manager 노드 — 작업 분해
   c. Worker 노드(들) — 실제 LLM 호출 (AI SDK streamText)
   d. Supporter 노드 — RAG 검색 (LangChain)
   e. Profiler 노드 — 사후 분석
3. 각 노드의 스트리밍 출력 → Data Stream Protocol로 Renderer에 전달
4. Vue Flow UI에서 실시간 노드 상태 시각화
```

---

## 6. 기존 코드 호환성

### 6.1 유지되는 것

- `engine/langchain/graph/` — StateGraph 노드 구조 (Supervisor, Manager, Worker, Supporter, Profiler)
- `engine/data/` — DAL 전체 (Entity, Repository, Criteria, Migration)
- `engine/provider/model-factory.ts` — `ResolvedModel` 인터페이스 유지, 내부를 AI SDK provider로 교체
- Vite proxy `/llm` → llama-server (로컬 모델 직접 접근 경로 유지)

### 6.2 제거/교체되는 것

- `renderer/app/service/llm-client.service.ts` — AI SDK 클라이언트로 교체
- 수동 SSE 파싱 로직 — AI SDK 내장 파서로 대체
- `chat.store.ts`의 history trimming — Engine 측 토큰 기반으로 이동

---

## 7. 패키지 의존성

### 7.1 신규 추가

```
# AI SDK Core
ai                        # Vercel AI SDK core (streamText, generateText, Data Stream Protocol)
@ai-sdk/openai            # OpenAI + OpenAI-compatible (llama-server)
@ai-sdk/anthropic         # Anthropic Claude
@ai-sdk/google            # Google Gemini

# 이미 존재 (유지)
@langchain/core
@langchain/langgraph
@langchain/openai
hono                      # Engine HTTP server (이미 사용 중일 수 있음)
```

### 7.2 선택적 추가 (P1–P2)

```
tiktoken                  # OpenAI 토크나이저 (토큰 카운팅)
@langchain/community      # 추가 도구/벡터스토어
```

---

## 8. 마이그레이션 단계 (Phase)

| Phase | 범위 | 결과물 |
|-------|------|--------|
| **Phase 1** | Engine API (Hono) + AI SDK `streamText` 기본 라우트 | `/api/chat` 동작, Renderer 연동 |
| **Phase 2** | Renderer 측 AI SDK 클라이언트 마이그레이션 | `llm-client.service.ts` 교체 |
| **Phase 3** | Token-aware history trimming | context overflow 해결 |
| **Phase 4** | Multi-provider (Anthropic, Google) 지원 | 클라우드 모델 네이티브 연동 |
| **Phase 5** | LangGraph 워크플로우 + AI SDK 스트리밍 통합 | 멀티에이전트 실행 |
| **Phase 6** | RAG 파이프라인 (LangChain) 확장 | 첨부파일/DB 기반 검색 |
| **Phase 7** | cronJob + REST API 트리거 | 3중 트리거 완성 |

---

## 9. 리스크 및 제약

| 리스크 | 대응 |
|--------|------|
| AI SDK + LangGraph 동시 스트리밍 복잡도 | Phase 5에서 별도 검증, 필요시 LangGraph는 non-streaming |
| llama-server 토크나이저 불일치 | tiktoken 대신 llama-server `/tokenize` 엔드포인트 활용 |
| Renderer에서 AI SDK `useChat()` Vue 호환성 | AI SDK는 React 우선 — Vue에서는 `fetch` + Data Stream 직접 파싱 또는 커뮤니티 Vue 어댑터 |
| Engine API 포트 충돌 (Electron + llama-server) | 포트 분리: llama-server 8080, Engine API 3100 |

---

## 10. 성공 기준

1. ✅ Chat UI → Engine API → llama-server 스트리밍 동작 (현재 TTFT 이하)
2. ✅ 200K context 모델에서 긴 대화 시 context overflow 없음
3. ✅ Anthropic Claude API 키 입력 후 즉시 사용 가능
4. ✅ LangGraph 워크플로우에서 Supervisor→Worker 라우팅 동작
5. ✅ 기존 chat.store.ts 590줄 이하 유지

---

## 11. 구현 반영 업데이트 (2026-04-19)

본 섹션은 기존 Draft 스펙 대비, 실제 코드베이스에 이미 반영된 사항을 명시한다.

### 11.1 반영 완료 항목

1. **멀티모달 보존 경로 확정**
   - `/api/chat` 경로에서 trim은 토큰 계산 목적만 사용하고, 실제 모델 호출 입력은 원본 multipart(이미지/파일/텍스트) 메시지 보존 경로를 사용한다.
2. **스트림 파서 단일화**
   - 공용 파서 `src/shared/ai-stream/protocol-parser.ts`를 기준으로 renderer/client 중복 파서를 제거한다.
3. **Google Provider 가시성 보장**
   - 원격 모델 조회 실패/빈 결과에서도 provider selector에서 Google이 사라지지 않도록 fallback Gemini 모델을 주입한다.
4. **구조화 응답 블록 확장**
   - `cmh-ui` 코드블록은 기존 `image/video/iframe/data-grid` 외 `text/markdown/code/table/button-group/collapse/card/entity-listing/filter/component`까지 지원한다.
5. **개발 실행 기준 정합화**
   - 채팅 개발은 `llm(8080)+engine(4000)+ui(5200)` 3개 프로세스를 동시 실행한다.

### 11.2 보안/안전 규칙

1. `iframe` 블록은 https + 허용 도메인만 렌더링한다.
2. `component` 블록은 `cmh-*`, `mt-*` 프리픽스만 허용한다.
3. 미지원 블록 타입은 markdown/text로 안전 폴백한다.

---

## 12. API 계약(실구현 기준)

### 12.1 채팅

- `POST /api/chat`
  - 입력: 모델/대화/메시지(멀티파트 포함)
  - 출력: AI SDK Data Stream Protocol (SSE)
  - 규칙: trim 결과를 텍스트 예산 계산에만 사용, 모델 입력은 멀티파트 보존

### 12.2 Provider/Model

- `GET /api/providers`
  - 목적: provider 목록
  - 실패 처리: DAL/엔진 일시 오류 시 하드 실패 대신 안전 응답(빈 목록/경고 로그) 우선
- `GET /api/providers/:id/remote-models`
  - 목적: 원격 모델 동기화 후보 조회
  - 실패 처리: renderer는 Google fallback 모델로 selector 그룹 유지

### 12.3 전송 경계

- 기본 채팅 전송 경로: HTTP `/api/chat` 기반 AI SDK stream
- `/ws` 경로: 레거시/외부 SDK 호환 채널로 유지
- HTTP/WS 간 의미 정합: 동일한 공용 프로토콜 파서 사용

---

## 13. 남은 이행 항목

1. LangGraph 워크플로우 스트림과 AI SDK Data Stream 브릿지의 운영 검증 강화
2. RAG 파이프라인의 첨부파일 인덱싱/검색 품질 지표 명문화
3. cronJob/REST 트리거를 동일 orchestration 계층으로 완전 통합
