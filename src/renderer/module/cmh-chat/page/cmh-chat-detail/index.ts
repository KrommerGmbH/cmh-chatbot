import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../../../../app/store/chat.store'
import template from './cmh-chat-detail.html?raw'

export default defineComponent({
  name: 'cmh-chat-detail',
  template,

  data() {
    return {
      chatStore: useChatStore(),
      i18n: useI18n(),
      inputText: '',
      isLoading: false,
    }
  },

  computed: {
    conversationId(): string {
      return this.$route.params.id as string
    },
    conversation() {
      return this.chatStore.conversations.find((c) => c.id === this.conversationId) ?? null
    },
    messages() {
      return this.conversation?.messages ?? []
    },
    isStreaming() {
      return this.chatStore.isStreaming
    },
  },

  created() {
    this.createdComponent()
  },

  methods: {
    createdComponent(): void {
      if (this.conversationId) {
        this.chatStore.selectConversation(this.conversationId)
      }
      this.loadConversation()
    },

    loadConversation(): void {
      // TODO: engine DAL 연동
      this.isLoading = false
    },

    onSendMessage(): void {
      const text = this.inputText.trim()
      if (!text || this.isStreaming) return

      this.inputText = ''
      this.chatStore.sendMessage(text)
    },

    onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        this.onSendMessage()
      }
    },

    onGoBack(): void {
      this.$router.push({ name: 'cmh.chat.list' })
    },
  },
})
