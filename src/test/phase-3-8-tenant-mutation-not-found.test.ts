// ============================================================
// Phase 3.8 — Tenant admin mutation not-found handling
//
// activateTenant()/suspendTenant()/archiveTenant() previously returned
// `DEFAULT_TENANT` when `setMockStatus()` found no matching tenant,
// silently reporting success and fabricating data for a failed lookup.
// This file proves each now throws instead.
// ============================================================
import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

async function freshTenantService() {
  vi.resetModules()
  const mod = await import('@/services/tenant.service')
  mod.tenantService._resetMockList()
  return mod.tenantService
}

const NONEXISTENT_ID = 'tenant-does-not-exist-anywhere'

describe('Phase 3.8 — activateTenant() rejects instead of fabricating DEFAULT_TENANT', () => {
  it('throws an Error containing the tenant identifier for an unknown slugOrId', async () => {
    const svc = await freshTenantService()
    await expect(svc.activateTenant(NONEXISTENT_ID)).rejects.toThrow(NONEXISTENT_ID)
  })

  it('still resolves normally for a real tenant (no regression)', async () => {
    const svc = await freshTenantService()
    const updated = await svc.activateTenant('tenant-road-bites-01')
    expect(updated.status).toBe('active')
  })
})

describe('Phase 3.8 — suspendTenant() rejects instead of fabricating DEFAULT_TENANT', () => {
  it('throws an Error containing the tenant identifier for an unknown slugOrId', async () => {
    const svc = await freshTenantService()
    await expect(svc.suspendTenant(NONEXISTENT_ID)).rejects.toThrow(NONEXISTENT_ID)
  })

  it('still resolves normally for a real tenant (no regression)', async () => {
    const svc = await freshTenantService()
    const updated = await svc.suspendTenant('tenant-samoon-01')
    expect(updated.status).toBe('suspended')
  })
})

describe('Phase 3.8 — archiveTenant() rejects instead of fabricating DEFAULT_TENANT', () => {
  it('throws an Error containing the tenant identifier for an unknown slugOrId', async () => {
    const svc = await freshTenantService()
    await expect(svc.archiveTenant(NONEXISTENT_ID)).rejects.toThrow(NONEXISTENT_ID)
  })

  it('still resolves normally for a real tenant (no regression)', async () => {
    const svc = await freshTenantService()
    const updated = await svc.archiveTenant('tenant-samoon-01')
    expect(updated.status).toBe('archived')
  })
})

describe('Phase 3.8 — no DEFAULT_TENANT fallback remains in the three mutation functions', () => {
  it('source contains no "?? { ...DEFAULT_TENANT }" pattern in activateTenant/suspendTenant/archiveTenant', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'tenant.service.ts'),
      'utf-8',
    )
    const start = src.indexOf('async activateTenant')
    const end = src.indexOf('async getTenants')
    const block = end > start ? src.slice(start, end) : src.slice(start)
    expect(block).not.toContain('?? { ...DEFAULT_TENANT }')
  })

  it('getTenantBySlug() and getCurrentTenant() are unaffected — still out of scope for this fix', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'tenant.service.ts'),
      'utf-8',
    )
    // getTenant() never returned DEFAULT_TENANT before this fix and still
    // doesn't (throws TenantNotFoundError, unchanged).
    const getTenantBlock = src.slice(src.indexOf('async getTenantBySlug('), src.indexOf('async getCurrentTenant'))
    expect(getTenantBlock).not.toContain('DEFAULT_TENANT')

    // getCurrentTenant() still returns DEFAULT_TENANT in mock mode —
    // explicitly out of scope for this fix, confirmed unchanged.
    const getCurrentTenantBlock = src.slice(
      src.indexOf('async getCurrentTenant('),
      src.indexOf('async listTenants') !== -1 ? src.indexOf('async listTenants') : src.indexOf('async activateTenant'),
    )
    expect(getCurrentTenantBlock).toContain('DEFAULT_TENANT')
  })
})
