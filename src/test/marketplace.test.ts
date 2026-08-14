import { describe, it, expect, beforeEach } from 'vitest'
import {
  matchesSearch,
  matchesCategory,
  getMarketplaceMeta,
  BUSINESS_TYPE_LABELS,
} from '@/types/marketplace'
import type { MarketplaceMeta } from '@/types/marketplace'
import { tenantService } from '@/services/tenant.service'

// ── Fixture ───────────────────────────────────────────────────────────────────

const mockMeta: MarketplaceMeta = {
  description: 'Fine dining Mediterranean cuisine',
  coverImage: 'https://example.com/cover.jpg',
  tags: ['Date Night', 'Fine Dining'],
  rating: 4.8,
  reviewCount: 1200,
  city: 'New York',
  branchCount: 3,
  openNow: true,
  primaryBranchSlug: 'main',
  featured: true,
  popular: true,
  branches: [
    {
      id: 'branch-1',
      slug: 'main',
      name: 'Main Branch',
      address: '123 Main St',
      city: 'New York',
      openNow: true,
      cuisines: ['Mediterranean', 'Italian'],
      amenities: ['WiFi'],
    },
  ],
}

// ── matchesSearch ─────────────────────────────────────────────────────────────

describe('matchesSearch', () => {
  it('returns true for empty query', () => {
    expect(matchesSearch('Samoon', mockMeta, ['restaurant'], '')).toBe(true)
    expect(matchesSearch('Samoon', mockMeta, ['restaurant'], '   ')).toBe(true)
  })

  it('matches by tenant name (case-insensitive)', () => {
    expect(matchesSearch('Samoon Restaurant', mockMeta, ['restaurant'], 'samoon')).toBe(true)
    expect(matchesSearch('Samoon Restaurant', mockMeta, ['restaurant'], 'SAMOON')).toBe(true)
    expect(matchesSearch('Brew Cafe', mockMeta, ['cafe'], 'samoon')).toBe(false)
  })

  it('matches by city', () => {
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'new york')).toBe(true)
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'london')).toBe(false)
  })

  it('matches by cuisine', () => {
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'mediterranean')).toBe(true)
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'italian')).toBe(true)
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'sushi')).toBe(false)
  })

  it('matches by tag', () => {
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'date night')).toBe(true)
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'vegan')).toBe(false)
  })

  it('matches by business type label', () => {
    expect(matchesSearch('X', mockMeta, ['cafe'], 'café')).toBe(true)
    expect(matchesSearch('X', mockMeta, ['food_truck'], 'food truck')).toBe(true)
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'bar')).toBe(false)
  })

  it('matches by description', () => {
    expect(matchesSearch('X', mockMeta, ['restaurant'], 'mediterranean')).toBe(true)
  })
})

// ── matchesCategory ───────────────────────────────────────────────────────────

describe('matchesCategory', () => {
  it('returns true for empty category (no filter)', () => {
    expect(matchesCategory(['restaurant'], '')).toBe(true)
    expect(matchesCategory(['cafe'], '')).toBe(true)
  })

  it('matches exact category', () => {
    expect(matchesCategory(['restaurant', 'cafe'], 'restaurant')).toBe(true)
    expect(matchesCategory(['cafe'], 'cafe')).toBe(true)
  })

  it('returns false when category does not match', () => {
    expect(matchesCategory(['cafe'], 'restaurant')).toBe(false)
    expect(matchesCategory(['food_truck'], 'bar')).toBe(false)
  })

  it('handles multiple businessTypes', () => {
    expect(matchesCategory(['restaurant', 'bar'], 'bar')).toBe(true)
  })
})

// ── getMarketplaceMeta ────────────────────────────────────────────────────────

describe('getMarketplaceMeta', () => {
  it('returns undefined when settings is undefined', () => {
    expect(getMarketplaceMeta(undefined)).toBeUndefined()
  })

  it('returns undefined when settings.marketplace is absent', () => {
    expect(getMarketplaceMeta({ theme: { primaryColor: '#fff' } })).toBeUndefined()
  })

  it('returns marketplace meta when present', () => {
    const meta = getMarketplaceMeta({ marketplace: mockMeta })
    expect(meta).toEqual(mockMeta)
  })
})

// ── BUSINESS_TYPE_LABELS ──────────────────────────────────────────────────────

describe('BUSINESS_TYPE_LABELS', () => {
  it('has labels for all core business types', () => {
    const types = ['restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe']
    types.forEach((t) => {
      expect(BUSINESS_TYPE_LABELS[t]).toBeTruthy()
    })
  })

  it('has distinct labels for each type', () => {
    const labels = Object.values(BUSINESS_TYPE_LABELS)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })
})

// ── Tenant service marketplace data ──────────────────────────────────────────

describe('Tenant marketplace metadata', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('all publicly visible tenants have marketplace metadata', async () => {
    const tenants = await tenantService.getTenants()
    const publicTenants = tenants.filter(
      (t) => t.slug !== 'default' && t.is_active === true,
    )
    expect(publicTenants.length).toBeGreaterThan(0)
    publicTenants.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      expect(meta).toBeDefined()
      expect(meta!.description).toBeTruthy()
      expect(meta!.city).toBeTruthy()
      expect(meta!.rating).toBeGreaterThan(0)
      expect(meta!.primaryBranchSlug).toBeTruthy()
    })
  })

  it('returns 5 public tenants (is_active, excludes hidden)', async () => {
    const all = await tenantService.getTenants()
    const pub = all.filter(
      (t) => t.slug !== 'default' && t.is_active === true,
    )
    expect(pub.length).toBe(5)
  })

  it('non-visible tenants are excluded from public list', async () => {
    const all = await tenantService.getTenants()
    const pub = all.filter(
      (t) => t.slug !== 'default' && t.is_active === true,
    )
    expect(pub.some((t) => t.slug === 'road-bites')).toBe(false)
  })

  it('featured tenants are correctly marked', async () => {
    const tenants = await tenantService.getTenants()
    const samoon = tenants.find((t) => t.slug === 'samoon')!
    const meta = getMarketplaceMeta(samoon.settings)
    expect(meta?.featured).toBe(true)
  })

  it('new tenants are correctly marked', async () => {
    const tenants = await tenantService.getTenants()
    const fc = tenants.find((t) => t.slug === 'central-food-court')!
    const meta = getMarketplaceMeta(fc.settings)
    expect(meta?.isNew).toBe(true)
  })

  it('all tenants have a valid primaryBranchSlug', async () => {
    const tenants = await tenantService.getTenants()
    tenants.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      if (meta) {
        expect(typeof meta.primaryBranchSlug).toBe('string')
        expect(meta.primaryBranchSlug!.length).toBeGreaterThan(0)
      }
    })
  })

  it('ratings are within valid range (0–5)', async () => {
    const tenants = await tenantService.getTenants()
    tenants.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      if (meta) {
        expect(meta.rating).toBeGreaterThanOrEqual(0)
        expect(meta.rating).toBeLessThanOrEqual(5)
      }
    })
  })

  it('search filters correctly by name', async () => {
    const tenants = await tenantService.getTenants()
    const pub = tenants.filter(
      (t) => t.slug !== 'default' && t.is_active === true,
    )
    const withMeta = pub.filter((t) => getMarketplaceMeta(t.settings))
    const results = withMeta.filter((t) => {
      const meta = getMarketplaceMeta(t.settings)!
      return matchesSearch(t.name, meta, t.businessTypes, 'brew cafe')
    })
    expect(results.length).toBe(1)
    expect(results[0].slug).toBe('brew-cafe')
  })

  it('category filter returns only matching business types', async () => {
    const tenants = await tenantService.getTenants()
    const pub = tenants.filter((t) => t.is_active === true)
    const cafes = pub.filter((t) => matchesCategory(t.businessTypes, 'cafe'))
    expect(cafes.every((t) => t.businessTypes.includes('cafe'))).toBe(true)
  })

  it('empty search query matches everything', async () => {
    const tenants = await tenantService.getTenants()
    const pub = tenants.filter((t) => t.is_active === true)
    const withMeta = pub.filter((t) => getMarketplaceMeta(t.settings))
    const results = withMeta.filter((t) => {
      const meta = getMarketplaceMeta(t.settings)!
      return matchesSearch(t.name, meta, t.businessTypes, '')
    })
    expect(results.length).toBe(withMeta.length)
  })
})
