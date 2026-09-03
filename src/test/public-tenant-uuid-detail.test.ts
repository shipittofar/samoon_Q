/**
 * Public slug routing must not call GET /tenants/{slug}/ or GET /tenants/current/.
 * Slug → GET /public/discover/ (match slug → id) → GET /tenants/{uuid}/.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ENDPOINTS } from '@/services/endpoints'
import { readPublicPathTenantSlug } from '@/lib/public-tenant-resolution'
import { isUsableTenantSlug } from '@/lib/identifier-brands'
import {
  setActiveTenantSlugForRequests,
  resolveTenantSlugForApi,
} from '@/lib/tenant-request-context'

vi.mock('@/services/axios.instance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

const SLUG = 'wma4he3d'
const UUID = '550e8400-e29b-41d4-a716-446655440000'

const TENANT_WIRE = {
  id: UUID,
  name: 'WMA',
  slug: SLUG,
  business_types: ['restaurant'],
  status: 'ACTIVE',
  is_active: true,
  created_at: '2024-01-01T00:00:00.000Z',
  settings: {},
}

async function realTenantService() {
  vi.resetModules()
  process.env.NEXT_PUBLIC_USE_MOCK = 'false'
  const tenantMod = await import('@/services/tenant.service')
  const axiosMod = await import('@/services/axios.instance')
  const resolution = await import('@/lib/public-tenant-resolution')
  return {
    tenantService: tenantMod.tenantService,
    fetchPublicTenantBySlug: resolution.fetchPublicTenantBySlug,
    api: axiosMod.default as unknown as { get: ReturnType<typeof vi.fn> },
  }
}

function urlsFromGet(api: { get: ReturnType<typeof vi.fn> }): string[] {
  return api.get.mock.calls.map((c) => c[0] as string)
}

describe('public tenant slug → UUID detail', () => {
  beforeEach(() => {
    setActiveTenantSlugForRequests(undefined)
    vi.clearAllMocks()
  })

  it('browser path /wma4he3d is still a routing slug', () => {
    expect(readPublicPathTenantSlug(`/${SLUG}`)).toBe(SLUG)
    expect(readPublicPathTenantSlug(`/${SLUG}/main`)).toBe(SLUG)
    expect(isUsableTenantSlug(SLUG, UUID)).toBe(true)
    expect(isUsableTenantSlug(UUID)).toBe(false)
  })

  it('getTenantBySlug uses Discover then DETAIL_BY_ID — never slug path or /current/', async () => {
    const { tenantService, api } = await realTenantService()
    api.get.mockClear()
    api.get
      .mockResolvedValueOnce({ data: { count: 1, results: [TENANT_WIRE] } })
      .mockResolvedValueOnce({ data: TENANT_WIRE })

    const tenant = await tenantService.getTenantBySlug(SLUG)

    expect(tenant.id).toBe(UUID)
    expect(tenant.slug).toBe(SLUG)
    expect(api.get).toHaveBeenCalledTimes(2)

    const [discoverUrl] = api.get.mock.calls[0]
    expect(discoverUrl).toBe(ENDPOINTS.PUBLIC.DISCOVER)
    expect(discoverUrl).not.toBe(ENDPOINTS.TENANTS.CURRENT)

    const [detailUrl] = api.get.mock.calls[1]
    expect(detailUrl).toBe(ENDPOINTS.TENANTS.DETAIL_BY_ID(UUID))
    expect(detailUrl).not.toBe(`/tenants/${SLUG}/`)
    expect(detailUrl).not.toContain(SLUG)

    const urls = urlsFromGet(api)
    expect(urls).not.toContain(ENDPOINTS.TENANTS.CURRENT)
    expect(urls).not.toContain('/tenants/current/')
    expect(urls).not.toContain(`/api/tenants/current/`)
    expect(urls).not.toContain(`/tenants/${SLUG}/`)
  })

  it('fetchPublicTenantBySlug cache miss uses Discover + UUID detail, not /current/', async () => {
    const { fetchPublicTenantBySlug: fetchBySlug, api } = await realTenantService()
    api.get.mockClear()
    api.get
      .mockResolvedValueOnce({ data: { count: 1, results: [TENANT_WIRE] } })
      .mockResolvedValueOnce({ data: TENANT_WIRE })

    const tenant = await fetchBySlug(SLUG)
    expect(tenant.id).toBe(UUID)
    expect(tenant.slug).toBe(SLUG)

    const urls = urlsFromGet(api)
    expect(urls).toContain(ENDPOINTS.PUBLIC.DISCOVER)
    expect(urls).toContain(ENDPOINTS.TENANTS.DETAIL_BY_ID(UUID))
    expect(urls).not.toContain(ENDPOINTS.TENANTS.CURRENT)
    expect(urls).not.toContain(`/tenants/${SLUG}/`)
  })

  it('fetchPublicTenantBySlug cache hit only GETs /tenants/{uuid}/', async () => {
    const { fetchPublicTenantBySlug: fetchBySlug, api } = await realTenantService()
    api.get.mockClear()
    api.get.mockResolvedValueOnce({ data: TENANT_WIRE })

    const tenant = await fetchBySlug(SLUG, {
      cachedTenants: [
        {
          id: UUID,
          slug: SLUG,
          name: 'WMA',
          businessTypes: ['restaurant'],
          status: 'ACTIVE',
          created_at: '',
        },
      ],
    })
    expect(tenant.id).toBe(UUID)
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get.mock.calls[0][0]).toBe(ENDPOINTS.TENANTS.DETAIL_BY_ID(UUID))
    expect(urlsFromGet(api)).not.toContain(ENDPOINTS.TENANTS.CURRENT)
    expect(urlsFromGet(api)).not.toContain(ENDPOINTS.PUBLIC.DISCOVER)
  })

  it('X-Tenant-Slug stays the real slug, never the UUID', () => {
    setActiveTenantSlugForRequests(SLUG, UUID)
    expect(resolveTenantSlugForApi()).toBe(SLUG)
    setActiveTenantSlugForRequests(UUID, UUID)
    expect(resolveTenantSlugForApi()).toBeUndefined()
  })

  it('Console detail path remains UUID', () => {
    expect(ENDPOINTS.TENANTS.DETAIL_BY_ID(UUID)).toBe(`/tenants/${UUID}/`)
    expect(ENDPOINTS.TENANTS.BRANCHES(UUID)).toBe(`/tenants/${UUID}/branches/`)
  })

  it('does not expose a slug-interpolating tenant detail helper', () => {
    expect(ENDPOINTS.TENANTS).not.toHaveProperty('DETAIL_BY_SLUG')
  })

  it('slug resolver uses Discover, not CURRENT; detail uses DETAIL_BY_ID', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(process.cwd(), 'src/services/tenant.service.ts'), 'utf8')
    const resolver = src.slice(
      src.indexOf('async function resolvePublicTenantIdBySlug'),
      src.indexOf('export const tenantService'),
    )
    expect(resolver).toContain('ENDPOINTS.PUBLIC.DISCOVER')
    expect(resolver).not.toContain('TENANTS.CURRENT')
    expect(resolver).not.toContain('/tenants/current/')
    expect(src).not.toContain('DETAIL_BY_SLUG')
    expect(src).toContain('ENDPOINTS.TENANTS.DETAIL_BY_ID')
  })
})
