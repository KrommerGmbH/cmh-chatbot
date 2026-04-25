import { defineComponent } from 'vue'
import template from './cmh-inheritance-warning.html?raw'
import './cmh-inheritance-warning.scss'

export default defineComponent({
  name: 'cmh-inheritance-warning',
  template,
  props: {
    name: {
      type: String,
      default: '',
    },
  },
})
