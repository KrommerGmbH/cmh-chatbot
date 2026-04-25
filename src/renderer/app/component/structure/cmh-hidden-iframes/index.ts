import { defineComponent } from 'vue'
import template from './cmh-hidden-iframes.html?raw'

export default defineComponent({
  name: 'cmh-hidden-iframes',
  template,
  props: {
    extensions: {
      type: Array,
      default: () => [],
    },
    locationId: {
      type: String,
      default: 'MAIN_HIDDEN',
    },
  },
})
