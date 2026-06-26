import { describe, it, expect, beforeEach } from 'vitest'
import { tenantService } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { buildPublicUrl, hrefToPublicUrl } from '@/utils/public-url'
import type { PublicBranchInfo } from '@/types/marketplace'

// ── public-url.ts — buildPublicUrl ────────────────────────────────────────────

describe('buildPublicUrl', () => {
  it('returns flat path when tenantSlug is absent', () => {
    expect(buildPublicUrl({ tenantSlug: null, branchSlug: null, module: 'menu' })).toBe('/menu')
    expect(buildPublicUrl({ tenantSlug: null, branchSlug: null })).toBe('/')
    expect(buildPublicUrl({ tenantSlug: undefined, branchSlug: undefined })).toBe('/')
  })

  it('returns tenant-only path when branchSlug is absent', () => {
    expect(buildPublicUrl({ tenantSlug: 'savor', branchSlug: null })).toBe('/savor')
    expect(buildPublicUrl({ tenantSlug: 'savor', branchSlug: undefined })).toBe('/savor')
  })

  it('returns tenant/module path when branchSlug absent but module provided', () => {
    expect(buildPublicUrl({ tenantSlug: 'savor', branchSlug: null, module: 'about' })).toBe(
      '/savor/about',
    )
  })

  it('returns full context-aware URL when all parts are present', () => {
    expect(buildPublicUrl({ tenantSlug: 'savor', branchSlug: 'main', module: 'menu' })).toBe(
      '/savor/main/menu',
    )
    expect(buildPublicUrl({ tenantSlug: 'savor', branchSlug: 'main' })).toBe('/savor/main')
  })

  it('handles empty module string', () => {
    expect(buildPublicUrl({ tenantSlug: 'savor', branchSlug: 'main', module: '' })).toBe(
      '/savor/main',
    )
  })
})

// ── public-url.ts — hrefToPublicUrl ──────────────────────────────────────────

describe('hrefToPublicUrl', () => {
  it('maps "/" to tenant homepage when tenantSlug present', () => {
    expect(hrefToPublicUrl('/', 'savor', 'main')).toBe('/savor')
  })

  it('maps "/restaurant" to tenant homepage when tenantSlug present', () => {
    expect(hrefToPublicUrl('/restaurant', 'savor', 'main')).toBe('/savor')
  })

  it('falls back to "/" for tenant homepage hrefs when no tenantSlug', () => {
    expect(hrefToPublicUrl('/', null, null)).toBe('/')
    expect(hrefToPublicUrl('/restaurant', undefined, undefined)).toBe('/')
  })

  it('maps "/menu" to branch-level menu URL', () => {
    expect(hrefToPublicUrl('/menu', 'savor', 'main')).toBe('/savor/main/menu')
  })

  it('maps "/reservation" to branch-level reservation URL', () => {
    expect(hrefToPublicUrl('/reservation', 'savor', 'main')).toBe('/savor/main/reservation')
  })

  it('maps "/loyalty" to branch-level loyalty URL', () => {
    expect(hrefToPublicUrl('/loyalty', 'brew-cafe', 'midtown')).toBe('/brew-cafe/midtown/loyalty')
  })

  it('falls back to flat href for unknown modules', () => {
    expect(hrefToPublicUrl('/unknown', null, null)).toBe('/unknown')
  })
})

// ── MarketplaceMeta — extended fields ─────────────────────────────────────────

describe('MarketplaceMeta extended fields (P8.7.7.2)', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('savor has branches array with 3 entries', async () => {
    const tenant = await tenantService.getTenant('savor')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches).toBeDefined()
    expect(meta?.branches?.length).toBe(3)
  })

  it('each branch entry has required fields', async () => {
    const tenant = await tenantService.getTenant('savor')
    const meta = getMarketplaceMeta(tenant.settings)
    meta?.branches?.forEach((b: PublicBranchInfo) => {
      expect(typeof b.slug).toBe('string')
      expect(b.slug.length).toBeGreaterThan(0)
      expect(typeof b.name).toBe('string')
      expect(typeof b.address).toBe('string')
      expect(typeof b.city).toBe('string')
      expect(typeof b.openNow).toBe('boolean')
    })
  })

  it('brew-cafe has 2 branches', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(2)
  })

  it('the-oak-bar has 1 branch', async () => {
    const tenant = await tenantService.getTenant('the-oak-bar')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(1)
  })

  it('central-food-court has 1 branch', async () => {
    const tenant = await tenantService.getTenant('central-food-court')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(1)
  })

  it('wheels-and-brews has 1 branch', async () => {
    const tenant = await tenantService.getTenant('wheels-and-brews')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(1)
  })

  it('all public tenants have tagline', async () => {
    const tenants = await tenantService.getTenants()
    const pub = tenants.filter(
      (t) => t.slug !== 'default' && (t.status === 'active' || t.status === 'trial'),
    )
    pub.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      expect(typeof meta?.tagline).toBe('string')
    })
  })

  it('all public tenants have priceLevel in valid range', async () => {
    const tenants = await tenantService.getTenants()
    const pub = tenants.filter(
      (t) => t.slug !== 'default' && (t.status === 'active' || t.status === 'trial'),
    )
    pub.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      if (meta?.priceLevel != null) {
        expect(meta.priceLevel).toBeGreaterThanOrEqual(1)
        expect(meta.priceLevel).toBeLessThanOrEqual(4)
      }
    })
  })

  it('savor primary branch slug matches first branch slug', async () => {
    const tenant = await tenantService.getTenant('savor')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.[0]?.slug).toBe(meta?.primaryBranchSlug)
  })

  it('all branch slugs are non-empty strings', async () => {
    const tenants = await tenantService.getTenants()
    tenants.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      meta?.branches?.forEach((b: PublicBranchInfo) => {
        expect(typeof b.slug).toBe('string')
        expect(b.slug.length).toBeGreaterThan(0)
      })
    })
  })

  it('gallery is an array of strings when present', async () => {
    const tenant = await tenantService.getTenant('savor')
    const meta = getMarketplaceMeta(tenant.settings)
    if (meta?.gallery) {
      expect(Array.isArray(meta.gallery)).toBe(true)
      meta.gallery.forEach((url: string) => {
        expect(typeof url).toBe('string')
        expect(url.startsWith('https')).toBe(true)
      })
    }
  })
})

// ── Tenant service — getTenant for unknown slug ───────────────────────────────

describe('tenantService.getTenant — unknown slug handling', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('returns DEFAULT_TENANT for unknown slug', async () => {
    const tenant = await tenantService.getTenant('nonexistent-business')
    expect(tenant.slug).toBe('default')
  })

  it('returns correct tenant for known slug', async () => {
    const tenant = await tenantService.getTenant('savor')
    expect(tenant.slug).toBe('savor')
    expect(tenant.name).toBe('Savor Restaurant')
  })

  it('returns correct tenant for brew-cafe', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    expect(tenant.slug).toBe('brew-cafe')
  })
})
