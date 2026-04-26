import { describe, expect, it, vi } from 'vitest'
import { createModelWarmupRegistry } from '../../../src/renderer/app/service/model-warmup-registry'

describe('model-warmup-registry', () => {
  it('deduplicates concurrent warmup calls for same model', async () => {
    const registry = createModelWarmupRegistry()
    const task = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return true
    })

    const [a, b, c] = await Promise.all([
      registry.run('model-a', task),
      registry.run('model-a', task),
      registry.run('model-a', task),
    ])

    expect(a).toBe(true)
    expect(b).toBe(true)
    expect(c).toBe(true)
    expect(task).toHaveBeenCalledTimes(1)
    expect(registry.isWarmed('model-a')).toBe(true)
  })

  it('does not mark warmed on failed warmup and allows retry', async () => {
    const registry = createModelWarmupRegistry()

    const first = vi.fn(async () => false)
    const second = vi.fn(async () => true)

    expect(await registry.run('model-b', first)).toBe(false)
    expect(registry.isWarmed('model-b')).toBe(false)

    expect(await registry.run('model-b', second)).toBe(true)
    expect(second).toHaveBeenCalledTimes(1)
    expect(registry.isWarmed('model-b')).toBe(true)
  })
})
