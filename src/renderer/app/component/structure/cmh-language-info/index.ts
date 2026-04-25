import { defineComponent } from 'vue'
import template from './cmh-language-info.html?raw'
import './cmh-language-info.scss'

export default defineComponent({
  name: 'cmh-language-info',
  template,
  props: {
    infoText: {
      type: String,
      default: '',
    },
    infoParent: {
      type: String,
      default: '',
    },
  },
  emits: ['click-parent-language'],
})
