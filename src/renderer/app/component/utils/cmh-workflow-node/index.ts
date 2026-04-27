/**
 * cmh-workflow-node — Vue Flow 커스텀 노드 컴포넌트
 *
 * Phase 6.2: 워크플로우 캔버스에 표시되는 노드 블록.
 * Handle(입출력 포트) + 아이콘 + 라벨 + 실행 상태 표시.
 */
import { defineComponent, type PropType } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Icon as IconifyIcon } from '@iconify/vue'
import type { WorkflowNodeData } from '../../../store/workflow.store'
import template from './cmh-workflow-node.html?raw'
import './cmh-workflow-node.scss'

export default defineComponent({
  name: 'cmh-workflow-node',
  template,
  components: { Handle, IconifyIcon },

  props: {
    id: { type: String, required: true },
    data: { type: Object as PropType<WorkflowNodeData>, required: true },
    selected: { type: Boolean, default: false },
  },

  data() {
    return {
      Position,
    }
  },

  computed: {
    statusClass(): string {
      return this.data.status ? `cmh-workflow-node--${this.data.status}` : ''
    },

    blockTypeClass(): string {
      return `cmh-workflow-node--${this.data.blockType}`
    },

    nodeLabel(): string {
      return this.data.label || this.data.blockType
    },

    nodeIcon(): string {
      return this.data.icon || 'ph:circle'
    },
  },
})
