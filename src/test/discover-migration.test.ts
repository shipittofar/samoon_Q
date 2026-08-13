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
  status: 'active',
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
    description: 'Fine dining',
    coverImage: 'https://example.com/cover.jpg',
    city: 'New York',
    cuisines: ['Mediterranean'],
    tags: ['Family Friendly'],
    amenities: ['WiFi'],
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
    },
    {
      id: 'branch-2',
      slug: 'downtown',
      name: 'Downtown Branch',
      openNow: false,
      todayHours: '11:00–21:00',
      location: { address: '456 Center St', city: 'New York' },
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

  it('mapDiscoverTenantToItem prefers branding over legacy theme and preserves image', () => {
    const item = mapDiscoverTenantToItem(SAMPLE_TENANT)
    expect(item.tenant.slug).toBe('samoon')
    expect(item.tenant.businessTypes).toEqual(['restaurant'])
    expect(item.tenant.image).toBe('https://example.com/logo.png')
    expect(item.tenant.settings?.featureFlags?.['reservations.enabled']).toBe(true)
    // Canonical branding from `branding`, not legacy theme.primaryColor
    expect(item.tenant.settings?.theme?.primaryColor).toBe('#1a1a2e')
    expect(item.tenant.settings?.theme?.accentHoverColor).toBe('#e85d04')
    expect(item.tenant.settings?.theme?.fontBody).toBe('inter')
    expect(item.tenant.settings?.theme?.fontsByLocale).toEqual({ en: 'inter', fa: 'vazir' })
    expect(item.meta.coverImage).toBe('https://example.com/cover.jpg')
    expect(item.meta.branches).toHaveLength(2)
    expect(item.branches).toHaveLength(2)
    expect(item.meta.primaryBranchSlug).toBe('main')
    expect(item.meta.branchCount).toBe(2)
  })

  it('falls back to legacy theme when branding is absent', () => {
    const { branding: _b, ...legacyOnly } = SAMPLE_TENANT
    const item = mapDiscoverTenantToItem({
      ...legacyOnly,
      theme: { primaryColor: '#abcdef' },
    })
    expect(item.tenant.settings?.theme?.primaryColor).toBe('#abcdef')
  })

  it('adaptDiscoverResponse filters default and non-public statuses', () => {
    const response: DiscoverResponse = {
      count: 3,
      results: [
        SAMPLE_TENANT,
        { ...SAMPLE_TENANT, id: 'default', slug: 'default', status: 'active' },
        { ...SAMPLE_TENANT, id: 'suspended', slug: 'closed', status: 'suspended' },
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
