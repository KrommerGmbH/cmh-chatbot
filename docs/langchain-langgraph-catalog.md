# LangChain & LangGraph — 기능 카탈로그

> **목적**: CMH Chatbot 관리 모드에서 사전 설정하고, 워크플로우에서 에이전트에 레고 블록처럼 끼워넣고 빼기 위한 기능 레지스트리  
> **대상**: LangChain.js (`@langchain/*`) + LangGraph.js (`@langchain/langgraph`)  
> **최종 갱신**: 2026-04-11

---

## 목차

1. [LangChain.js 코어 모듈](#1-langchainjs-코어-모듈)
2. [LangChain.js 통합(Integrations)](#2-langchainjs-통합integrations)
3. [LangGraph.js 코어](#3-langgraphjs-코어)
4. [LangGraph.js 프리빌트 & 패턴](#4-langgraphjs-프리빌트--패턴)
5. [워크플로우 레고 블록 설계 가이드](#5-워크플로우-레고-블록-설계-가이드)

---

## 1. LangChain.js 코어 모듈

### 1.1 Chat Models (채팅 모델)

| 블록 ID | 모듈 | 설명 | 워크플로우 용도 |
|---------|------|------|----------------|
| `chat-model` | `@langchain/core` | 메시지 기반 LLM 인터페이스. 입력: `BaseMessage[]`, 출력: `AIMessage` | 모든 대화/추론 노드의 핵심 |
| `chat-model-streaming` | `@langchain/core` | 토큰 단위 스트리밍 지원 | 실시간 응답 UI |
| `structured-output` | `@langchain/core` | `.withStructuredOutput()` — Zod 스키마로 구조화된 응답 추출 | 분류, 엔티티 추출, 폼 자동 생성 |
| `tool-calling` | `@langchain/core` | `.bindTools()` — 모델이 도구 호출 결정 | 에이전트 행동 결정 |

### 1.2 Messages (메시지 시스템)

| 블록 ID | 타입 | 설명 |
|---------|------|------|
| `human-message` | `HumanMessage` | 사용자 입력 |
| `ai-message` | `AIMessage` | 모델 응답 (tool_calls 포함 가능) |
| `system-message` | `SystemMessage` | 시스템 프롬프트 |
| `tool-message` | `ToolMessage` | 도구 실행 결과 반환 |

### 1.3 Tools (도구)

| 블록 ID | 모듈 | 설명 | 워크플로우 용도 |
|---------|------|------|----------------|
| `tool-define` | `@langchain/core/tools` | `tool()` 함수로 커스텀 도구 정의 (이름 + 설명 + 입력 스키마 + 함수) | 에이전트 행동 확장 |
| `tool-retriever` | `@langchain/core/tools` | `createRetrieverTool()` — 벡터 검색을 도구로 래핑 | RAG 에이전트 |
| `server-side-tools` | Provider-specific | 웹 검색, 코드 인터프리터 (OpenAI, Anthropic, Gemini 내장) | 서버사이드 실행 |

### 1.4 Retrieval (검색/RAG)

| 블록 ID | 모듈 | 설명 | 워크플로우 용도 |
|---------|------|------|----------------|
| `document-loader` | `langchain/document_loaders` | 다양한 소스에서 `Document` 객체로 데이터 수집 | 데이터 인제스트 파이프라인 |
| `text-splitter` | `@langchain/textsplitters` | 문서를 청크로 분할 (RecursiveCharacterTextSplitter 추천) | 인덱싱 전처리 |
| `embeddings` | `@langchain/core/embeddings` | 텍스트 → 벡터 변환 | 시맨틱 검색 기반 |
| `vector-store` | `@langchain/core/vectorstores` | 벡터 저장 + 유사도 검색 | 지식 베이스 |
| `retriever` | `@langchain/core/retrievers` | 비정형 쿼리 → 관련 문서 반환 인터페이스 | RAG 노드 |

### 1.5 Output Parsers (출력 파서)

| 블록 ID | 설명 | 워크플로우 용도 |
|---------|------|----------------|
| `json-output-parser` | LLM 응답을 JSON으로 파싱 | 구조화 데이터 추출 |
| `list-output-parser` | LLM 응답을 리스트로 파싱 | 다중 항목 추출 |
| `structured-output-parser` | Zod 스키마 기반 파싱 | 엔티티 추출 |

### 1.6 Callbacks & Streaming

| 블록 ID | 설명 | 워크플로우 용도 |
|---------|------|----------------|
| `callbacks` | 실행 단계별 훅 (시작/종료/에러/토큰) | 모니터링, 로깅 |
| `streaming` | `.stream()` / `.streamEvents()` | 실시간 UI 업데이트 |

---

## 2. LangChain.js 통합(Integrations)

### 2.1 Chat Model 프로바이더

| 패키지 | 프로바이더 | 주요 모델 | 특징 |
|--------|-----------|----------|------|
| `@langchain/openai` | OpenAI | GPT-4o, GPT-4o-mini | 도구호출, 구조화출력, 스트리밍 |
| `@langchain/anthropic` | Anthropic | Claude Sonnet/Opus | 도구호출, 긴 컨텍스트 |
| `@langchain/google-genai` | Google | Gemini 2.0 Flash | 멀티모달, 서버도구 |
| `@langchain/aws` | AWS Bedrock | Claude, Llama 등 | 기업용 |
| `@langchain/community` | 커뮤니티 | DeepSeek, Perplexity, Fireworks 등 | 다양한 프로바이더 |
| `node-llama-cpp` | 로컬 (llama.cpp) | GGUF 모델 전체 | CPU/GPU, 오프라인 |

### 2.2 Embedding 모델

| 패키지 | 프로바이더 | 모델 예시 |
|--------|-----------|----------|
| `@langchain/openai` | OpenAI | text-embedding-3-small/large |
| `@langchain/google-genai` | Google | text-embedding-004 |
| `@langchain/community` | HuggingFace, Cohere 등 | 다양한 모델 |

### 2.3 Vector Store (벡터 저장소)

| 패키지 | 저장소 | 특징 | 권장 용도 |
|--------|-------|------|----------|
| `@langchain/core` | **MemoryVectorStore** | 인메모리, 설치 불필요 | 개발/테스트, 소규모 |
| `@langchain/community` | **FAISS** | 고속 유사도 검색, 로컬 | 중규모, 오프라인 |
| `@langchain/community` | **Chroma** | 오픈소스 벡터 DB | 중대규모 |
| `@langchain/pinecone` | **Pinecone** | 관리형 벡터 DB | 프로덕션 |
| `@langchain/community` | **Supabase** | pgvector 기반 | PostgreSQL 통합 |
| `@langchain/weaviate` | **Weaviate** | GraphQL 벡터 검색 | 복잡 쿼리 |
| `@langchain/community` | **LanceDB** | 경량 벡터 DB | 임베디드 |
| `@langchain/community` | **LibSQL** | SQLite 벡터 확장 | Electron 앱 적합 ⭐ |

### 2.4 Document Loader (문서 로더)

#### 파일 로더

| 로더 | 확장자 | 패키지 |
|------|--------|--------|
| **PDFLoader** | `.pdf` | `@langchain/community` |
| **DocxLoader** | `.docx`, `.doc` | `@langchain/community` |
| **CSVLoader** | `.csv` | `langchain/document_loaders` |
| **JSONLoader** | `.json`, `.jsonl` | `langchain/document_loaders` |
| **TextLoader** | `.txt`, `.md` | `langchain/document_loaders` |
| **EPUBLoader** | `.epub` | `@langchain/community` |
| **PPTXLoader** | `.pptx` | `@langchain/community` |
| **DirectoryLoader** | 폴더 전체 | `langchain/document_loaders` |

#### 웹/API 로더

| 로더 | 소스 | 설명 |
|------|------|------|
| **CheerioWebBaseLoader** | 웹 URL | HTML → 텍스트 |
| **GitbookLoader** | GitBook | 문서 사이트 수집 |
| **NotionAPILoader** | Notion | 노션 페이지/DB |
| **GithubRepoLoader** | GitHub | 저장소 코드 |
| **SonioxLoader** | 오디오 | 음성 → 텍스트 트랜스크립션 |
| **FireCrawlLoader** | 웹 크롤링 | AI 최적화 크롤러 |

### 2.5 Text Splitter (텍스트 분할기)

| 분할기 | 용도 | 추천도 |
|--------|------|--------|
| **RecursiveCharacterTextSplitter** | 범용 텍스트 (이중 개행 → 개행 → 공백 순) | ⭐ 기본 추천 |
| **CharacterTextSplitter** | 단일 구분자 기반 | 단순 텍스트 |
| **TokenTextSplitter** | 토큰 기반 분할 | 정확한 토큰 제어 |
| **MarkdownTextSplitter** | 마크다운 헤더 기반 | 문서 구조 보존 |
| **RecursiveJsonSplitter** | JSON 구조 분할 | JSON 데이터 |
| **HTMLSectionSplitter** | HTML 섹션 기반 | 웹 콘텐츠 |

---

## 3. LangGraph.js 코어

### 3.1 그래프 구조 (핵심 빌딩 블록)

| 블록 ID | 모듈 | 설명 | 워크플로우 용도 |
|---------|------|------|----------------|
| `state-graph` | `StateGraph` | 상태 기반 워크플로우 그래프 정의 | 모든 에이전트의 뼈대 |
| `state-schema` | `StateSchema` / `Annotation.Root` | 그래프 상태 스키마 정의 (Zod 지원) | 노드 간 데이터 공유 |
| `node` | `.addNode()` | 노드 = 계산 단위 (함수). 상태를 받아 업데이트 반환 | 개별 작업 단위 |
| `edge` | `.addEdge()` | 고정 엣지 — A 다음 항상 B | 순차 실행 |
| `conditional-edge` | `.addConditionalEdges()` | 조건부 분기 — 상태에 따라 다음 노드 결정 | 동적 라우팅 |
| `entry-point` | `START` | 그래프 시작점 | — |
| `end-point` | `END` | 그래프 종료점 | — |

### 3.2 State Management (상태 관리)

| 블록 ID | 설명 | 워크플로우 용도 |
|---------|------|----------------|
| `messages-value` | 메시지 히스토리 상태 (자동 누적) | 대화형 에이전트 |
| `reduced-value` | 커스텀 리듀서로 상태 업데이트 | 복잡한 상태 로직 |
| `command` | `Command` 객체 — 상태 업데이트 + 노드 이동 + 인터럽트 재개 통합 | 세밀한 실행 제어 |

### 3.3 Persistence (영속성)

| 블록 ID | 모듈 | 설명 | 워크플로우 용도 |
|---------|------|------|----------------|
| `memory-saver` | `MemorySaver` | 인메모리 체크포인터 | 개발/테스트 |
| `sqlite-saver` | `@langchain/langgraph-checkpoint-sqlite` | SQLite 기반 체크포인터 | Electron 앱 적합 ⭐ |
| `postgres-saver` | `@langchain/langgraph-checkpoint-postgres` | PostgreSQL 기반 | 프로덕션 서버 |

> **체크포인터가 활성화하는 기능:**
> - 대화 메모리 (thread 간 상태 유지)
> - Human-in-the-loop (중단 → 승인 → 재개)
> - Time Travel (과거 실행 리플레이/포크)
> - 내결함성 (실패 시 마지막 성공 지점에서 재시작)

### 3.4 Memory (메모리)

| 블록 ID | 유형 | 설명 | 워크플로우 용도 |
|---------|------|------|----------------|
| `short-term-memory` | 단기 (Thread-scoped) | 같은 대화 내 메시지 히스토리 유지 | 멀티턴 대화 |
| `long-term-memory` | 장기 (Cross-thread) | `store.put()`/`store.search()` — 네임스페이스별 기억 저장 | 사용자 선호도, 학습된 지식 |

### 3.5 Human-in-the-Loop (HITL)

| 블록 ID | 모듈 | 설명 | 워크플로우 용도 |
|---------|------|------|----------------|
| `interrupt` | `interrupt()` | 노드 실행 중 일시정지 → 사람 검토 대기 | 승인 게이트, 편집 포인트 |
| `command-resume` | `Command({ resume: ... })` | 인터럽트 후 사용자 입력으로 재개 | HITL 워크플로우 |

### 3.6 Streaming (스트리밍)

| 블록 ID | 스트림 모드 | 설명 |
|---------|-----------|------|
| `stream-values` | `values` | 매 노드 실행 후 전체 상태 스냅샷 |
| `stream-updates` | `updates` | 노드가 반환한 업데이트만 |
| `stream-messages` | `messages` | AI 메시지 토큰 단위 스트리밍 |
| `stream-tools` | `tools` | 도구 실행 진행 상황 (시작/실행중/완료/에러) |

### 3.7 Subgraphs (서브그래프)

| 블록 ID | 설명 | 워크플로우 용도 |
|---------|------|----------------|
| `subgraph` | 다른 그래프를 노드로 사용 | 멀티 에이전트, 모듈 재사용 |
| `subgraph-per-invocation` | 호출 시마다 새 상태 (기본값) | 독립 실행 |
| `subgraph-per-thread` | 스레드별 상태 유지 | 멀티턴 서브에이전트 |

---

## 4. LangGraph.js 프리빌트 & 패턴

### 4.1 프리빌트 에이전트

| 패턴 | 설명 | 적합한 시나리오 |
|------|------|----------------|
| **ReAct Agent** | `createReactAgent()` — 추론 → 행동 → 관찰 루프 | 범용 도구 사용 에이전트 |
| **RAG Agent** | 리트리버 도구 + 채팅 모델 조합 | 지식 기반 Q&A |
| **Agentic RAG** | 에이전트가 동적으로 검색 시점/방법 결정 | 복잡한 정보 검색 |

### 4.2 멀티 에이전트 패턴

| 패턴 | 설명 | 적합한 시나리오 |
|------|------|----------------|
| **Supervisor** | 중앙 조율자가 특화 에이전트에 작업 위임 | 복잡한 워크플로우 조율 |
| **Swarm** | 에이전트 간 동적 핸드오프 | 유연한 협업 |
| **Map-Reduce** | 병렬 처리 → 결과 집약 | 대량 데이터 분석 |

### 4.3 워크플로우 패턴

| 패턴 | 설명 | 예시 |
|------|------|------|
| **Sequential** | A → B → C 순차 실행 | 파이프라인 |
| **Branching** | 조건에 따라 A → B 또는 A → C | 분류 → 라우팅 |
| **Looping** | 에이전트가 완료 조건까지 반복 | 자기 수정 에이전트 |
| **Fork-Join** | 병렬 분기 → 합류 | 동시 검색 |
| **Human Gate** | 자동 → 인간 승인 → 자동 | 승인 워크플로우 |

### 4.4 Functional API

| 블록 ID | 설명 | 워크플로우 용도 |
|---------|------|----------------|
| `entrypoint` | `entrypoint()` — 함수형 워크플로우 진입점 | 간단한 선형 파이프라인 |
| `task` | `task()` — 비동기 작업 단위 (체크포인팅 포함) | 개별 API 호출, 데이터 처리 |

> Functional API는 단순 워크플로우에 적합하고, StateGraph는 복잡한 멀티 에이전트 시스템에 적합

---

## 5. 워크플로우 레고 블록 설계 가이드

### 5.1 블록 분류 체계

```
┌─────────────────────────────────────────────────┐
│                  워크플로우 블록                   │
├──────────┬──────────┬──────────┬────────────────┤
│  입력    │  처리    │  출력    │  제어           │
│  블록    │  블록    │  블록    │  블록           │
├──────────┼──────────┼──────────┼────────────────┤
│ 문서로더  │ LLM호출  │ 응답생성  │ 조건분기        │
│ 웹크롤러  │ 임베딩   │ 파일저장  │ 루프           │
│ API입력   │ 벡터검색  │ API호출  │ HITL(인간승인)  │
│ DB쿼리   │ 텍스트분할 │ DB저장   │ 에러핸들링      │
│ 파일읽기  │ 분류/라우팅│ 알림     │ 타임아웃        │
│ 사용자입력│ 요약     │ 로깅     │ 병렬실행        │
└──────────┴──────────┴──────────┴────────────────┘
```

### 5.2 CMH Chatbot에 특히 유용한 블록 조합

#### 🎯 기본 채팅 (현재)
```
[사용자 입력] → [LLM 호출 (llama.cpp)] → [응답 스트리밍]
```

#### 🔍 RAG 채팅 (지식 기반)
```
[사용자 입력] → [쿼리 분석] → [벡터 검색 (LibSQL)] → [컨텍스트 병합] → [LLM 호출] → [응답]
```

#### 🤖 에이전트 채팅 (도구 사용)
```
[사용자 입력] → [LLM (도구 바인딩)] ↔ [도구 실행 루프] → [최종 응답]
                                         ├─ 웹 검색
                                         ├─ 계산기
                                         ├─ DB 조회
                                         └─ 파일 읽기
```

#### 👥 멀티 에이전트 (워크플로우)
```
[사용자 입력] → [Supervisor] → ┬─ [Research Agent]   → [결과 병합] → [응답]
                               ├─ [Analysis Agent]   →
                               └─ [Writing Agent]    →
```

#### ✅ 승인 워크플로우 (HITL)
```
[자동 분석] → [결과 생성] → [HITL 인터럽트 ⏸️] → [사용자 승인] → [실행]
```

### 5.3 관리 모드에서 설정할 항목

| 설정 영역 | 설정 항목 | 저장 위치 |
|----------|----------|----------|
| **프로바이더** | API 키, 엔드포인트, 모델 선택 | 암호화 DB |
| **도구** | 활성/비활성 토글, 파라미터 | 설정 DB |
| **벡터 저장소** | 임베딩 모델, 컬렉션, 청크 사이즈 | 설정 DB |
| **문서 소스** | 로더 종류, 경로/URL, 동기화 주기 | 설정 DB |
| **워크플로우 템플릿** | 노드 구성, 엣지 연결, 파라미터 | 워크플로우 DB |
| **HITL 규칙** | 어떤 노드에서 승인 필요, 자동/수동 기준 | 설정 DB |

---

## 부록: 패키지 설치 명령어

```bash
# 코어
pnpm add @langchain/core @langchain/langgraph

# 프로바이더 (필요한 것만)
pnpm add @langchain/openai        # OpenAI
pnpm add @langchain/anthropic     # Anthropic
pnpm add @langchain/google-genai  # Google Gemini
pnpm add @langchain/community     # 커뮤니티 통합

# 벡터 저장소 (Electron/로컬 추천)
pnpm add @langchain/community     # FAISS, LibSQL, LanceDB 등

# 체크포인터
pnpm add @langchain/langgraph-checkpoint-sqlite  # Electron 적합

# 문서 로더/분할
pnpm add @langchain/textsplitters

# LangGraph 프리빌트
pnpm add @langchain/langgraph-prebuilt
```

---

## 부록: 블록 메타데이터 스키마 (관리 모드용)

```typescript
/** 워크플로우 블록 정의 — 관리 모드에서 CRUD */
interface WorkflowBlock {
  id: string                              // UUID
  type: 'input' | 'process' | 'output' | 'control'
  category: string                        // e.g. 'document-loader', 'llm-call'
  name: string                            // 표시 이름
  description: string                     // 설명
  icon: string                            // mt-icon 이름
  configSchema: Record<string, unknown>   // Zod 스키마 (직렬화)
  defaultConfig: Record<string, unknown>  // 기본 설정값
  inputs: PortDefinition[]                // 입력 포트
  outputs: PortDefinition[]               // 출력 포트
  enabled: boolean                        // 활성 여부
}

interface PortDefinition {
  name: string
  type: 'message' | 'document' | 'embedding' | 'text' | 'any'
  required: boolean
}
```
