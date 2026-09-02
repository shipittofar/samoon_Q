// ============================================================
// Phase Z.6.2 — Tenant Settings Contract Migration
//
// Regression suite for docs/TENANT_SETTINGS_CONTRACT_MIGRATION_AUDIT.md.
// Proves:
//   1. withMeta() (discover page) no longer drops a tenant that has no
//      settings.marketplace configured yet.
//   2. matchesSearch()/matchesFilters()/sortItems() degrade gracefully
//      (no crash) against a MarketplaceMeta missing its optional fields.
//   3. getMarketplaceMeta() reads settings.marketplace directly (typed,
//      no cast).
//   4. tenant.settings.featureFlags is the real field name (not
//      `features`, this phase's own earlier Z.6 naming mistake).
// ============================================================
import { describe, it, expect } from 'vitest'
import { withMeta } from '@/app/discover/DiscoverClientPage'
import { getMarketplaceMeta, matchesSearch, matchesFilters, sortItems, DEFAULT_FILTERS } from '@/types/marketplace'
import type { MarketplaceMeta } from '@/types/marketplace'
import type { Tenant } from '@/types'

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't1',
    name: 'Test Tenant',
    slug: 'test-tenant',
    businessTypes: ['restaurant'],
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── A — withMeta() no longer drops tenants without marketplace data ───────────

describe('Phase Z.6.2 — withMeta() keeps every tenant, even without settings.marketplace', () => {
  it('a tenant with no settings at all is still included, with an empty meta object', () => {
    const result = withMeta([makeTenant()])
    expect(result).toHaveLength(1)
    expect(result[0]!.tenant.id).toBe('t1')
    expect(result[0]!.meta).toEqual({})
  })

  it('a tenant with settings but no marketplace key is still included', () => {
    const result = withMeta([makeTenant({ settings: { featureFlags: { x: true } } })])
    expect(result).toHaveLength(1)
    expect(result[0]!.meta).toEqual({})
  })

  it('a tenant with full marketplace data keeps listing fields intact', () => {
    const marketplace = { story: 'Great food', rating: 4.5, tags: ['Italian'] }
    const result = withMeta([makeTenant({ settings: { marketplace } })])
    expect(result[0]!.meta).toEqual(marketplace)
  })

  it('a mixed list (some with marketplace, some without) keeps every tenant', () => {
    const result = withMeta([
      makeTenant({ id: 'a', settings: { marketplace: { rating: 5 } } }),
      makeTenant({ id: 'b' }),
      makeTenant({ id: 'c', settings: { marketplace: { rating: 3 } } }),
    ])
    expect(result.map((r) => r.tenant.id)).toEqual(['a', 'b', 'c'])
  })
})

// ── B — MarketplaceMeta helpers degrade gracefully on missing fields ──────────

describe('Phase Z.6.2 — marketplace helpers do not crash on a partial MarketplaceMeta', () => {
  const bareMeta: MarketplaceMeta = {}

  it('matchesSearch() does not throw when description/city/tags/branches are all absent', () => {
    expect(() => matchesSearch('Test Tenant', bareMeta, ['restaurant'], 'test')).not.toThrow()
    expect(matchesSearch('Test Tenant', bareMeta, ['restaurant'], 'test')).toBe(true)
  })

  it('matchesSearch() still finds a match by tenant name alone', () => {
    expect(matchesSearch('Samoon Restaurant', bareMeta, [], 'samoon')).toBe(true)
  })

  it('matchesFilters() does not throw when branch cuisines/city/priceLevel/amenities are absent', () => {
    expect(() => matchesFilters(bareMeta, {}, DEFAULT_FILTERS)).not.toThrow()
  })

  it('matchesFilters() correctly rejects a cuisine filter against empty branch cuisines', () => {
    expect(matchesFilters(bareMeta, {}, { ...DEFAULT_FILTERS, cuisines: ['Italian'] })).toBe(false)
  })

  it('sortItems() does not throw sorting by rating/reviewCount when both are absent', () => {
    const items = [{ tenant: { name: 'A', created_at: '2024-01-01' }, meta: bareMeta }]
    expect(() => sortItems(items, 'highest_rated')).not.toThrow()
    expect(() => sortItems(items, 'most_reviewed')).not.toThrow()
  })
})

// ── C — getMarketplaceMeta() reads settings.marketplace directly ──────────────

describe('Phase Z.6.2 — getMarketplaceMeta()', () => {
  it('returns undefined for undefined settings', () => {
    expect(getMarketplaceMeta(undefined)).toBeUndefined()
  })

  it('returns undefined when marketplace is absent', () => {
    expect(getMarketplaceMeta({ featureFlags: { a: true } })).toBeUndefined()
  })

  it('returns only tenant listing fields when present', () => {
    const marketplace = { story: 'x', city: 'Paris', coverImage: 'img' }
    expect(getMarketplaceMeta({ marketplace })).toEqual({ story: 'x' })
  })
})

// ── D — featureFlags is the real settings field name (not `features`) ─────────

describe('Phase Z.6.2 — TenantSettings.featureFlags naming', () => {
  it('a tenant\'s featureFlags round-trips through the typed settings field', () => {
    const tenant = makeTenant({ settings: { featureFlags: { 'menu.enabled': true } } })
    expect(tenant.settings?.featureFlags).toEqual({ 'menu.enabled': true })
  })
})
