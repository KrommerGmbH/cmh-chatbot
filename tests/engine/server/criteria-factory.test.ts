import { describe, expect, it } from 'vitest'
import {
  createAllProvidersCriteria,
  createProviderModelsCriteria,
  createProviderSearchCriteria,
} from '../../../src/engine/server/routes/criteria-factory'

describe('criteria-factory', () => {
  it('builds provider search criteria with type/isActive', () => {
    const criteria = createProviderSearchCriteria({ type: 'cloud-api', isActive: 'true', limit: 50 })

    expect(criteria.limit).toBe(50)
    expect(criteria.filters).toHaveLength(2)
    expect(criteria.sortings).toHaveLength(1)
  })

  it('builds provider models criteria by providerId', () => {
    const criteria = createProviderModelsCriteria('provider-1', 25)

    expect(criteria.limit).toBe(25)
    expect(criteria.filters).toHaveLength(1)
  })

  it('builds all providers criteria with default limit', () => {
    const criteria = createAllProvidersCriteria()

    expect(criteria.limit).toBe(100)
  })
})
