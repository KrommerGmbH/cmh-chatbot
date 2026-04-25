/**
 * CMH Chatbot Renderer — main.ts
 *
 * AideWorks main.ts 부트스트랩 패턴 포팅.
 * 채팅 셸(기본) + 관리 화면(설정) 듀얼 모드.
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ModuleFactory from './app/factory/module.factory'
import { VueAdapter } from './app/adapter/vue-adapter'
import { useUiPreferencesStore } from './app/store/ui-preferences.store'

// ── CSS ──
import './assets/scss/variables.scss'
import './assets/scss/global.scss'

// ── Structure 컴포넌트 (정적 import) ──
import CmhAdmin from './app/component/structure/cmh-admin'
import CmhDesktop from './app/component/structure/cmh-desktop'
import CmhAdminMenu from './app/component/structure/cmh-admin-menu'
import CmhPage from './app/component/structure/cmh-page'
import CmhChatShell from './app/component/structure/cmh-chat-shell'
import CmhRangeSlider from './app/component/base/cmh-range-slider'

// ── Mixin 등록 (모듈 로드 전 반드시 실행) ──
import './app/mixin'

// ── 모듈/플러그인 비동기 로드 ──
const moduleGlob = import.meta.glob('./module/*/index.ts')

// ── Dark Mode 초기화 (mount 전) ──
const pinia = createPinia()
const app = createApp(CmhAdmin)
app.use(pinia)

const uiPreferencesStore = useUiPreferencesStore(pinia)
uiPreferencesStore.hydrate()

const vueAdapter = new VueAdapter(app)

;(async (): Promise<void> => {
  // ── 모듈 동적 로드 ──
  await ModuleFactory.loadModulesAsync(moduleGlob)

  // ── Router (모듈 등록 완료 후 동적 import) ──
  const { router } = await import('./router')

  // ── Structure 컴포넌트 글로벌 등록 ──
  const structureComponents = [
    ['cmh-admin', CmhAdmin],
    ['cmh-desktop', CmhDesktop],
    ['cmh-admin-menu', CmhAdminMenu],
    ['cmh-page', CmhPage],
    ['cmh-chat-shell', CmhChatShell],
    ['cmh-range-slider', CmhRangeSlider],
  ] as const

  for (const [name, comp] of structureComponents) {
    vueAdapter.registerComponent(name, comp)
  }

  // ── 어댑터 초기화 (Meteor, Iconify, i18n) ──
  vueAdapter.init()
  app.use(router)

  // ── Mount ──
  vueAdapter.mount('#app')
})()
