/**
 * Chat Store
 *
 * 채팅 UI 상태 관리 전용 (thin orchestrator).
 * 실제 LLM 호출, 모델 관리, 첨부 파싱, 대화 영속화는 service 레이어에 위임.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { i18n } from '../init/i18n'

// ── Services ─────────────────────────────────────────────
import {
  streamChat,
  generateChat,
  isModelLoadedOnServer,
  warmupModelOnServer,
} from '../service/ai-client.service'
import { createModelWarmupRegistry } from '../service/model-warmup-registry'
import { loadModelsFromDAL } from '../service/llm-model.service'
import {
  isImageAttachment,
  toImageDataUrl,
  buildAttachmentTextBlock,
} from '../service/attachment-parser.service'
import {
  loadConversationsFromDAL,
  saveConversation,
  updateConversation,
  deleteConversation as dalDeleteConversation,
  persistMessage,
  rateMessage as dalRateMessage,
} from '../service/conversation.service'

import { useNotificationStore } from './notification.store'
import { useAgentStore } from './agent.store'
import { isDefaultConversationTitle } from '../service/chat-title-policy'

/** Type-safe i18n shortcut */
const $t = (key: string, params?: Record<string, unknown>): string =>
  (i18n.global as any).t(key, params ?? {}) as string

// ── 타입 (re-export for consumers) ──────────────────────

export interface TodoItem {
  id: string
  title: string
  status: 'not-started' | 'in-progress' | 'completed'
}

export interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
  dataUrl?: string
}

export interface ActionButton {
  id: string
  label: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  action: string
  payload?: Record<string, unknown>
}

export interface ToolCallEvent {
  id: string
  name: string
  status: 'running' | 'success' | 'error'
  input?: Record<string, unknown>
  output?: unknown
  error?: string
  startedAt: string
  endedAt?: string
  durationMs?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
  isStreaming?: boolean
  streamingStatus?: 'connecting' | 'thinking' | 'generating'
  thinking?: string
  todos?: TodoItem[]
  attachments?: AttachedFile[]
  actionButtons?: ActionButton[]
  rating?: number | null
  modelName?: string | null
  systemType?: 'info' | 'warning' | 'error' | 'success' | 'loading'
  /** #3 Hidden Message Policy — true이면 UI에 렌더링하지 않음 */
  hidden?: boolean
  /** #6 Tool Call Card — LangGraph 노드/도구 호출 이벤트 */
  toolEvents?: ToolCallEvent[]
  /** Arbitrary metadata (nodeMetadata, etc.) */
  metadata?: Record<string, unknown> | null
}

export interface ModelOption {
  id: string
  provider: string
  name: string
  modelId: string
  type: 'chat' | 'vision' | 'embedding' | 'multimodal'
  filePath: string | null
  description: string
  providerType: string
  hasApiKey: boolean
  isDefault: boolean
  contextLength: number
}

export interface ConversationMeta {
  /** 아티팩트 참조 목록 (코드, 이미지, 문서 등) */
  artifacts?: Array<{ id: string; type: string; title?: string; messageId: string }>
  /** 워크플로우 ID 연결 */
  workflowId?: string
  /** 태그 */
  tags?: string[]
  /** 기타 확장 */
  [key: string]: unknown
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  modelId: string
  createdAt: string
  updatedAt: string
  /** #11 Artifact Meta — 대화 수준 메타데이터 */
  meta?: ConversationMeta | null
  /** #5 Time Travel/Fork — 분기 원본 대화 ID */
  parentId?: string | null
  /** #5 Time Travel/Fork — 분기 기준 메시지 ID */
  forkFromMessageId?: string | null
}

// ── Store ────────────────────────────────────────────────

export const useChatStore = defineStore('chat', () => {
  const PREFERRED_DEFAULT_LOCAL_MODEL_ID = 'gemma-4-E4B-it-UD-Q4_K_XL'
  const conversations = ref<Conversation[]>([])
  const currentConversationId = ref<string | null>(null)
  const selectedModelId = ref<string>('')
  const pendingAttachments = ref<AttachedFile[]>([])
  const models = ref<ModelOption[]>([])
  const modelById = ref<Map<string, ModelOption>>(new Map())
  const conversationById = ref<Map<string, Conversation>>(new Map())
  const connectionWarning = ref<string | null>(null)
  const _isStreaming = ref(false)

  function rebuildModelIndex(): void {
    const next = new Map<string, ModelOption>()
    for (const m of models.value) next.set(m.id, m)
    modelById.value = next
  }

  function rebuildConversationIndex(): void {
    const next = new Map<string, Conversation>()
    for (const c of conversations.value) next.set(c.id, c)
    conversationById.value = next
  }

  let _abortController: AbortController | null = null
  let _isUserAbortRequested = false

  // ── 스트림 이벤트 콜백 (TTS 연동용) ────────────────
  type StreamDeltaCb = (delta: string, messageId: string) => void
  type StreamEndCb = (messageId: string) => void
  const streamDeltaCallbacks: StreamDeltaCb[] = []
  const streamEndCallbacks: StreamEndCb[] = []

  const _warmupRegistry = createModelWarmupRegistry()
  let _keepAliveTimer: ReturnType<typeof setInterval> | null = null
  let _cloudModelRefreshTimer1: ReturnType<typeof setTimeout> | null = null
  let _cloudModelRefreshTimer2: ReturnType<typeof setTimeout> | null = null

  function onStreamDelta(cb: StreamDeltaCb): () => void {
    streamDeltaCallbacks.push(cb)
    return () => { const i = streamDeltaCallbacks.indexOf(cb); if (i >= 0) streamDeltaCallbacks.splice(i, 1) }
  }
  function onStreamEnd(cb: StreamEndCb): () => void {
    streamEndCallbacks.push(cb)
    return () => { const i = streamEndCallbacks.indexOf(cb); if (i >= 0) streamEndCallbacks.splice(i, 1) }
  }

  // ── Computed ───────────────────────────────────────
  const currentConversation = computed(() =>
    (currentConversationId.value ? (conversationById.value.get(currentConversationId.value) ?? null) : null),
  )
  const currentMessages = computed((): ChatMessage[] =>
    (currentConversation.value?.messages ?? []).filter((m) => !m.hidden),
  )
  const isStreaming = computed(() => _isStreaming.value)
  const availableModels = computed(() => models.value)

  const selectedModel = computed(() =>
    modelById.value.get(selectedModelId.value)
      ?? models.value[0]
      ?? { id: '', provider: '', name: 'No Model', description: '', modelId: '', type: 'chat' as const, filePath: null, providerType: 'unknown', hasApiKey: false, isDefault: false, contextLength: 4096 },
  )

  const modelsByProvider = computed(() => {
    const groups: Record<string, ModelOption[]> = {}
    for (const m of models.value) {
      if (!groups[m.provider]) groups[m.provider] = []
      groups[m.provider].push(m)
    }

    const orderedEntries = Object.entries(groups).sort(([providerA, listA], [providerB, listB]) => {
      const aIsLocal = listA.some((m) => m.providerType === 'local-gguf')
      const bIsLocal = listB.some((m) => m.providerType === 'local-gguf')
      if (aIsLocal !== bIsLocal) return aIsLocal ? -1 : 1

      const aLooksLocal = providerA.toLowerCase().includes('local') || providerA.toLowerCase().includes('llama')
      const bLooksLocal = providerB.toLowerCase().includes('local') || providerB.toLowerCase().includes('llama')
      if (aLooksLocal !== bLooksLocal) return aLooksLocal ? -1 : 1

      return providerA.localeCompare(providerB)
    })

    return Object.fromEntries(orderedEntries)
  })

  // ── Model Warmup ───────────────────────────────────

  async function warmupModel(modelEntityId: string, timeoutMs = 35_000): Promise<boolean> {
    const model = modelById.value.get(modelEntityId)
    if (!model?.modelId || model.providerType !== 'local-gguf') return false
    return _warmupRegistry.run(model.modelId, async () => {
      const ok = await warmupModelOnServer(model.modelId, timeoutMs)
      return ok
    })
  }

  function startLocalModelKeepAlive(): void {
    if (_keepAliveTimer) return
    console.log('[chat:keepalive] started')
    _keepAliveTimer = setInterval(async () => {
      if (_isStreaming.value) return
      const model = selectedModel.value
      if (!model || model.providerType !== 'local-gguf' || !model.modelId) return
      const loaded = await isModelLoadedOnServer(model.modelId)
      if (!loaded) await warmupModel(model.id, 60_000)
    }, 45_000)
  }

  // ── Load Models ────────────────────────────────────

  async function loadModels(): Promise<void> {
    models.value = await loadModelsFromDAL()
    rebuildModelIndex()

    try {
      const { useUserContextStore } = await import('./user-context.store')
      const userCtx = useUserContextStore()
      if (!userCtx.isInitialized) userCtx.initialize()
      const savedModelId = userCtx.settings.selectedModelId
      const savedModel = savedModelId ? modelById.value.get(savedModelId) : undefined
      const isSavedModelUsable = !!savedModel
        && (savedModel.providerType !== 'cloud-api' || savedModel.hasApiKey)

      if (savedModelId && isSavedModelUsable) {
        selectedModelId.value = savedModelId
        warmupModel(selectedModelId.value)
        startLocalModelKeepAlive()
        return
      }
    } catch { /* user-context not ready */ }

    const currentModel = selectedModelId.value ? modelById.value.get(selectedModelId.value) : undefined
    const isCurrentModelUsable = !!currentModel
      && (currentModel.providerType !== 'cloud-api' || currentModel.hasApiKey)

    if (!isCurrentModelUsable) {
      const preferredLocal = models.value.find((m) => m.modelId === PREFERRED_DEFAULT_LOCAL_MODEL_ID)
      const defaultModel = models.value.find((m) => m.isDefault)
      selectedModelId.value = preferredLocal?.id ?? defaultModel?.id ?? models.value[0]?.id ?? ''
    }
    if (selectedModelId.value) {
      void import('./user-context.store').then(({ useUserContextStore }) => {
        useUserContextStore().updateSettings({ selectedModelId: selectedModelId.value })
      }).catch(() => {})
      warmupModel(selectedModelId.value, 90_000)
    }
    startLocalModelKeepAlive()
  }

  function scheduleDynamicCloudModelRefresh(): void {
    if (_cloudModelRefreshTimer1 || _cloudModelRefreshTimer2) return

    // 앱 시작 직후 엔진 기동 지연을 고려해 2회 재동기화
    _cloudModelRefreshTimer1 = setTimeout(() => {
      void loadModels()
    }, 15_000)

    _cloudModelRefreshTimer2 = setTimeout(() => {
      void loadModels()
    }, 60_000)
  }

  loadModels()
  scheduleDynamicCloudModelRefresh()

  // ── Load Conversations ─────────────────────────────

  const _conversationsLoaded = (async () => {
    try {
      const restored = await loadConversationsFromDAL($t('cmh-global.chat.newChat'), selectedModelId.value)
      conversations.value = restored
      rebuildConversationIndex()
      if (restored.length > 0 && !currentConversationId.value) {
        currentConversationId.value = restored[0].id
      }
    } catch (e) {
      console.warn('[chat] Failed to load conversations from DAL:', e)
    }
  })()

  // ── Conversation Actions ───────────────────────────

  function createConversation(title = ''): Conversation {
    const existingEmpty = conversations.value.find(
      (c) => c.messages.filter((m) => m.role === 'user').length === 0,
    )
    if (existingEmpty && !title) {
      currentConversationId.value = existingEmpty.id
      return existingEmpty
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id, title: title || $t('cmh-global.chat.newChat'), messages: [],
      modelId: selectedModelId.value, createdAt: now, updatedAt: now,
    }
    conversations.value.unshift(conversation)
    rebuildConversationIndex()
    currentConversationId.value = conversation.id
    saveConversation({ id, title: conversation.title, modelId: selectedModelId.value })
    return conversation
  }

  function selectConversation(id: string): void { currentConversationId.value = id }

  function selectModel(modelId: string): void {
    selectedModelId.value = modelId
    import('./user-context.store').then(({ useUserContextStore }) => {
      useUserContextStore().updateSettings({ selectedModelId: modelId })
    }).catch(() => {})
    void warmupModelWithIndicator(modelId, 90_000)
    startLocalModelKeepAlive()
  }

  async function warmupModelWithIndicator(modelEntityId: string, timeoutMs = 90_000): Promise<boolean> {
    const model = modelById.value.get(modelEntityId)
    if (!model?.modelId || model.providerType !== 'local-gguf') return warmupModel(modelEntityId, timeoutMs)

    let loadingMsgId = ''
    if (currentConversation.value) {
      loadingMsgId = addSystemMessage(
        ($t('cmh-global.chat.localModelLoading', { model: model.name }) as string)
          || `${model.name} 모델 로딩 중...`,
        'loading',
      )
    }

    try {
      return await warmupModel(modelEntityId, timeoutMs)
    } finally {
      if (loadingMsgId) removeSystemMessage(loadingMsgId)
    }
  }

  function renameConversation(id: string, newTitle: string): void {
    const conv = conversationById.value.get(id)
    if (!conv) return
    conv.title = newTitle
    conv.updatedAt = new Date().toISOString()
    updateConversation(id, { title: newTitle })
  }

  function deleteConversation(id: string): void {
    conversations.value = conversations.value.filter((c) => c.id !== id)
    rebuildConversationIndex()
    if (currentConversationId.value === id) {
      currentConversationId.value = conversations.value[0]?.id ?? null
    }
    dalDeleteConversation(id)
  }

  /** #5 Time Travel/Fork — 지정 메시지 시점에서 대화를 분기 (새 대화 생성) */
  function forkConversation(convId: string, fromMessageId: string): Conversation | null {
    const source = conversationById.value.get(convId)
    if (!source) return null

    const msgIdx = source.messages.findIndex((m) => m.id === fromMessageId)
    if (msgIdx < 0) return null

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    // fromMessageId 포함하여 해당 메시지까지의 히스토리를 깊은 복사
    const forkedMessages: ChatMessage[] = source.messages
      .slice(0, msgIdx + 1)
      .map((m) => ({ ...m, id: crypto.randomUUID(), createdAt: m.createdAt }))

    const forked: Conversation = {
      id,
      title: `${source.title} (fork)`,
      messages: forkedMessages,
      modelId: source.modelId,
      createdAt: now,
      updatedAt: now,
      parentId: convId,
      forkFromMessageId: fromMessageId,
    }

    conversations.value.unshift(forked)
    rebuildConversationIndex()
    currentConversationId.value = forked.id
    saveConversation({ id, title: forked.title, modelId: forked.modelId })
    for (const msg of forkedMessages) {
      persistMessage(id, msg)
    }
    return forked
  }

  // ── Attachments ────────────────────────────────────

  function addPendingAttachment(file: AttachedFile): void { pendingAttachments.value.push(file) }
  function removePendingAttachment(id: string): void { pendingAttachments.value = pendingAttachments.value.filter((f) => f.id !== id) }
  function clearPendingAttachments(): void { pendingAttachments.value = [] }

  // ── Prompt Helpers ─────────────────────────────────

  const DEFAULT_SYSTEM_PROMPT =
    'You are a helpful AI assistant. '
    + 'Users may rate your responses using a "dissatisfaction score" (불만족 점수): '
    + 'a reverse score where 0 = satisfied, 100 = completely dissatisfied. '
    + 'This is NOT a positive star rating — higher means the response deviated more from user intent. '
    + 'If a user mentions dissatisfaction or rating, understand this context.'

  function _getSystemPrompt(): string {
    try {
      const agentStore = useAgentStore()
      const agentId = agentStore.selectedAgentId
      if (agentId) {
        const agent = agentStore.agents.find((a: { id: string }) => a.id === agentId)
        if (agent?.systemPrompt) return agent.systemPrompt
      }
    } catch { /* agent store not ready */ }
    return DEFAULT_SYSTEM_PROMPT
  }

  function _isSimpleQuestion(input: string): boolean {
    const text = input.trim().toLowerCase()
    if (!text) return true
    const complexKeywords = [
      '비교', '분석', '설계', '구현', '최적화', '리팩터', '디버그',
      '단계별', '근거', '원인', '전략', '아키텍처', '코드', '테스트',
      'compare', 'analyze', 'design', 'implement', 'optimize', 'debug',
      'step', 'reason', 'architecture', 'code', 'test',
    ]
    if (complexKeywords.some((k) => text.includes(k))) return false
    if (/(그리고|또한|각각|조건|and|also|each|with)/i.test(text)) return false
    if (/\x60\x60\x60|function|class|const|let|var|import|export/i.test(text)) return false
    return true
  }

  function _wantsLongAnswer(input: string): boolean {
    return /(자세히|상세히|길게|예시|근거|단계별|풀어서|설명해|비교해|analyze|detailed|in detail|step by step|with examples|explain)/i.test(input.trim().toLowerCase())
  }

  function _isSyntheticAssistantError(content: string | undefined | null): boolean {
    const t = (content ?? '').trim().toLowerCase()
    if (!t) return false
    return t.startsWith('⚠️') || t.includes('failed to fetch') || t.includes('connection failed')
      || t.includes('응답 시간 초과') || t.includes('연결 실패')
  }

  // ── Send Message ───────────────────────────────────

  async function sendMessage(text: string): Promise<void> {
    // 중복 전송 방지 — 스트리밍 중에는 새 메시지 전송 금지
    if (_isStreaming.value) {
      console.warn('[chat] sendMessage blocked — already streaming')
      return
    }
    const reqId = crypto.randomUUID().slice(0, 8)
    const tStart = performance.now()
    let tFirstDelta = 0, maxDeltaGap = 0, prevDeltaAt = 0

    const activeModel = modelById.value.get(selectedModelId.value)
      ?? models.value.find((m) => m.isDefault)
      ?? models.value[0]

    if (!activeModel) {
      useNotificationStore().createNotification({
        variant: 'warning',
        title: $t('cmh-global.chat.noModelSelected'),
        message: $t('cmh-global.chat.noModelSelectedMessage'),
      })
      return
    }

    if (selectedModelId.value !== activeModel.id) {
      console.warn('[chat:%s] selectedModelId mismatch: requested=%s resolved=%s', reqId, selectedModelId.value, activeModel.id)
      selectedModelId.value = activeModel.id
      import('./user-context.store').then(({ useUserContextStore }) => {
        useUserContextStore().updateSettings({ selectedModelId: activeModel.id })
      }).catch(() => {})
    }

    console.log(
      '[chat:%s] ▶ START text=%s model=%s rawModel=%s name=%s providerType=%s type=%s',
      reqId,
      text.slice(0, 50),
      activeModel.id,
      activeModel.modelId,
      activeModel.name,
      activeModel.providerType,
      activeModel.type,
    )

    if (!currentConversation.value) createConversation()
    const conv = currentConversation.value!

    const attachments = [...pendingAttachments.value]
    console.log('[chat:%s] 📎 pendingAttachments=%d items=%s', reqId, attachments.length, attachments.map(a => `${a.name}(${a.type},dataUrl=${(a.dataUrl ?? '').length}chars)`).join(', '))
    const imageAttachments = attachments.filter((a) => isImageAttachment(a))
    const hasImages = imageAttachments.length > 0
    const modelType = activeModel.type

    // ── 유저 메시지를 즉시 push (모델 검증 전) ──────────────
    clearPendingAttachments()
    conv.messages.push({
      id: crypto.randomUUID(), role: 'user', content: text,
      createdAt: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments : undefined,
    })
    const userMsg = conv.messages[conv.messages.length - 1]

    const userMsgCount = conv.messages.filter((m) => m.role === 'user').length
    const isFirstMessage = userMsgCount === 1

    // 비전 미지원 + 이미지 → 경고 후 텍스트 폴백
    if (hasImages && modelType !== 'vision' && modelType !== 'multimodal') {
      useNotificationStore().createNotification({
        variant: 'warning',
        title: $t('cmh-global.chat.visionNotSupported'),
        message: $t('cmh-global.chat.visionNotSupportedMessage', { model: activeModel.name }) as string,
      })
    }

    connectionWarning.value = null
    const targetModelId = activeModel.modelId
    if (!targetModelId) {
      useNotificationStore().createNotification({
        variant: 'warning', title: $t('cmh-global.chat.noModelSelected'),
        message: $t('cmh-global.chat.noModelSelectedMessage'),
      })
      return
    }

    if (activeModel.providerType === 'cloud-api' && !activeModel.hasApiKey) {
      const msg = '클라우드 모델 API 키가 설정되지 않았거나 mock 키입니다. Provider 설정에서 실제 키를 입력하세요.'
      useNotificationStore().createNotification({
        variant: 'error',
        title: $t('cmh-global.chat.connectionFailed'),
        message: msg,
      })
      connectionWarning.value = `⚠️ ${msg}`
      return
    }

    // 로컬 모델 사전 점검
    let isModelResident = activeModel.providerType !== 'local-gguf'
    if (activeModel.providerType === 'local-gguf') {
      if (_warmupRegistry.isWarmed(targetModelId)) {
        isModelResident = true
      } else {
        isModelResident = await isModelLoadedOnServer(targetModelId)
      }
      if (!isModelResident) {
        isModelResident = await warmupModelWithIndicator(activeModel.id, 90_000)
        if (!isModelResident) {
          useNotificationStore().createNotification({
            variant: 'error',
            title: $t('cmh-global.chat.connectionFailed'),
            message: '로컬 모델 준비에 실패했습니다. llama-server(8080) 상태와 모델 파일을 확인하세요.',
          })
          return
        }
      }
    }

    const isSimple = _isSimpleQuestion(text)
    const useFastMode = hasImages ? false : isSimple
    const isOcrRequest = hasImages && /(텍스트\s*추출|문자\s*추출|ocr|extract\s*text|read\s*text)/i.test(text)

    // ── 유저 메시지 구성 (첨부 포함) ──────────────
    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = text
    const canSendImages = hasImages && (modelType === 'vision' || modelType === 'multimodal')
    // canSendImages일 때만 이미지 건너뜀 (멀티파트로 보내니까), 아니면 텍스트 설명 포함
    const attachmentTextBlock = buildAttachmentTextBlock(attachments, { skipImages: canSendImages })
    console.log('[chat:%s] 📎 attachmentTextBlock=%d chars, canSendImages=%s, modelType=%s', reqId, attachmentTextBlock.length, canSendImages, modelType)
    if (canSendImages) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []
      for (const a of imageAttachments) {
        const url = toImageDataUrl(a)
        if (url) parts.push({ type: 'image_url', image_url: { url } })
      }
      const textPart = attachmentTextBlock ? text + '\n\n' + attachmentTextBlock : text
      parts.push({ type: 'text', text: textPart })
      if (parts.length > 1) userContent = parts
    } else if (attachmentTextBlock) {
      userContent = text + '\n\n' + attachmentTextBlock
    }

    // assistant placeholder
    conv.messages.push({
      id: crypto.randomUUID(), role: 'assistant', content: '',
      createdAt: new Date().toISOString(), isStreaming: true,
      streamingStatus: isModelResident ? 'generating' : 'connecting',
      modelName: activeModel.name,
    })
    const assistantMsg = conv.messages[conv.messages.length - 1]
    const assistantMsgId = assistantMsg.id

    // API 메시지 배열
    const historyMessages = conv.messages
      .filter((m) => m.id !== assistantMsgId)
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && !!m.content?.trim() && !_isSyntheticAssistantError(m.content)))
    const trimmedHistory = historyMessages.slice(-(isSimple ? 6 : 16))
    const apiMessages = trimmedHistory.map((m) => ({
      role: m.role,
      content: m.id === userMsg.id ? userContent : m.content,
    }))

    // 디버그: API에 실제로 전달되는 마지막 메시지 확인
    const lastApiMsg = apiMessages[apiMessages.length - 1]
    console.log('[chat:%s] 📎 apiMessages=%d lastMsg.role=%s lastMsg.contentType=%s contentPreview=%s',
      reqId, apiMessages.length, lastApiMsg?.role,
      typeof lastApiMsg?.content === 'string' ? 'string' : 'multipart',
      typeof lastApiMsg?.content === 'string' ? lastApiMsg.content.slice(0, 200) : JSON.stringify(lastApiMsg?.content).slice(0, 300),
    )

    _isStreaming.value = true
    _isUserAbortRequested = false
    _abortController = new AbortController()

    // 스트림 무한 대기 방지 타임아웃
    const isCloudProvider = activeModel.providerType === 'cloud-api'
    const isMultimodal = modelType === 'vision' || modelType === 'multimodal'
    const isLocalModel = activeModel.providerType === 'local-gguf'
    const FIRST_TOKEN_TIMEOUT_MS = isLocalModel ? 180_000
      : (hasImages || isMultimodal || isCloudProvider) ? 90_000 : 45_000
    const OVERALL_TIMEOUT_MS = isLocalModel ? 600_000
      : (hasImages || isMultimodal) ? 240_000 : 180_000
    let firstDeltaReceived = false
    let isTimeoutAbort = false
    const firstTokenTimer = setTimeout(() => {
      if (_abortController && !firstDeltaReceived) {
        isTimeoutAbort = true
        console.warn('[chat:%s] ⏱ first token timeout (%dms)', reqId, FIRST_TOKEN_TIMEOUT_MS)
        _abortController.abort()
      }
    }, FIRST_TOKEN_TIMEOUT_MS)
    const overallTimer = setTimeout(() => {
      if (_abortController) {
        isTimeoutAbort = true
        console.warn('[chat:%s] ⏱ overall timeout (%dms)', reqId, OVERALL_TIMEOUT_MS)
        _abortController.abort()
      }
    }, OVERALL_TIMEOUT_MS)

    try {
      const systemPrompt = _getSystemPrompt()
        + (useFastMode && !_wantsLongAnswer(text)
          ? '\n\nFor simple questions, answer directly in 1-2 short sentences. Do not output reasoning.'
          : '')
        + (isOcrRequest
          ? '\n\nOCR mode: Extract all visible text from the attached image exactly as written. Preserve line breaks and order. Do not summarize. If no readable text exists, reply with "[no text]" only.'
          : '')
      const disableThinking = useFastMode && !_wantsLongAnswer(text)
      console.log('[chat:%s] mode=%s disableThinking=%s msgs=%d', reqId, useFastMode ? 'fast' : 'normal', disableThinking, apiMessages.length)

      // 모델 컨텍스트 크기에 따라 maxTokens 동적 할당 (응답용으로 최대 25% 할당, 상한 4096)
      const ctxLen = activeModel.contextLength ?? 4096
      const dynamicMaxTokens = Math.min(Math.floor(ctxLen * 0.25), 4096)
      console.log('[chat:%s] ctxLen=%d dynamicMaxTokens=%d', reqId, ctxLen, dynamicMaxTokens)

      const stream = streamChat(apiMessages, targetModelId, {
        system: systemPrompt,
        temperature: isOcrRequest ? 0.1 : (useFastMode ? 0.2 : 0.7),
        maxTokens: dynamicMaxTokens,
        modelId: activeModel.id,
        providerType: activeModel.providerType,
        disableThinking,
        signal: _abortController.signal,
      })

      let deltaCount = 0
      for await (const delta of stream) {
        deltaCount++
        if (!firstDeltaReceived) {
          firstDeltaReceived = true
          clearTimeout(firstTokenTimer)
        }
        const now = performance.now()
        if (!tFirstDelta) tFirstDelta = now
        if (prevDeltaAt) { const gap = now - prevDeltaAt; if (gap > maxDeltaGap) maxDeltaGap = gap }
        prevDeltaAt = now

        if (delta.reasoning) {
          if (assistantMsg.streamingStatus !== 'thinking') assistantMsg.streamingStatus = 'thinking'
          if (!assistantMsg.thinking) assistantMsg.thinking = ''
          assistantMsg.thinking += delta.reasoning
        }
        if (delta.content) {
          if (assistantMsg.streamingStatus !== 'generating') assistantMsg.streamingStatus = 'generating'
          assistantMsg.content += delta.content
          for (const cb of streamDeltaCallbacks) cb(delta.content, assistantMsgId)
        }
        // #3 Hidden Message Policy — 서버가 렌더링 차단 지시
        if (delta.hidden) {
          assistantMsg.hidden = true
        }
        // #10 Tool Event Timeline — tool 호출 이벤트 추적
        if (delta.toolEvent) {
          if (!assistantMsg.toolEvents) assistantMsg.toolEvents = []
          const te = delta.toolEvent
          if (te.type === 'tool-start') {
            assistantMsg.toolEvents.push({
              id: te.id,
              name: te.name,
              status: 'running',
              startedAt: new Date().toISOString(),
              input: te.input,
            })
          } else {
            // tool-end / tool-error → 기존 running 이벤트 업데이트
            const existing = assistantMsg.toolEvents.find((ev) => ev.id === te.id || (ev.name === te.name && ev.status === 'running'))
            if (existing) {
              existing.status = te.type === 'tool-end' ? 'success' : 'error'
              existing.endedAt = new Date().toISOString()
              existing.durationMs = existing.startedAt ? Date.now() - new Date(existing.startedAt).getTime() : undefined
              if (te.output !== undefined) existing.output = te.output
              if (te.error) existing.error = te.error
            } else {
              // 매칭 없으면 새 항목으로 추가
              assistantMsg.toolEvents.push({
                id: te.id || crypto.randomUUID(),
                name: te.name,
                status: te.type === 'tool-end' ? 'success' : 'error',
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
                output: te.output,
                error: te.error,
              })
            }
          }
        }
        // #6 Tool Call Card — nodeMetadata를 toolEvents로 캡처 (폴백)
        if (delta.nodeMetadata) {
          if (!assistantMsg.toolEvents) assistantMsg.toolEvents = []
          const nm = delta.nodeMetadata
          assistantMsg.toolEvents.push({
            id: crypto.randomUUID(),
            name: nm.node || nm.agent || 'unknown',
            status: 'running',
            startedAt: new Date().toISOString(),
            input: nm as unknown as Record<string, unknown>,
          })
        }
      }

      if (deltaCount === 0 && !assistantMsg.content.trim() && !(assistantMsg.thinking?.trim())) {
        throw new Error('모델 응답이 비어 있습니다. Engine(4000) / llama-server(8080) 연결과 모델 ID 매핑을 확인하세요.')
      }

      console.log('[chat:%s] done deltas=%d contentLen=%d thinkingLen=%d totalMs=%d', reqId, deltaCount, assistantMsg.content.length, assistantMsg.thinking?.length ?? 0, Math.round(performance.now() - tStart))
    } catch (err: unknown) {
      const errName = (err as Error).name
      const errMessage = (err as Error).message
      if ((err as Error).name === 'AbortError') {
        if (!_isUserAbortRequested) {
          const timeoutMsg = isTimeoutAbort
            ? `${$t('cmh-global.chat.connectionFailed')} (timeout)`
            : $t('cmh-global.chat.connectionFailed')
          console.warn('[chat:%s] ⚠ abort: %s', reqId, timeoutMsg)
          assistantMsg.content = assistantMsg.content || '⚠️ ' + timeoutMsg
          connectionWarning.value = '⚠️ ' + timeoutMsg
        }
      } else {
        console.error('[chat:%s] ❌ %s: %s', reqId, errName, errMessage)
        assistantMsg.content = assistantMsg.content || '⚠️ ' + (err as Error).message
        useNotificationStore().createNotification({
          variant: 'error', title: $t('cmh-global.chat.connectionFailed'),
          message: (err as Error).message,
        })
        connectionWarning.value = '⚠️ ' + (err as Error).message
      }
    } finally {
      clearTimeout(firstTokenTimer)
      clearTimeout(overallTimer)
      assistantMsg.isStreaming = false
      assistantMsg.streamingStatus = undefined
      _isStreaming.value = false
      _abortController = null
      conv.updatedAt = new Date().toISOString()

      for (const cb of streamEndCallbacks) cb(assistantMsgId)

      persistMessage(conv.id, userMsg)
      if ((assistantMsg.content?.trim() ?? '') || (assistantMsg.thinking?.trim() ?? '')) {
        persistMessage(conv.id, assistantMsg)
      } else {
        conv.messages = conv.messages.filter((m) => m.id !== assistantMsgId)
      }
      _isUserAbortRequested = false

      // AI 대화 제목 생성 (기본 제목 상태일 때만)
      if (isFirstMessage && assistantMsg.content && isDefaultConversationTitle(conv.title)) {
        _generateConversationTitle(conv, text, assistantMsg.content, {
          rawModelId: targetModelId,
          modelEntityId: activeModel.id,
          providerType: activeModel.providerType,
        })
      }
    }
  }

  // ── Title Generation ───────────────────────────────

  async function _generateConversationTitle(
    conv: Conversation,
    userText: string,
    assistantText: string,
    modelSnapshot: { rawModelId?: string; modelEntityId?: string; providerType?: string },
  ): Promise<void> {
    try {
      const rawModelId = modelSnapshot.rawModelId?.trim()
      if (!rawModelId) return
      const locale = _getLocaleLabel()
      const title = await generateChat([
        { role: 'system', content: 'Generate a short conversation title (max 30 chars) for the following exchange. Reply ONLY in ' + locale + ' language. Reply with ONLY the title, no quotes, no explanation.' },
        { role: 'user', content: userText.slice(0, 200) },
        { role: 'assistant', content: assistantText.slice(0, 200) },
        { role: 'user', content: 'Title:' },
      ], rawModelId, {
        maxTokens: 30,
        temperature: 0.3,
        modelId: modelSnapshot.modelEntityId,
        providerType: modelSnapshot.providerType,
      })

      const cleaned = title.replace(/^["']|["']$/g, '')
      if (cleaned.length > 0) {
        conv.title = cleaned.slice(0, 50)
        updateConversation(conv.id, { title: conv.title })
      }
    } catch { /* keep existing title */ }
  }

  function _getLocaleLabel(): string {
    const locale = (i18n.global.locale as unknown as { value: string }).value ?? 'en-GB'
    const map: Record<string, string> = { 'ko-KR': 'Korean', 'en-GB': 'English', 'de-DE': 'German', 'zh-CN': 'Chinese', 'ja-JP': 'Japanese' }
    return map[locale] ?? 'English'
  }

  // ── Other Actions ──────────────────────────────────

  function stopGeneration(): void {
    if (_abortController) { _isUserAbortRequested = true; _abortController.abort(); _abortController = null }
  }

  function rateMessage(messageId: string, score: number | null): void {
    const conv = currentConversation.value
    if (conv) { const msg = conv.messages.find((m) => m.id === messageId); if (msg) msg.rating = score }
    dalRateMessage(messageId, score)
  }

  function addSystemMessage(text: string, systemType: ChatMessage['systemType'] = 'info'): string {
    const conv = currentConversation.value
    if (!conv) return ''
    const id = crypto.randomUUID()
    conv.messages.push({ id, role: 'system', content: text, createdAt: new Date().toISOString(), systemType })
    return id
  }

  function removeSystemMessage(id: string): void {
    const conv = currentConversation.value
    if (conv) conv.messages = conv.messages.filter((m) => m.id !== id)
  }

  // ── #11 Artifact Meta ──────────────────────────────

  function updateConversationMeta(
    convId: string,
    updater: (meta: ConversationMeta) => void,
  ): void {
    const conv = conversationById.value.get(convId)
    if (!conv) return
    if (!conv.meta) conv.meta = {}
    updater(conv.meta)
    conv.updatedAt = new Date().toISOString()
    updateConversation(convId, { title: conv.title })
  }

  function addArtifact(
    convId: string,
    artifact: { id: string; type: string; title?: string; messageId: string },
  ): void {
    updateConversationMeta(convId, (meta) => {
      if (!meta.artifacts) meta.artifacts = []
      meta.artifacts.push(artifact)
    })
  }

  // ── #3 Hidden Message Policy ───────────────────────

  function setMessageHidden(messageId: string, hidden = true): void {
    const conv = currentConversation.value
    if (!conv) return
    const msg = conv.messages.find((m) => m.id === messageId)
    if (msg) msg.hidden = hidden
  }

  return {
    conversations, currentConversationId, isStreaming, selectedModelId,
    pendingAttachments, connectionWarning,
    currentConversation, currentMessages, availableModels, selectedModel, modelsByProvider,
    loadModels, conversationsLoaded: _conversationsLoaded,
    createConversation, selectConversation, selectModel,
    addPendingAttachment, removePendingAttachment, clearPendingAttachments,
    sendMessage, deleteConversation, renameConversation, stopGeneration, forkConversation,
    addSystemMessage, removeSystemMessage, rateMessage,
    onStreamDelta, onStreamEnd,
    updateConversationMeta, addArtifact, setMessageHidden,
  }
})
