import { describe, expect, it } from 'vitest'
import { shouldShowProviderApiKeyHint } from '../../../src/renderer/app/component/structure/cmh-chat-shell/sub/cmh-chat-input/model-picker.utils'

describe('model-picker.utils', () => {
  it('shows provider hint when all cloud models have no api key', () => {
    expect(shouldShowProviderApiKeyHint([
      { providerType: 'cloud-api', hasApiKey: false } as any,
      { providerType: 'cloud-api', hasApiKey: false } as any,
    ])).toBe(true)
  })

  it('hides provider hint when at least one cloud model has api key', () => {
    expect(shouldShowProviderApiKeyHint([
      { providerType: 'cloud-api', hasApiKey: false } as any,
      { providerType: 'cloud-api', hasApiKey: true } as any,
    ])).toBe(false)
  })
})
