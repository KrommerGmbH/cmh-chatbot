/**
 * cmh-search-bar — 전역 검색바
 *
 * Shopware sw-search-bar 대응.
 *
 * 특징:
 * - EntityDefinitionFactory에 등록된 entity의 searchFields를 읽어 검색
 * - entity 타입 필터링 지원
 * - 키보드 탐색 지원 (화살표 키, Enter, Esc)
 */
import { defineComponent, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminMenuStore } from '../../../store/admin-menu.store'
import EntityDefinitionFactory from '@core/factory/entity-definition.factory'
import type { AnyEntityDefinition } from '@core/factory/entity-definition.factory'
import ModuleFactory from '@core/factory/module.factory'
import template from './cmh-search-bar.html?raw'
import './cmh-search-bar.scss'

// ── 검색 결과 타입 ──────────────────────────────────────────────────
interface SearchResultItem {
  id: string
  name: string
  description?: string
  icon?: string
  entityType: string
  routeName?: string
  routeParams?: Record<string, string>
  /** 클릭 시 이동할 route path */
  routePath?: string
  /** 원본 데이터 */
  raw?: unknown
}

interface SearchResultGroup {
  type: string
  label: string
  icon?: string
  items: SearchResultItem[]
  color?: string
}

interface SearchTypeOption {
  name: string
  label: string
  icon?: string
  color?: string
}

// 검색 딜레이 (ms)
const SEARCH_DEBOUNCE_MS = 300

export default defineComponent({
  name: 'cmh-search-bar',
  template,

  props: {
    /** 초기 검색 타입 (entity type name) */
    initialSearchType: {
      type: String,
      default: '',
    },
    /** 검색바 placeholder */
    placeholder: {
      type: String,
      default: '',
    },
    customSearchTypes: {
      type: Array as () => SearchTypeOption[],
      default: () => [],
    },
    customSearchHandler: {
      type: Function as unknown as () => ((term: string, typeName: string) => Promise<SearchResultItem[]> | SearchResultItem[]),
      default: null,
    },
    syncTypeWithRoute: {
      type: Boolean,
      default: true,
    },
  },

  emits: ['search', 'select'],

  setup(props, { emit }) {
    const searchInput = ref<HTMLInputElement | null>(null)
    const searchTerm = ref('')
    const currentSearchType = ref(props.initialSearchType)
    const showResults = ref(false)
    const isLoading = ref(false)
    const results = ref<SearchResultItem[]>([])
    const activeGroupType = ref('')
    const activeItemIndex = ref(0)

    const router = useRouter()
    const route = useRoute()
    const { t } = useI18n()
    const adminMenuStore = useAdminMenuStore()

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const isMobileView = ref(false)
    const isSearchBarShown = ref(true)

    // ── 계산 속성 ───────────────────────────────────────────────────
    const searchBarClasses = computed(() => ({
      'is--active': showResults.value,
      'is--with-type': !!currentSearchType.value,
      'is--search-shown': isSearchBarShown.value,
    }))
    const searchBarFieldClasses = computed(() => ({
      'is--active': showResults.value,
    }))
    const showTypePicker = ref(false)
    const showResultsContainer = computed(
      () => showResults.value && (results.value.length > 0 || isLoading.value || !!searchTerm.value.trim()),
    )

    const hasCustomSearch = computed(() => props.customSearchTypes.length > 0 && !!props.customSearchHandler)

    function translateMaybeKey(value: string | undefined): string {
      if (!value) return ''
      return value.includes('.') ? t(value) : value
    }

    const availableSearchTypes = computed<SearchTypeOption[]>(() => {
      if (hasCustomSearch.value) {
        return props.customSearchTypes
      }

      const types = Array.from(EntityDefinitionFactory.getRegistry().values())
      return types
        .filter((def) => def.searchFields?.some((f) => f.searchable) ?? true)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        .map((def) => ({
          name: def.name,
          label: translateMaybeKey(def.label),
          icon: def.icon,
          color: def.color,
        }))
    })

    const searchTypeMap = computed(() => new Map(availableSearchTypes.value.map((type) => [type.name, type])))

    const selectedTypeLabel = computed(() => {
      if (!currentSearchType.value) {
        return t('cmh-global.searchBar.allTypes')
      }
      return searchTypeMap.value.get(currentSearchType.value)?.label ?? currentSearchType.value
    })

    const resolvedPlaceholder = computed(() => props.placeholder || t('cmh-global.searchBar.placeholder'))

    const currentTypeColor = computed(() => {
      if (!currentSearchType.value) return 'var(--color-accent, #6ad6f0)'
      const customType = searchTypeMap.value.get(currentSearchType.value)
      if (customType?.color) return customType.color

      const def = EntityDefinitionFactory.get(currentSearchType.value)
      if (def?.color) return def.color
      const module = Array.from(ModuleFactory.getRegistry().values()).find((mod) =>
        mod.entities?.some((entity) => entity.name === currentSearchType.value),
      )
      return module?.color ?? 'var(--color-accent, #6ad6f0)'
    })

    const selectedTypeIcon = computed(() => {
      if (!currentSearchType.value) return 'regular-layer-group'
      return searchTypeMap.value.get(currentSearchType.value)?.icon ?? 'regular-list'
    })

    function isTypeSelected(typeName: string) {
      return currentSearchType.value === typeName
    }

    function toggleType(typeName: string) {
      setSearchType(typeName)
    }

    function clearTypeSelection() {
      currentSearchType.value = ''
      if (searchTerm.value.trim()) {
        performSearch(searchTerm.value)
      }
      if (!hasCustomSearch.value && route.name !== 'aw.dashboard.index') {
        void router.push({ name: 'aw.dashboard.index' })
      }
    }

    function getEntityListRouteForType(typeName: string): string | null {
      for (const mod of ModuleFactory.getRegistry().values()) {
        if (mod.entities?.some((entity) => entity.name === typeName)) {
          const candidate = mod.routes?.find((r) => {
            const name = r.name?.toString() ?? ''
            return name.endsWith('.list') || name.endsWith('.index')
          })
          if (candidate && candidate.name) return candidate.name as string
        }
      }
      return null
    }

    function setSearchType(typeName: string) {
      currentSearchType.value = typeName
      showTypePicker.value = false
      if (searchTerm.value.trim()) {
        performSearch(searchTerm.value)
      }

      const targetRoute = hasCustomSearch.value ? null : getEntityListRouteForType(typeName)
      if (targetRoute) {
        void router.push({ name: targetRoute })
      }
    }

    function selectAllTypes() {
      currentSearchType.value = ''
      showTypePicker.value = false
      if (searchTerm.value.trim()) {
        performSearch(searchTerm.value)
      }
      if (!hasCustomSearch.value && route.name !== 'aw.dashboard.index') {
        void router.push({ name: 'aw.dashboard.index' })
      }
    }

    function syncTypeFromRoute(routeName: string | undefined) {
      if (!routeName) {
        currentSearchType.value = ''
        return
      }

      const mod = Array.from(ModuleFactory.getRegistry().values()).find((m) =>
        m.routes?.some((r) => r.name === routeName),
      )

      if (!mod || !mod.entities || mod.entities.length === 0) {
        currentSearchType.value = ''
        return
      }

      currentSearchType.value = mod.entities[0].name
    }

    if (props.syncTypeWithRoute) {
      syncTypeFromRoute(route.name as string)
      watch(
        () => route.name,
        (name) => syncTypeFromRoute(name as string),
      )
    }

    /**
     * 검색 결과를 entity 타입별로 그룹화
     */
    const groupedResults = computed<SearchResultGroup[]>(() => {
      const groups = new Map<string, SearchResultGroup>()

      results.value.forEach((item) => {
        if (!groups.has(item.entityType)) {
          const typeDef = searchTypeMap.value.get(item.entityType)
          const def = EntityDefinitionFactory.get(item.entityType)
          groups.set(item.entityType, {
            type: item.entityType,
            label: translateMaybeKey(typeDef?.label ?? def?.label ?? item.entityType),
            icon: typeDef?.icon ?? def?.icon,
            items: [],
            color: typeDef?.color ?? def?.color,
          })
        }
        groups.get(item.entityType)!.items.push(item)
      })

      return [...groups.values()]
    })

    // ── 검색 로직 ───────────────────────────────────────────────────
    async function performSearch(term: string) {
      if (!term.trim()) {
        results.value = []
        return
      }

      if (hasCustomSearch.value && props.customSearchHandler) {
        isLoading.value = true
        const customResults = await Promise.resolve(props.customSearchHandler(term.trim(), currentSearchType.value))
        results.value = customResults
        isLoading.value = false
        emit('search', { term: term.trim(), results: customResults })
        return
      }

      isLoading.value = true
      const query = term.trim()

      const candidates = currentSearchType.value
        ? [EntityDefinitionFactory.get(currentSearchType.value)].filter((def): def is AnyEntityDefinition => !!def)
        : Array.from(EntityDefinitionFactory.getRegistry().values())
          .filter((def) => def.searchFields?.some((f) => f.searchable) ?? true)

      const searchPromises = candidates.map(async (def) => {
        const fields = (def.searchFields ?? [
          { field: 'name', label: 'cmh-global.labels.name', searchable: true },
          { field: 'label', label: 'cmh-global.labels.label', searchable: true },
        ]).filter((f) => f.searchable).map((f) => f.field)

        if (fields.length === 0) return { def, items: [] as unknown[] }

        try {
          const { data } = await window.aideworks.dataSearch<any>(def.name, {
            page: 1,
            limit: 8,
            filters: [{ type: 'containsAny', fields, value: query }],
          })
          return { def, items: data }
        } catch {
          return { def, items: [] as unknown[] }
        }
      })

      const resolved = await Promise.all(searchPromises)

      const found: SearchResultItem[] = []

      resolved.forEach(({ def, items }) => {
        items.forEach((rawItem: any) => {
          const displayName =
            rawItem.name || rawItem.label || rawItem.title || rawItem.fileName || String(rawItem.id)

          const description =
            rawItem.description || rawItem.subtitle || rawItem.type || ''

          found.push({
            id: `${def.name}:${rawItem.id}`,
            name: displayName,
            description,
            icon: def.icon,
            entityType: def.name,
            raw: rawItem,
          })
        })
      })

      if (found.length === 0) {
        // 정의 메타정보 검색 대체
        candidates.forEach((def) => {
          const lowerLabel = def.label.toLowerCase()
          const lowerName = def.name.toLowerCase()
          if (lowerLabel.includes(query.toLowerCase()) || lowerName.includes(query.toLowerCase())) {
            found.push({
              id: `entity-def-${def.name}`,
              name: def.label,
              description: def.description,
              icon: def.icon,
              entityType: def.name,
            })
          }
        })
      }

      results.value = found
      isLoading.value = false
      emit('search', { term: query, results: found })
    }

    // ── 이벤트 핸들러 ───────────────────────────────────────────────
    function onInput() {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => performSearch(searchTerm.value), SEARCH_DEBOUNCE_MS)
    }

    function onFocus() {
      showResults.value = true
      isSearchBarShown.value = true
      if (searchTerm.value) performSearch(searchTerm.value)
    }

    function onBlur() {
      // 결과 클릭 처리 후 닫기
      setTimeout(() => {
        showResults.value = false
      }, 200)
    }

    function onEscape() {
      clearSearch()
    }

    function onEnter() {
      const activeGroup = groupedResults.value.find((g) => g.type === activeGroupType.value)
      if (activeGroup && activeGroup.items[activeItemIndex.value]) {
        onSelectResult(activeGroup.items[activeItemIndex.value])
      }
    }

    function onArrowDown() {
      if (!groupedResults.value.length) return
      const currentGroup = groupedResults.value.find((g) => g.type === activeGroupType.value)
      if (!currentGroup) {
        activeGroupType.value = groupedResults.value[0].type
        activeItemIndex.value = 0
        return
      }
      if (activeItemIndex.value < currentGroup.items.length - 1) {
        activeItemIndex.value++
      }
    }

    function onArrowUp() {
      if (activeItemIndex.value > 0) {
        activeItemIndex.value--
      }
    }

    function clearSearch() {
      searchTerm.value = ''
      results.value = []
      showResults.value = false
    }

    function updateViewportState() {
      isMobileView.value = window.innerWidth <= 500
      isSearchBarShown.value = !isMobileView.value
    }

    function showSearchBar() {
      isSearchBarShown.value = true
      adminMenuStore.closeOffCanvas()
      requestAnimationFrame(() => searchInput.value?.focus())
    }

    function hideSearchBar() {
      clearSearch()

      if (isMobileView.value) {
        isSearchBarShown.value = false
      }
    }

    function toggleOffCanvas() {
      adminMenuStore.toggleOffCanvas()
    }

    function clearSearchType() {
      currentSearchType.value = ''
    }

    function onSelectResult(item: SearchResultItem) {
      emit('select', item)

      if (item.routeName) {
        void router.push({ name: item.routeName, params: item.routeParams ?? {} })
      } else if (item.routePath) {
        void router.push(item.routePath)
      }

      clearSearch()
    }

    function onOpenMoreResults(payload: { entity: string; term: string }) {
      setSearchType(payload.entity)
      showResults.value = false
    }

    function isActiveItem(groupType: string, idx: number) {
      return activeGroupType.value === groupType && activeItemIndex.value === idx
    }

    function setActiveItem(groupType: string, idx: number) {
      activeGroupType.value = groupType
      activeItemIndex.value = idx
    }

    // searchTerm watch
    watch(searchTerm, (val) => {
      if (!val) results.value = []
    })

    onMounted(() => {
      updateViewportState()
      window.addEventListener('resize', updateViewportState)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', updateViewportState)
    })

    return {
      searchInput,
      searchTerm,
      currentSearchType,
      showTypePicker,
      isSearchBarShown,
      showResultsContainer,
      showResults,
      isLoading,
      results,
      groupedResults,
      availableSearchTypes,
      searchBarClasses,
      selectedTypeLabel,
      selectedTypeIcon,
      currentTypeColor,
      resolvedPlaceholder,
      searchBarFieldClasses,
      onInput,
      onFocus,
      onBlur,
      onEscape,
      onEnter,
      onArrowDown,
      onArrowUp,
      clearSearch,
      showSearchBar,
      hideSearchBar,
      toggleOffCanvas,
      clearTypeSelection,
      selectAllTypes,
      setSearchType,
      toggleType,
      isTypeSelected,
      onSelectResult,
      onOpenMoreResults,
      isActiveItem,
      setActiveItem,
    }
  },
})
