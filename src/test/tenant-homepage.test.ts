import { describe, it, expect, beforeEach } from 'vitest'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { buildPublicUrl, hrefToPublicUrl } from '@/utils/public-url'
import { resolveOrderBranchMenuUrl } from '@/utils/navigation-intelligence'
import type { PublicBranchInfo } from '@/types/marketplace'

// ── public-url.ts — buildPublicUrl ────────────────────────────────────────────

describe('buildPublicUrl', () => {
  it('returns flat path when tenantSlug is absent', () => {
    expect(buildPublicUrl({ tenantSlug: null, branchSlug: null, module: 'menu' })).toBe('/menu')
    expect(buildPublicUrl({ tenantSlug: null, branchSlug: null })).toBe('/')
    expect(buildPublicUrl({ tenantSlug: undefined, branchSlug: undefined })).toBe('/')
  })

  it('returns tenant-only path when branchSlug is absent', () => {
    expect(buildPublicUrl({ tenantSlug: 'samoon', branchSlug: null })).toBe('/samoon')
    expect(buildPublicUrl({ tenantSlug: 'samoon', branchSlug: undefined })).toBe('/samoon')
  })

  it('returns tenant/module path when branchSlug absent but module provided', () => {
    expect(buildPublicUrl({ tenantSlug: 'samoon', branchSlug: null, module: 'about' })).toBe(
      '/samoon/about',
    )
  })

  it('returns full context-aware URL when all parts are present', () => {
    expect(buildPublicUrl({ tenantSlug: 'samoon', branchSlug: 'main', module: 'menu' })).toBe(
      '/samoon/main/menu',
    )
    expect(buildPublicUrl({ tenantSlug: 'samoon', branchSlug: 'main' })).toBe('/samoon/main')
  })

  it('handles empty module string', () => {
    expect(buildPublicUrl({ tenantSlug: 'samoon', branchSlug: 'main', module: '' })).toBe(
      '/samoon/main',
    )
  })
})

// ── navigation-intelligence — resolveOrderBranchMenuUrl ─────────────────────

describe('resolveOrderBranchMenuUrl', () => {
  it('prefers tenant_slug and branch_slug from the order response', () => {
    expect(
      resolveOrderBranchMenuUrl({
        tenant_slug: 'cafe-noon',
        branch_slug: 'izad-shahr',
      }),
    ).toBe('/cafe-noon/izad-shahr/menu')
  })

  it('falls back to branch.slug and tenantSlugFallback when API slugs are absent', () => {
    expect(
      resolveOrderBranchMenuUrl(
        { branch: { slug: 'main' } as import('@/types').Branch },
        'samoon',
      ),
    ).toBe('/samoon/main/menu')
  })

  it('falls back to flat /menu when no slug context is available', () => {
    expect(resolveOrderBranchMenuUrl({})).toBe('/menu')
  })
})

// ── public-url.ts — hrefToPublicUrl ──────────────────────────────────────────

describe('hrefToPublicUrl', () => {
  it('maps "/" to tenant homepage when tenantSlug present', () => {
    expect(hrefToPublicUrl('/', 'samoon', 'main')).toBe('/samoon')
  })

  it('maps "/restaurant" to tenant homepage when tenantSlug present', () => {
    expect(hrefToPublicUrl('/restaurant', 'samoon', 'main')).toBe('/samoon')
  })

  it('falls back to "/" for tenant homepage hrefs when no tenantSlug', () => {
    expect(hrefToPublicUrl('/', null, null)).toBe('/')
    expect(hrefToPublicUrl('/restaurant', undefined, undefined)).toBe('/')
  })

  it('maps "/menu" to branch-level menu URL', () => {
    expect(hrefToPublicUrl('/menu', 'samoon', 'main')).toBe('/samoon/main/menu')
  })

  it('maps "/reservation" to branch-level reservation URL', () => {
    expect(hrefToPublicUrl('/reservation', 'samoon', 'main')).toBe('/samoon/main/reservation')
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

  it('samoon has branches array with 3 entries', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches).toBeDefined()
    expect(meta?.branches?.length).toBe(3)
  })

  it('each branch entry has required fields', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
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
    const tenant = await tenantService.getTenantBySlug('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(2)
  })

  it('the-oak-bar has 1 branch', async () => {
    const tenant = await tenantService.getTenantBySlug('the-oak-bar')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(1)
  })

  it('central-food-court has 1 branch', async () => {
    const tenant = await tenantService.getTenantBySlug('central-food-court')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(1)
  })

  it('wheels-and-brews has 1 branch', async () => {
    const tenant = await tenantService.getTenantBySlug('wheels-and-brews')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.branches?.length).toBe(1)
  })

  it('all public tenants have tagline', async () => {
    const tenants = await tenantService.getTenants()
    const pub = tenants.filter(
      (t) => t.slug !== 'default' && t.is_active === true,
    )
    pub.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      expect(typeof meta?.tagline).toBe('string')
    })
  })

  it('all public tenants have priceLevel in valid range', async () => {
    const tenants = await tenantService.getTenants()
    const pub = tenants.filter(
      (t) => t.slug !== 'default' && t.is_active === true,
    )
    pub.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      if (meta?.priceLevel != null) {
        expect(meta.priceLevel).toBeGreaterThanOrEqual(1)
        expect(meta.priceLevel).toBeLessThanOrEqual(4)
      }
    })
  })

  it('samoon primary branch slug matches first branch slug', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
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
    const tenant = await tenantService.getTenantBySlug('samoon')
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

  it('throws TenantNotFoundError for unknown slug instead of returning a fake tenant', async () => {
    await expect(tenantService.getTenantBySlug('nonexistent-business')).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  it('returns correct tenant for known slug', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    expect(tenant.slug).toBe('samoon')
    expect(tenant.name).toBe('Samoon Restaurant')
  })

  it('returns correct tenant for brew-cafe', async () => {
    const tenant = await tenantService.getTenantBySlug('brew-cafe')
    expect(tenant.slug).toBe('brew-cafe')
  })
})
