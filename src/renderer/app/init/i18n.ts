/**
 * CMH Chatbot i18n 초기화
 *
 * vue-i18n v9 Composition API 모드.
 * 5개 locale: ko-KR (기본), en-GB (fallback), de-DE, zh-CN, ja-JP
 */
import { createI18n } from 'vue-i18n'

// ── Global component snippets ──
import globalEnGB from '../snippet/en-GB.json'
import globalKoKR from '../snippet/ko-KR.json'
import globalDeDE from '../snippet/de-DE.json'
import globalZhCN from '../snippet/zh-CN.json'
import globalJaJP from '../snippet/ja-JP.json'

// ── Module snippets ──
import chatEnGB from '../../module/cmh-chat/snippet/en-GB.json'
import chatKoKR from '../../module/cmh-chat/snippet/ko-KR.json'
import chatDeDE from '../../module/cmh-chat/snippet/de-DE.json'
import chatZhCN from '../../module/cmh-chat/snippet/zh-CN.json'
import chatJaJP from '../../module/cmh-chat/snippet/ja-JP.json'

import workflowEnGB from '../../module/cmh-workflow/snippet/en-GB.json'
import workflowKoKR from '../../module/cmh-workflow/snippet/ko-KR.json'
import workflowDeDE from '../../module/cmh-workflow/snippet/de-DE.json'
import workflowZhCN from '../../module/cmh-workflow/snippet/zh-CN.json'
import workflowJaJP from '../../module/cmh-workflow/snippet/ja-JP.json'

import providerEnGB from '../../module/cmh-provider/snippet/en-GB.json'
import providerKoKR from '../../module/cmh-provider/snippet/ko-KR.json'
import providerDeDE from '../../module/cmh-provider/snippet/de-DE.json'
import providerZhCN from '../../module/cmh-provider/snippet/zh-CN.json'
import providerJaJP from '../../module/cmh-provider/snippet/ja-JP.json'

import modelEnGB from '../../module/cmh-model/snippet/en-GB.json'
import modelKoKR from '../../module/cmh-model/snippet/ko-KR.json'
import modelDeDE from '../../module/cmh-model/snippet/de-DE.json'
import modelZhCN from '../../module/cmh-model/snippet/zh-CN.json'
import modelJaJP from '../../module/cmh-model/snippet/ja-JP.json'

import settingsEnGB from '../../module/cmh-settings/snippet/en-GB.json'
import settingsKoKR from '../../module/cmh-settings/snippet/ko-KR.json'
import settingsDeDE from '../../module/cmh-settings/snippet/de-DE.json'
import settingsZhCN from '../../module/cmh-settings/snippet/zh-CN.json'
import settingsJaJP from '../../module/cmh-settings/snippet/ja-JP.json'

import mediaEnGB from '../../module/cmh-media/snippet/en-GB.json'
import mediaKoKR from '../../module/cmh-media/snippet/ko-KR.json'
import mediaDeDE from '../../module/cmh-media/snippet/de-DE.json'
import mediaZhCN from '../../module/cmh-media/snippet/zh-CN.json'
import mediaJaJP from '../../module/cmh-media/snippet/ja-JP.json'

import agentEnGB from '../../module/cmh-agent/snippet/en-GB.json'
import agentKoKR from '../../module/cmh-agent/snippet/ko-KR.json'
import agentDeDE from '../../module/cmh-agent/snippet/de-DE.json'
import agentZhCN from '../../module/cmh-agent/snippet/zh-CN.json'
import agentJaJP from '../../module/cmh-agent/snippet/ja-JP.json'

import logEnGB from '../../module/cmh-log/snippet/en-GB.json'
import logKoKR from '../../module/cmh-log/snippet/ko-KR.json'
import logDeDE from '../../module/cmh-log/snippet/de-DE.json'
import logZhCN from '../../module/cmh-log/snippet/zh-CN.json'
import logJaJP from '../../module/cmh-log/snippet/ja-JP.json'

// ── 기본값 ──
export const DEFAULT_LOCALE = 'ko-KR'
export const FALLBACK_LOCALE = 'en-GB'

export type AppLocale = 'ko-KR' | 'en-GB' | 'de-DE' | 'zh-CN' | 'ja-JP'

export const SUPPORTED_LOCALES: AppLocale[] = ['ko-KR', 'en-GB', 'de-DE', 'zh-CN', 'ja-JP']

function mergeMessages(...sources: Record<string, unknown>[]): Record<string, string | Record<string, unknown>> {
  const result: Record<string, string | Record<string, unknown>> = {}
  for (const src of sources) Object.assign(result, src)
  return result
}

function withLocaleAliases(
  messages: Record<string, Record<string, string | Record<string, unknown>>>,
) {
  return {
    ...messages,
    en: messages['en-GB'],
    de: messages['de-DE'],
    ko: messages['ko-KR'],
    zh: messages['zh-CN'],
    ja: messages['ja-JP'],
  }
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: withLocaleAliases({
    'en-GB': mergeMessages(globalEnGB, chatEnGB, workflowEnGB, providerEnGB, modelEnGB, settingsEnGB, mediaEnGB, agentEnGB, logEnGB),
    'de-DE': mergeMessages(globalDeDE, chatDeDE, workflowDeDE, providerDeDE, modelDeDE, settingsDeDE, mediaDeDE, agentDeDE, logDeDE),
    'ko-KR': mergeMessages(globalKoKR, chatKoKR, workflowKoKR, providerKoKR, modelKoKR, settingsKoKR, mediaKoKR, agentKoKR, logKoKR),
    'zh-CN': mergeMessages(globalZhCN, chatZhCN, workflowZhCN, providerZhCN, modelZhCN, settingsZhCN, mediaZhCN, agentZhCN, logZhCN),
    'ja-JP': mergeMessages(globalJaJP, chatJaJP, workflowJaJP, providerJaJP, modelJaJP, settingsJaJP, mediaJaJP, agentJaJP, logJaJP),
  }) as never,
})

export function applyAppLocale(locale?: string | null): string {
  const normalized = normalizeLocale(locale)
  ;(i18n.global.locale as unknown as { value: string }).value = normalized
  document.documentElement.lang = normalized
  return normalized
}

function normalizeLocale(locale?: string | null): AppLocale {
  if (!locale) return DEFAULT_LOCALE
  const found = SUPPORTED_LOCALES.find(
    (l) => l === locale || l.split('-')[0] === locale.split('-')[0],
  )
  return found ?? DEFAULT_LOCALE
}

applyAppLocale(DEFAULT_LOCALE)
