import { defineComponent } from 'vue'
import { simpleMarkdown } from '../../utils/markdown'
import './cmh-chat-message.scss'
import type { ChatMessage, TodoItem, ActionButton, ToolCallEvent } from '../../../../../store/chat.store'
import template from './cmh-chat-message.html?raw'

type ChatUiButton = {
  id?: string
  label: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'critical'
  action?: string
  url?: string
  payload?: Record<string, unknown>
}

type ChatUiBlock =
  | { type: 'text'; text: string; scroll?: boolean; maxHeight?: number }
  | { type: 'markdown'; text: string; scroll?: boolean; maxHeight?: number }
  | { type: 'code'; code: string; language?: string; title?: string; collapsible?: boolean }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'video'; src: string; poster?: string }
  | { type: 'iframe'; src: string; title?: string }
  | { type: 'data-grid'; columns: Array<{ property: string; label: string; visible?: boolean }>; rows: Record<string, unknown>[] }
  | { type: 'table'; columns: string[]; rows: Array<Array<string | number | boolean | null>> }
  | { type: 'button-group'; buttons: ChatUiButton[] }
  | { type: 'collapse'; title: string; content?: string; markdown?: string; open?: boolean }
  | { type: 'card'; title?: string; subtitle?: string; content?: string; markdown?: string }
  | { type: 'entity-listing'; columns: Array<{ property: string; label: string; visible?: boolean }>; rows: Record<string, unknown>[] }
  | { type: 'filter'; kind: string; config?: Record<string, unknown> }
  | { type: 'component'; is: string; props?: Record<string, unknown> }

export default defineComponent({
  name: 'cmh-chat-message',
  template,

  props: {
    message: {
      type: Object as () => ChatMessage,
      required: true,
    },
    /** 현재 이 메시지의 TTS가 재생 중인지 */
    isSpeaking: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['remove-system-message', 'action-button', 'rate-message', 'speak-message', 'resend-message', 'edit-message', 'open-artifact', 'fork-from-message'],

  data() {
    return {
      copied: false,
      isEditing: false,
      editText: '',
    }
  },

  computed: {
    renderedContent(): string {
      if (!this.message.content) return ''
      const raw = this.stripUiBlocks(this.message.content)
      // ⭐ 스트리밍 중에는 마크다운 파싱 건너뛰고 plain text → 각 delta마다 regex 20+개 재실행 방지
      if (this.message.isStreaming) {
        return raw
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
      }
      return simpleMarkdown(raw)
    },

    uiBlocks(): ChatUiBlock[] {
      return this.extractUiBlocks(this.message.content ?? '')
    },

    completedTodoCount(): number {
      return (this.message.todos ?? []).filter((t: TodoItem) => t.status === 'completed').length
    },

    /** #6 Tool Call Card — 도구 호출 이벤트 목록 */
    toolEvents(): ToolCallEvent[] {
      return this.message.toolEvents ?? []
    },

    hasToolEvents(): boolean {
      return this.toolEvents.length > 0
    },

    /** #10 Tool Event Timeline — 전체 tool 실행 소요시간 합계 */
    toolTimelineDuration(): string {
      const events = this.toolEvents as ToolCallEvent[]
      const totalMs = events.reduce((sum, ev) => sum + (ev.durationMs ?? 0), 0)
      if (totalMs <= 0) return ''
      return totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`
    },

    formattedTime(): string {
      const d = new Date(this.message.createdAt ?? Date.now())
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    },
  },

  methods: {
    /** #10 Tool Event Timeline — 시작 시간 포맷 (HH:MM:SS) */
    formatToolTime(isoStr: string): string {
      const d = new Date(isoStr)
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },

    /** #1 Artifact Panel — UI 블록을 사이드 패널에서 열기 */
    openInPanel(block: ChatUiBlock): void {
      this.$emit('open-artifact', {
        type: block.type,
        content: block,
        title: ('title' in block ? block.title : undefined) ?? block.type,
        messageId: this.message.id,
      })
    },

    stripUiBlocks(content: string): string {
      return content
        .replace(/```cmh-ui\s*([\s\S]*?)```/gi, '')
        .replace(/```json\s*([\s\S]*?)```/gi, (full, body) => {
          try {
            const parsed = JSON.parse(String(body).trim()) as { type?: string; blocks?: unknown[] }
            if (Array.isArray(parsed?.blocks)) return ''
            if (typeof parsed?.type === 'string') {
              return ''
            }
            return full
          } catch {
            return full
          }
        })
        .trim()
    },

    extractUiBlocks(content: string): ChatUiBlock[] {
      if (!content) return []
      const blocks: ChatUiBlock[] = []

      const parseJsonBlock = (raw: string): void => {
        try {
          const parsed = JSON.parse(raw) as any
          if (Array.isArray(parsed?.blocks)) {
            for (const b of parsed.blocks) {
              const mapped = this.mapUiBlock(b)
              if (mapped) blocks.push(mapped)
            }
            return
          }
          const mapped = this.mapUiBlock(parsed)
          if (mapped) blocks.push(mapped)
        } catch {
          // noop
        }
      }

      const cmhUiRegex = /```cmh-ui\s*([\s\S]*?)```/gi
      let m: RegExpExecArray | null
      while ((m = cmhUiRegex.exec(content)) !== null) {
        parseJsonBlock(String(m[1] ?? '').trim())
      }

      const jsonRegex = /```json\s*([\s\S]*?)```/gi
      while ((m = jsonRegex.exec(content)) !== null) {
        parseJsonBlock(String(m[1] ?? '').trim())
      }

      return blocks
    },

    mapUiBlock(input: any): ChatUiBlock | null {
      const type = String(input?.type ?? '').trim().toLowerCase()
      if (!type) return null

      if (type === 'text' && typeof input?.text === 'string') {
        return {
          type: 'text',
          text: input.text,
          scroll: input?.scroll === true,
          maxHeight: Number.isFinite(input?.maxHeight) ? Number(input.maxHeight) : undefined,
        }
      }

      if (type === 'markdown' && typeof input?.text === 'string') {
        return {
          type: 'markdown',
          text: input.text,
          scroll: input?.scroll === true,
          maxHeight: Number.isFinite(input?.maxHeight) ? Number(input.maxHeight) : undefined,
        }
      }

      if (type === 'code' && typeof input?.code === 'string') {
        return {
          type: 'code',
          code: input.code,
          language: typeof input?.language === 'string' ? input.language : undefined,
          title: typeof input?.title === 'string' ? input.title : undefined,
          collapsible: input?.collapsible === true,
        }
      }

      if (type === 'image' && typeof input?.src === 'string' && input.src.trim()) {
        return { type: 'image', src: input.src.trim(), alt: typeof input?.alt === 'string' ? input.alt : undefined }
      }

      if (type === 'video' && typeof input?.src === 'string' && input.src.trim()) {
        return {
          type: 'video',
          src: input.src.trim(),
          poster: typeof input?.poster === 'string' ? input.poster : undefined,
        }
      }

      if (type === 'iframe' && typeof input?.src === 'string' && this.isAllowedIframeUrl(input.src)) {
        return {
          type: 'iframe',
          src: input.src.trim(),
          title: typeof input?.title === 'string' ? input.title : undefined,
        }
      }

      if (type === 'data-grid' && Array.isArray(input?.columns) && Array.isArray(input?.rows)) {
        const columns = input.columns
          .map((c: any) => ({
            property: String(c?.property ?? ''),
            label: String(c?.label ?? c?.property ?? ''),
            visible: c?.visible !== false,
          }))
          .filter((c: { property: string }) => !!c.property)

        if (columns.length > 0) {
          return { type: 'data-grid', columns, rows: input.rows as Record<string, unknown>[] }
        }
      }

      if (type === 'table' && Array.isArray(input?.columns) && Array.isArray(input?.rows)) {
        const columns = input.columns.map((c: any) => String(c ?? '')).filter(Boolean)
        const rows = input.rows
          .filter((r: unknown) => Array.isArray(r))
          .map((r: any[]) => r.map((cell) => {
            if (cell === null || cell === undefined) return null
            if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') return cell
            return JSON.stringify(cell)
          }))

        if (columns.length > 0) {
          return { type: 'table', columns, rows }
        }
      }

      if (type === 'button-group' && Array.isArray(input?.buttons)) {
        const buttons = input.buttons
          .map((b: any) => ({
            id: typeof b?.id === 'string' ? b.id : undefined,
            label: String(b?.label ?? '').trim(),
            variant: (['primary', 'secondary', 'ghost', 'critical'].includes(String(b?.variant))
              ? String(b?.variant)
              : 'secondary') as ChatUiButton['variant'],
            action: typeof b?.action === 'string' ? b.action : undefined,
            url: typeof b?.url === 'string' ? b.url : undefined,
            payload: b?.payload && typeof b.payload === 'object' ? b.payload as Record<string, unknown> : undefined,
          }))
          .filter((b: ChatUiButton) => !!b.label)

        if (buttons.length > 0) {
          return { type: 'button-group', buttons }
        }
      }

      if (type === 'collapse' && typeof input?.title === 'string') {
        return {
          type: 'collapse',
          title: input.title,
          content: typeof input?.content === 'string' ? input.content : undefined,
          markdown: typeof input?.markdown === 'string' ? input.markdown : undefined,
          open: input?.open === true,
        }
      }

      if (type === 'card') {
        if (typeof input?.content === 'string' || typeof input?.markdown === 'string' || typeof input?.title === 'string') {
          return {
            type: 'card',
            title: typeof input?.title === 'string' ? input.title : undefined,
            subtitle: typeof input?.subtitle === 'string' ? input.subtitle : undefined,
            content: typeof input?.content === 'string' ? input.content : undefined,
            markdown: typeof input?.markdown === 'string' ? input.markdown : undefined,
          }
        }
      }

      if (type === 'entity-listing' && Array.isArray(input?.columns) && Array.isArray(input?.rows)) {
        const columns = input.columns
          .map((c: any) => ({
            property: String(c?.property ?? ''),
            label: String(c?.label ?? c?.property ?? ''),
            visible: c?.visible !== false,
          }))
          .filter((c: { property: string }) => !!c.property)

        if (columns.length > 0) {
          return { type: 'entity-listing', columns, rows: input.rows as Record<string, unknown>[] }
        }
      }

      if (type === 'filter' && typeof input?.kind === 'string') {
        return {
          type: 'filter',
          kind: input.kind,
          config: input?.config && typeof input.config === 'object' ? input.config as Record<string, unknown> : undefined,
        }
      }

      if (type === 'component' && typeof input?.is === 'string' && this.isAllowedDynamicComponent(input.is)) {
        return {
          type: 'component',
          is: input.is,
          props: input?.props && typeof input.props === 'object' ? input.props as Record<string, unknown> : undefined,
        }
      }

      return null
    },

    isAllowedDynamicComponent(name: string): boolean {
      const n = String(name ?? '').trim().toLowerCase()
      if (!n) return false
      return n.startsWith('cmh-') || n.startsWith('mt-')
    },

    getFilterComponent(kind: string): string | null {
      const k = String(kind ?? '').trim().toLowerCase()
      const map: Record<string, string> = {
        string: 'cmh-string-filter',
        number: 'cmh-number-filter',
        boolean: 'cmh-boolean-filter',
        date: 'cmh-date-filter',
        range: 'cmh-range-filter',
        existence: 'cmh-existence-filter',
        multi: 'cmh-multi-select-filter',
      }
      return map[k] ?? null
    },

    getScrollStyle(block: { scroll?: boolean; maxHeight?: number }): Record<string, string> {
      if (!block.scroll) return {}
      const maxHeight = block.maxHeight && block.maxHeight > 0 ? `${block.maxHeight}px` : '260px'
      return { maxHeight, overflow: 'auto' }
    },

    renderMarkdownText(text: string): string {
      return simpleMarkdown(text)
    },

    onUiActionButton(btn: ChatUiButton): void {
      if (btn.url) {
        window.open(btn.url, '_blank', 'noopener,noreferrer')
        return
      }

      this.$emit('action-button', {
        id: btn.id ?? crypto.randomUUID(),
        label: btn.label,
        variant: btn.variant ?? 'secondary',
        action: btn.action ?? 'ui.action',
        payload: btn.payload,
      } as ActionButton)
    },

    isAllowedIframeUrl(src: string): boolean {
      try {
        const url = new URL(src)
        if (url.protocol !== 'https:') return false
        const host = url.hostname.toLowerCase()
        return host.endsWith('youtube.com')
          || host.endsWith('youtu.be')
          || host.endsWith('player.vimeo.com')
      } catch {
        return false
      }
    },

    onFileChipClick(file: { id: string; name: string; type: string; dataUrl?: string }): void {
      if (file.dataUrl) {
        if (file.type.startsWith('image/')) {
          const win = window.open('', '_blank')
          if (win) {
            win.document.write(`<img src="${file.dataUrl}" alt="${file.name}" style="max-width:100%;height:auto;" />`)
            win.document.title = file.name
          }
        } else {
          const a = document.createElement('a')
          a.href = file.dataUrl
          a.download = file.name
          a.click()
        }
      }
    },

    copyMessageContent(): void {
      navigator.clipboard.writeText(this.message.content).then(() => {
        this.copied = true
        setTimeout(() => { this.copied = false }, 2000)
      })
    },

    startEdit(): void {
      this.$emit('edit-message', { messageId: this.message.id, content: this.message.content })
    },
  },
})
