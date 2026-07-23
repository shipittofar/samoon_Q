import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolvePublicTenantId, fetchPublicTenantBySlug } from '@/lib/public-tenant-resolution'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'

describe('public-tenant-resolution', () => {
  beforeEach(() => {
    tenantService._resetMockList()
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
})
