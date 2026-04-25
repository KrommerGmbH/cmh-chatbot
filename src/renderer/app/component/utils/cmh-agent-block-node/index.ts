/**
 * cmh-agent-block-node — Vue Flow 커스텀 노드 (에이전트 LangChain 블록)
 *
 * cmh-agent-core 미니에디터 캔버스에 표시되는 LangChain 블록 노드.
 * Handle(좌/우 포트) + 이모지 아이콘 + 라벨.
 */
import { defineComponent, type PropType } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import template from './cmh-agent-block-node.html?raw'
import './cmh-agent-block-node.scss'

interface AgentBlockNodeData {
  blockId: string
  label: string
  icon: string
  category: string
}

export default defineComponent({
  name: 'cmh-agent-block-node',
  template,
  components: { Handle },

  props: {
    id: { type: String, required: true },
    data: { type: Object as PropType<AgentBlockNodeData>, required: true },
  },

  data() {
    return {
      Position,
    }
  },
})
