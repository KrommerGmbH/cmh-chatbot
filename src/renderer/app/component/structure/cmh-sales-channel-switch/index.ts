import { defineComponent } from 'vue'
import template from './cmh-sales-channel-switch.html?raw'
import './cmh-sales-channel-switch.scss'

export default defineComponent({
  name: 'cmh-sales-channel-switch',
  template,
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    label: {
      type: String,
      default: 'cmh-global.salesChannel.label',
    },
    placeholder: {
      type: String,
      default: 'cmh-global.salesChannel.defaultOption',
    },
    options: {
      type: Array,
      default: () => [],
    },
    salesChannelId: {
      type: String,
      default: '',
    },
    showUnsavedChangesModal: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:value', 'close-changes-modal', 'revert-unsaved-changes', 'save-changes'],
  methods: {
    onChange(value: string): void {
      this.$emit('update:value', value)
    },
  },
})
