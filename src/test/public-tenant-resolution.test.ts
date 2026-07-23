import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolvePublicTenantId,
  fetchPublicTenantBySlug,
  resolvePublicTenantForPage,
  resolvePublicBranchPageForPage,
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

  it('resolvePublicTenantId falls back to getTenants when cache misses', async () => {
    const id = await resolvePublicTenantId('samoon')
    expect(id).toBe('tenant-samoon-01')
  })

  it('resolvePublicTenantId throws TenantNotFoundError for unknown slug', async () => {
    await expect(resolvePublicTenantId('nonexistent-slug-xyz')).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  it('fetchPublicTenantBySlug uses getTenantById not getTenantBySlug', async () => {
    const bySlugSpy = vi.spyOn(tenantService, 'getTenantBySlug')
    const byIdSpy = vi.spyOn(tenantService, 'getTenantById')
    const tenant = await fetchPublicTenantBySlug('samoon')
    expect(tenant.slug).toBe('samoon')
    expect(byIdSpy).toHaveBeenCalledWith('tenant-samoon-01')
    expect(bySlugSpy).not.toHaveBeenCalled()
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

    expect(tenantPage).toContain('resolvePublicTenantForPage')
    expect(tenantPage).not.toContain('function resolvePublicTenant')
    expect(branchPage).toContain('resolvePublicBranchPageForPage')
    expect(branchPage).not.toContain('function resolvePublicTenant')
    expect(branchPage).not.toContain('function resolvePublicBranchPage')
  })
})
