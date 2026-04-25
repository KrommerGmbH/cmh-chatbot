import { describe, expect, it } from 'vitest'
import { isUsableApiKey } from '../../../../shared/security/is-usable-api-key'

describe('isUsableApiKey', () => {
  it('returns false for empty or placeholder keys', () => {
    expect(isUsableApiKey('')).toBe(false)
    expect(isUsableApiKey('   ')).toBe(false)
    expect(isUsableApiKey('your-api-key')).toBe(false)
    expect(isUsableApiKey('replace-me')).toBe(false)
    expect(isUsableApiKey('sk-mock-key')).toBe(false)
    expect(isUsableApiKey('sk-ant-mock-test')).toBe(false)
  })

  it('returns false for explicit mock-like keys', () => {
    expect(isUsableApiKey('this-is-mock-token')).toBe(false)
    expect(isUsableApiKey('AIzaSy-mock-token')).toBe(false)
  })

  it('returns true for normal looking keys', () => {
    expect(isUsableApiKey('sk-live-123')).toBe(true)
    expect(isUsableApiKey('ghp_xxxxxxxxxxxxxxxxxxxx')).toBe(true)
    expect(isUsableApiKey('AIzaSyAABBCCDDEEFF')).toBe(true)
  })
})
