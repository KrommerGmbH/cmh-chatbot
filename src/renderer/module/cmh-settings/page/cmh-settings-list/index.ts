import { defineComponent } from 'vue'
import template from './cmh-settings-list.html?raw'
import './cmh-settings-list.scss'

export default defineComponent({
  name: 'cmh-settings-list',
  template,

  data() {
    return {
      isLoading: false,
    }
  },

  created() {
    this.createdComponent()
  },

  methods: {
    createdComponent(): void {
      // 향후 설정 데이터 로드
    },

    navigateToSection(section: string): void {
      void this.$router.push({ name: 'cmh.settings.detail', params: { section } })
    },
  },
})
