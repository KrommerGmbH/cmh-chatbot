import { defineComponent, ref, reactive, onBeforeUnmount } from 'vue'
import template from './cmh-split-pane.html?raw'
import './cmh-split-pane.scss'

export interface AwSplitPaneConfig {
  /** 초기 너비 (px) — 마지막 visible 패인은 flex:1 이므로 적용 안 됨 */
  initial: number
  /** 최소 너비 (px) */
  min: number
  /** 최대 너비 (px), 미지정 시 무제한 */
  max?: number
}

/**
 * cmh-split-pane — 드래그 리사이즈 가능한 수평 분할 패인 컨테이너
 *
 * 슬롯: pane-0, pane-1, pane-2 ... (panes 배열 길이만큼)
 * 마지막 패인은 남은 공간을 flex:1 로 채운다.
 */
export default defineComponent({
  name: 'cmh-split-pane',
  template,

  props: {
    panes: {
      type: Array as () => AwSplitPaneConfig[],
      required: true,
    },
    /** 숨길 패인 인덱스 목록 (divider + pane 모두 숨김, 인접 패인이 flex:1로 확장) */
    hiddenPanes: {
      type: Array as () => number[],
      default: () => [],
    },
  },

  setup(props) {
    const container = ref<HTMLElement | null>(null)
    const sizes = reactive<number[]>(props.panes.map((p) => p.initial))
    const isDragging = ref(false)
    const draggingIndex = ref(-1)
    const startX = ref(0)
    const startSizes = ref<number[]>([])

    /** 해당 인덱스가 마지막 visible 패인인지 확인 */
    function isLastVisiblePane(index: number): boolean {
      const hidden = props.hiddenPanes ?? []
      for (let i = index + 1; i < props.panes.length; i++) {
        if (!hidden.includes(i)) return false
      }
      return true
    }

    /** 각 패인의 인라인 스타일 반환 */
    function paneStyle(index: number): Record<string, string> {
      // 숨김 패인: 공간 차지 안 함
      if ((props.hiddenPanes ?? []).includes(index)) {
        return { display: 'none' }
      }
      // 마지막 visible 패인: flex:1 로 나머지 공간 채움
      if (isLastVisiblePane(index)) {
        return {
          flex: '1 1 0',
          minWidth: `${props.panes[index].min}px`,
          overflow: 'hidden',
        }
      }
      return {
        width: `${sizes[index]}px`,
        minWidth: `${props.panes[index].min}px`,
        maxWidth: `${sizes[index]}px`,
        flexShrink: '0',
        overflow: 'hidden',
      }
    }

    function startDrag(index: number, event: MouseEvent): void {
      isDragging.value = true
      draggingIndex.value = index
      startX.value = event.clientX
      startSizes.value = [...sizes]
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function onMouseMove(event: MouseEvent): void {
      if (!isDragging.value) return

      const i = draggingIndex.value
      const dx = event.clientX - startX.value
      const paneA = props.panes[i]
      const paneB = props.panes[i + 1]
      const isLastB = i + 1 === props.panes.length - 1

      // A 패인: 시작 크기 + 드래그 델타
      let newA = startSizes.value[i] + dx
      newA = Math.max(paneA.min, newA)
      if (paneA.max !== undefined) newA = Math.min(paneA.max, newA)

      sizes[i] = newA

      // 마지막 패인이 아닌 경우에만 B 패인 크기 조정
      if (!isLastB && paneB) {
        let newB = startSizes.value[i + 1] - dx
        newB = Math.max(paneB.min, newB)
        if (paneB.max !== undefined) newB = Math.min(paneB.max, newB)
        sizes[i + 1] = newB
      }
    }

    function onMouseUp(): void {
      isDragging.value = false
      draggingIndex.value = -1
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    })

    return {
      container,
      sizes,
      isDragging,
      draggingIndex,
      isLastVisiblePane,
      paneStyle,
      startDrag,
    }
  },
})
