import { defineComponent } from 'vue'
import template from './cmh-error.html?raw'
import './cmh-error.scss'

export default defineComponent({
  name: 'cmh-error',
  template,
  props: {
    statusCode: {
      type: [String, Number],
      default: '',
    },
    title: {
      type: String,
      default: 'cmh-global.default.warning',
    },
    message: {
      type: String,
      default: '',
    },
    error: {
      type: Object,
      default: null,
    },
    showStack: {
      type: Boolean,
      default: false,
    },
    showLink: {
      type: Boolean,
      default: false,
    },
    linkText: {
      type: String,
      default: 'cmh-global.actions.back',
    },
    imagePath: {
      type: String,
      default: '',
    },
  },
})
