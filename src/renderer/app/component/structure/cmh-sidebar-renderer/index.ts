/**
 * cmh-sidebar-renderer — 우측 사이드바 렌더러
 *
 * Shopware sw-sidebar + sw-sidebar-renderer 대응.
 *
 * - SidebarFactory에 등록된 SidebarItemDefinition 목록을 렌더링
 * - 아이콘 탭 클릭으로 패널 열기/닫기
 * - 동적 컴포넌트 렌더링 지원
 *
 * 플러그인 사용 예:
 * ```ts
 * // 플러그인 init에서
 * AideWorks.Sidebar.register({
 *   id: 'my-filter',
 *   moduleName: 'my-module',
 *   component: 'my-filter-panel',  // 전역 등록 컴포넌트 이름
 *   icon: 'regular-filter',
 *   label: '필터',
 *   pluginName: 'MyPlugin',
 *   position: 10,
 *   badge: () => store.activeFilterCount,
 * })
 * ```
 */
import { defineComponent, ref, computed } from 'vue'
import SidebarFactory from '@core/factory/sidebar.factory'
import template from './cmh-sidebar-renderer.html?raw'
import './cmh-sidebar-renderer.scss'

export default defineComponent({
  name: 'cmh-sidebar-renderer',
  template,

  props: {
    /**
     * 현재 활성 모듈 이름.
     * 설정 시 해당 모듈에 등록된 sidebar만 필터링.
     * 미설정 시 전체 sidebar 표시.
     */
    activeModule: {
      type: String,
      default: '',
    },

    /**
     * 현재 활성 entity 이름.
     * 설정 시 해당 entity에 등록된 sidebar도 포함.
     */
    activeEntity: {
      type: String,
      default: '',
    },

    /**
     * 동적 컴포넌트에 전달할 추가 props
     */
    componentProps: {
      type: Object,
      default: () => ({}),
    },
  },

  emits: ['panel-open', 'panel-close'],

  setup(props, { emit }) {
    const activeItemId = ref<string | null>(null)
    const isPanelOpen = ref(false)

    // ── 계산 속성 ─────────────────────────────────────────────────
    /**
     * 현재 컨텍스트에 맞는 사이드바 항목 목록.
     * activeModule, activeEntity 필터 적용.
     */
    const sidebarItems = computed(() => {
      const all = SidebarFactory.getAll()

      if (props.activeModule || props.activeEntity) {
        return all.filter((item) => {
          if (props.activeModule && item.moduleName === props.activeModule) return true
          if (props.activeEntity && item.entityName === props.activeEntity) return true
          return false
        })
      }

      return all
    })

    const activeItem = computed(() =>
      sidebarItems.value.find((item) => item.id === activeItemId.value),
    )

    const sidebarClasses = computed(() => ({
      'is--panel-open': isPanelOpen.value,
    }))

    const activeItemProps = computed(() => ({
      ...props.componentProps,
    }))

    // ── 이벤트 핸들러 ─────────────────────────────────────────────
    function onTabClick(itemId: string) {
      if (activeItemId.value === itemId && isPanelOpen.value) {
        // 같은 탭 클릭 → 패널 닫기
        closePanel()
      } else {
        activeItemId.value = itemId
        isPanelOpen.value = true
        emit('panel-open', activeItem.value)
      }
    }

    function closePanel() {
      isPanelOpen.value = false
      emit('panel-close', activeItem.value)
    }

    return {
      activeItemId,
      isPanelOpen,
      sidebarItems,
      activeItem,
      sidebarClasses,
      activeItemProps,
      onTabClick,
      closePanel,
    }
  },
})
