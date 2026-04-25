import { defineComponent, ref } from 'vue'
import template from './cmh-help-center-v2.html?raw'
import './cmh-help-center-v2.scss'

export default defineComponent({
  name: 'cmh-help-center-v2',
  template,

  setup() {
    const isOpen = ref(false)

    function toggleOpen(): void {
      isOpen.value = !isOpen.value
    }

    function closePanel(): void {
      isOpen.value = false
    }

    return {
      isOpen,
      toggleOpen,
      closePanel,
    }
  },
})
