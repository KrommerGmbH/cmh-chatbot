/**
 * cmh-admin-menu-item — 재귀 네비게이션 메뉴 아이템
 *
 * Shopware sw-admin-menu-item 포팅.
 * 전역 등록 (main.ts) 후 자기 자신을 재귀 호출 가능.
 */
import { defineComponent, computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminMenuStore } from '../../../store/admin-menu.store'
import type { NavigationEntryWithChildren } from '@core/factory/module.factory'
import template from './cmh-admin-menu-item.html?raw'
import './cmh-admin-menu-item.scss'

export default defineComponent({
  name: 'cmh-admin-menu-item',
  template,

  props: {
    entry: {
      type: Object as PropType<NavigationEntryWithChildren>,
      required: true,
    },
    /** 사이드바 펼침 여부 (collapsible-text 제어용) */
    sidebarExpanded: {
      type: Boolean,
      default: true,
    },
  },

  setup(props) {
    const adminMenuStore = useAdminMenuStore()
    const isHovered = ref(false)
    const { t, te } = useI18n()

    // ── Computed ────────────────────────────────────────────────────
    const hasChildren = computed(
      () => (props.entry.children?.length ?? 0) > 0,
    )

    /**
     * showMenuItem: children 있거나 path 있을 때만 표시.
     * Shopware showMenuItem 로직 대응.
     * children 없고 path 도 없는 빈 카테고리는 숨김.
     */
    const showMenuItem = computed(
      () => hasChildren.value || !!props.entry.path,
    )

    /** 이 항목의 children 펼침 여부 */
    const isExpanded = computed(
      () => adminMenuStore.isEntryExpanded(props.entry.id),
    )

    const itemClasses = computed(() => ({
      [`navigation-list-item__level-${props.entry.level}`]: true,
      'navigation-list-item__has-children': hasChildren.value,
      'is--entry-expanded': isExpanded.value,
    }))

    const showFlyout = computed(
      () => props.entry.level === 1 && hasChildren.value && !props.sidebarExpanded && isHovered.value,
    )

    const resolvedLabel = computed(() => {
      const label = props.entry.label
      if (label.includes('.') && te(label)) {
        return t(label)
      }

      return label
    })

    // ── Methods ─────────────────────────────────────────────────────
    function onToggleExpand(): void {
      if (!props.sidebarExpanded) {
        return
      }

      if (isExpanded.value) {
        adminMenuStore.collapseMenuEntry(props.entry.id)
      } else {
        adminMenuStore.expandMenuEntry(props.entry.id)
      }
    }

    function onMouseEnter(): void {
      isHovered.value = true
    }

    function onMouseLeave(): void {
      isHovered.value = false
    }

    /**
     * router-link 클릭 시 admin menu collapse/expand 처리.
     *
     * - entry.collapseAdminMenu !== false (true 또는 undefined)
     *   → 메뉴가 펼쳐진 상태면 접음, 닫힌 상태면 무시
     * - entry.collapseAdminMenu === false
     *   → 현재 상태 유지 (설정 허브처럼 사이드바를 유지해야 하는 화면)
     */
    function onNavigate(): void {
      const collapseAdminMenu = (props.entry as { collapseAdminMenu?: boolean }).collapseAdminMenu
      if (collapseAdminMenu !== false) {
        // true 또는 undefined (기본): 펼쳐진 상태면 접기, 닫힌 상태면 무시
        if (adminMenuStore.isExpanded) {
          adminMenuStore.collapseSidebar()
        }
      }
    }

    /**
     * plugin 타입의 첫 번째 항목 앞에 구분선 표시.
     * Shopware isFirstPluginInMenuEntries 대응.
     */
    function isFirstPlugin(child: NavigationEntryWithChildren, idx: number): boolean {
      if (child.moduleType !== 'plugin') return false
      // 이전 항목이 plugin이 아닌 경우에만 구분선
      const prev = idx > 0 ? props.entry.children[idx - 1] : null
      return !prev || prev.moduleType !== 'plugin'
    }

    return {
      hasChildren,
      showMenuItem,
      isExpanded,
      itemClasses,
      showFlyout,
      resolvedLabel,
      onToggleExpand,
      onMouseEnter,
      onMouseLeave,
      onNavigate,
      isFirstPlugin,
    }
  },
})
