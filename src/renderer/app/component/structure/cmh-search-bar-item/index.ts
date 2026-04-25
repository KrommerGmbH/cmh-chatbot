import { defineComponent } from 'vue'
import template from './cmh-search-bar-item.html?raw'
import './cmh-search-bar-item.scss'

export default defineComponent({
  name: 'cmh-search-bar-item',
  template,
  props: {
    item: {
      type: Object,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['select', 'mouseenter'],
})
