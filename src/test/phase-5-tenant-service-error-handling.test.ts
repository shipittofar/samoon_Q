// ============================================================
// Phase 5 — tenant.service.ts getTenants() error handling
//
// getTenants() previously swallowed real-mode fetch failures into an
// empty array (`catch { return [] }`), making a genuine backend/network
// failure indistinguishable from "this tenant genuinely has zero
// tenants." This file proves the rejection now propagates, exactly like
// getTenant() already does, so React Query's normal error flow
// (isError, the global QueryCache.onError toast) can handle it.
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

async function freshTenantServiceMockMode() {
  vi.resetModules()
  process.env.NEXT_PUBLIC_USE_MOCK = 'true'
  const mod = await import('@/services/tenant.service')
  return mod.tenantService
}

describe('Phase 5 — getTenants() real-mode error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects (does not resolve to []) when api.get rejects', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    const networkError = new Error('Network Error')
    api.get.mockRejectedValueOnce(networkError)

    await expect(tenantService.getTenants()).rejects.toThrow('Network Error')
  })

  it('does not swallow a 500 response into an empty array', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    const serverError = Object.assign(new Error('Internal Server Error'), {
      response: { status: 500 },
    })
    api.get.mockRejectedValueOnce(serverError)

    let resolved: unknown = 'not-called'
    let rejected: unknown = 'not-called'
    try {
      resolved = await tenantService.getTenants()
    } catch (err) {
      rejected = err
    }
    expect(resolved).toBe('not-called')
    expect(rejected).not.toBe('not-called')
    expect(resolved).not.toEqual([])
  })

  it('still resolves normally when api.get succeeds', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({ data: { results: [{ id: 't1', slug: 'demo' }] } })

    const result = await tenantService.getTenants()
    // Phase Z.6 — getTenants() now runs each result through normalizeTenant(),
    // which fills in `businessTypes` (camelCase, module-key semantics) from
    // the backend's `business_types` field when present, defaulting to []
    // when neither is present — see tenant.service.ts's normalizeTenant()
    // doc comment. Every other raw field is still preserved untouched.
    expect(result).toEqual([{ id: 't1', slug: 'demo', businessTypes: [] }])
  })
})

describe('Phase 5 — getTenants() mock-mode behavior is unchanged', () => {
  it('resolves with the mock tenant list, no network call involved', async () => {
    const tenantService = await freshTenantServiceMockMode()
    const result = await tenantService.getTenants()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })
})
