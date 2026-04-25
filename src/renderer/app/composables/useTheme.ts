/**
 * useTheme — Electron Dark Mode + Meteor 테마 연동 Composable
 *
 * Meteor Component Library는 [data-theme='dark'] attribute 셀렉터로
 * 다크 모드 CSS custom properties를 오버라이드한다.
 *
 * 따라서 document.documentElement 에 data-theme 속성만 설정하면
 * Meteor 컴포넌트 전체가 자동으로 다크/라이트 테마로 전환된다.
 *
 * 사용법:
 * ```ts
 * // main.ts or cmh-admin/index.ts
 * const { isDark, setTheme } = useTheme()
 * ```
 */
import { ref, readonly } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// 앱 전역 단일 상태 (모듈 스코프 싱글턴)
// ─────────────────────────────────────────────────────────────────────────────
const isDark = ref(false)
let initialized = false
let cleanupListener: (() => void) | null = null

/**
 * document.documentElement에 Meteor 다크모드 attribute 적용.
 * - isDark=true  → data-theme="dark"
 * - isDark=false → data-theme 제거 (라이트모드)
 */
function applyTheme(dark: boolean): void {
  isDark.value = dark
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

/**
 * useTheme — Electron nativeTheme 기반 다크모드 composable.
 *
 * init()을 한 번 호출하면 OS 테마 변경 이벤트를 자동으로 구독하고,
 * Meteor CSS custom properties가 적용된다.
 */
export function useTheme() {
  /**
   * 초기화 (앱 시작 시 main.ts에서 한 번만 호출).
   * - 현재 시스템 테마를 조회하여 즉시 적용
   * - OS 테마 변경 이벤트 구독
   */
  async function init(): Promise<void> {
    if (initialized) return
    initialized = true

    if (!window.aideworks?.getTheme) {
      // Electron 환경이 아닌 경우 (웹 dev server 등) — prefers-color-scheme 폴백
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mediaQuery.matches)
      mediaQuery.addEventListener('change', (e) => applyTheme(e.matches))
      return
    }

    // Electron: 현재 테마 조회 후 즉시 적용
    const currentIsDark = await window.aideworks.getTheme()
    applyTheme(currentIsDark)

    // OS 테마 변경 이벤트 구독
    cleanupListener = window.aideworks.onThemeChange((dark) => {
      applyTheme(dark)
    })
  }

  /**
   * 테마 수동 설정.
   * 'system' = OS 설정에 따름 (기본값).
   */
  async function setTheme(mode: 'dark' | 'light' | 'system'): Promise<void> {
    if (!window.aideworks?.setTheme) {
      applyTheme(mode === 'dark')
      return
    }
    const resultIsDark = await window.aideworks.setTheme(mode)
    applyTheme(resultIsDark)
  }

  /** 다크/라이트 토글 */
  async function toggleTheme(): Promise<void> {
    await setTheme(isDark.value ? 'light' : 'dark')
  }

  /** cleanup — 앱 종료 전 IPC 리스너 해제 */
  function destroy(): void {
    cleanupListener?.()
    cleanupListener = null
    initialized = false
  }

  return {
    /** 현재 다크모드 여부 (reactive, readonly) */
    isDark: readonly(isDark),
    init,
    setTheme,
    toggleTheme,
    destroy,
  }
}
