import { computed, defineComponent } from 'vue'
import template from './cmh-desktop.html?raw'
import './cmh-desktop.scss'

export default defineComponent({
  name: 'cmh-desktop',
  template,

  props: {
    noNavigation: { type: Boolean, default: false },
  },

  setup(props) {
    const desktopClasses = computed(() => ({
      'cmh-desktop--no-nav': props.noNavigation,
    }))
    return { desktopClasses }
  },
})
