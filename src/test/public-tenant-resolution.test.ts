import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolvePublicTenantId,
  fetchPublicTenantBySlug,
  resolvePublicTenantForPage,
  resolvePublicBranchPageForPage,
  readPublicPathTenantSlug,
} from '@/lib/public-tenant-resolution'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'

describe('public-tenant-resolution', () => {
  beforeEach(() => {
    tenantService._resetMockList()
    vi.restoreAllMocks()
  })

  it('resolvePublicTenantId returns id from cached tenants without list fetch', async () => {
    const getTenantsSpy = vi.spyOn(tenantService, 'getTenants')
    const id = await resolvePublicTenantId('samoon', {
      cachedTenants: [{ id: 'tenant-samoon-01', slug: 'samoon', name: 'Samoon', businessTypes: [], status: 'active', created_at: '' }],
    })
    expect(id).toBe('tenant-samoon-01')
    expect(getTenantsSpy).not.toHaveBeenCalled()
  })

  it('resolvePublicTenantId uses slug→id resolver when cache misses (not GET /tenants/ page 1)', async () => {
    const getTenantsSpy = vi.spyOn(tenantService, 'getTenants')
    const resolveSpy = vi.spyOn(tenantService, 'resolvePublicTenantIdBySlug')
    const id = await resolvePublicTenantId('samoon')
    expect(id).toBe('tenant-samoon-01')
    expect(getTenantsSpy).not.toHaveBeenCalled()
    expect(resolveSpy).toHaveBeenCalledWith('samoon')
  })

  it('resolvePublicTenantId throws TenantNotFoundError for unknown slug', async () => {
    await expect(resolvePublicTenantId('nonexistent-slug-xyz')).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  it('fetchPublicTenantBySlug uses getTenantBySlug, not GET /tenants/ page 1', async () => {
    const bySlugSpy = vi.spyOn(tenantService, 'getTenantBySlug')
    const listSpy = vi.spyOn(tenantService, 'getTenants')
    const tenant = await fetchPublicTenantBySlug('samoon')
    expect(tenant.slug).toBe('samoon')
    expect(bySlugSpy).toHaveBeenCalledWith('samoon')
    expect(listSpy).not.toHaveBeenCalled()
  })

  it('resolves a slug that is absent from a first-page GET /tenants/ cache', async () => {
    const listSpy = vi.spyOn(tenantService, 'getTenants')
    const tenant = await fetchPublicTenantBySlug('samoon', {
      cachedTenants: [
        { id: 'other', slug: 'other-biz', name: 'Other', businessTypes: [], status: 'ACTIVE', created_at: '' },
      ],
    })
    expect(tenant.slug).toBe('samoon')
    expect(listSpy).not.toHaveBeenCalled()
  })

  it('resolvePublicTenantForPage resolves tenant for SSR', async () => {
    const tenant = await resolvePublicTenantForPage('samoon')
    expect(tenant.slug).toBe('samoon')
    expect(tenant.id).toBe('tenant-samoon-01')
  })

  it('resolvePublicBranchPageForPage uses Discover branches and skips the branch API', async () => {
    vi.spyOn(tenantService, 'getTenantBySlug').mockResolvedValue({
      id: '8061b0ec-1dd5-49e4-ae14-b4d59230d348',
      slug: 'wma4he3d',
      name: 'abi',
      businessTypes: [],
      status: 'ACTIVE',
      is_active: true,
      created_at: '2026-08-24T08:12:12.533565Z',
      branches: [
        {
          id: 'branch-1',
          slug: 'j1o7cc8b',
          name: 'Main',
          openNow: true,
          location: { address: '1 Main', city: 'Tehran' },
        },
      ],
    } as never)
    const listSpy = vi.spyOn(branchManagementService, 'getTenantsBranches')
    const detailSpy = vi.spyOn(branchManagementService, 'getPublicBranch')

    const data = await resolvePublicBranchPageForPage('wma4he3d', 'j1o7cc8b')

    expect(data.branch.slug).toBe('j1o7cc8b')
    expect(data.branch.city).toBe('Tehran')
    expect(listSpy).not.toHaveBeenCalled()
    expect(detailSpy).not.toHaveBeenCalled()
  })

  it('resolvePublicBranchPageForPage resolves branch page data for SSR', async () => {
    const data = await resolvePublicBranchPageForPage('samoon', 'main')
    expect(data.tenant.slug).toBe('samoon')
    expect(data.branch.slug).toBe('main')
    expect(data.marketplaceBranch.id).toBeTruthy()
  })

  it('public SSR pages use cached resolvers from lib (no local duplicates)', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const root = join(process.cwd(), 'src/app')
    const tenantPage = readFileSync(join(root, '[tenantSlug]/page.tsx'), 'utf8')
    const branchPage = readFileSync(join(root, '[tenantSlug]/[branchSlug]/page.tsx'), 'utf8')

    expect(tenantPage).toContain('initialTenant={tenant}')
    expect(tenantPage).toContain('resolvePublicTenantForPage')
    expect(tenantPage).not.toContain('function resolvePublicTenant')
    expect(branchPage).toContain('resolvePublicBranchPageForPage')
    expect(branchPage).not.toContain('function resolvePublicTenant')
    expect(branchPage).not.toContain('function resolvePublicBranchPage')
  })
})

describe('readPublicPathTenantSlug', () => {
  it('reads the first segment of /acme as the Tenant slug', () => {
    expect(readPublicPathTenantSlug('/acme')).toBe('acme')
    expect(readPublicPathTenantSlug('/acme/main')).toBe('acme')
  })

  it('does not use reserved app routes as tenant slugs', () => {
    expect(readPublicPathTenantSlug('/console')).toBeUndefined()
    expect(readPublicPathTenantSlug('/discover')).toBeUndefined()
    expect(readPublicPathTenantSlug('/')).toBeUndefined()
  })
})
