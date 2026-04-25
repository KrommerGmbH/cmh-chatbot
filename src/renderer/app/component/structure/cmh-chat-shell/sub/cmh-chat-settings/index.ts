import { defineComponent, type PropType } from 'vue'
import type { ColorScheme, FontLevel, FontTokens } from '../../../../../store/ui-preferences.store'
import './cmh-chat-settings.scss'
import template from './cmh-chat-settings.html?raw'

export default defineComponent({
  name: 'cmh-chat-settings',
  template,

  props: {
    fontTokens: { type: Object as PropType<FontTokens>, required: true },
    fontLevels: { type: Array as PropType<FontLevel[]>, required: true },
    colorSchemeOptions: {
      type: Array as PropType<{ value: ColorScheme; label: string; color: string }[]>,
      required: true,
    },
    currentColorScheme: { type: String as PropType<ColorScheme>, required: true },
    currentTheme: { type: String as PropType<'light' | 'dark'>, required: true },
  },

  emits: ['update-font-token', 'reset-font-tokens', 'set-color-scheme', 'set-theme', 'close'],
})
