# cmh-chatbot — TODO

> **최종 갱신**: 2026-04-20  
> **기준**: specs/ai-sdk-langgraph-architecture.{spec,plan}.md + PLAN.md

---

## A. Agent Chat UI 패턴 (11개 중 미반영/부분)

### P1 — 높은 우선순위

| # | 항목 | 상태 | 설명 |
| --- | --- | --- | --- |
| 1 | Artifact Panel (사이드 패널) | ✅ 완료 | cmh-chat-shell에 split-view 추가, 아티팩트 블록을 패널로 분리 렌더링 |
| 3 | Hidden Message Policy (`do-not-render`) | ✅ 완료 | ChatMessage.hidden + currentMessages 필터링 + protocol-parser h/hidden 시그널 |
| 11 | Artifact Meta (`thread.meta`) | ✅ 완료 | Conversation.meta + ConversationMeta 타입 + addArtifact() + DAL metadata 연동 |

### P2 — 중간 우선순위

| # | 항목 | 상태 | 설명 |
| --- | --- | --- | --- |
| 5 | Time Travel / Fork (채팅 분기 UX) | ✅ 완료 | Conversation parentId/forkFromMessageId, forkConversation(), fork 버튼 |
| 6 | Tool Call/Result 카드 UX | ✅ 완료 | ToolCallEvent 타입 + chat.store nodeMetadata→toolEvents 캡처 + cmh-chat-message tool-card 렌더링 |
| 7 | Auth Token Passthrough 표준화 | ✅ 완료 | auth 미들웨어에 provider token forwarding, X-Provider-Auth 헤더 |
| 9 | Structured Block 확장 (`cmh-ui`) | ✅ 완료 | cmh-ui 블록과 아티팩트 패널 연계, 블록→패널 분리 트리거 |
| 10 | Tool Event Timeline | ✅ 완료 | protocol-parser toolEvent 파싱, chat.store 이벤트 추적, 타임라인 UI 구현 |

---

## B. 추가 미구현 항목 (스펙 기준)

### ❌ 미구현

| # | 항목 | 설명 |
| --- | --- | --- |
| B-1 | VectorStore 실 구현체 | ✅ 완료 — InMemoryVectorStore (cosine similarity) 구현 |
| B-2 | Document Loaders (PDF/CSV/DOCX) | ✅ 완료 — CSV/Text/PDF/DOCX loader + chunk 유틸리티 |
| B-3 | LangSmith/LangFuse 실제 전송 | ✅ 완료 — http-trace-sink.ts (배치 전송, 환경변수 자동감지) |
| B-4 | LLM Response cache | ✅ 완료 — responseCache LRU+TTL, /api/generate 캐시 통합, /api/cache/* 관리 엔드포인트 |
| B-5 | Model instance pooling | ✅ 완료 — LRU 풀(32 인스턴스, 10분 TTL) createChatModel에 통합 |
| B-6 | Metrics export (Prometheus 등) | ✅ 완료 — MetricsRegistry + /api/metrics 엔드포인트 |
| B-7 | cronJob→DAL 스케줄 관리 | ✅ 완료 — cmh_scheduled_task entity + definition 생성 |

### ⚠️ 부분 구현

| # | 항목 | 상태 |
| --- | --- | --- |
| B-8 | RAG pipeline | ✅ 완료 — createDefaultRAGPipeline() + InMemoryVectorStore 기본 주입 |
| B-9 | REST API 트리거 | ✅ 완료 — HMAC-SHA256 webhook-auth middleware 구현 |
| B-10 | /api/workflow 전용 라우트 | ✅ 완료 — orchestrator 위임, stream/json 응답 지원 |

---

## C. 구현 완료 (참고)

- ✅ AI SDK `streamText` 기반 스트리밍 (`/api/chat`)
- ✅ Multi-provider (OpenAI, Anthropic, Google, llama-server, Ollama)
- ✅ Token-aware history trimming
- ✅ LangGraph 멀티에이전트 (Supervisor→Manager→Worker)
- ✅ HITL interrupt/resume (`human-gate.node.ts`)
- ✅ Streaming 제어 UX (abort/timeout/status)
- ✅ Thread Restore/Hydration
- ✅ 공용 스트림 파서 (`protocol-parser.ts`)
- ✅ Provider/Engine health 인메모리 캐시
- ✅ Observability 콜백 프레임워크 (tracing, monitoring, profiler, logging)
- ✅ StreamEventMonitor (LangGraph 노드 메트릭)
- ✅ Structured Block 렌더링 (15종 `cmh-ui`)
- ✅ Auth middleware (Bearer/X-API-Key)
- ✅ Webhook route (`/api/webhook/chat`)
- ✅ Scheduler service (node-cron)
