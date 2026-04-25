/// <reference types="vite/client" />

/** 컴포넌트 .html 파일을 문자열 템플릿으로 import (?raw suffix 사용) */
declare module '*.html?raw' {
  const content: string
  export default content
}

/** Vite define — 빌드 시 앱 버전 주입 */
declare const __APP_VERSION__: string

declare global {
  interface Window {
    aideworks?: {
      dataSearch: <T>(entity: string, criteria: Record<string, unknown>) => Promise<{ data: T[]; total: number }>
      dataGet: <T>(entity: string, id: string) => Promise<T | null>
      dataSave: <T>(entity: string, payload: T) => Promise<T>
      dataDelete: (entity: string, id: string) => Promise<boolean>
      getTheme?: () => Promise<boolean>
      setTheme?: (mode: 'dark' | 'light' | 'system') => Promise<boolean>
      onThemeChange?: (callback: (isDark: boolean) => void) => (() => void)
    }

    CmhChatbot: typeof import('./app/factory/module.factory').default & {
      Component: {
        register: (name: string, loader: () => Promise<unknown>) => void
        getRegistry: () => Map<string, () => Promise<unknown>>
      }
    }
  }

  const CmhChatbot: Window['CmhChatbot']
}

export {}
