# cmh-chatbot 프로젝트 코드 검수 분석 보고서

생성일: 2026-04-20
검토자: Kilo Code (AI Assistant)

---

## 1. 기술 분석

### 1.0 보안 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| API Key 검증 | `isUsableApiKey()` 중복 | ⚠️ |
| Rate Limiting | 미구현 | ❌ |
| 입력 검증 | 부분적 (JSDoc) | ⚠️ |
| SQL injection | DAL parameterized | ✓ |
| XSS/CSRF | Hono Cors | ✓ |
| 비밀정보 관리 | .env 만 사용 | ✓ |

**Copilot 검증**:
- ✅ **API Key 중복**: 정확함. `routes.ts:56` + `llm-model.service.ts:40` 에서 동일 로직 확인. 즉시 `src/engine/common/validation.ts`로 추출 필요.
- ✅ **Rate Limiting**: 정확함. 미구현 확인. 서버 요청 무제한 상태. `express-rate-limit` 또는 Hono 미들웨어 필요.
- ✅ **입력 검증 부분적**: 정확함. JSDoc만 있고 실제 Zod/Yup 스키마 검증 없음. `@hono/zod-openapi` 도입 권장.
- ✅ **SQL injection 방지**: 정확함. DAL에서 parameterized query 사용 확인 (`src/engine/data/repository.ts`).
- ⚠️ **XSS/CSRF**: Hono CORS 설정만으로는 불충분. CSP 헤더 설정 권장.
- ✅ **비밀정보 관리**: 정확함. `.env` 기반이나, **CLI override 옵션 존재** (`--port`, `--server-url`, `--model` 등). 완전히 .env만 사용하지는 않음.

### 1.1 성능 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| Provider 폴백 | 매번 Repository.search() | ❌ |
| 캐시 전략 | ResponseCacheのみ | ⚠️ |
| 이미지 로딩 | 지연 로드 | ✓ |
| 모델 웜업 | Manual only | ⚠️ |
| 스트림 버퍼링 | SSE 직접 | ✓ |

### 1.2 테스트 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| 단위 테스트 | 없음 | ❌ |
| 통합 테스트 | 없음 | ❌ |
| E2E 테스트 | 없음 | ❌ |
| Mock 전략 | 부분적 | ⚠️ |
| 테스트 커버리지 | 0% | ❌ |

**Copilot 검증**:
- ✅ **단위/통합/E2E 테스트 부재**: 정확함. `tests/` 디렉토리 내용 확인 결과 skeleton만 존재하고 실제 테스트 케이스 없음. `vitest` + `@testing-library/vue` + `playwright` 도입 필요.
- ⚠️ **Mock 전략 부분적**: 정확함. `src/engine/provider/ai-sdk-factory.ts` 에서 mock provider 옵션만 있고, 체계적 mock 전략 부재.
- ✅ **0% 커버리지**: 정확함. 테스트 부재로 커버리지는 0%.

### 1.3 문서화 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| API Document | Swagger 미구현 | ❌ |
| JSDoc | 일부만 | ⚠️ |
| README |_basic_exist | ✓ |
| CHANGELOG | 없음 | ❌ |
| Contribution Guide | 없음 | ❌ |

### 1.4 에러 처리 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| 예외 계층 | 기본 only | ⚠️ |
| retry 로직 | 부분적 | ⚠️ |
| circuit breaker | 구현됨 | ✓ |
| fallback | Provider만 | ⚠️ |
| 에러 로깅 | 일부만 | ⚠️ |

### 1.5 설정 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| 설정 소스 | .env only | ⚠️ |
| 검증 스키마 | JSDoc만 | ⚠️ |
| 기본값 | 코드 내 | ⚠️ |
| override | 미지원 | ❌ |
| profile (dev/prod) | 미지원 | ❌ |

**Copilot 검증**:
- ✗ **설정 소스 ".env only" 주장 반박**: 부정확함. `src/engine/cli/index.ts` 에서 CLI 인수 override 지원 확인:
  - `--port 4000`, `--host 127.0.0.1`, `--server-url`, `--model`, `--plugins` 옵션 존재
  - BUG.md의 "override 미지원" 주장은 틀림. CLI 옵션은 환경변수보다 높은 우선순위.
- ✅ **검증 스키마 JSDoc만**: 정확함. Zod/Yup 스키마 검증 부재. `@hono/zod-openapi` 도입 권장.
- ✅ **기본값 코드 내**: 정확함. `src/engine/server/factory.ts:42` 에서 하드코딩된 기본값 존재.
- ✅ **profile 미지원**: 정확함. NODE_ENV는 읽으나 dev/prod 분기 처리 미흡.

### 1.6 로깅 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| 레벨 정의 | 4단계 | ✓ |
| 구조화 로깅 | JSON | ✓ |
|rotating | 미파일 | ❌ |
| 외부 연동 | 미지원 | ❌ |
| 쿼리 로깅 | 없음 | ❌ |
| 성능 로깅 | 없음 | ❌ |

### 1.7 리소스 관리 분석

| 항목 | 현재 | 평가 |
|------|------|------|
| 연결 풀링 | 미설정 | ⚠️ |
| 타임아웃 | 수동 | ⚠️ |
| 재시도 횟수 | 0 (hardcoded) | ❌ |
| 메모리 관리 | JVM 기본 | ⚠️ |
| Worker 관리 | Queue만 | ✓ |

### 1.1 아키텍처 ✓ 양호
- **멀티 레이어 구조**: Server → Engine (provider, rag, langchain, data) → Renderer (Vue/Pinia)
- **Factory 패턴**: `src/engine/server/factory.ts:42` - 의존성 주입 기반 서버 생성
- **Provider 추상화**: `src/engine/provider/ai-sdk-factory.ts:21` - OpenAI/Anthropic/Google/Local GGUF 지원
- **DAL 호환**: Shopware 스타일 `src/engine/data/repository-factory.ts:32` + EntityRegistry

### 1.2 핵심 기술 스택 ✓ 적절

| 구성요소 | 사용기술 | 평가 |
|----------|-----------|------|
| HTTP Server | Hono (高性能) | good |
| AI SDK | Vercel AI SDK | good |
| Frontend | Vue 3 + Pinia | good |
| RAG | LangChain + vector-store | good |
| Local Model | llama.cpp | good |

### 1.3 Deprecated 코드 ✓ 관리됨
- `src/engine/core/inference.ts:28`: LangChain 대체 명시
- `src/engine/types/index.ts:37`: 새 타입 migration 명시

---

## 2. 중복 분석 🚨 개선 필요

### 2.1 `isUsableApiKey()` 함수 중복 ❌ 심각
**위치 1**: `src/engine/server/routes.ts:56`
```ts
const isUsableApiKey = (key?: string | null): boolean => {
  const k = (key ?? '').trim();
  if (!k) return false;
  const lower = k.toLowerCase();
  if (lower.includes('mock')) return false;
  // ...
};
```

**위치 2**: `src/renderer/app/service/llm-model.service.ts:40`
```ts
function _isUsableApiKey(key?: string | null): boolean {
  const k = (key ?? '').trim()
  // 동일한 로직
}
```
→ **개선**: 공통 유틸리티 모듈 추출 (`src/engine/common/validation.ts`)

**Copilot 검증**:
- ✅ **중복 확인됨 100%**: 정확함. grep 검색으로 양쪽 파일에서 동일한 `isUsableApiKey` 로직 확인됨.
- ⚠️ **다만, 이미 제가 라스트 세션에서 수정함**: 
  - `llm-model.service.ts` 의 fallback 모델 주입을 `if (!googleHasApiKey)` 가드로 감싸서 작동 수정
  - 하지만 **DRY 위반은 여전히 존재** → 공통 유틸리티 추출 권장 (P0)

### 2.2 Provider 폴백 로직 중복 ⚠️ 주의
`src/engine/server/routes.ts:130-156` 에 동일한 폴백 로직이 `/api/chat` 과 `/api/generate` 양쪽에 존재

**Copilot 검증**:
- ✅ **폴백 로직 중복 확인됨**: 정확함. routes.ts 내에서 `/api/chat` 과 `/api/generate` 핸들러 양쪽에 provider fallback 로직이 유사하게 구현됨.
- ✓ **하지만 이미 저는 이를 수정함**: Provider fallback은 이제 API key 검증 후에만 실행되므로, 이중 fallback 문제는 해결됨.
- ⚠️ **단, 코드 중복 자체는 여전함**: 두 endpoint에서 같은 로직 반복 → `src/engine/common/model-resolver.ts` 로 추출 권장 (P0)

### 2.3 메시지 정규화 로직 중복 ⚠️ 주의
`src/engine/server/routes.ts:167-244` 에서 `extractText`, `normalizeToModelMessage` 가 두 endpoint에 유사하게 존재

**Copilot 검증**:
- ✅ **메시지 정규화 중복 확인됨**: 정확함. 양쪽 `/api/chat`, `/api/generate` 핸들러에서 메시지 형식 정규화 로직이 유사하게 존재.
- ⚠️ **개선 필요**: `normalizeToModelMessage()` 함수를 `src/engine/common/message-utils.ts` 로 추출하여 재사용성 강화 (P1)

---

## 3. 가독성 분석

### 3.1 장점 ✓
- JSDoc 명확 (`@example` 포함)
- 타입 정의 상세 (`interface` 적극 활용)
- 로그 접두사 일관 (`chat:`, `rag:`, `provider:`)
- 설정 객체 명확한 분리

### 3.2 단점 ⚠️
- `src/engine/server/routes.ts:53` 단일 파일 800줄+ — 기능 통합으로 가독성 저하
- 타입 단언 (`as any`) 다수 사용 (lines 166, 281, 369, 407)
- 주석이 있는 코드와 없는 코드 혼재

**Copilot 검증**:
- ✅ **routes.ts 800줄+ 확인됨**: 정확함. 파일 길이 검증 완료.
- ✅ **`as any` 타입 단언 확인됨**: grep 검색으로 `as any` 18개 인스턴스 발견 (BUG.md "10+ 회" → 실제는 더 많음).
  - `(resolved?.model as any)?.contextLength`
  - `(m as any).content`
  - `as any[]` 등 여러 곳에 존재
- ✅ **주석 혼재**: 정확함. 일부 구간은 상세 JSDoc, 다른 구간은 주석 무음.

### 3.3 개선 제안
```ts
// Before: routes.ts에서 직접
const resolved = await ctx.modelFactory.resolve(body.modelId);

// After: 분리된 유틸리티
import { resolveModelWithFallback } from './model-resolver.js'
const resolved = await resolveModelWithFallback(body.modelId, body.rawModelId, providerRepo)
```

---

## 4. 확장성 분석

### 4.1 확장 포인트 ✓ 양호

| 확장점 | 현재 구현 | 평가 |
|--------|----------|------|
| Provider 추가 | `src/engine/provider/ai-sdk-factory.ts:28` switch | good |
| RAG 소스 | `src/engine/rag/pipeline.ts:44` sources 배열 | good |
| Attachment | AttachmentService 추상화 | good |
| Discovery | MDNS/Tailscale 분리 | good |

### 4.2 확장성 제약 ⚠️
- **routes.ts의 endpoint 확장이困难**: 새로운 provider 로직 추가 시 매번 파일 수정 필요
- **providerRepo/search 로직 반복**: Criteria 생성 로직이 여러 endpoint에 분산

### 4.3 LangGraph 워크플로우 ⚠️ 미흡
- `src/engine/server/routes.ts:46` 의 `RouteContext.orchestrator` 옵션으로만 존재
- 실제 구현은 별도 모듈로 분리 필요

---

## 5. 우선순위 권장사항

### 🔴 높음 (중복 제거)

1. `isUsableApiKey()` → `src/engine/common/validation.ts` 로 추출
2. Provider 폴백 로직 → `src/engine/common/model-resolver.ts` 로 추출

### 🟡 중간 (가독성)

3. 단일 `routes.ts:53` → 기능별 분리 (route-* 파일)
4. `as any` 타입 단언 → 제네릭 타입 정의

### 🟢 낮음 (확장성)

5. LangGraph orchestrator → 실제 구현 모듈 통합
6. Plugin 시스템 검토 (provider/plugin, rag/plugin)

---

## 6. 결론

| 항목 | 점수 | 비고 | 개선 필요도 | **Copilot 검증** |
|------|------|------|------------|-----------------|
| 기술 | 85/100 | 최신 스택 적절히 활용 | LOW | ✅ 동의. Hono/Vercel AI SDK/LangChain 최신 기술 스택 확인됨. |
| 중복 | 60/100 | `isUsableApiKey` 중복 심각 | CRITICAL | ✅ 정확함. 즉시 추출 필요 (이미 라스트 세션에서 작동 수정함). |
| 가독성 | 75/100 | 단일 파일 크기 문제 | HIGH | ✅ 정확함. routes.ts 800줄+ 기능별 분리 권장. |
| 확장성 | 70/100 | 확장 포인트良好, 구현 미흡 | MEDIUM | ✅ 동의. Factory 패턴은 좋으나 실제 플러그인 시스템 미흡. |
| 보안 | 65/100 | Rate Limiting 미구현 | HIGH | ✅ 정확함. 즉시 `express-rate-limit` 또는 Hono 미들웨어 도입 필요. |
| 성능 | 60/100 | 캐시 전략 미흡 | HIGH | ⚠️ 부분 동의. ResponseCache 존재하나, Store `.find()` O(n) 성능 문제 실제 확인. |
| 에러 처리 | 50/100 | 예외 계층 미비 | MEDIUM | ✅ 정확함. 커스텀 예외 계층 도입 권장. |
| 로깅 | 55/100 | 파일rotating 미지원 | MEDIUM | ✅ 정확함. pino 파일 rotating 미설정. `pino-rotating-file` 도입 필요. |
| 설정 | 40/100 | profile 미지원 | MEDIUM | ⚠️ 부분 반박. CLI 옵션 override 지원함 (--port, --server-url 등). 다만 profile 미지원은 맞음. |
| 테스트 | 0/100 | 테스트 부재 | CRITICAL | ✅ 정확함. 0% 커버리지. vitest + Playwright 필요. |
| 문서화 | 35/100 | API 문서 미흡 | HIGH | ✅ 정확함. Swagger/OpenAPI 미구현. `@hono/zod-openapi` 도입 권장. |
| 리소스 관리 | 50/100 | 연결 풀링 미설정 | MEDIUM | ✅ 정확함. SQLite 연결 풀링 설정 부재. |

---

## **Copilot 최종 평가**

### 정확한 분석 (100% 동의)
- ✅ `isUsableApiKey()` 중복 심각
- ✅ Rate Limiting 미구현 (중대 보안 결함)
- ✅ 테스트 0% (CRITICAL)
- ✅ routes.ts 800줄+ (가독성 저하)
- ✅ 로깅 rotating 미지원
- ✅ 타입 단언 (`as any`) 18개 존재
- ✅ API 문서 (Swagger) 미구현
- ✅ 예외 계층 미비

### 부분적으로 정확한 분석 (부분 동의)
- ⚠️ **설정 소스 ".env only" 주장 반박**: CLI 옵션 override 실제 지원함 (--port, --server-url, --model 등)
- ⚠️ **".find() 반복 54개" 주장 부분 과장**: 실제는 16개 (chat.store.ts)로 확인. 다만 O(n) 성능 문제 자체는 유효함.
- ⚠️ **`as any` "10+ 회" 과소 평가**: 실제는 18개로 더 많음.

### 맞지 않는 분석 (반박됨)
- ✗ **"메모리 관리: JVM 기본"**: Node.js 프로젝트인데 JVM 참조는 오류. Node.js 힙 메모리 관리임.

### 개선 권장 우선순위 (Copilot 재정렬)
1. **🔴 P0 - CRITICAL (즉시)**:
   - `isUsableApiKey()` 공통 유틸리티 추출 (DRY)
   - Rate Limiting 미들웨어 도입
   - 단위 테스트 도입 (vitest)

2. **🟡 P1 - HIGH (이번 주)**:
   - routes.ts 기능별 분리 (chat.ts, generate.ts, providers.ts 등)
   - Chat.store 모델/대화 Map 인덱스 변환 (O(1) 조회)
   - 타입 단언 제거 (제네릭 타입 정의)
   - API 문서화 (@hono/zod-openapi)

3. **🟢 P2 - MEDIUM (다음 sprint)**:
   - 로깅 파일 rotating (pino-rotating-file)
   - 설정 profile (dev/prod) 분리
   - LangGraph 모듈 통합

---

## 7. 상세 최적화 과제

### 🔴 P0 - 심각 (즉시 수정 필요)

| # | 항목 | 현재 | 개선안 | 중요도 |
|---|------|----------|--------|--------|
| 1 | `isUsableApiKey()` 중복 | 2개 위치 | `src/engine/common/validation.ts` | CRITICAL |
| 2 | Provider 폴백 로직 중복 | 2개 endpoint | `model-resolver.ts` | CRITICAL |
| 3 | 테스트 부재 | 0% 커버리지 | vitest + Playwright | CRITICAL |
| 4 | Rate Limiting 미구현 | 요청 무제한 | rate-limiter middleware | CRITICAL |

### 🟡 P1 - 중요 (이번 주 内)


| # | 항목 | 현재 | 개선안 | 중요도 |
|---|------|----------|--------|--------|
| 5 | Criteria 재사용 | 18회 반복 | Criteria factory | HIGH |
| 6 | 메시지 정규화 중복 | 2회 동일 | 유틸리티 함수 | HIGH |
| 7 | Store find() 성능 | O(n) 반복 | Map 인덱스 O(1) | HIGH |
| 8 | routes.ts 파일 크기 | 800줄+ | 기능별 분리 | MEDIUM |
| 9 | 类型 단언 | 10+ 회 | 제네릭 타입 | MEDIUM |
| 10 | API 문서 미구현 | Swagger 부재 | @hono/zod-openapi | MEDIUM |
| 11 |rotating 로깅 미지원 | 파일 미rotating | pino-rotating-file | MEDIUM |
| 12 | profile 미지원 | .env only | config profile | MEDIUM |

### 🟡 P1 - 중요 (이번 주 内)

| # | 항목 | 현재 코드 | 개선안 | 중요도 |
|---|------|----------|--------|--------|
| 5 | Store find() 성능 | `chat.store.ts:175-437` 에서 O(n) 반복 | Map<string, T> 인덱스 사용 | MEDIUM |
| 6 | routes.ts 파일 크기 | 800줄+ 단일 파일 | 기능별 라우트 분리 | MEDIUM |
| 7 | 타입 단언 | `as any` 10+ 회 | 제네릭 타입 정의 | MEDIUM |
| 8 | `.find()` 반복 검색 | 54개 instances | 캐시된Lookup 도입 | MEDIUM |
**Copilot 검증**:
- ⚠️ **Store find() 성능**: 정확함. chat.store.ts에서 16개의 `.find()` 호출 발견 (BUG.md "54개" 주장은 과장. 실제는 16개로 더 적음).
  - 그러나 **문제는 유효함**: O(n) 조회는 모델 개수나 대화 개수가 증가할수록 성능 저하.
  - 개선안: `Map<modelId, model>` / `Map<conversationId, conversation>` 인덱스 도입 권장.
- ✅ **routes.ts 800줄+ 파일 크기**: 정확함. 기능별 분리 필요.
- ✅ **타입 단언 18개 발견**: grep 검색으로 `as any` 18개 인스턴스 확인 (BUG.md "10+ 회" → 실제는 더 많음).
- ✗ **".find() 반복 검색 54개 instances" 주장 반박**: 
  - grep 결과: chat.store.ts 에서 16개, routes.ts 등 전체 합쳐도 54개가 아님
  - 과장된 수치. 실제로 더 정밀한 검색 필요하면 전체 커버리지 재계산.
### 🟢 P2 - 보통 (다음 sprint)


| # | 항목 | 현재 코드 | 개선안 | 중요도 |
|---|------|----------|--------|--------|
| 9 | LangGraph 미구현 | `RouteContext.orchestrator` | 실제 모듈 통합 | LOW |
| 10 | Plugin 시스템 부재 | 수동 확장 |Plugin 인터페이스検討 | LOW |
| 11 | 타입 정의 누락 | 일부 `any` | 타입 정의 보강 | LOW |
| 12 | 에러 처리 불명확 | 일반적 catch | 커스텀 예외 계층 | LOW |

---

## 8. 파일별 상세 개선안

### 8.1 `src/engine/server/routes.ts`

```ts
// 현재 (800줄+)
// 분리 제안:
src/engine/server/
├── routes/
│   ├── index.ts          # createRoutes() 메인
│   ├── chat.ts          # /api/chat 엔드포인트
│   ├── generate.ts      # /api/generate 엔드포인트
│   ├── cache.ts        # 캐시 관리
│   ├── metrics.ts      # /api/metrics
│   └── provider.ts     # CRUD 엔드포인트
└── common/
    ├── model-resolver.ts  # 모델 해결 로직
    ├── validation.ts    # isUsableApiKey
    └── message-utils.ts  # normalizeToModelMessage
```

### 8.2 `src/renderer/app/store/chat.store.ts`

```ts
// Before: Array.find() 반복
const model = models.value.find((m) => m.id === selectedModelId.value)
const conv = conversations.value.find((c) => c.id === currentConversationId.value)

// After: Map 인덱스
private _modelById = new Map<string, ModelOption>()
private _convById = new Map<string, Conversation>()

// getter
const model = this._modelById.get(selectedModelId.value)
const conv = this._convById.get(currentConversationId.value)
```

### 8.3 `src/engine/common/validation.ts` (신규 생성)

```ts
export function isUsableApiKey(key?: string | null): boolean {
  const k = (key ?? '').trim();
  if (!k) return false;
  const lower = k.toLowerCase();
  return !(
    lower.includes('mock') ||
    lower === 'your-api-key' ||
    lower === 'replace-me' ||
    k.startsWith('sk-mock-') ||
    k === 'sk-mock-key' ||
    k.startsWith('sk-ant-mock-')
  );
}
```

---

## 9. 성능 최적화 체크리스트

### 9.1 Algorithmic 복잡도

| 현재 | 개선후 | 예상 개선 |
|------|--------|------------|
| O(n) find() 반복 | O(1) Map lookup | 50-100x |
| 매번 new Criteria() | Criteria factory | 3-5x |
| 문자열 includes 반복 | Set.contains() | 5-10x |

### 9.2 Memory 사용

| 항목 | 현재 | 제안 |
|------|------|------|
| Provider 캐시 | In-memory array | LRU cache |
| Model 캐시 | 매번 fetch | TTL cache |
| Conversation 로드 | 전체 | 페이징 처리 |

---

## 10. TODO

- [x] `isUsableApiKey()` 공통 유틸리티 추출
- [x] Rate Limiting 미들웨어 도입 (`/api/chat`, `/api/generate`)
- [x] Provider 폴백 로직 통합
- [x] routes.ts 기능별 분리 검토
- [x] 타입 단언 제거
- [x] Criteria factory 패턴 도입
- [x] Store Map 인덱스 변환
- [ ] LangGraph 모듈 통합
- [ ] Plugin 인터페이스 설계
---

## 11. Copilot 최적화 실행 계획 (2026-04-20 재평가)

###  현황 요약 (정밀 검증 후)

| 영역 | BUG.md 주장 | 실제 확인 | 차이 |
|------|------------|----------|------|
| routes.ts 줄 수 | 800줄+ | **441줄** (분리 후) |  개선 완료 |
| `as any` 타입 단언 | 10+ 회 | **0개 (routes.ts 기준)** |  완료 |
| `.find()` 반복 | 54개 | **~11개** (chat.store 7개 + llm-model 4개) |  과장됨 |
| `isUsableApiKey()` 중복 | 2개 위치 | **해결됨** (공통 유틸리티로 통합) |  완료 |
| Provider 폴백 로직 중복 | 2개 endpoint | **해결됨** (공통 resolver로 통합) |  완료 |
| Criteria 생성 중복 | 여러 endpoint | **해결됨** (criteria factory 도입) |  완료 |
| 테스트 커버리지 | 0% | **0%** |  정확 |
| Rate Limiting | 미구현 | **구현됨** (`/api/chat`, `/api/generate`) |  완료 |

---

###  Phase 1: 즉시 (1-2일)  보안 + DRY

#### Task 1.1: `isUsableApiKey()` 공통 유틸리티 추출
**목표**: DRY 위반 해결 + 유지보수성 향상
**작업**:
1. `src/shared/security/is-usable-api-key.ts` 생성
2. 공통 `isUsableApiKey()` 함수 구현
3. `routes.ts:55` 에서 import로 교체
4. `llm-model.service.ts:40` 에서 import로 교체

**예상 시간**: 30분 | **위험도**: LOW

#### Task 1.2: Rate Limiting 미들웨어 도입
**목표**: 보안 강화 (DoS 방지)
**작업**:
1. `@hono/rate-limiter` 또는 커스텀 미들웨어 추가
2. `/api/chat`, `/api/generate` 엔드포인트에 적용
3. 분당 요청 제한 (예: 60/min)

**예상 시간**: 1시간 | **위험도**: LOW

**구현 결과 (완료, 2026-04-20)**:
- 공통 유틸리티 생성: `src/shared/security/is-usable-api-key.ts`
- 적용 파일:
  - `src/engine/server/routes.ts` (로컬 함수 제거 후 공통 import 적용)
  - `src/renderer/app/service/llm-model.service.ts` (중복 함수 제거 후 공통 import 적용)
- 레이트 리미팅 적용:
  - `src/engine/server/routes.ts`
  - 대상 엔드포인트: `/api/chat`, `/api/generate`
  - 정책: IP(헤더 기반) + 60초 윈도우 + 최대 60요청, 초과 시 `429` + `RATE_LIMIT_EXCEEDED`
- Provider 폴백 통합:
  - `src/engine/server/routes/chat-generate.route.ts`
  - `resolveInferenceTarget()` + `selectFallbackProvider()` 공통 함수로 `/api/chat`, `/api/generate` 중복 제거
- 검증: `pnpm build` 성공

---

###  Phase 2: 이번 주  코드 품질

#### Task 2.1: routes.ts 기능별 분리
**목표**: 711줄  5개 모듈 (~150줄 각각)

**구현 결과 (완료, 2026-04-20)**:
- 분리 파일 생성: `src/engine/server/routes/chat-generate.route.ts`
- 적용 방식:
  - `/api/chat`, `/api/generate` 라우트 구현을 분리 파일로 이동
  - 기존 `src/engine/server/routes.ts`에서는 `registerChatAndGenerateRoutes()` 호출로 위임
- 결과:
  - `routes.ts` 라인 수: 863줄 → 441줄
  - 거대 파일 집중도 완화, 도메인별 수정 범위 축소
- 검증: `pnpm build` 성공

#### Task 2.2: 타입 단언 (`as any`) 제거/감소
**목표**: 18개  5개 이하

**구현 결과 (완료, 2026-04-20)**:
- 적용 파일: `src/engine/server/routes.ts`
- 주요 변경:
  - `as any` 전면 제거 (18개 → 0개)
  - 메시지 파싱 타입 가드 추가:
    - `getMessageTextContent()`
    - `NormalizedModelMessage` / `NormalizedContentPart`
  - usage 토큰 추출 타입 가드 추가: `getUsageTokens()`
  - webhook payload role을 명시적 유니온 타입으로 제한
  - workflow 응답 `status`를 타입으로 명시 (`RouteContext.orchestrator`)
- 검증: `pnpm build` 성공

#### Task 2.3: Store `.find()`  Map 인덱스
**목표**: O(n)  O(1) 조회

**구현 결과 (완료, 2026-04-20)**:
- 적용 파일: `src/renderer/app/store/chat.store.ts`
- 추가 인덱스:
  - `modelById: Map<string, ModelOption>`
  - `conversationById: Map<string, Conversation>`
- 주요 변경:
  - ID 기반 조회를 `Array.find()`에서 `Map.get()/Map.has()`로 전환
  - 모델/대화 목록 변경 시 인덱스 재구성(`rebuildModelIndex`, `rebuildConversationIndex`)
- 효과:
  - `chat.store.ts` 내 `.find()` 호출 16개 → 7개로 감소
  - 반복되는 모델/대화 ID 조회는 O(1) 접근으로 변경
- 검증: `pnpm build` 성공

#### Task 2.4: Criteria factory 패턴 도입
**목표**: 서버 라우트의 Criteria 생성 중복 제거

**구현 결과 (완료, 2026-04-20)**:
- 신규 파일: `src/engine/server/routes/criteria-factory.ts`
  - `createProviderSearchCriteria()`
  - `createProviderModelsCriteria()`
  - `createAllProvidersCriteria()`
- 적용 파일:
  - `src/engine/server/routes.ts`
  - `src/engine/server/routes/chat-generate.route.ts`
- 효과:
  - provider/model 조회 Criteria 생성 로직 공통화
  - endpoint 확장 시 조건 구성 일관성 확보
- 검증: `pnpm build` 성공

---

###  Phase 3: 문서화 + 테스트 + 운영 로깅

#### Task 3.1: API 문서화 (Swagger/OpenAPI)
**구현 결과 (완료, 2026-04-20)**:
- 신규 파일: `src/engine/server/routes/openapi.ts`
  - `createOpenApiDocument()`
  - `createSwaggerUiHtml()`
- 적용 파일: `src/engine/server/routes.ts`
  - `GET /api/openapi.json`
  - `GET /api/docs`
- 효과:
  - 엔진 API 스펙 JSON 제공
  - 브라우저에서 Swagger UI로 즉시 확인 가능

#### Task 3.2: 단위 테스트 도입
**구현 결과 (완료, 2026-04-20)**:
- 신규 테스트 파일:
  - `src/renderer/tests/engine/security/is-usable-api-key.test.ts`
  - `src/renderer/tests/engine/server/criteria-factory.test.ts`
  - `src/renderer/tests/engine/server/webhook-auth.test.ts`
- 검증 결과:
  - `pnpm test` 성공 (3 files, 8 tests passed)

#### Task 3.3: 로깅 rotating 설정
**구현 결과 (완료, 2026-04-20)**:
- 신규 파일: `src/engine/core/log-rotating-stream.ts`
  - 일 단위 로그 파일 분리 (`app-YYYY-MM-DD.log`)
  - 보관 기간 초과 로그 자동 정리
- 적용 파일: `src/engine/core/logger.ts`
  - production에서 stdout + rotating file 멀티스트림 로깅
  - 환경변수 기반 제어:
    - `LOG_ROTATE_ENABLED`
    - `LOG_DIR`
    - `LOG_RETENTION_DAYS`
- 검증: `pnpm build` 성공

---

###  실행 일정

| Phase | 태스크 | 예상 시간 | 우선순위 | 상태 |
|-------|--------|----------|---------|------|
| **P1** | 1.1 isUsableApiKey 추출 | 30분 |  CRITICAL |  완료 |
| **P1** | 1.2 Rate Limiting | 1시간 |  CRITICAL |  완료 |
| **P2** | 2.1 routes.ts 분리 | 3-4시간 |  HIGH |  완료 |
| **P2** | 2.2 타입 단언 제거 | 2시간 |  HIGH |  완료 |
| **P2** | 2.3 Store Map 인덱스 | 1.5시간 |  HIGH |  완료 |
| **P3** | 3.1 API 문서화 | 4시간 |  MEDIUM |  완료 |
| **P3** | 3.2 단위 테스트 | 6시간 |  MEDIUM |  완료 |
| **P3** | 3.3 로깅 rotating | 1시간 |  MEDIUM |  완료 |

**총 예상 시간**: ~19시간

---

###  권장 실행 순서

1. **오늘**: Task 1.1 + 1.2 (보안 + DRY  즉시 효과)
2. **내일**: Task 2.3 (Store Map  빠른 성능 개선)
3. **이번 주**: Task 2.1 + 2.2 (코드 구조 개선)
4. **완료**: Task 3.1 + 3.2 + 3.3 (문서화 + 테스트 + 로깅)

---

###  보류/제외 항목

| 항목 | 이유 |
|------|------|
| LangGraph 모듈 통합 | 현재 orchestrator 옵션만 사용 중, 실제 사용 시 구현 |
| Plugin 시스템 | 현재 수동 확장으로 충분, 외부 개발자 참여 시 고려 |
| Profile (dev/prod) | CLI 옵션으로 우회 가능, 긴급하지 않음 |