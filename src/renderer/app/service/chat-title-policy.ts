const DEFAULT_TITLES = new Set([
  '새 채팅',
  '새채팅',
  'New Chat',
  'Neuer Chat',
  '新对话',
  '新しいチャット',
])

export function isDefaultConversationTitle(title?: string | null): boolean {
  const normalized = (title ?? '').trim()
  if (!normalized) return true
  return DEFAULT_TITLES.has(normalized)
}
