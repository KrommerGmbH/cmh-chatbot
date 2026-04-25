import { Criteria } from '../../data/criteria.js'

interface ProviderSearchCriteriaOptions {
  type?: string
  isActive?: string
  limit?: number
}

export function createProviderSearchCriteria(options: ProviderSearchCriteriaOptions = {}): Criteria {
  const criteria = new Criteria()

  if (options.type) criteria.addFilter(Criteria.equals('type', options.type))
  if (options.isActive !== undefined) {
    criteria.addFilter(Criteria.equals('isActive', options.isActive === 'true'))
  }

  criteria.addSorting(Criteria.sort('priority', 'ASC'))
  criteria.setLimit(options.limit ?? 100)
  return criteria
}

export function createProviderModelsCriteria(providerId: string, limit = 100): Criteria {
  const criteria = new Criteria()
  criteria.addFilter(Criteria.equals('providerId', providerId))
  criteria.setLimit(limit)
  return criteria
}

export function createAllProvidersCriteria(limit = 100): Criteria {
  const criteria = new Criteria()
  criteria.setLimit(limit)
  return criteria
}
