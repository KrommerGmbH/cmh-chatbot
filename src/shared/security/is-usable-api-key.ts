/**
 * Returns true when an API key looks real/usable.
 * Filters out empty placeholder/mock credentials.
 */
export function isUsableApiKey(key?: string | null): boolean {
  const k = (key ?? '').trim()
  if (!k) return false

  const lower = k.toLowerCase()
  if (lower.includes('mock')) return false
  if (lower === 'your-api-key' || lower === 'replace-me') return false
  if (k.startsWith('sk-mock-') || k === 'sk-mock-key') return false
  if (k.startsWith('sk-ant-mock-')) return false
  if (k.startsWith('AIzaSy') && lower.includes('mock')) return false

  return true
}
