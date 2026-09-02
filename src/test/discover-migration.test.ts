import { describe, it, expect } from 'vitest'
import {
  adaptDiscoverResponse,
  mapDiscoverBranchToPublicBranchInfo,
  mapDiscoverTenantToItem,
} from '@/lib/discover-adapter'
import type { DiscoverResponse, DiscoverTenant } from '@/types/discover'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'
import { matchesSearch, matchesFilters, sortItems, DEFAULT_FILTERS } from '@/types/marketplace'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

const SAMPLE_TENANT: DiscoverTenant = {
  id: 'tenant-1',
  slug: 'samoon',
  name: 'Samoon Restaurant',
  is_active: true,
  status: 'ACTIVE',
  created_at: '2024-01-01T00:00:00.000Z',
  businessTypes: ['restaurant'],
  image: 'https://example.com/logo.png',
  featureFlags: { 'reservations.enabled': true },
  branding: {
    primaryColor: '#1a1a2e',
    accentHoverColor: '#e85d04',
    fontBody: 'inter',
    fontsByLocale: { en: 'inter', fa: 'vazir' },
  },
  // Legacy Discover field — must NOT become the canonical branding source
  theme: { primaryColor: '#e85d04' },
  marketplace: {
    tags: ['Family Friendly'],
    rating: 4.8,
    reviewCount: 100,
    featured: true,
    popular: false,
    isNew: false,
    openNow: true,
    priceLevel: 3,
    branchCount: 2,
    primaryBranchSlug: 'main',
    tagline: 'A story in every dish',
  },
  branches: [
    {
      id: 'branch-1',
      slug: 'main',
      name: 'Main Branch',
      openNow: true,
      todayHours: '10:00–22:00',
      image: 'https://example.com/branch.jpg',
      location: { address: '123 Main St', city: 'New York', country: 'US' },
      cuisines: ['Mediterranean'],
      amenities: ['WiFi'],
    },
    {
      id: 'branch-2',
      slug: 'downtown',
      name: 'Downtown Branch',
      openNow: false,
      todayHours: '11:00–21:00',
      location: { address: '456 Center St', city: 'New York' },
      cuisines: ['Mediterranean'],
      amenities: ['Parking'],
    },
  ],
}

describe('discover adapter', () => {
  it('mapDiscoverBranchToPublicBranchInfo preserves checkout config', () => {
    const info = mapDiscoverBranchToPublicBranchInfo({
      ...SAMPLE_TENANT.branches![0],
      checkout: DEFAULT_BRANCH_CHECKOUT,
      marketplaceVisible: true,
      reservationsEnabled: false,
    })
    expect(info.checkout).toEqual(DEFAULT_BRANCH_CHECKOUT)
    expect(info.marketplaceVisible).toBe(true)
    expect(info.reservationsEnabled).toBe(false)
  })

  it('mapDiscoverBranchToPublicBranchInfo flattens location', () => {
    const info = mapDiscoverBranchToPublicBranchInfo(SAMPLE_TENANT.branches![0])
    expect(info).toMatchObject({
      id: 'branch-1',
      slug: 'main',
      name: 'Main Branch',
      address: '123 Main St',
      city: 'New York',
      openNow: true,
      todayHours: '10:00–22:00',
    })
  })

  it('mapDiscoverBranchToPublicBranchInfo maps branch cuisines and amenities', () => {
    const info = mapDiscoverBranchToPublicBranchInfo(SAMPLE_TENANT.branches![0])
    expect(info.cuisines).toEqual(['Mediterranean'])
    expect(info.amenities).toEqual(['WiFi'])
  })

  it('mapDiscoverTenantToItem prefers branding over legacy theme and preserves image', () => {
    const item = mapDiscoverTenantToItem(SAMPLE_TENANT)
    expect(item.tenant.slug).toBe('samoon')
    expect(item.tenant.businessTypes).toEqual(['restaurant'])
    expect(item.tenant.image).toBe('https://example.com/logo.png')
    expect(item.tenant.settings?.featureFlags?.['reservations.enabled']).toBe(true)
    expect(item.tenant.settings?.theme?.primaryColor).toBe('#1a1a2e')
    expect(item.tenant.settings?.theme?.accentHoverColor).toBe('#e85d04')
    expect(item.tenant.settings?.theme?.fontBody).toBe('inter')
    expect(item.tenant.settings?.theme?.fontsByLocale).toEqual({ en: 'inter', fa: 'vazir' })
    expect(item.tenant.discoverCover).toBeUndefined()
    expect(item.meta.branches).toHaveLength(2)
    expect(item.branches).toHaveLength(2)
    expect(item.meta.primaryBranchSlug).toBe('main')
    expect(item.meta.branchCount).toBe(2)
  })

  it('maps Discover tenant.description onto tenant without using branch description', () => {
    const item = mapDiscoverTenantToItem({
      ...SAMPLE_TENANT,
      description: 'Tenant-owned story',
      branches: [
        { ...SAMPLE_TENANT.branches![0], description: 'Primary branch copy' },
        { ...SAMPLE_TENANT.branches![1], description: 'Second branch copy' },
      ],
    })
    expect(item.tenant.description).toBe('Tenant-owned story')
    expect(item.meta.description).toBe('Primary branch copy')
    expect(item.branches[0].description).toBe('Primary branch copy')
  })

  it('does not fall back to branches[0].description when tenant description is missing', () => {
    const item = mapDiscoverTenantToItem({
      ...SAMPLE_TENANT,
      description: undefined,
      branches: [{ ...SAMPLE_TENANT.branches![0], description: 'Only branch copy' }],
    })
    expect(item.tenant.description).toBeUndefined()
    expect(item.meta.description).toBe('Only branch copy')
  })

  it('falls back to legacy theme when branding is absent', () => {
    const { branding: _b, ...legacyOnly } = SAMPLE_TENANT
    const item = mapDiscoverTenantToItem({
      ...legacyOnly,
      theme: { primaryColor: '#abcdef' },
    })
    expect(item.tenant.settings?.theme?.primaryColor).toBe('#abcdef')
  })

  it('adaptDiscoverResponse filters default and non-visible tenants (is_active)', () => {
    const response: DiscoverResponse = {
      count: 3,
      results: [
        SAMPLE_TENANT,
        { ...SAMPLE_TENANT, id: 'default', slug: 'default', is_active: true, status: 'ACTIVE' },
        { ...SAMPLE_TENANT, id: 'hidden', slug: 'hidden', is_active: false, status: 'ACTIVE' },
      ],
    }
    const items = adaptDiscoverResponse(response)
    expect(items).toHaveLength(1)
    expect(items[0].tenant.slug).toBe('samoon')
  })

  it('preserves search by branch name via meta.branches', () => {
    const item = mapDiscoverTenantToItem(SAMPLE_TENANT)
    expect(
      matchesSearch(item.tenant.name, item.meta, item.tenant.businessTypes, 'Downtown'),
    ).toBe(true)
  })

  it('preserves filter and sort behavior', () => {
    const item = mapDiscoverTenantToItem(SAMPLE_TENANT)
    const row = { tenant: item.tenant, meta: item.meta }
    expect(
      matchesFilters(item.meta, item.tenant.settings?.featureFlags ?? {}, {
        ...DEFAULT_FILTERS,
        cuisines: ['Mediterranean'],
        openNow: true,
      }),
    ).toBe(true)
    // Cuisine/amenity filters resolve from branch payloads only.
    expect(item.branches.some((b) => b.cuisines?.includes('Mediterranean'))).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(item.meta, 'cuisines')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(item.meta, 'amenities')).toBe(false)
    const sorted = sortItems([row], 'highest_rated')
    expect(sorted[0].meta.rating).toBe(4.8)
  })
})

describe('discover migration wiring', () => {
  it('ENDPOINTS.PUBLIC.DISCOVER is /public/discover/', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.PUBLIC.DISCOVER).toBe('/public/discover/')
  })

  it('useDiscover is exported and uses public-discover query key', () => {
    const src = readFileSync(join(ROOT, 'hooks', 'index.ts'), 'utf8')
    expect(src).toContain('export function useDiscover')
    expect(src).toContain("queryKey: ['public-discover']")
    expect(src).toContain('discoverService.getDiscover')
  })

  it('DiscoverClientPage uses useDiscover not usePublicTenants', () => {
    const src = readFileSync(join(ROOT, 'app', 'discover', 'DiscoverClientPage.tsx'), 'utf8')
    expect(src).toContain('useDiscover')
    expect(src).not.toContain('usePublicTenants')
    expect(src).toContain('branches={branches}')
  })

  it('BusinessCard skips usePublicBranches when branches prop is provided', () => {
    const src = readFileSync(join(ROOT, 'components', 'marketplace', 'BusinessCard.tsx'), 'utf8')
    expect(src).toContain('branches?: PublicBranchInfo[]')
    expect(src).toContain('enabled: branchesProp === undefined')
  })
})

describe('Discover card Explore CTA', () => {
  it('single-branch tenant shows Explore and goes to the public tenant page, not the branch slug', async () => {
    const { getDiscoverCardPrimaryCta } = await import('@/lib/discover-card-cta')
    const cta = getDiscoverCardPrimaryCta({
      tenantSlug: 'the-oak-bar',
      branchCount: 1,
      primaryBranchSlug: 'main',
    })
    expect(cta.labelKey).toBe('explore')
    expect(cta.href).toBe('/the-oak-bar')
    expect(cta.href.split('/').filter(Boolean)).toEqual(['the-oak-bar'])
    expect(cta.href).not.toContain('/main')
    expect(cta.href).not.toContain('/menu')
  })

  it('multi-branch tenant still uses Explore and the public tenant page', async () => {
    const { getDiscoverCardPrimaryCta } = await import('@/lib/discover-card-cta')
    const cta = getDiscoverCardPrimaryCta({
      tenantSlug: 'samoon',
      branchCount: 3,
      primaryBranchSlug: 'downtown',
    })
    expect(cta.labelKey).toBe('explore')
    expect(cta.href).toBe('/samoon')
    expect(cta.href).not.toContain('/downtown')
  })

  it('BusinessCard wires the primary CTA helper and marketplace Explore label', () => {
    const src = readFileSync(join(ROOT, 'components', 'marketplace', 'BusinessCard.tsx'), 'utf8')
    expect(src).toContain('getDiscoverCardPrimaryCta')
    expect(src).toContain("href={viewHref}")
    expect(src).toContain("from '@/lib/discover-card-cta'")
    expect(src).not.toContain('/menu')
    const en = JSON.parse(readFileSync(join(ROOT, 'i18n', 'locales', 'en.json'), 'utf8')) as {
      marketplace: { explore: string }
    }
    expect(en.marketplace.explore).toBe('Explore')
  })

  it('discover service and endpoints are unchanged by this CTA restore', () => {
    const service = readFileSync(join(ROOT, 'services', 'discover.service.ts'), 'utf8')
    expect(service).toContain('getDiscover')
    const card = readFileSync(join(ROOT, 'components', 'marketplace', 'BusinessCard.tsx'), 'utf8')
    expect(card).not.toContain('discoverService')
  })
})

describe('Discover card description', () => {
  it('BusinessCard renders tenant.description with line-clamp-2 and hides when empty', () => {
    const src = readFileSync(join(ROOT, 'components', 'marketplace', 'BusinessCard.tsx'), 'utf8')
    expect(src).toContain('{tenant.description && (')
    expect(src).toContain('{tenant.description}</p>')
    expect(src).toContain('line-clamp-2')
    expect(src).not.toContain('{meta.description && (')
    expect(src).not.toContain('{meta.description}')
    expect(src).not.toContain('primary?.description')
    expect(src).not.toContain('branches[0].description')
    expect(src).not.toContain('?? branches[0]')
  })
})
