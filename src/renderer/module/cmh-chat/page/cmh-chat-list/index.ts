import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../../../../app/store/chat.store'
import template from './cmh-chat-list.html?raw'

export default defineComponent({
  name: 'cmh-chat-list',
  template,

  data() {
    return {
      chatStore: useChatStore(),
      i18n: useI18n(),
      isLoading: false,
    }
  },

  computed: {
    conversations() {
      return this.chatStore.conversations
    },
    isEmpty(): boolean {
      return this.conversations.length === 0
    },
  },

  created() {
    this.createdComponent()
  },

  methods: {
    createdComponent(): void {
      this.loadConversations()
    },

    loadConversations(): void {
      // TODO: engine DAL 연동하여 대화 목록 로드
      this.isLoading = false
    },

    onOpenConversation(id: string): void {
      this.$router.push({ name: 'cmh.chat.detail', params: { id } })
    },

    onNewConversation(): void {
      const conv = this.chatStore.createConversation()
      this.$router.push({ name: 'cmh.chat.detail', params: { id: conv.id } })
    },

    onDeleteConversation(id: string): void {
      this.chatStore.deleteConversation(id)
    },

    formatDate(dateString: string): string {
      return new Date(dateString).toLocaleDateString()
    },
  },
})
