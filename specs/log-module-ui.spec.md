# Log 모듈 UI — 기능 스펙

> **프로젝트**: cmh-chatbot Renderer
> **작성일**: 2026-04-18
> **우선순위**: Medium

---

## 1. 개요

LangChain/LangGraph 실행 로그를 list/detail 구조로 표시하는 모듈. AI 에이전트의 추론 과정, 도구 호출, 체인 실행 흐름을 시각화.

## 2. 유저 스토리

- **US-1**: 사용자가 사이드바에서 "Log" 탭을 클릭하면 최근 LLM 호출 로그 목록이 표시된다.
- **US-2**: 목록에서 로그를 클릭하면 상세 뷰가 열려 요청/응답, 토큰 수, 소요 시간, 에이전트 그래프 경로를 확인한다.
- **US-3**: 로그를 대화(conversation)별로 필터링할 수 있다.
- **US-4**: 에러가 발생한 호출은 빨간색으로 강조된다.

## 3. 데이터 모델

### 3.1 Entity: `cmh_llm_log`

```typescript
interface LlmLog extends Entity {
  id: string
  conversationId: string
  messageId?: string
  modelId: string
  modelName: string
  agentId?: string
  agentName?: string
  type: 'chat' | 'tool-call' | 'chain' | 'graph-node'
  input: string           // request (JSON or text)
  output: string          // response (JSON or text)
  tokensInput: number
  tokensOutput: number
  durationMs: number
  status: 'success' | 'error' | 'timeout'
  error?: string
  metadata?: Record<string, unknown>
  createdAt: string
}
```

### 3.2 Entity 파일

- `src/engine/data/entity/llm-log.entity.ts`
- `src/engine/data/entity/llm-log.definition.ts`

## 4. UI 구조

### 4.1 List 페이지

```
┌─────────────────────────────────────────┐
│ 🔍 필터: [대화 선택v] [모델v] [상태v]    │
├─────────────────────────────────────────┤
│ ● chat  | Gemma 4 E4B | 2.3s | 847 tok │
│ ● chat  | Gemma 4 E4B | 1.1s | 234 tok │
│ ✗ error | Gemma 4 E4B | 90s  | timeout │
│ ...                                      │
└─────────────────────────────────────────┘
```

### 4.2 Detail 페이지

```
┌─────────────────────────────────────────┐
│ ← Back | Log #abc123                     │
├─────────────────────────────────────────┤
│ Model: Gemma 4 E4B                       │
│ Duration: 2.3s | Tokens: 123→724         │
│ Status: ✓ success                        │
├─────────────────────────────────────────┤
│ [Request]                                │
│ { messages: [...], model: "..." }        │
├─────────────────────────────────────────┤
│ [Response]                               │
│ { content: "...", thinking: "..." }      │
└─────────────────────────────────────────┘
```

## 5. 구현 순서

1. `llm-log.entity.ts` + `llm-log.definition.ts` 생성
2. `sendMessage` 완료 후 로그 자동 저장 로직 추가 (chat.store.ts)
3. Log list 컴포넌트 (`cmh-log-list/`)
4. Log detail 컴포넌트 (`cmh-log-detail/`)
5. 사이드바 또는 별도 패널에 Log 탭 추가

## 6. 파일 목록

| 파일 | 유형 |
|------|------|
| `src/engine/data/entity/llm-log.entity.ts` | 신규 |
| `src/engine/data/entity/llm-log.definition.ts` | 신규 |
| `src/renderer/app/component/structure/cmh-log-list/` | 신규 (index.ts, html, scss) |
| `src/renderer/app/component/structure/cmh-log-detail/` | 신규 (index.ts, html, scss) |
| `src/renderer/app/store/chat.store.ts` | 수정 (로그 저장) |
| `src/engine/data/seed.ts` | 수정 (entity 등록) |
