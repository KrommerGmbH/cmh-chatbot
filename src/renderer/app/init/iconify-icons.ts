/**
 * Iconify 오프라인 아이콘 등록
 *
 * Phosphor Icons 전체 셋을 오프라인 번들에 등록한다.
 * cmh-chatbot은 Phosphor Icons regular를 기본 아이콘으로 사용한다.
 *
 * 사용법:
 *   <iconify-icon icon="ph:paperclip" />
 *   <iconify-icon icon="ph:microphone" />
 *   <iconify-icon icon="ph--chats-thin" />
 */
import { addCollection, addIcon } from '@iconify/vue/offline'
import phIcons from '@iconify-json/ph/icons.json'

// ── Phosphor Icons 전체 오프라인 등록 ──
addCollection(phIcons as Parameters<typeof addCollection>[0])

// ── 추가 개별 아이콘 (Phosphor에 없는 경우만) ──
addIcon('mdi:send', {
  body: '<path fill="currentColor" d="M2 21l21-9L2 3v7l15 2l-15 2v7z"/>',
  width: 24,
  height: 24,
})
