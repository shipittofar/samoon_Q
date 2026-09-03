import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolvePublicTenantId,
  fetchPublicTenantBySlug,
  resolvePublicTenantForPage,
  resolvePublicBranchPageForPage,
  readPublicPathTenantSlug,
} from '@/lib/public-tenant-resolution'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'

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

  it('resolvePublicTenantId uses getTenantBySlug when cache misses (not GET /tenants/ page 1)', async () => {
    const getTenantsSpy = vi.spyOn(tenantService, 'getTenants')
    const bySlugSpy = vi.spyOn(tenantService, 'getTenantBySlug')
    const id = await resolvePublicTenantId('samoon')
    expect(id).toBe('tenant-samoon-01')
    expect(getTenantsSpy).not.toHaveBeenCalled()
    expect(bySlugSpy).toHaveBeenCalledWith('samoon')
  })

  it('resolvePublicTenantId throws TenantNotFoundError for unknown slug', async () => {
    await expect(resolvePublicTenantId('nonexistent-slug-xyz')).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  it('fetchPublicTenantBySlug uses getTenantBySlug, not a paginated tenant list', async () => {
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
