/**
 * cmh-modal — 범용 모달 다이얼로그
 *
 * Shopware sw-modal 패턴 마이그레이션.
 * - 좌/우 독립 드래그로 너비 조절 (CHECKLIST F-2)
 * - Props: title, icon, width, minWidth, maxWidth, showCloseButton, closable, isLoading, resizable
 * - Emits: modal-close
 * - Slots: default, header, footer
 */
import { defineComponent, ref, computed, onMounted, onUnmounted } from 'vue'
import template from './cmh-modal.html?raw'
import './cmh-modal.scss'

type ResizeSide = 'left' | 'right'

export default defineComponent({
  name: 'cmh-modal',
  template,

  props: {
    /** 모달 제목 */
    title: {
      type: String,
      default: '',
    },
    /** 헤더 아이콘 (mt-icon name) */
    icon: {
      type: String,
      default: '',
    },
    /** 초기 너비 (CSS 값 — 'px' | '%' | 'vw') */
    width: {
      type: String,
      default: '50%',
    },
    minWidth: {
      type: String,
      default: '320px',
    },
    maxWidth: {
      type: String,
      default: '90vw',
    },
    /** 닫기 버튼 표시 여부 */
    showCloseButton: {
      type: Boolean,
      default: true,
    },
    /** backdrop 클릭 / ESC 키 닫기 허용 여부 */
    closable: {
      type: Boolean,
      default: true,
    },
    /** 로딩 오버레이 */
    isLoading: {
      type: Boolean,
      default: false,
    },
    /** 좌우 드래그 너비 조절 활성화 */
    resizable: {
      type: Boolean,
      default: true,
    },
  },

  emits: ['modal-close'],

  setup(props, { emit }) {
    const dialogEl = ref<HTMLElement | null>(null)

    // ── 너비 상태 (px 수치로 관리) ─────────────────────────────────
    const currentWidthPx = ref<number | null>(null)
    const dialogOffsetXPx = ref(0)

    const dialogStyle = computed(() => {
      const w = currentWidthPx.value !== null
        ? `${currentWidthPx.value}px`
        : props.width
      return {
        width: w,
        minWidth: props.minWidth,
        maxWidth: props.maxWidth,
        transform: `translateX(${dialogOffsetXPx.value}px)`,
      }
    })

    // ── 드래그 리사이즈 ───────────────────────────────────────────
    let resizeSide: ResizeSide = 'right'
    let startX = 0
    let startWidth = 0
    let startOffsetX = 0

    function onResizeStart(e: MouseEvent, side: ResizeSide): void {
      if (!dialogEl.value) return
      resizeSide = side
      startX = e.clientX
      startWidth = dialogEl.value.offsetWidth
      startOffsetX = dialogOffsetXPx.value

      document.addEventListener('mousemove', onResizeMove)
      document.addEventListener('mouseup', onResizeEnd)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ew-resize'
    }

    function onResizeMove(e: MouseEvent): void {
      if (!dialogEl.value) return

      const minPx = parsePx(props.minWidth, window.innerWidth) ?? 320
      const maxPx = parsePx(props.maxWidth, window.innerWidth) ?? window.innerWidth * 0.9

      let newWidth: number

      if (resizeSide === 'right') {
        // 오른쪽 핸들: 우측으로 드래그 → 넓어짐
        const delta = e.clientX - startX
        newWidth = Math.min(maxPx, Math.max(minPx, startWidth + delta))
      } else {
        // 왼쪽 핸들: 왼쪽으로 드래그 → 넓어짐 (delta 반전)
        const delta = startX - e.clientX
        newWidth = Math.min(maxPx, Math.max(minPx, startWidth + delta))
      }

      currentWidthPx.value = newWidth

      const widthDelta = newWidth - startWidth
      dialogOffsetXPx.value = resizeSide === 'right'
        ? startOffsetX + (widthDelta / 2)
        : startOffsetX - (widthDelta / 2)
    }

    function onResizeEnd(): void {
      document.removeEventListener('mousemove', onResizeMove)
      document.removeEventListener('mouseup', onResizeEnd)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    /** CSS 값 → px 숫자로 변환 (vw, %, px 지원) */
    function parsePx(val: string, containerWidth: number): number | null {
      if (!val) return null
      if (val.endsWith('px')) return parseFloat(val)
      if (val.endsWith('vw')) return (parseFloat(val) / 100) * window.innerWidth
      if (val.endsWith('%')) return (parseFloat(val) / 100) * containerWidth
      return null
    }

    // ── 닫기 ─────────────────────────────────────────────────────
    function onClose(): void {
      if (props.closable) emit('modal-close')
    }

    function onBackdropClick(): void {
      onClose()
    }

    // ESC 키
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }

    onMounted(() => {
      document.addEventListener('keydown', onKeydown)
      // 초기 너비 px 파싱
      const parsed = parsePx(props.width, window.innerWidth)
      if (parsed) currentWidthPx.value = parsed
    })

    onUnmounted(() => {
      document.removeEventListener('keydown', onKeydown)
      onResizeEnd()
    })

    return {
      dialogEl,
      dialogStyle,
      onClose,
      onBackdropClick,
      onResizeStart,
    }
  },
})
