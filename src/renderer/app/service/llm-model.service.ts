/**
 * LLM Model Service
 *
 * 모델 DAL 로드, llama-server 동기화, 프로바이더 캐시 관리.
 * Store와 분리하여 설정 UI, 외부 API에서도 재사용 가능.
 */
import { Criteria } from '@engine/data/criteria'
import {
  DEFAULT_MODELS,
  DEFAULT_PROVIDERS,
  ENTITY_CMH_LLM_MODEL,
  ENTITY_CMH_LLM_PROVIDER,
} from '@engine/data/seed'
import { useRepositoryFactory } from '../composables/useRepositoryFactory'
import type { LlmModel } from '@engine/data/entity/llm/llm-model.entity'
import type { LlmProvider } from '@engine/data/entity/llm/llm-provider.entity'
import { isUsableApiKey } from '../../../shared/security/is-usable-api-key'

// Ensure entity definitions are registered
import '@engine/data/entity/llm/llm-provider.definition'
import '@engine/data/entity/llm/llm-model.definition'

import type { ModelOption } from '../store/chat.store'

// ── Repository ───────────────────────────────────────────

const { repositoryFactory } = useRepositoryFactory()
const _providerRepo = repositoryFactory.create(ENTITY_CMH_LLM_PROVIDER)
const _modelRepo = repositoryFactory.create(ENTITY_CMH_LLM_MODEL)

/** Provider ID → name 캐시 (N+1 방지) */
const _providerNameCache = new Map<string, string>()

/** Provider ID → full data 캐시 */
const _providerCache = new Map<string, LlmProvider>()

/** Engine API 가용성 캐시 (proxy ECONNREFUSED 스팸 방지) */
let _engineApiAvailableCache: boolean | null = null
let _engineApiCheckedAt = 0

// ── 공개 API ─────────────────────────────────────────────

export function getProviderCache(): Map<string, LlmProvider> {
  return _providerCache
}

export function getProviderName(providerId: string): string {
  return _providerNameCache.get(providerId) ?? 'Unknown'
}

/**
 * DAL에서 활성 모델 목록 로드 + llama-server 동기화
 */
export async function loadModelsFromDAL(): Promise<ModelOption[]> {
  // 프로바이더 캐시 갱신
  let provResult = await _providerRepo.search(new Criteria())
  await _ensureBridgeDefaultProviders(provResult.data as LlmProvider[])
  provResult = await _providerRepo.search(new Criteria())
  _providerNameCache.clear()
  _providerCache.clear()
  for (const p of provResult.data as LlmProvider[]) {
    _providerNameCache.set(p.id, p.name)
    _providerCache.set(p.id, p)
  }

  const criteria = new Criteria()
  let modelResult = await _modelRepo.search(criteria)
  await _ensureBridgeDefaultModels(modelResult.data as LlmModel[])
  modelResult = await _modelRepo.search(criteria)
  const dalModels = modelResult.data as LlmModel[]

  // llama-server에서 실제 사용 가능한 로컬 모델 목록 조회
  await _syncLocalModelsFromServer(dalModels)

  // cloud provider에서 실시간 모델 목록 조회 후 DAL 동기화
  await _syncCloudModelsFromProviders(dalModels)

  // 비활성 클라우드 모델 필터링 + TTS/STT 모델 제외
  const filtered = dalModels.filter((m: LlmModel) => {
    if (!m.isActive) return false
    if (m.type === 'tts' || m.type === 'stt') return false
    const prov = _providerCache.get(m.providerId)
    if (!prov) return true
    if (prov.type !== 'local-gguf' && !prov.isActive) return false
    return true
  })

  const mapped = filtered.map((m: LlmModel) => {
    const prov = _providerCache.get(m.providerId)
    const inferred = _inferProviderFromModelId(m.modelId)
    const providerLabel = _providerNameCache.get(m.providerId) ?? prov?.name ?? inferred.provider
    const providerType = prov?.type ?? inferred.providerType
    const modelType = _inferCloudModelType(m.modelId, providerLabel, m.type as ModelOption['type'])
    return {
      id: m.id,
      provider: providerLabel,
      name: m.name,
      modelId: m.modelId,
      type: modelType,
      filePath: m.filePath ?? null,
      description: `${m.modelId} — ${_formatContextLength(m.contextLength)}`,
      providerType,
      // provider 정보가 누락된 경우(예: renderer DAL 캐시 불일치)도
      // 클라우드 모델 선택 자체는 허용하고, 실제 키 검증은 engine에서 수행한다.
      hasApiKey: prov
        ? (prov.type === 'local-gguf' || isUsableApiKey(prov.apiKey))
        : providerType !== 'cloud-api' || inferred.assumeApiKeyPresent,
      isDefault: m.isDefault ?? false,
      contextLength: m.contextLength ?? 4096,
    }
  })

  const withGoogleFallback = await _injectGoogleFallbackModels(mapped)
  const withGitHubFallback = await _injectGitHubFallbackModels(withGoogleFallback)

  try {
    const providerGroups = withGoogleFallback.reduce<Record<string, number>>((acc, m) => {
      acc[m.provider] = (acc[m.provider] ?? 0) + 1
      return acc
    }, {})
    const hasGoogleProvider = Object.keys(providerGroups)
      .some((name) => name.toLowerCase().includes('google') || name.toLowerCase().includes('gemini'))

    const debugPayload = {
      totalModels: withGitHubFallback.length,
      providerGroups,
      providerGroupsEntries: Object.entries(providerGroups),
      hasGoogleProvider,
      googleModels: withGitHubFallback.filter((m) => m.modelId.toLowerCase().startsWith('gemini')).length,
    }

    // DevTools 객체 미리보기는 표시 순서가 달라 보일 수 있어 JSON 문자열로도 함께 출력
    console.info('[llm-model] selector-groups', debugPayload)
    console.info('[llm-model] selector-groups:json', JSON.stringify(debugPayload))
  } catch {
    // noop
  }

  return withGitHubFallback
}

async function _ensureBridgeDefaultProviders(existingProviders: LlmProvider[]): Promise<void> {
  const existingIds = new Set(existingProviders.map((p) => p.id))
  let inserted = 0

  for (const p of DEFAULT_PROVIDERS) {
    if (existingIds.has(p.id)) continue
    try {
      await _providerRepo.save({ ...p } as LlmProvider)
      inserted++
    } catch (err) {
      console.warn('[llm-model] default provider seed failed', p.id, p.name, err)
    }
  }

  if (inserted > 0) {
    console.info('[llm-model] default providers inserted', inserted)
  }
}

async function _ensureBridgeDefaultModels(existingModels: LlmModel[]): Promise<void> {
  const existingIds = new Set(existingModels.map((m) => m.id))
  let inserted = 0

  for (const m of DEFAULT_MODELS) {
    if (existingIds.has(m.id)) continue
    try {
      await _modelRepo.save({ ...m } as LlmModel)
      inserted++
    } catch (err) {
      console.warn('[llm-model] default model seed failed', m.id, m.modelId, err)
    }
  }

  if (inserted > 0) {
    console.info('[llm-model] default models inserted', inserted)
  }
}

async function _injectGoogleFallbackModels(models: ModelOption[]): Promise<ModelOption[]> {
  const hasGoogle = models.some((m) => {
    const p = (m.provider ?? '').toLowerCase()
    return p.includes('google') || p.includes('gemini') || m.modelId.toLowerCase().startsWith('gemini')
  })
  if (hasGoogle) return models

  try {
    // 1) renderer DAL 캐시 우선 사용 (engine 미기동 시 /api/providers 호출로 500 로그 방지)
    const cachedGoogle = [..._providerCache.values()].find((p) => {
      const name = (p.name ?? '').toLowerCase()
      return p.type === 'cloud-api' && p.isActive && (name.includes('google') || name.includes('gemini'))
    })

    // 2) 캐시에 없을 때만 엔진 API 시도
    let googleProvider: { id: string; name?: string; apiKey?: string | null } | null = null
    if (cachedGoogle?.id) {
      googleProvider = { id: cachedGoogle.id, name: cachedGoogle.name, apiKey: cachedGoogle.apiKey }
    } else {
      const engineUp = await _isEngineApiAvailableForCloudSync()
      if (!engineUp) return models

      const provRes = await fetch('/api/providers', { cache: 'no-store' })
      if (!provRes.ok) return models
      const provJson = await provRes.json() as { providers?: Array<{ id: string; name?: string; type?: string; isActive?: boolean; apiKey?: string | null; hasApiKey?: boolean }> }
      const found = (provJson.providers ?? []).find((p) => {
        const name = (p.name ?? '').toLowerCase()
        return p.type === 'cloud-api' && p.isActive && (name.includes('google') || name.includes('gemini'))
      })
      if (!found?.id) return models
      googleProvider = {
        id: found.id,
        name: found.name,
        apiKey: found.hasApiKey ? 'present-via-api' : found.apiKey,
      }
    }

    const googleHasApiKey = isUsableApiKey(googleProvider.apiKey)

    // API 키가 없어도 Google 모델을 selector에 표시한다.
    // hasApiKey: false 로 마킹하여 UI에서 "API 키 설정 필요" 메시지를 보여줌.
    const remoteJson = googleHasApiKey
      ? (() => _isEngineApiAvailableForCloudSync())()
          .then((engineUp) => {
            if (!engineUp) {
              return { models: [] as Array<{ modelId: string; name?: string; capabilities?: string[] }> }
            }
            return fetch(`/api/providers/${googleProvider.id}/remote-models`, { cache: 'no-store' })
              .then(async (remoteRes) => (remoteRes.ok
                ? await remoteRes.json() as { models?: Array<{ modelId: string; name?: string; capabilities?: string[] }> }
                : { models: [] }))
              .catch(() => {
                _engineApiAvailableCache = false
                _engineApiCheckedAt = Date.now()
                return { models: [] as Array<{ modelId: string; name?: string; capabilities?: string[] }> }
              })
          })
      : Promise.resolve({ models: [] as Array<{ modelId: string; name?: string; capabilities?: string[] }> })

    const resolvedRemoteJson = await remoteJson

    const existingModelIds = new Set(models.map((m) => m.modelId))
    const fallbacks: ModelOption[] = []
    for (const rm of resolvedRemoteJson.models ?? []) {
      const mid = (rm.modelId ?? '').trim()
      if (!mid || existingModelIds.has(mid)) continue
      const caps = (rm.capabilities ?? []).map((c) => c.toLowerCase())
      if (caps.length > 0 && !caps.some((c) => c.includes('generatecontent') || c.includes('streamgeneratecontent'))) {
        continue
      }

      const lowerMid = mid.toLowerCase()
      const inferredType: ModelOption['type'] = lowerMid.includes('embedding')
        ? 'embedding'
        : (lowerMid.includes('tts') || lowerMid.includes('speech') || lowerMid.includes('audio'))
          ? 'chat'
          : 'multimodal'

      fallbacks.push({
        id: `fallback-google-${mid}`,
        provider: googleProvider.name ?? 'Google AI (Gemini)',
        name: rm.name?.trim() || mid,
        modelId: mid,
        type: inferredType,
        filePath: null,
        description: `${mid} — ${_formatContextLength(1_048_576)}`,
        providerType: 'cloud-api',
        hasApiKey: googleHasApiKey,
        isDefault: false,
        contextLength: 1_048_576,
      })
    }

    // API 키가 없는 상태에서만 안전 기본 모델을 주입한다.
    // (API 키가 있는데 remote 목록이 비어 있을 경우, 잘못된 기본 ID 주입으로
    //  "model not found"를 유발할 수 있으므로 주입하지 않는다.)
    if (fallbacks.length === 0 && !googleHasApiKey) {
      const conservativeDefaults = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      ]

      for (const d of conservativeDefaults) {
        if (existingModelIds.has(d.id)) continue
        fallbacks.push({
          id: `fallback-google-${d.id}`,
          provider: googleProvider.name ?? 'Google AI (Gemini)',
          name: d.name,
          modelId: d.id,
          type: 'multimodal',
          filePath: null,
          description: `${d.id} — ${_formatContextLength(1_048_576)}`,
          providerType: 'cloud-api',
          hasApiKey: googleHasApiKey,
          isDefault: false,
          contextLength: 1_048_576,
        })
      }
    }

    if (fallbacks.length > 0) {
      console.info('[llm-model] injected google fallback models', fallbacks.length)
      return [...models, ...fallbacks]
    }
  } catch {
    // noop
  }

  return models
}

/** GitHub Copilot Models provider의 기본 모델을 항상 selector에 표시한다. */
async function _injectGitHubFallbackModels(models: ModelOption[]): Promise<ModelOption[]> {
  try {
    const hasGitHubFromModels = models.some((m) => {
      const p = (m.provider ?? '').toLowerCase()
      return p.includes('github') || p.includes('copilot')
    })

    const cachedGitHub = [..._providerCache.values()].find((p) => {
      const name = (p.name ?? '').toLowerCase()
      return p.type === 'cloud-api' && p.isActive && (name.includes('github') || name.includes('copilot'))
    })

    // GitHub provider가 DAL에 없고, 기존 모델 목록에도 GitHub 라벨이 없으면 주입하지 않음
    if (!cachedGitHub?.id && !hasGitHubFromModels) return models

    const githubProviderLabel = cachedGitHub?.name
      ?? models.find((m) => {
        const p = (m.provider ?? '').toLowerCase()
        return p.includes('github') || p.includes('copilot')
      })?.provider
      ?? 'GitHub Copilot (Models)'

    const githubHasApiKey = cachedGitHub
      ? isUsableApiKey(cachedGitHub.apiKey)
      : models.some((m) => {
          const p = (m.provider ?? '').toLowerCase()
          return (p.includes('github') || p.includes('copilot')) && !!m.hasApiKey
        })

    const existingModelIds = new Set(models.map((m) => m.modelId))

    const conservativeDefaults: Array<{ id: string; name: string }> = [
      { id: 'openai/gpt-4o', name: 'GPT-4o (Copilot)' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1 (Copilot)' },
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini (Copilot)' },
      { id: 'openai/o3-mini', name: 'o3-mini (Copilot)' },
      { id: 'openai/o4-mini', name: 'o4-mini (Copilot)' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Copilot)' },
      { id: 'meta/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B (Copilot)' },
    ]

    const fallbacks: ModelOption[] = []
    for (const d of conservativeDefaults) {
      if (existingModelIds.has(d.id)) continue
      fallbacks.push({
        id: `fallback-github-${d.id}`,
        provider: githubProviderLabel,
        name: d.name,
        modelId: d.id,
        type: 'multimodal',
        filePath: null,
        description: `${d.id} — GitHub Models`,
        providerType: 'cloud-api',
        hasApiKey: githubHasApiKey,
        isDefault: false,
        contextLength: 128_000,
      })
    }

    if (fallbacks.length > 0) {
      console.info('[llm-model] injected github fallback models', fallbacks.length)
      return [...models, ...fallbacks]
    }
  } catch {
    // noop
  }

  return models
}

// ── 내부 헬퍼 ────────────────────────────────────────────

/** llama-server /v1/models에서 실제 로드된 모델과 DAL 동기화 */
async function _syncLocalModelsFromServer(dalModels: LlmModel[]): Promise<void> {
  try {
    const res = await fetch('/llm/v1/models')
    if (!res.ok) return
    const data = await res.json()
    const serverModelIds = new Set<string>(
      (data.data ?? []).map((m: { id: string }) => m.id),
    )

    const localProviderId = [..._providerNameCache.entries()]
      .find(([, name]) => name.toLowerCase().includes('local') || name.toLowerCase().includes('llama'))?.[0]

    if (!localProviderId || serverModelIds.size === 0) return

    const existingModelIds = new Set(dalModels.map((m) => m.modelId))
    const _autoRegisterBlocklist = [/gemma-3-4b/i, /gemma-3-1b/i]

    // 서버에는 있지만 DB에 없는 모델 자동 등록
    for (const modelId of serverModelIds) {
      if (_autoRegisterBlocklist.some((rx) => rx.test(modelId))) {
        console.log(`[llm-model] Skipped blocked model: ${modelId}`)
        continue
      }
      if (!existingModelIds.has(modelId)) {
        const inferredType = _inferLocalModelType(modelId)
        const newModel: Partial<LlmModel> = {
          id: crypto.randomUUID(),
          providerId: localProviderId,
          name: modelId.replace(/\.gguf$/i, '').replace(/[-_]/g, ' '),
          modelId,
          type: inferredType,
          contextLength: 4096,
          isActive: true,
          filePath: modelId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await _modelRepo.save(newModel as LlmModel).catch(() => {})
        dalModels.push(newModel as LlmModel)
        console.log(`[llm-model] Auto-registered local model: ${modelId} (type=${inferredType})`)
      }
    }

    // 기존 로컬 모델의 타입 보정 (chat 고정 오분류 방지)
    for (const m of dalModels) {
      if (m.providerId !== localProviderId) continue
      const inferredType = _inferLocalModelType(m.modelId)
      if (m.type !== inferredType) {
        m.type = inferredType
        await _modelRepo.save({ ...m, type: inferredType, updatedAt: new Date().toISOString() } as LlmModel).catch(() => {})
        console.log(`[llm-model] Updated local model type: ${m.modelId} -> ${inferredType}`)
      }
    }

    // DB에 있지만 서버에 없는 로컬 모델 비활성화
    for (const m of dalModels) {
      if (m.providerId === localProviderId && !serverModelIds.has(m.modelId) && m.isActive) {
        m.isActive = false
        await _modelRepo.save({ ...m, isActive: false, updatedAt: new Date().toISOString() } as LlmModel).catch(() => {})
        console.log(`[llm-model] Deactivated stale local model: ${m.modelId}`)
      }
    }
  } catch {
    // llama-server 미실행 시 무시
  }
}

/** cloud provider 실시간 모델 목록과 DAL 동기화 (Gemini/OpenAI/Copilot 등) */
async function _syncCloudModelsFromProviders(dalModels: LlmModel[]): Promise<void> {
  const cloudProviders = [..._providerCache.values()]
    .filter((p) => p.type === 'cloud-api' && p.isActive && isUsableApiKey(p.apiKey))

  if (cloudProviders.length === 0) return

  const canUseEngineApi = await _isEngineApiAvailableForCloudSync()
  if (!canUseEngineApi) return

  for (const provider of cloudProviders) {
    try {
      const res = await fetch(`/api/providers/${provider.id}/remote-models`, {
        cache: 'no-store',
      })
      if (!res.ok) continue

      const data = await res.json() as {
        models?: Array<{
          modelId: string
          name?: string
          description?: string
          capabilities?: string[]
        }>
      }

      const rawRemoteModels = (data.models ?? []).filter((m) => !!m.modelId)
      if (rawRemoteModels.length === 0) continue

      const providerName = (provider.name ?? '').toLowerCase()
      const isGoogle = providerName.includes('google') || providerName.includes('gemini')

      // Gemini는 generation 가능 모델만 chat 모델로 채택
      const remoteModels = rawRemoteModels.filter((m) => {
        if (!isGoogle) return true
        const caps = (m.capabilities ?? []).map((c) => c.toLowerCase())
        if (caps.length === 0) return true
        return caps.some((c) => c.includes('generatecontent') || c.includes('streamgeneratecontent'))
      })

      if (remoteModels.length === 0) continue

      const providerModels = dalModels.filter((m) => m.providerId === provider.id)
      const modelById = new Map(providerModels.map((m) => [m.modelId, m]))
      const remoteIds = new Set(remoteModels.map((m) => m.modelId))

      // 신규 모델 추가 + 기존 모델 활성화/이름 보정
      for (const r of remoteModels) {
        const existing = modelById.get(r.modelId)
        if (existing) {
          const nextName = r.name?.trim() || existing.name
          const shouldUpdate = !existing.isActive || existing.name !== nextName
          if (shouldUpdate) {
            const updated = {
              ...existing,
              name: nextName,
              isActive: true,
              updatedAt: new Date().toISOString(),
            } as LlmModel
            await _modelRepo.save(updated).catch(() => {})
            Object.assign(existing, updated)
          }
          continue
        }

        const inferredCtx = isGoogle ? 1_048_576 : 128_000
        const inferredType = _inferCloudModelType(r.modelId, provider.name ?? '', 'chat')
        const created = {
          id: crypto.randomUUID(),
          providerId: provider.id,
          name: (r.name?.trim() || r.modelId),
          modelId: r.modelId,
          type: inferredType,
          contextLength: inferredCtx,
          isActive: true,
          isDefault: false,
          isDownloaded: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as LlmModel
        await _modelRepo.save(created).catch(() => {})
        dalModels.push(created)
      }

      // 원격 목록에 없는 기존 cloud chat 모델은 비활성화 (stale 정리)
      for (const m of providerModels) {
        if (m.type !== 'chat') continue
        if (!m.isActive) continue
        if (remoteIds.has(m.modelId)) continue
        m.isActive = false
        await _modelRepo.save({
          ...m,
          isActive: false,
          updatedAt: new Date().toISOString(),
        } as LlmModel).catch(() => {})
      }
    } catch {
      // Engine API 미실행/네트워크 오류 시 무시
      _engineApiAvailableCache = false
      _engineApiCheckedAt = Date.now()
    }
  }
}

/** Engine API(/api) 연결 가능 여부 확인 (30초 캐시) */
async function _isEngineApiAvailableForCloudSync(): Promise<boolean> {
  const now = Date.now()
  if (_engineApiAvailableCache !== null && now - _engineApiCheckedAt < 60_000) {
    return _engineApiAvailableCache
  }

  // 최근 실패 상태는 더 오래 캐시하여 proxy 500 스팸을 줄인다.
  if (_engineApiAvailableCache === false && now - _engineApiCheckedAt < 5 * 60_000) {
    return false
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1200)
    const res = await fetch('/api/health', {
      method: 'GET',
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    _engineApiAvailableCache = res.ok
  } catch {
    _engineApiAvailableCache = false
  }

  _engineApiCheckedAt = now
  return _engineApiAvailableCache
}

function _formatContextLength(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M ctx`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K ctx`
  return `${tokens} ctx`
}

function _inferProviderFromModelId(modelId: string): {
  provider: string
  providerType: string
  assumeApiKeyPresent: boolean
} {
  const id = (modelId ?? '').toLowerCase()
  if (id.startsWith('gemini') || id.startsWith('gemma')) {
    return {
      provider: 'Google AI (Gemini)',
      providerType: 'cloud-api',
      assumeApiKeyPresent: true,
    }
  }
  if (id.startsWith('claude')) {
    return {
      provider: 'Anthropic',
      providerType: 'cloud-api',
      assumeApiKeyPresent: true,
    }
  }
  if (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3')) {
    return {
      provider: 'OpenAI',
      providerType: 'cloud-api',
      assumeApiKeyPresent: true,
    }
  }
  return {
    provider: 'Unknown',
    providerType: 'unknown',
    assumeApiKeyPresent: true,
  }
}

function _inferLocalModelType(modelId: string): ModelOption['type'] {
  const id = modelId.toLowerCase()

  // 멀티모달/비전 계열 휴리스틱
  if (
    /\b(vl|vision|multimodal|llava)\b/.test(id)
    || id.includes('gemma-4')
    || id.includes('qwen2.5-vl')
    || id.includes('qwen-vl')
  ) {
    return 'multimodal'
  }

  return 'chat'
}

function _inferCloudModelType(
  modelId: string,
  providerName: string,
  fallbackType: ModelOption['type'],
): ModelOption['type'] {
  const id = (modelId ?? '').toLowerCase()
  const provider = (providerName ?? '').toLowerCase()

  if (id.includes('embedding') || id.includes('text-embedding')) return 'embedding'

  // 범용 멀티모달 추론: gemini / claude / gpt-4o / o1 / o3 / vision 계열
  if (
    id.startsWith('gemini')
    || id.startsWith('claude')
    || id.startsWith('gpt-4o')
    || id.startsWith('o1')
    || id.startsWith('o3')
    || id.includes('vision')
    || id.includes('multimodal')
    || provider.includes('google')
    || provider.includes('gemini')
    || provider.includes('anthropic')
    || provider.includes('claude')
  ) {
    return 'multimodal'
  }

  return fallbackType
}
