type WarmupTask = () => Promise<boolean>

export interface ModelWarmupRegistry {
  isWarmed(modelId: string): boolean
  run(modelId: string, task: WarmupTask): Promise<boolean>
}

export function createModelWarmupRegistry(): ModelWarmupRegistry {
  const warmed = new Set<string>()
  const inFlight = new Map<string, Promise<boolean>>()

  return {
    isWarmed(modelId: string): boolean {
      return warmed.has(modelId)
    },

    run(modelId: string, task: WarmupTask): Promise<boolean> {
      if (warmed.has(modelId)) return Promise.resolve(true)

      const existing = inFlight.get(modelId)
      if (existing) return existing

      const pending = (async () => {
        const ok = await task()
        if (ok) warmed.add(modelId)
        return ok
      })().finally(() => {
        inFlight.delete(modelId)
      })

      inFlight.set(modelId, pending)
      return pending
    },
  }
}
