import { defineComponent } from 'vue'
import template from './cmh-search-more-results.html?raw'
import './cmh-search-more-results.scss'

export default defineComponent({
  name: 'cmh-search-more-results',
  template,
  props: {
    entity: {
      type: String,
      required: true,
    },
    term: {
      type: String,
      default: '',
    },
  },
  emits: ['open'],
})
