import { defineComponent } from 'vue'
import template from './cmh-discard-changes-modal.html?raw'
import './cmh-discard-changes-modal.scss'

export default defineComponent({
  name: 'cmh-discard-changes-modal',
  template,
  emits: ['discard-changes', 'keep-editing', 'modal-close'],
})
