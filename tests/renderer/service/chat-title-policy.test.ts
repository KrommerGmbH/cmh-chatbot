import { describe, expect, it } from 'vitest'
import { isDefaultConversationTitle } from '../../../src/renderer/app/service/chat-title-policy'

describe('chat-title-policy', () => {
  it('returns true for default titles', () => {
    expect(isDefaultConversationTitle('새 채팅')).toBe(true)
    expect(isDefaultConversationTitle('새채팅')).toBe(true)
    expect(isDefaultConversationTitle('New Chat')).toBe(true)
  })

  it('returns false for generated/custom titles', () => {
    expect(isDefaultConversationTitle('Gemma 모델 비교 요약')).toBe(false)
    expect(isDefaultConversationTitle('2026-04-26 작업 정리')).toBe(false)
  })
})
