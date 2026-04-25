import { defineComponent } from 'vue'
import template from './cmh-in-app-purchase-checkout.html?raw'
import './cmh-in-app-purchase-checkout.scss'

export default defineComponent({
  name: 'cmh-in-app-purchase-checkout',
  template,
  props: {
    entry: {
      type: Object,
      default: null,
    },
  },
  emits: ['modal-close'],
})
