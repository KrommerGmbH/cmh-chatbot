# CMH Chatbot — Copilot Instructions

> **프로젝트**: `@krommergmbh/cmh-chatbot` (pnpm 라이브러리 + 자체 Renderer UI + Shopware App)
> **위치**: `E:\Kang\workspace\cmh-chatbot`

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **엔진** | tsup (ESM+CJS+DTS, 4 entries: index, client, server, cli) |
| **Renderer** | Vite 6 + Vue 3 + @shopware-ag/meteor-component-library |
| **Shopware 통합** | `@shopware-ag/meteor-admin-sdk` — Shopware Admin에 **App**으로 등록 (Plugin 아님) |
| **i18n** | vue-i18n v9 (legacy: false, globalInjection: true), 5개 locale |
| **상태 관리** | Pinia (Composition Store) |
| **Template** | `.html?raw` 문자열 template → `vue/dist/vue.esm-bundler.js` alias 필수 |

### 1.1 배포 모델

| 호스트 | 방식 | 설명 |
|--------|------|------|
| **AideWorks** (Electron) | 라이브러리 import | `@krommergmbh/cmh-chatbot`을 직접 import하여 사용 |
| **Shopware Admin** | **App 등록** | `@shopware-ag/meteor-admin-sdk`로 Admin에 App으로 등록. 독립 DB·Entity·UI·AI Library |
| **Docker** | 독립 서버 | Docker 이미지로 배포, REST/WS API 제공 |

### 1.2 Shopware App 핵심 원칙

> **⚠️ cmh-chatbot은 Shopware Plugin이 아니라 Shopware App이다.**

- **독립 DB**: cmh-chatbot 자체 Entity, Definition, Repository — Shopware DB와 분리
- **독립 UI**: Renderer를 자체 빌드하여 Shopware Admin 내 App iframe/module로 탑재
- **독립 라이브러리**: LangChain, LangGraph, Vercel AI SDK 등 AI 스택을 자체 번들
- **통합 SDK**: `@shopware-ag/meteor-admin-sdk`로 Shopware Admin과 통신 (위치·알림·데이터 동기화)
- ❌ Shopware Plugin 방식으로 설치/등록 금지
- ❌ Shopware 코어 Entity에 직접 의존 금지

---

## 2. UI/UX 디자인 원칙

### 2.1 모바일 우선 반응형 디자인 (Mobile-First Responsive Design)

> **⚠️ 핵심 원칙**: cmh-chatbot Renderer UI는 **모바일 기기에서도 사용할 수 있는 반응형 디자인**으로 구현해야 한다.

#### 필수 규칙

1. **Mobile-First CSS** — 기본 스타일은 모바일 뷰포트 기준으로 작성하고, `@media (min-width: ...)` 으로 데스크톱을 확장한다.
2. **브레이크포인트 기준**:
   | 이름 | 너비 | 용도 |
   |------|------|------|
   | `$bp-mobile` | `< 640px` | 모바일 (기본) |
   | `$bp-tablet` | `≥ 640px` | 태블릿 |
   | `$bp-desktop` | `≥ 1024px` | 데스크톱 |
3. **터치 친화적 UI** — 최소 터치 타겟 `44px × 44px` (WCAG 2.5.8)
4. **사이드바** — 모바일에서는 오버레이(슬라이드) 방식, 데스크톱에서는 고정 사이드바
5. **입력 영역** — 모바일 가상 키보드가 올라올 때 입력 영역이 가려지지 않도록 `position: sticky` 또는 `fixed bottom` 사용
6. **폰트 크기** — 모바일에서 최소 `14px` (iOS Safari 자동 줌 방지: input은 `16px` 이상)
7. **가로 스크롤 금지** — `overflow-x: hidden` 또는 `max-width: 100vw` 보장
8. **메시지 버블** — 화면 너비의 최대 85%로 제한 (`max-width: 85%`)

#### 금지 사항

- ❌ 고정 너비(`width: 600px` 등) 하드코딩 — 반드시 `%`, `vw`, `min()`, `clamp()` 사용
- ❌ `:hover` 전용 인터랙션 — 터치 환경에서는 hover 없음, 반드시 `@media (hover: hover)` 분기
- ❌ 데스크톱 전용 레이아웃 먼저 구현 후 모바일 대응 — **모바일부터 구현**

### 2.2 아이콘 규칙

> **⚠️ 핵심 원칙**: cmh-chatbot은 **Phosphor Icons regular만** 사용한다. 다른 아이콘 라이브러리 사용 절대 금지.

1. **유일 소스: Phosphor Icons regular** — `.docs/Phosphor Icons/assets/regular/`
2. 아이콘 사용 전 반드시 해당 디렉토리에서 파일 존재 확인
3. ❌ Meteor Icon Kit 사용 금지 (aideworks 전용)
4. ❌ Iconify 사용 금지
5. ❌ 하드코딩 SVG inline 금지, `<img>` 태그 아이콘 금지

### 2.3 색상 및 테마

- 색상 하드코딩 금지 — CSS Custom Property(`var(--color-xxx)`) 사용
- Dark Mode 기본 지원

### 2.4 폰트 크기 토큰 시스템 (Font Size Token System)

> **⚠️ 절대 금지**: SCSS/CSS에서 `font-size: Npx` 하드코딩 금지. 반드시 CSS Custom Property 토큰을 사용한다.

#### 5단계 폰트 토큰

| 레벨 | CSS Variable | 기본값 | Weight Variable | 기본 Weight | 용도 |
|------|-------------|--------|----------------|------------|------|
| **XS** | `--cmh-font-size-xs` | `11px` | `--cmh-font-weight-xs` | `300` | 타임스탬프, 메타 라벨, 보조 텍스트, 칩, 설명 |
| **SM** | `--cmh-font-size-sm` | `13px` | `--cmh-font-weight-sm` | `400` | 사이드바 헤더, 내비게이션 라벨, 보조 본문 |
| **Base** | `--cmh-font-size-base` | `15px` | `--cmh-font-weight-base` | `400` | 기본 본문, 입력 필드, 버튼 |
| **LG** | `--cmh-font-size-lg` | `18px` | `--cmh-font-weight-lg` | `600` | 로고, 섹션 제목 |
| **XL** | `--cmh-font-size-xl` | `24px` | `--cmh-font-weight-xl` | `700` | 페이지 타이틀 |

#### 사용법

```scss
// ✅ 올바른 사용
font-size: var(--cmh-font-size-sm, 13px);
font-weight: var(--cmh-font-weight-sm, 400);

// ❌ 금지 — 하드코딩
font-size: 13px;
font-size: 1.2rem;
```

#### 예외

- `8px` 이하의 장식용 아이콘(▶ 화살표 등)은 `/* decorative icon — keep fixed */` 주석과 함께 고정값 허용

#### 호환 별칭 (Compat Aliases)

| 별칭 | 매핑 |
|------|------|
| `--cmh-font-base` | `= --cmh-font-size-base` |
| `--cmh-font-chat` | `= --cmh-font-size-sm` |
| `--cmh-font-code` | `= --cmh-font-size-xs` |

---

## 3. 컴포넌트 패턴

### 3.1 Template 확장자

- `.html` 확장자만 사용
- import 시 `?raw` suffix 필수: `import template from './foo.html?raw'`

### 3.2 페이지 index.ts 코딩 패턴

- **Options API 스타일** (`data()`, `computed`, `watch`, `methods`, `created()`, `mounted()`)
- `setup()` / Composition API lifecycle 직접 사용 금지 (페이지 엔트리에서)
- lifecycle 로직은 `createdComponent()`, `mountedComponent()` 메서드로 위임

### 3.3 i18n

- 모든 사용자 노출 텍스트는 `$t()` 사용
- 5개 locale: `ko-KR`(기본), `en-GB`(fallback), `de-DE`, `zh-CN`, `ja-JP`
- 새 키 추가 시 5개 파일 모두 동시 업데이트

---

## 4. Entity ID

- 정수형 ID 금지 — 반드시 UUID (`crypto.randomUUID()`)

---

## 5. 빌드 주의사항

- Vite alias: `vue` → `vue/dist/vue.esm-bundler.js` (런타임 template 컴파일러 필수)
- Meteor CSS sourcemap: `scripts/fix-meteor-sourcemaps.cjs` postinstall 스크립트로 처리

---

## 6. 구현 작업 방지책 (Anti-Pattern 방지)

> **⚠️ 이 규칙은 모든 Copilot 에이전트가 구현 작업 시 반드시 준수해야 한다.**

### 6.1 한 세션 집중 규칙

1. **한 세션에 구현 항목 최대 3개** — 4개 이상 동시 진행 금지
2. 항목이 3개를 초과하면 **우선순위를 정하고 나머지는 다음 세션으로 명시적 이월**
3. "별도 스펙 필요"로 미루기 금지 — 바로 스펙 작성을 시작하거나, 못 하는 이유를 구체적으로 설명

### 6.2 토큰 예산 관리

1. 구현 시작 전 **남은 항목 수 × 예상 복잡도**를 계산하여 세션 내 완료 가능 여부 판단
2. 완료 불가 판단 시 **즉시 사용자에게 알리고** 우선순위 확인
3. 토큰 한계에 도달하기 전에 **현재 진행 상황을 요약**하고 다음 세션 인계 정보 제공

### 6.3 "나중에" 금지 원칙

1. 구현 요청받은 항목을 "대규모 기능", "별도 스펙 필요" 등으로 **임의로 미루지 않는다**
2. 정말 한 세션에 불가능한 경우 → **최소한 스펙(spec.md) 또는 태스크(tasks.md)를 생성**하고 종료
3. 사용자가 "D (전부)" 선택 시 → 순차적으로 하나씩 완료하되, 각 항목 완료 후 다음으로 넘어감

---

## 7. AI SDK 스트림/첨부 통합 패턴

### 7.1 스트림 파서 단일화

- AI SDK 스트림 파서는 `src/shared/ai-stream/protocol-parser.ts`를 공용으로 사용한다.
- 금지: renderer/client에서 동일한 SSE/DataStream 파서를 각각 중복 구현.

### 7.2 `/api/chat` 멀티모달 보존

- `trimHistory`는 텍스트 기반 토큰 계산 용도로만 사용한다.
- 실제 모델 호출(`streamText`)에는 **원본 멀티파트 메시지(image/file/text)를 보존한 최근 N개**를 전달한다.
- 금지: trim 단계에서 이미지 파트를 문자열로 평탄화한 메시지를 그대로 모델에 전달.

### 7.3 WebSocket과 AI SDK transport 경계

- renderer 채팅 UI 기본 경로는 `/api/chat` 기반 AI SDK stream을 사용한다.
- WebSocket(`/ws`)은 외부 SDK/레거시 호환 경로로 유지한다.
- HTTP 경로(`chat-client.ts`)는 AI SDK Stream Protocol 파싱을 사용해 WS와 동작 의미를 맞춘다.

### 7.4 구조화 답변 블록 렌더링 규칙

- AI가 구조화 UI 응답을 보낼 때는 메시지 본문에 `cmh-ui` 코드블록(JSON)을 사용한다.
- 지원 타입: `image`, `video`, `iframe`, `data-grid`
- 예시:

```cmh-ui
{
   "blocks": [
      { "type": "image", "src": "https://..." },
      { "type": "data-grid", "columns": [{ "property": "name", "label": "Name" }], "rows": [{ "name": "Alice" }] }
   ]
}
```

- 보안: `iframe`은 https + 허용 도메인만 렌더링한다.

### 7.5 확장 블록 스키마 (채팅 UI)

- 기본 4타입(`image`, `video`, `iframe`, `data-grid`)에 한정하지 않는다.
- 추가 지원 타입: `text`, `markdown`, `code`, `table`, `button-group`, `collapse`, `card`, `entity-listing`, `filter`, `component`
- `component`는 `cmh-*`, `mt-*` 프리픽스만 허용한다.
- 알 수 없는 타입은 본문 markdown/text로 안전 폴백한다.

### 7.6 개발 서버 실행 기준

- Renderer(`/api/*`)는 Engine 프록시에 의존한다.
- 채팅 개발은 `dev:chat` 실행 시 `llm+engine+ui` 3개 프로세스가 함께 올라와야 한다.
- 기본 포트는 `llm(8080)+engine(4000)+ui(5200)`이며, 포트 충돌 시 환경변수로 오버라이드한다.
   - `CMH_LLM_PORT`
   - `CMH_ENGINE_PORT`
   - `CMH_UI_PORT`
- `dev-cleanup`은 현재 설정된 포트 조합을 정리해야 하며(기본 또는 env override), 점유 프로세스가 없어도 실패로 처리하지 않는다.
- Engine 미기동 상태의 Vite proxy `ECONNREFUSED`는 코드 버그가 아니라 런타임 프로세스 누락이다.

### 7.7 Google Provider 가시성 보장

- Google 원격 모델 조회(`/api/providers/:id/remote-models`)가 실패하거나 빈 목록이어도 selector에서 Google provider가 사라지지 않아야 한다.
- 이 경우 renderer는 안전 기본 Gemini 모델(`gemini-2.5-flash`, `gemini-2.5-pro`)을 fallback으로 주입해 provider 그룹을 유지한다.
- renderer는 provider 캐시(DAL)를 우선 사용하고, engine health 실패 상태는 장시간 캐시하여 `/api/*` proxy 500 로그 스팸을 줄인다.

### 7.8 API 문서 라우트 표준

- 엔진 API 문서 엔드포인트는 다음 두 경로를 기본으로 유지한다.
   - `GET /api/openapi.json`: OpenAPI JSON 문서
   - `GET /api/docs`: Swagger UI HTML
- OpenAPI 생성/Swagger HTML 작성은 `src/engine/server/routes/openapi.ts`에 집중한다.
- 금지: 라우트 파일 여러 곳에 문서 스키마/HTML 문자열을 분산 정의.

### 7.9 서버 로깅 로테이션 표준

- production에서 파일 로깅은 일 단위 로테이션을 사용한다.
- 로테이션 구현은 `src/engine/core/log-rotating-stream.ts`를 사용한다.
- 환경변수:
   - `LOG_ROTATE_ENABLED`
   - `LOG_DIR`
   - `LOG_RETENTION_DAYS`
- 금지: 단일 `app.log` 파일에 무기한 append.

### 7.10 엔진 단위 테스트 위치 규칙

- 테스트 소스는 `tests/**` 단일 경로만 사용한다.
- 엔진 단위 테스트는 아래 경로에 둔다.
   - `tests/engine/**`
- 우선 작성 대상:
   - 보안 유틸 (`is-usable-api-key`)
   - 서버 Criteria factory
   - webhook auth 미들웨어

### 7.11 모델 선택기 API 키 안내/실시간 동기화

- `cmh-chat-input`의 provider별 모델 목록에서, 해당 provider의 cloud 모델이 모두 `hasApiKey=false`면
   `cmh-chat-input__model-picker-models` 영역에 API 키 설정 안내 문구를 표시한다.
- 모델 선택기 오픈 시(`open-model-picker`) `chatStore.loadModels()`를 호출해 cloud 모델 목록을 실시간 API 동기화 기준으로 갱신한다.

### 7.12 로컬 모델 warmup/제목 생성 표준

- 로컬 모델 warmup은 동시 요청 시 dedupe registry(`model-warmup-registry`)로 단일 in-flight Promise를 공유한다.
- warmup 진행 중에는 채팅창에 `systemType='loading'` 메시지를 표시하고 완료/실패 시 정리한다.
- 앱 시작 시 기본 모델은 `gemma-4-E4B-it-UD-Q4_K_XL` 우선 선택, 없으면 `isDefault`, 최종 폴백은 첫 모델 순으로 선택한다.
- 첫 질문 이후 제목 생성은 "기본 제목(예: 새 채팅/New Chat)" 상태일 때만 실행하고, 생성 결과는 DB/UI에 저장한다.
