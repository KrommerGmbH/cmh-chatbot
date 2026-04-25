import { defineComponent } from 'vue'
import { useRoute } from 'vue-router'
import { InMemoryDataAdapter } from '@engine/data/data-adapter'
import { RepositoryFactory } from '@engine/data/repository-factory'
import { Criteria } from '@engine/data/criteria'
import { seedDefaultData, ENTITY_CMH_LLM_MODEL } from '@engine/data/seed'
import type { LlmModel } from '@engine/data/entity/llm/llm-model.entity'
import { getAutoRead, setAutoRead, setTtsOptions } from '@/app/service/tts.service'
import template from './cmh-settings-detail.html?raw'
import './cmh-settings-detail.scss'

// Ensure entity definitions are registered
import '@engine/data/entity/llm/llm-model.definition'

// DAL 초기화
const _adapter = new InMemoryDataAdapter()
seedDefaultData(_adapter)
const _repoFactory = new RepositoryFactory(_adapter)
const _modelRepo = _repoFactory.create<LlmModel>(ENTITY_CMH_LLM_MODEL)

export default defineComponent({
  name: 'cmh-settings-detail',
  template,

  data() {
    return {
      isLoading: false,
      section: 'general' as string,

      // TTS
      ttsModels: [] as LlmModel[],
      selectedTtsModelId: '' as string,
      ttsRate: 1.0,
      ttsAutoRead: false,

      // STT
      sttModels: [] as LlmModel[],
      selectedSttModelId: '' as string,
      sttStatus: 'idle' as string,
    }
  },

  computed: {
    sttStatusText(): string {
      const map: Record<string, string> = {
        'idle': this.$t('cmh-settings.detail.stt.status.idle'),
        'loading-model': this.$t('cmh-settings.detail.stt.status.loadingModel'),
        'ready': this.$t('cmh-settings.detail.stt.status.ready'),
        'recording': this.$t('cmh-settings.detail.stt.status.recording'),
        'transcribing': this.$t('cmh-settings.detail.stt.status.transcribing'),
        'error': this.$t('cmh-settings.detail.stt.status.error'),
      }
      return map[this.sttStatus] ?? this.sttStatus
    },
  },

  created() {
    this.createdComponent()
  },

  methods: {
    async createdComponent(): Promise<void> {
      const route = useRoute()
      this.section = (route.params.section as string) ?? 'general'
      this.ttsAutoRead = getAutoRead()
      await this.loadModels()
    },

    async loadModels(): Promise<void> {
      this.isLoading = true
      try {
        // TTS 모델 로드
        const ttsCriteria = new Criteria()
        ttsCriteria.addFilter(Criteria.equals('type', 'tts'))
        ttsCriteria.addFilter(Criteria.equals('isActive', true))
        const ttsResult = await _modelRepo.search(ttsCriteria)
        this.ttsModels = ttsResult.data

        // STT 모델 로드
        const sttCriteria = new Criteria()
        sttCriteria.addFilter(Criteria.equals('type', 'stt'))
        sttCriteria.addFilter(Criteria.equals('isActive', true))
        const sttResult = await _modelRepo.search(sttCriteria)
        this.sttModels = sttResult.data

        // 기본 선택: isDefault 또는 첫 번째
        const defaultTts = this.ttsModels.find((m) => m.isDefault) ?? this.ttsModels[0]
        if (defaultTts) this.selectedTtsModelId = defaultTts.id

        const defaultStt = this.sttModels.find((m) => m.isDefault) ?? this.sttModels[0]
        if (defaultStt) this.selectedSttModelId = defaultStt.id
      } finally {
        this.isLoading = false
      }
    },

    selectTtsModel(id: string): void {
      this.selectedTtsModelId = id
      // 향후: 선택된 모델을 TTS 서비스에 연결
    },

    selectSttModel(id: string): void {
      this.selectedSttModelId = id
      // 향후: 선택된 모델을 STT 서비스에 연결
    },

    onTtsRateChange(event: Event): void {
      const target = event.target as HTMLInputElement
      this.ttsRate = parseFloat(target.value)
      setTtsOptions({ rate: this.ttsRate })
    },

    toggleAutoRead(): void {
      this.ttsAutoRead = !this.ttsAutoRead
      setAutoRead(this.ttsAutoRead)
    },

    navigateBack(): void {
      this.$router.push({ name: 'cmh.settings.list' })
    },
  },
})
