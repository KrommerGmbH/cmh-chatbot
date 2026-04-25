import { describe, expect, it } from 'vitest'
import {
  createAllProvidersCriteria,
  createProviderModelsCriteria,
  createProviderSearchCriteria,
} from '../../../src/engine/server/routes/criteria-factory'

describe('criteria-factory', () => {
  it('builds provider search criteria with type/isActive', () => {
    const criteria = createProviderSearchCriteria({ type: 'cloud-api', isActive: 'true', limit: 50 })
    const payload = criteria.toJSON()

    expect(payload.limit).toBe(50)
    expect(payload.filters).toHaveLength(2)
    expect(payload.sortings).toHaveLength(1)
  })

  it('builds provider models criteria by providerId', () => {
    const criteria = createProviderModelsCriteria('provider-1', 25)
    const payload = criteria.toJSON()

    expect(payload.limit).toBe(25)
    expect(payload.filters).toHaveLength(1)
  })

  it('builds all providers criteria with default limit', () => {
    const criteria = createAllProvidersCriteria()
    const payload = criteria.toJSON()

    expect(payload.limit).toBe(100)
  })
})
