import { defineComponent, type PropType } from 'vue'
import { repositoryFactory } from '@core/data'
import { Criteria } from '@core/data'
import template from './cmh-many-to-many-assignment-card.html?raw'

/**
 * @module cmh-many-to-many-assignment-card
 * @description M:N 관계를 위한 범용 할당 카드 컴포넌트
 *
 * Shopware sw-many-to-many-assignment-card 마이그레이션.
 * 검색 + 할당 + 해제 + 그리드 표시를 하나의 카드에 통합한다.
 *
 * 사용 예 (Agent ↔ Model 할당):
 * ```html
 * <cmh-many-to-many-assignment-card
 *   entity-name="aw_llm_model"
 *   :assigned-items="assignedModels"
 *   :columns="modelColumns"
 *   label-property="name"
 *   :placeholder="$t('cmh-agent.detail.searchModels')"
 *   @add-item="onAddModel"
 *   @remove-item="onRemoveModel"
 * />
 * ```
 */
export default defineComponent({
  name: 'cmh-many-to-many-assignment-card',
  template,

  inject: {
    repositoryFactory: { default: null },
  },

  emits: ['add-item', 'remove-item'],

  props: {
    /** 검색 대상 엔티티명 (e.g. 'aw_llm_model') */
    entityName: {
      type: String,
      required: true,
    },

    /** 현재 할당된 항목 배열 */
    assignedItems: {
      type: Array as PropType<Record<string, unknown>[]>,
      required: true,
    },

    /** 그리드 컬럼 정의 */
    columns: {
      type: Array as PropType<{ property: string; label: string; sortable?: boolean }[]>,
      required: true,
    },

    /** 검색 결과에서 표시할 속성명 */
    labelProperty: {
      type: String,
      default: 'name',
    },

    /** 검색 입력 placeholder */
    placeholder: {
      type: String,
      default: '',
    },

    /** 카드 제목 */
    cardTitle: {
      type: String,
      default: '',
    },

    /** 비활성화 여부 */
    disabled: {
      type: Boolean,
      default: false,
    },

    /** 검색 결과 최대 개수 */
    resultLimit: {
      type: Number,
      default: 25,
    },

    /** 검색 가능한 필드 목록 (비어있으면 labelProperty만 검색) */
    searchableFields: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
  },

  data() {
    return {
      searchTerm: '',
      searchResults: [] as Record<string, unknown>[],
      isSearching: false,
      showResults: false,
      gridPage: 1,
      gridLimit: 10,
    }
  },

  computed: {
    searchRepository() {
      const factory = this.repositoryFactory as typeof repositoryFactory
      return factory.create(this.entityName)
    },

    assignedIds(): Set<string> {
      return new Set(this.assignedItems.map((item) => String(item.id)))
    },

    paginatedItems(): Record<string, unknown>[] {
      const start = (this.gridPage - 1) * this.gridLimit
      return this.assignedItems.slice(start, start + this.gridLimit)
    },

    totalAssigned(): number {
      return this.assignedItems.length
    },
  },

  watch: {
    searchTerm(val: string) {
      if (val.length >= 1) {
        void this.doSearch()
      } else {
        this.searchResults = []
        this.showResults = false
      }
    },
  },

  methods: {
    async doSearch(): Promise<void> {
      this.isSearching = true
      try {
        const criteria = new Criteria().setPage(1).setLimit(this.resultLimit)
        const term = this.searchTerm.trim()

        if (term) {
          const fields = this.searchableFields.length > 0 ? this.searchableFields : [this.labelProperty]
          if (fields.length === 1) {
            criteria.addFilter(Criteria.contains(fields[0], term))
          } else {
            criteria.addFilter(
              Criteria.multi('OR', fields.map((f) => Criteria.contains(f, term)))
            )
          }
        }

        const result = await this.searchRepository.search(criteria)
        this.searchResults = (result.data ?? result) as Record<string, unknown>[]
        this.showResults = true
      } catch (e) {
        console.error('[cmh-many-to-many-assignment-card] search error:', e)
        this.searchResults = []
      } finally {
        this.isSearching = false
      }
    },

    isSelected(item: Record<string, unknown>): boolean {
      return this.assignedIds.has(String(item.id))
    },

    onSelectItem(item: Record<string, unknown>): void {
      if (this.isSelected(item)) return
      this.$emit('add-item', item)
      // 검색 결과에서 선택 상태 즉시 반영
      this.searchTerm = ''
      this.showResults = false
    },

    onRemoveItem(item: Record<string, unknown>): void {
      this.$emit('remove-item', item)
    },

    onSearchFocus(): void {
      if (this.searchTerm.length >= 1 && this.searchResults.length > 0) {
        this.showResults = true
      }
    },

    onSearchBlur(): void {
      // 결과 클릭 처리를 위해 약간의 지연
      setTimeout(() => {
        this.showResults = false
      }, 200)
    },

    onGridPageChange({ page }: { page: number }): void {
      this.gridPage = page
    },

    getItemLabel(item: Record<string, unknown>): string {
      return String(item[this.labelProperty] ?? item.id ?? '')
    },
  },
})
