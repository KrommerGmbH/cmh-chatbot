import { defineComponent, nextTick } from 'vue'
import { useUiPreferencesStore, FONT_LEVELS, DEFAULT_FONT_TOKENS, type ColorScheme, type FontLevel, type FontTokens } from '../../../store/ui-preferences.store'
import { useChatStore, type ActionButton } from '../../../store/chat.store'
import { useAgentStore } from '../../../store/agent.store'
import { useUserContextStore } from '../../../store/user-context.store'
import { SUPPORTED_LOCALES, applyAppLocale, i18n, type AppLocale } from '../../../init/i18n'
import {
  toggleRecording,
  onSttStatus,
  onSttResult,
  onSttProgress,
  getIsRecording,
  getIsModelLoaded,
  type SttStatus,
} from '../../../service/stt.service'
import {
  onTtsStatus,
  setAutoRead,
  getAutoRead,
  speak,
  stop as ttsStop,
  toggleSpeak,
  speakIfAutoRead,
  isSpeaking,
  setActiveEngine,
  configureEdgeTts,
  startStreamingSpeak,
  type TtsStatus,
  type TtsEngine,
  type StreamingTtsHandle,
} from '../../../service/tts.service'
import { InMemoryDataAdapter } from '@engine/data/data-adapter'
import { RepositoryFactory } from '@engine/data/repository-factory'
import { Criteria } from '@engine/data/criteria'
import { seedDefaultData, ENTITY_CMH_LANGUAGE } from '@engine/data/seed'
import type { LanguageEntity } from '@engine/data/entity/language/language.entity'
import NotificationMixin from '../../../mixin/notification.mixin'
// Ensure language definitions are registered
import '@engine/data/entity/language/language.definition'
import '@engine/data/entity/language/language-translation.definition'
import CmhChatSidebar from './sub/cmh-chat-sidebar/index'
import CmhChatMessage from './sub/cmh-chat-message/index'
import CmhChatInput from './sub/cmh-chat-input/index'
import CmhChatSettings from './sub/cmh-chat-settings/index'
import CmhLanguageSwitch from '../cmh-language-switch/index'
import template from './cmh-chat-shell.html?raw'
import './cmh-chat-shell.scss'

export default defineComponent({
  name: 'cmh-chat-shell',
  template,
  mixins: [NotificationMixin],
  components: {
    'cmh-chat-sidebar': CmhChatSidebar,
    'cmh-chat-message': CmhChatMessage,
    'cmh-chat-input': CmhChatInput,
    'cmh-chat-settings': CmhChatSettings,
    'cmh-language-switch': CmhLanguageSwitch,
  },

  data() {
    return {
      chatStore: useChatStore(),
      uiPreferencesStore: useUiPreferencesStore(),
      agentStore: useAgentStore(),
      userContextStore: useUserContextStore(),
      inputText: '',
      showSettingsPanel: false,
      selectedAgentId: '' as string,
      sttActive: false,
      sttStatus: 'idle' as SttStatus,
      sttStatusMessage: '',
      sttModelProgress: 0,
      sttLoadingMsgId: '' as string,
      ttsEnabled: false,
      ttsStatus: 'idle' as TtsStatus,
      ttsStatusMessage: '',
      ttsSpeakingMsgId: '' as string,
      /** watch 중복 자동읽기 방지 — 마지막으로 auto-read된 메시지 ID */
      lastAutoReadMsgId: '' as string,
      /** 스트리밍 TTS 핸들 — AI 생성과 동시에 음성 출력 */
      _streamingTtsHandle: null as StreamingTtsHandle | null,
      /** 스트리밍 이벤트 구독 해제 콜백 */
      _unsubStreamDelta: null as (() => void) | null,
      _unsubStreamEnd: null as (() => void) | null,
      /** Phase 1.1 — 사용자가 위로 스크롤했는지 여부 (자동 스크롤 억제) */
      isUserScrolledUp: false,
      isHydrating: true,
      FONT_LEVELS,
      fontTokens: JSON.parse(JSON.stringify(DEFAULT_FONT_TOKENS)) as FontTokens,
      languages: [] as LanguageEntity[],
      showMobileSidebar: false,
      isPreparingAttachments: false,
      _pendingAttachmentReads: 0,
      /** #1 Artifact Panel — 사이드 패널 표시 여부 */
      showArtifactPanel: false,
      /** #1 Artifact Panel — 현재 패널에 표시 중인 아티팩트 */
      activeArtifact: null as { type: string; content: unknown; title?: string; messageId?: string } | null,
    }
  },

  computed: {
    currentMessages() {
      return this.chatStore.currentMessages
    },
    canSend(): boolean {
      return this.inputText.trim().length > 0 && !this.chatStore.isStreaming && !this.isPreparingAttachments
    },
    selectedAgentLabel(): string {
      if (!this.selectedAgentId) {
        const first = this.agentStore.activeAgents[0]
        return first ? first.name : this.$t('cmh-global.agent.title')
      }
      const agent = this.agentStore.agents.find((a: { id: string }) => a.id === this.selectedAgentId)
      return agent ? agent.name : this.$t('cmh-global.agent.title')
    },
    /**
     * 채팅 입력 에이전트 선택 — 오케스트레이터 + 1차 하위 매니저만 표시
     */
    selectableAgents(): { id: string; name: string }[] {
      const orchestratorType = this.agentStore.getAgentTypeByName('orchestrator')
      const managerType = this.agentStore.getAgentTypeByName('manager')
      const orchestrators = this.agentStore.activeAgents.filter(
        (a: { agentTypeId: string }) => orchestratorType && a.agentTypeId === orchestratorType.id,
      )
      // 1차 매니저: parentAgentId가 오케스트레이터인 매니저
      const orchestratorIds = new Set(orchestrators.map((o: { id: string }) => o.id))
      const firstLevelManagers = this.agentStore.activeAgents.filter(
        (a: { agentTypeId: string; parentAgentId?: string | null }) =>
          managerType && a.agentTypeId === managerType.id && a.parentAgentId && orchestratorIds.has(a.parentAgentId),
      )
      return [...orchestrators, ...firstLevelManagers]
    },
    colorSchemeOptions(): { value: ColorScheme; label: string; color: string }[] {
      return [
        { value: 'default' as ColorScheme, label: this.$t('cmh-global.settings.colorDefault'), color: '#0e639c' },
        { value: 'ocean' as ColorScheme, label: this.$t('cmh-global.settings.colorOcean'), color: '#0077b6' },
        { value: 'forest' as ColorScheme, label: this.$t('cmh-global.settings.colorForest'), color: '#2d6a4f' },
        { value: 'sunset' as ColorScheme, label: this.$t('cmh-global.settings.colorSunset'), color: '#e76f51' },
        { value: 'lavender' as ColorScheme, label: this.$t('cmh-global.settings.colorLavender'), color: '#7b2cbf' },
      ]
    },
    supportedLocales(): { value: string; label: string }[] {
      if (this.languages.length > 0) {
        return this.languages.map((lang: LanguageEntity) => ({
          value: lang.code,
          label: lang.nativeName,
        }))
      }
      // Fallback if DB not yet loaded
      return [
        { value: 'ko-KR', label: '한국어' },
        { value: 'en-GB', label: 'English' },
        { value: 'de-DE', label: 'Deutsch' },
        { value: 'zh-CN', label: '中文' },
        { value: 'ja-JP', label: '日本語' },
      ]
    },
    currentLocale(): string {
      return (i18n.global.locale as unknown as { value: string }).value
    },
  },

  watch: {
    currentMessages: {
      handler(newMessages: { id: string; role: string; content: string; isStreaming?: boolean }[]) {
        // Phase 1.1 — 사용자가 위로 스크롤한 상태면 자동 스크롤하지 않음
        if (!this.isUserScrolledUp) this.scrollToBottom()

        // TTS 자동 읽기: 마지막 assistant 메시지가 스트리밍 완료되면 읽기
        // 1) lastAutoReadMsgId로 동일 메시지 중복 읽기 방지 (deep watch 다중 트리거 대응)
        // 2) 수동 재생(ttsSpeakingMsgId) 중이면 자동 읽기 억제
        if (this.ttsEnabled && newMessages.length > 0 && !this.ttsSpeakingMsgId) {
          const last = newMessages[newMessages.length - 1]
          if (
            last.role === 'assistant'
            && !last.isStreaming
            && last.content
            && last.id !== this.lastAutoReadMsgId
          ) {
            this.lastAutoReadMsgId = last.id
            this.ttsSpeakingMsgId = last.id
            speakIfAutoRead(last.content)
          }
        }
      },
      deep: true,
    },

    /** Phase 1.5 — connectionWarning → notification 통합 */
    'chatStore.connectionWarning'(newVal: string | null) {
      if (newVal) {
        this.createNotificationWarning({
          message: newVal,
        })
        // 표시 후 즉시 초기화 (notification 시스템이 관리)
        this.chatStore.connectionWarning = null
      }
    },
  },

  created() {
    this.createdComponent()
  },

  mounted() {
    this.mountedComponent()
  },

  methods: {
    async createdComponent(): Promise<void> {
      // DAL에서 대화 복원을 기다린 후 빈 대화 생성 여부 판단
      await this.chatStore.conversationsLoaded
      if (this.chatStore.conversations.length === 0) {
        this.chatStore.createConversation()
      } else if (!this.chatStore.currentConversationId) {
        this.chatStore.selectConversation(this.chatStore.conversations[0].id)
      }
      // Store에서 fontTokens 복원
      const stored = this.uiPreferencesStore.fontTokens
      this.fontTokens = JSON.parse(JSON.stringify(stored)) as FontTokens
      this.isHydrating = false

      // 기본 에이전트 선택 — 오케스트레이터 우선
      const orchestratorType = this.agentStore.getAgentTypeByName('orchestrator')
      const defaultOrchestrator = orchestratorType
        ? this.agentStore.activeAgents.find((a: { agentTypeId: string }) => a.agentTypeId === orchestratorType.id)
        : null
      const firstAgent = defaultOrchestrator ?? this.agentStore.activeAgents[0]
      if (firstAgent) {
        // user-context에서 저장된 에이전트 복원
        const savedAgentId = this.userContextStore?.settings?.selectedAgentId
        const savedAgent = savedAgentId
          ? this.agentStore.activeAgents.find((a: { id: string }) => a.id === savedAgentId)
          : null
        const agentToSelect = savedAgent ?? firstAgent
        this.selectedAgentId = agentToSelect.id
        this.agentStore.selectedAgentId = agentToSelect.id
      }

      // ── DB에서 언어 목록 로드 ───────────────────
      this.loadLanguages()

      // ── Edge TTS 기본 설정 등록 ─────────────────
      configureEdgeTts({
        engine: 'edge-tts',
        modelId: 'edge-tts',
      })
      setActiveEngine('edge-tts')

      // ── TTS 자동읽기 상태 초기화 ──────────────
      this.ttsEnabled = getAutoRead()

      // ── STT 콜백 등록 ───────────────────────────
      onSttStatus((status: SttStatus, message?: string) => {
        this.sttStatus = status
        this.sttStatusMessage = message ?? ''
        this.sttActive = status === 'recording'

        // 모델 로딩 시 채팅창에 시스템 메시지 표시
        if (status === 'loading-model') {
          this.sttLoadingMsgId = this.chatStore.addSystemMessage(
            this.$t('cmh-global.chat.sttModelLoading'),
            'loading',
          )
        } else if (status === 'transcribing') {
          // 로딩 메시지 제거 후 변환 중 메시지
          if (this.sttLoadingMsgId) {
            this.chatStore.removeSystemMessage(this.sttLoadingMsgId)
          }
          this.sttLoadingMsgId = this.chatStore.addSystemMessage(
            this.$t('cmh-global.chat.sttTranscribing'),
            'loading',
          )
        } else if (status === 'ready' || status === 'idle' || status === 'error') {
          // 로딩 메시지 제거
          if (this.sttLoadingMsgId) {
            this.chatStore.removeSystemMessage(this.sttLoadingMsgId)
            this.sttLoadingMsgId = ''
          }
          if (status === 'error' && message) {
            this.chatStore.addSystemMessage(message, 'error')
          }
        }
      })

      onSttResult((text: string) => {
        // 변환된 텍스트를 입력 필드에 추가
        if (this.inputText.trim()) {
          this.inputText += ' ' + text
        } else {
          this.inputText = text
        }
      })

      onSttProgress((progress: number) => {
        this.sttModelProgress = progress
      })

      // ── TTS 콜백 등록 ───────────────────────────
      onTtsStatus((status: TtsStatus, message?: string) => {
        this.ttsStatus = status
        this.ttsStatusMessage = message ?? ''
        if (status === 'idle' || status === 'error') {
          this.ttsSpeakingMsgId = ''
          this._streamingTtsHandle = null
        }
      })

      // ── 스트리밍 TTS 이벤트 구독 (AI 생성과 동시 읽기) ──
      this._unsubStreamDelta = this.chatStore.onStreamDelta((delta: string, msgId: string) => {
        if (!this.ttsEnabled) return

        // 스트리밍 핸들 생성 (첫 토큰 도착 시)
        if (!this._streamingTtsHandle) {
          this._streamingTtsHandle = startStreamingSpeak()
          this.ttsSpeakingMsgId = msgId
          this.lastAutoReadMsgId = msgId // watch 재트리거 방지
        }

        this._streamingTtsHandle.feedDelta(delta)
      })

      this._unsubStreamEnd = this.chatStore.onStreamEnd((msgId: string) => {
        if (this._streamingTtsHandle) {
          this._streamingTtsHandle.finish()
          // 핸들은 idle 콜백에서 null로 정리됨
          this.lastAutoReadMsgId = msgId // watch가 완료된 메시지를 다시 읽지 않도록
        }
      })
    },

    mountedComponent(): void {
      this.scrollToBottom()

      // Phase 1.1 — 스크롤 자유 이동: 사용자 스크롤 감지
      const container = this.$refs.messagesContainer as HTMLElement | undefined
      if (container) {
        container.addEventListener('scroll', this.onMessagesScroll)
      }
    },

    async scrollToBottom(force = false): Promise<void> {
      // Phase 1.1 — isUserScrolledUp 상태면 자동 스크롤 생략 (force 시 무시)
      if (this.isUserScrolledUp && !force) return
      await nextTick()
      const container = this.$refs.messagesContainer as HTMLElement | undefined
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    },

    /** Phase 1.1 — 메시지 컨테이너 스크롤 감지: 하단 50px 이내면 자동 스크롤 재개 */
    onMessagesScroll(): void {
      const container = this.$refs.messagesContainer as HTMLElement | undefined
      if (!container) return
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      this.isUserScrolledUp = distanceFromBottom > 50
    },

    async onSendMessage(): Promise<void> {
      await this._waitForPendingAttachmentReads()
      const text = this.inputText.trim()
      if (!text || this.chatStore.isStreaming) return

      this.inputText = ''
      await this.chatStore.sendMessage(text)
    },

    /** AI 응답 생성 멈춤 */
    onStopGeneration(): void {
      this.chatStore.stopGeneration()
    },

    /** 언어 변경 */
    onChangeLocale(locale: string): void {
      applyAppLocale(locale)
    },

    onNewConversation(): void {
      // 새 대화 버튼 클릭 시에만 생성 (유일한 생성 경로)
      // 현재 대화가 비어있으면 재사용
      const current = this.chatStore.currentConversation
      if (current && current.messages.filter((m: { role: string }) => m.role === 'user').length === 0) {
        this.inputText = ''
        return
      }
      this.chatStore.createConversation()
      this.inputText = ''
    },

    onSelectConversation(id: string): void {
      this.chatStore.selectConversation(id)
    },

    /** 모바일에서 대화 선택 시 사이드바 닫기 */
    onMobileSelectConversation(id: string): void {
      this.chatStore.selectConversation(id)
      this.showMobileSidebar = false
    },

    onDeleteConversation(id: string): void {
      this.chatStore.deleteConversation(id)
    },

    onRenameConversation(payload: { id: string; title: string }): void {
      this.chatStore.renameConversation(payload.id, payload.title)
    },

    onSwitchToAdmin(): void {
      this.uiPreferencesStore.setShellMode('admin')
    },

    /** Phase 1.3 — 선택된 파일을 pending attachment에 추가 (이미지는 base64 읽기) */
    async onFileInputChange(event: Event): Promise<void> {
      const input = event.target as HTMLInputElement
      const files = input.files
      if (!files) return

      const tasks = Array.from(files).map(async (file) => {
        this._pendingAttachmentReads += 1
        this.isPreparingAttachments = true

        const id = crypto.randomUUID()
        try {
          const dataUrl = await this.readFileAsDataUrl(file)
          const mimeFromDataUrl = /^data:([^;]+);base64,/i.exec(dataUrl)?.[1] ?? ''
          const resolvedType = (file.type || mimeFromDataUrl || 'application/octet-stream').toLowerCase()

          this.chatStore.addPendingAttachment({
            id,
            name: file.name,
            type: resolvedType,
            size: file.size,
            dataUrl,
          })
        } catch (e) {
          console.warn('[chat] Failed to read attachment:', file.name, e)
        } finally {
          this._pendingAttachmentReads = Math.max(0, this._pendingAttachmentReads - 1)
          this.isPreparingAttachments = this._pendingAttachmentReads > 0
        }
      })

      await Promise.allSettled(tasks)
      input.value = ''
    },

    readFileAsDataUrl(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
            resolve(reader.result)
            return
          }
          reject(new Error('Invalid attachment data URL'))
        }
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment'))
        reader.readAsDataURL(file)
      })
    },

    async _waitForPendingAttachmentReads(timeoutMs = 7000): Promise<void> {
      const start = Date.now()
      while (this._pendingAttachmentReads > 0 && Date.now() - start < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      this.isPreparingAttachments = this._pendingAttachmentReads > 0
    },

    onRemoveAttachment(id: string): void {
      this.chatStore.removePendingAttachment(id)
    },

    onSelectModel(modelId: string): void {
      this.chatStore.selectModel(modelId)
    },

    onSelectAgent(agentId: string): void {
      this.selectedAgentId = agentId
      this.agentStore.selectedAgentId = agentId
      // user-context에 세션 선택 저장
      import('../../../store/user-context.store').then(({ useUserContextStore }) => {
        useUserContextStore().updateSettings({ selectedAgentId: agentId })
      }).catch(() => {})
    },

    /** STT 토글 — Whisper 모델로 음성 인식 */
    async onToggleSTT(): Promise<void> {
      await toggleRecording()
    },

    /** TTS 자동 읽기 토글 — 새 AI 메시지를 자동으로 음성 출력 */
    onToggleTTS(): void {
      this.ttsEnabled = !this.ttsEnabled
      setAutoRead(this.ttsEnabled)

      if (this.ttsEnabled) {
        // 활성화 시 마지막 assistant 메시지가 있으면 즉시 읽기
        const msgs = this.currentMessages
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1]
          if (last.role === 'assistant' && !last.isStreaming && last.content) {
            this.ttsSpeakingMsgId = last.id
            this.lastAutoReadMsgId = last.id
            speak(last.content)
          }
        }
      } else {
        // 스트리밍 TTS 핸들 취소
        if (this._streamingTtsHandle) {
          this._streamingTtsHandle.cancel()
          this._streamingTtsHandle = null
        }
        ttsStop()
        this.ttsSpeakingMsgId = ''
        this.lastAutoReadMsgId = ''
      }
    },

    /** 개별 메시지 음성 읽기/중지 토글 */
    async onSpeakMessage(msgId: string, content: string): Promise<void> {
      if (this.ttsSpeakingMsgId === msgId && isSpeaking()) {
        ttsStop()
        this.ttsSpeakingMsgId = ''
      } else {
        // 기존 재생 중단 후 새 메시지 재생
        if (isSpeaking()) ttsStop()
        this.ttsSpeakingMsgId = msgId
        this.lastAutoReadMsgId = msgId // watch 재트리거 방지
        await speak(content)
      }
    },

    onActionButton(btn: ActionButton): void {
      // 액션 버튼 클릭 → 해당 라벨을 메시지로 전송
      this.inputText = btn.label
      this.onSendMessage()
    },

    /** 사용자 메시지 재전송 — 같은 텍스트로 새 메시지 전송 */
    onResendMessage(content: string): void {
      this.inputText = content
      this.onSendMessage()
    },

    /** 사용자 메시지 편집 — 입력창에 텍스트를 넣어 수정 후 재전송 가능 */
    onEditMessage(payload: { messageId: string; content: string }): void {
      this.inputText = payload.content
      // 입력창에 포커스
      this.$nextTick(() => {
        const textarea = this.$el?.querySelector('.cmh-chat-input__textarea') as HTMLTextAreaElement | null
        if (textarea) {
          textarea.focus()
          textarea.setSelectionRange(textarea.value.length, textarea.value.length)
        }
      })
    },

    /** Phase 2 — AI 메시지 별점 평가 */
    onRateMessage(messageId: string, score: number | null): void {
      this.chatStore.rateMessage(messageId, score)
    },

    /** DB에서 언어 목록 로드 (InMemoryDataAdapter 기반 DAL) */
    async loadLanguages(): Promise<void> {
      try {
        const adapter = new InMemoryDataAdapter()
        seedDefaultData(adapter)
        const repoFactory = new RepositoryFactory(adapter)
        const langRepo = repoFactory.create<LanguageEntity>(ENTITY_CMH_LANGUAGE)
        const criteria = new Criteria()
        criteria.addFilter(Criteria.equals('isActive', true))
        criteria.addSorting(Criteria.sort('position', 'ASC'))
        criteria.setLimit(50)
        const result = await langRepo.search(criteria)
        this.languages = result.data
      } catch (e) {
        console.warn('[cmh-chat-shell] Failed to load languages from DB, using fallback', e)
      }
    },

    updateFontToken(level: FontLevel, field: 'size' | 'weight', value: number): void {
      if (this.isHydrating) return
      this.fontTokens[level][field] = value
      this.uiPreferencesStore.updateFontToken(level, field, value)
    },

    resetFontTokens(): void {
      this.fontTokens = JSON.parse(JSON.stringify(DEFAULT_FONT_TOKENS)) as FontTokens
      this.uiPreferencesStore.resetFontTokens()
    },

    onSetColorScheme(scheme: ColorScheme): void {
      this.uiPreferencesStore.setColorScheme(scheme)
    },

    /** #1 Artifact Panel — 아티팩트를 사이드 패널에서 열기 */
    onOpenArtifact(payload: { type: string; content: unknown; title?: string; messageId?: string }): void {
      this.activeArtifact = payload
      this.showArtifactPanel = true
    },

    /** #1 Artifact Panel — 패널 닫기 */
    onCloseArtifactPanel(): void {
      this.showArtifactPanel = false
      this.activeArtifact = null
    },

    /** #5 Time Travel/Fork — 메시지 시점에서 대화 분기 */
    onForkFromMessage(messageId: string): void {
      const convId = this.chatStore.currentConversationId
      if (!convId) return
      const forked = this.chatStore.forkConversation(convId, messageId)
      if (forked) {
        this.createNotificationSuccess({
          message: this.$t('cmh-global.chat.forkedConversation'),
        })
      }
    },
  },

  beforeUnmount() {
    // Phase 1.1 — 스크롤 이벤트 리스너 해제
    const container = this.$refs.messagesContainer as HTMLElement | undefined
    if (container) {
      container.removeEventListener('scroll', this.onMessagesScroll)
    }
    this._unsubStreamDelta?.()
    this._unsubStreamEnd?.()
    if (this._streamingTtsHandle) {
      this._streamingTtsHandle.cancel()
      this._streamingTtsHandle = null
    }
  },
})
