import type { ModelOption } from '../../../../../store/chat.store'

export function shouldShowProviderApiKeyHint(models: ModelOption[]): boolean {
  if (!models || models.length === 0) return false
  const cloudModels = models.filter((m) => m.providerType === 'cloud-api')
  if (cloudModels.length === 0) return false
  return cloudModels.every((m) => !m.hasApiKey)
}
