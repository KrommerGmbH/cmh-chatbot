import { defineComponent, nextTick } from 'vue'
import './cmh-chat-sidebar.scss'
import template from './cmh-chat-sidebar.html?raw'

export default defineComponent({
  name: 'cmh-chat-sidebar',
  template,

  props: {
    conversations: {
      type: Array as () => Array<{ id: string; title: string }>,
      required: true,
    },
    currentConversationId: {
      type: String as () => string | null,
      default: null,
    },
  },

  emits: ['new-conversation', 'select-conversation', 'delete-conversation', 'open-settings', 'switch-to-admin', 'rename-conversation'],

  data() {
    return {
      editingConvId: null as string | null,
      editTitle: '',
    }
  },

  methods: {
    startEdit(conv: { id: string; title: string }): void {
      this.editingConvId = conv.id
      this.editTitle = conv.title
      nextTick(() => {
        const inputs = this.$refs.editInput as HTMLInputElement[] | HTMLInputElement | undefined
        const input = Array.isArray(inputs) ? inputs[0] : inputs
        if (input) { input.focus(); input.select() }
      })
    },
    commitEdit(convId: string): void {
      if (!this.editingConvId) return
      const trimmed = this.editTitle.trim()
      if (trimmed) {
        this.$emit('rename-conversation', { id: convId, title: trimmed })
      }
      this.editingConvId = null
      this.editTitle = ''
    },
    cancelEdit(): void {
      this.editingConvId = null
      this.editTitle = ''
    },
  },
})
