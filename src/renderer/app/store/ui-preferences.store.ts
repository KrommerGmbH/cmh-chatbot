/**
 * UI Preferences Store
 *
 * 테마, 로케일, 폰트 토큰(5단계), 색상 스킴, 뷰 모드 등 UI 환경 설정.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { applyAppLocale, DEFAULT_LOCALE, type AppLocale } from '../init/i18n'

export type ThemeMode = 'light' | 'dark'
export type ShellMode = 'chat' | 'admin'
export type ColorScheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'lavender'

// ── Font Token 시스템 (AideWorks 동일 패턴) ─────────────

export interface FontToken {
  size: number
  weight: number
}

export interface FontTokens {
  xs: FontToken
  sm: FontToken
  base: FontToken
  lg: FontToken
  xl: FontToken
}

export const FONT_LEVELS = ['xs', 'sm', 'base', 'lg', 'xl'] as const
export type FontLevel = (typeof FONT_LEVELS)[number]

export const DEFAULT_FONT_TOKENS: FontTokens = {
  xs: { size: 12, weight: 400 },
  sm: { size: 13, weight: 400 },
  base: { size: 14, weight: 400 },
  lg: { size: 18, weight: 500 },
  xl: { size: 20, weight: 600 },
}

// ── localStorage 키 ─────────────────────────────────────

const LS_THEME = 'cmh_theme'
const LS_LOCALE = 'cmh_locale'
const LS_SHELL_MODE = 'cmh_shell_mode'
const LS_FONT_TOKENS = 'cmh_font_tokens'
const LS_COLOR_SCHEME = 'cmh_color_scheme'
const DEFAULT_THEME: ThemeMode = 'dark'

/** 색상 스킴 프리셋 — CSS custom properties */
const COLOR_SCHEME_MAP: Record<ColorScheme, Record<string, string>> = {
  default: {
    '--cmh-accent': '#0e639c',
    '--cmh-accent-hover': '#1177bb',
    '--cmh-user-bubble': '#0e639c',
    '--cmh-assistant-bubble': 'var(--color-bg-secondary, #252526)',
    '--cmh-user-text': '#ffffff',
  },
  ocean: {
    '--cmh-accent': '#0077b6',
    '--cmh-accent-hover': '#0096c7',
    '--cmh-user-bubble': '#0077b6',
    '--cmh-assistant-bubble': '#1b2838',
    '--cmh-user-text': '#ffffff',
  },
  forest: {
    '--cmh-accent': '#2d6a4f',
    '--cmh-accent-hover': '#40916c',
    '--cmh-user-bubble': '#2d6a4f',
    '--cmh-assistant-bubble': '#1b2e1b',
    '--cmh-user-text': '#ffffff',
  },
  sunset: {
    '--cmh-accent': '#e76f51',
    '--cmh-accent-hover': '#f4845f',
    '--cmh-user-bubble': '#e76f51',
    '--cmh-assistant-bubble': '#2a1f1a',
    '--cmh-user-text': '#ffffff',
  },
  lavender: {
    '--cmh-accent': '#7b2cbf',
    '--cmh-accent-hover': '#9d4edd',
    '--cmh-user-bubble': '#7b2cbf',
    '--cmh-assistant-bubble': '#1f1a2e',
    '--cmh-user-text': '#ffffff',
  },
}

// ── Font Token 유틸리티 함수 ────────────────────────────

function applyFontTokens(tokens: FontTokens): void {
  const root = document.documentElement.style
  for (const level of FONT_LEVELS) {
    root.setProperty(`--cmh-font-size-${level}`, `${tokens[level].size}px`)
    root.setProperty(`--cmh-font-weight-${level}`, String(tokens[level].weight))
  }
  // 호환성 별칭
  root.setProperty('--cmh-font-base', `${tokens.base.size}px`)
  root.setProperty('--cmh-font-chat', `${tokens.sm.size}px`)
  root.setProperty('--cmh-font-code', `${tokens.xs.size}px`)
}

function getStoredFontTokens(): FontTokens {
  const stored = localStorage.getItem(LS_FONT_TOKENS)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<FontTokens>
      return {
        xs: { ...DEFAULT_FONT_TOKENS.xs, ...parsed.xs },
        sm: { ...DEFAULT_FONT_TOKENS.sm, ...parsed.sm },
        base: { ...DEFAULT_FONT_TOKENS.base, ...parsed.base },
        lg: { ...DEFAULT_FONT_TOKENS.lg, ...parsed.lg },
        xl: { ...DEFAULT_FONT_TOKENS.xl, ...parsed.xl },
      }
    } catch { /* fallback */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_FONT_TOKENS))
}

function persistFontTokens(tokens: FontTokens): void {
  localStorage.setItem(LS_FONT_TOKENS, JSON.stringify(tokens))
}

export const useUiPreferencesStore = defineStore('cmh-ui-preferences', () => {
  const theme = ref<ThemeMode>((localStorage.getItem(LS_THEME) as ThemeMode) ?? DEFAULT_THEME)
  const locale = ref<AppLocale>((localStorage.getItem(LS_LOCALE) as AppLocale) ?? DEFAULT_LOCALE)
  const shellMode = ref<ShellMode>((localStorage.getItem(LS_SHELL_MODE) as ShellMode) ?? 'chat')
  const fontTokens = ref<FontTokens>(getStoredFontTokens())
  const colorScheme = ref<ColorScheme>((localStorage.getItem(LS_COLOR_SCHEME) as ColorScheme) ?? 'default')

  function setTheme(value: ThemeMode): void {
    theme.value = value
    localStorage.setItem(LS_THEME, value)
    document.documentElement.dataset.theme = value
  }

  function setLocale(value: AppLocale): AppLocale {
    const normalized = applyAppLocale(value)
    locale.value = normalized as AppLocale
    localStorage.setItem(LS_LOCALE, normalized)
    return normalized as AppLocale
  }

  function setShellMode(mode: ShellMode): void {
    shellMode.value = mode
    localStorage.setItem(LS_SHELL_MODE, mode)
  }

  function toggleShellMode(): void {
    setShellMode(shellMode.value === 'chat' ? 'admin' : 'chat')
  }

  // ── Font Token 관리 ─────────────────────────────────

  function setFontTokenSet(tokens: FontTokens): void {
    fontTokens.value = tokens
    persistFontTokens(tokens)
    applyFontTokens(tokens)
  }

  function updateFontToken(level: FontLevel, field: 'size' | 'weight', value: number): void {
    fontTokens.value[level][field] = value
    persistFontTokens(fontTokens.value)
    applyFontTokens(fontTokens.value)
  }

  function resetFontTokens(): void {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_FONT_TOKENS)) as FontTokens
    setFontTokenSet(defaults)
  }

  function setColorScheme(value: ColorScheme): void {
    colorScheme.value = value
    localStorage.setItem(LS_COLOR_SCHEME, value)
    applyColorScheme(value)
  }

  function applyColorScheme(value: ColorScheme): void {
    const vars = COLOR_SCHEME_MAP[value]
    const root = document.documentElement
    for (const [prop, val] of Object.entries(vars)) {
      root.style.setProperty(prop, val)
    }
  }

  function hydrate(): void {
    const storedTheme = localStorage.getItem(LS_THEME) as ThemeMode | null
    const storedLocale = localStorage.getItem(LS_LOCALE) as AppLocale | null
    const storedShellMode = localStorage.getItem(LS_SHELL_MODE) as ShellMode | null

    if (storedTheme) setTheme(storedTheme)
    else setTheme(DEFAULT_THEME)

    if (storedLocale) setLocale(storedLocale)
    else applyAppLocale(DEFAULT_LOCALE)

    if (storedShellMode) shellMode.value = storedShellMode

    // 폰트 토큰 적용
    fontTokens.value = getStoredFontTokens()
    applyFontTokens(fontTokens.value)

    // 색상 스킴 적용
    const storedColorScheme = localStorage.getItem(LS_COLOR_SCHEME) as ColorScheme | null
    if (storedColorScheme && COLOR_SCHEME_MAP[storedColorScheme]) {
      colorScheme.value = storedColorScheme
    }
    applyColorScheme(colorScheme.value)
  }

  return {
    theme,
    locale,
    shellMode,
    fontTokens,
    colorScheme,
    setTheme,
    setLocale,
    setShellMode,
    toggleShellMode,
    setFontTokenSet,
    updateFontToken,
    resetFontTokens,
    setColorScheme,
    hydrate,
    COLOR_SCHEME_MAP,
  }
})
