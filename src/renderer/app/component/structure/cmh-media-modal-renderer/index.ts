import { defineComponent } from 'vue'
import template from './cmh-media-modal-renderer.html?raw'
import './cmh-media-modal-renderer.scss'

export default defineComponent({
  name: 'cmh-media-modal-renderer',
  template,
  props: {
    mediaModal: {
      type: Object,
      default: null,
    },
  },
  emits: ['media-modal-selection-change', 'modal-close'],
})
