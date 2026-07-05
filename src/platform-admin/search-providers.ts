/**
 * Platform Search Providers — P9.4 Phase F
 *
 * Three real, working providers demonstrating the search registry against
 * genuinely different collection fields — Businesses (platform.tenants),
 * Platform Users (platform.users), and Countries (the P9.2 reference
 * collection) — all built on the exact same `configCollection` helpers
 * P9.2 already ships (`getCollectionEntries`, `getEntityLabel`), so this
 * is composition, not a second search implementation.
 */
import { configCollection, platformConfigurationRegistry } from '@/config'
import { platformSearchRegistry, type PlatformSearchHit } from './search'

function searchCollectionField(fieldId: string, moduleId: string, query: string): PlatformSearchHit[] {
  const field = platformConfigurationRegistry.getField(fieldId)
  if (!field) return []
  const q = query.trim().toLowerCase()
  const entries = configCollection.getCollectionEntries(field, field.default)
  return entries
    .filter((entry) => {
      const label = configCollection.getEntityLabel(field, entry.entityId).toLowerCase()
      return label.includes(q) || entry.entityId.toLowerCase().includes(q)
    })
    .slice(0, 8)
    .map((entry) => ({
      id: `${fieldId}:${entry.entityId}`,
      label: configCollection.getEntityLabel(field, entry.entityId),
      hint: entry.entityId,
      moduleId,
    }))
}

platformSearchRegistry.register({
  id: 'businesses',
  label: 'Businesses',
  search: (query) => searchCollectionField('platform.tenants.registry', 'platform.tenants', query),
})

platformSearchRegistry.register({
  id: 'platform_users',
  label: 'Platform Users',
  search: (query) => searchCollectionField('platform.users.registry', 'platform.users', query),
})

platformSearchRegistry.register({
  id: 'countries',
  label: 'Countries',
  search: (query) => searchCollectionField('countries.registry', 'countries', query),
})
