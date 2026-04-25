import { defineComponent } from 'vue'
import template from './cmh-sales-channel-config.html?raw'
import './cmh-sales-channel-config.scss'

export default defineComponent({
  name: 'cmh-sales-channel-config',
  template,
  props: {
    selectedSalesChannelId: {
      type: String,
      default: '',
    },
    options: {
      type: Array,
      default: () => [],
    },
    actualConfigData: {
      type: Object,
      default: () => ({}),
    },
    allConfigs: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['update:selectedSalesChannelId', 'save'],
  methods: {
    onInput(value: string): void {
      this.$emit('update:selectedSalesChannelId', value)
      this.$emit('save', value)
    },
  },
})
