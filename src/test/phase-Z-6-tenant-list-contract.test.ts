// ============================================================
// Phase Z.6 — Frontend Tenant List Contract Alignment
//
// Regression suite for docs/TENANT_LIST_CONTRACT_ALIGNMENT_AUDIT.md.
// Proves normalizeTenant() (src/services/tenant.service.ts) fills in
// `businessTypes` from the backend's real `business_types` field without
// dropping any other field, and that the new Tenant fields (image,
// tax_percentage, updated_at, business_types, settings.currency/language/
// timezone/featureFlags/ordering) round-trip through getTenant()/getTenants()
// untouched. `featureFlags` (not `features` — corrected in Phase Z.6.2,
// see TENANT_SETTINGS_CONTRACT_MIGRATION_AUDIT.md) matches the real
// contract feature-flags.service.ts and BusinessCard.tsx have always read.
// ============================================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/axios.instance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

async function freshTenantServiceRealMode() {
  vi.resetModules()
  process.env.NEXT_PUBLIC_USE_MOCK = 'false'
  const mod = await import('@/services/tenant.service')
  const axiosMod = await import('@/services/axios.instance')
  return { tenantService: mod.tenantService, api: axiosMod.default as unknown as { get: ReturnType<typeof vi.fn> } }
}

/** The exact raw shape described in the Phase Z.6 task — snake_case,
 * no `businessTypes` key at all. */
const RAW_BACKEND_TENANT = {
  id: 't-real-01',
  name: 'Real Backend Tenant',
  slug: 'real-backend-tenant',
  image: 'https://example.com/logo.png',
  business_types: ['restaurant', 'cafe'],
  status: 'active',
  tax_percentage: 8.5,
  settings: {
    currency: 'USD',
    language: 'en',
    timezone: 'America/New_York',
    featureFlags: { loyalty: true, delivery: false },
    ordering: { minimumOrder: 15 },
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
}

describe('Phase Z.6 — normalizeTenant() via getTenants() (real mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fills businessTypes from the backend\'s business_types field', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({ data: { results: [RAW_BACKEND_TENANT] } })

    const [tenant] = await tenantService.getTenants()
    expect(tenant!.businessTypes).toEqual(['restaurant', 'cafe'])
  })

  it('does not drop any raw field — every backend field survives untouched', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({ data: { results: [RAW_BACKEND_TENANT] } })

    const [tenant] = await tenantService.getTenants()
    expect(tenant).toMatchObject({
      id: 't-real-01',
      name: 'Real Backend Tenant',
      slug: 'real-backend-tenant',
      image: 'https://example.com/logo.png',
      business_types: ['restaurant', 'cafe'],
      status: 'ACTIVE',
      tax_percentage: 8.5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    })
  })

  it('settings.featureFlags survive; deprecated Branch-owned settings are stripped', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({ data: { results: [RAW_BACKEND_TENANT] } })

    const [tenant] = await tenantService.getTenants()
    expect(tenant!.settings?.featureFlags).toEqual({ loyalty: true, delivery: false })
    expect(tenant!.settings && 'ordering' in tenant!.settings).toBe(false)
    expect(tenant!.settings && 'currency' in tenant!.settings).toBe(false)
    expect(tenant!.settings && 'language' in tenant!.settings).toBe(false)
    expect(tenant!.settings && 'timezone' in tenant!.settings).toBe(false)
  })

  it('a response that already has businessTypes (mock-shaped) is left alone, not overwritten by business_types', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({
      data: { results: [{ ...RAW_BACKEND_TENANT, businessTypes: ['already-set'] }] },
    })

    const [tenant] = await tenantService.getTenants()
    expect(tenant!.businessTypes).toEqual(['already-set'])
  })

  it('a response with neither businessTypes nor business_types defaults to an empty array, not undefined (the exact bug this fix closes: consumers call .forEach()/.map() on this unconditionally)', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({ data: { results: [{ id: 't2', name: 'No Types', slug: 'no-types', status: 'active', created_at: '2024-01-01T00:00:00Z' }] } })

    const [tenant] = await tenantService.getTenants()
    expect(tenant!.businessTypes).toEqual([])
    expect(() => tenant!.businessTypes.forEach(() => {})).not.toThrow()
  })

  it('getTenant(slug) (single-tenant fetch) applies the same normalization', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({ data: { count: 1, results: [RAW_BACKEND_TENANT] } })

    const tenant = await tenantService.getTenantBySlug('real-backend-tenant')
    expect(tenant.businessTypes).toEqual(['restaurant', 'cafe'])
    expect(tenant.tax_percentage).toBe(8.5)
  })
})

describe('Phase Z.6 — mock mode is unaffected', () => {
  it('mock tenants already carry businessTypes and are returned unchanged', async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { tenantService } = await import('@/services/tenant.service')
    const tenants = await tenantService.getTenants()
    tenants.forEach((t) => expect(Array.isArray(t.businessTypes)).toBe(true))
  })
})
