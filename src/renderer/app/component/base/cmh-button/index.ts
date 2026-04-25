import { defineComponent } from 'vue'
import template from './cmh-button.html?raw'
import './cmh-button.scss'

export default defineComponent({
  name: 'cmh-button',
  inheritAttrs: false,

  props: {
    widthMultiplier: {
      type: Number,
      required: false,
      default: 2,
    },

    baseWidth: {
      type: String,
      required: false,
      default: '88px',
    },

    block: {
      type: Boolean,
      required: false,
      default: false,
    },
  },

  computed: {
    buttonClasses(): Record<string, boolean> {
      return {
        'is--block': this.block,
      }
    },

    buttonStyle(): Record<string, string> {
      return {
        '--cmh-button-width-multiplier': String(this.widthMultiplier),
        '--cmh-button-base-width': this.baseWidth,
      }
    },
  },

  template,
})
