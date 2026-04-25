import { defineComponent, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import template from './cmh-page.html?raw'
import './cmh-page.scss'

export default defineComponent({
  name: 'cmh-page',
  template,

  props: {
    showSmartBar: { type: Boolean, default: true },
    showSearchBar: { type: Boolean, default: false },
  },

  setup() {
    const route = useRoute()
    const { t } = useI18n()

    const moduleColor = computed(() => (route.meta?.moduleColor as string) ?? '#189EFF')
    const moduleIcon = computed(() => (route.meta?.moduleIcon as string) ?? '')
    const pageTitle = computed(() => {
      const titleKey = route.meta?.titleKey as string | undefined
      return titleKey ? t(titleKey) : (route.meta?.title as string) ?? ''
    })

    return { moduleColor, moduleIcon, pageTitle, t }
  },
})
