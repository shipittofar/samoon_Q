import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { DEFAULT_TENANT } from '@/constants'
import type { Tenant } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Mock tenant store — simulates what the Django backend will return for P1A.1.
 * Keyed by slug. The 'default' slug maps to the single implicit restaurant tenant.
 */
const MOCK_TENANTS: Record<string, Tenant> = {
  default: { ...DEFAULT_TENANT },
  savor: {
    id: 'tenant-savor-01',
    name: 'Savor Restaurant',
    slug: 'savor',
    businessTypes: ['restaurant'],
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
}

export const tenantService = {
  /**
   * Load a tenant by slug.
   * Falls back to DEFAULT_TENANT if the slug is not found (mock) or the request
   * fails (real API), preserving single-tenant backward compatibility (P1A.4).
   *
   * Tenant resolution strategy: the slug is determined by the caller.
   * In Phase 1B (P1B.3) the slug will be extracted from the subdomain in
   * next.js middleware and passed here. Until then, callers pass an explicit
   * slug or omit it to receive the default tenant.
   */
  async getTenant(slug?: string): Promise<Tenant> {
    const resolvedSlug = slug ?? 'default'

    if (USE_MOCK) {
      await delay()
      return MOCK_TENANTS[resolvedSlug] ?? DEFAULT_TENANT
    }

    try {
      const { data } = await api.get<Tenant>(ENDPOINTS.TENANTS.DETAIL(resolvedSlug))
      return data
    } catch {
      // Network failure: degrade gracefully to the default tenant so the app
      // remains usable for the existing single-tenant deployment (P1A.4).
      return DEFAULT_TENANT
    }
  },

  /**
   * Load the tenant inferred from the current request context.
   * In Phase 1B this will read the tenant slug set by middleware in a request
   * header. For now it calls the /tenants/current/ endpoint which the backend
   * resolves from the Host header.
   */
  async getCurrentTenant(): Promise<Tenant> {
    if (USE_MOCK) {
      await delay()
      return { ...DEFAULT_TENANT }
    }

    try {
      const { data } = await api.get<Tenant>(ENDPOINTS.TENANTS.CURRENT)
      return data
    } catch {
      return DEFAULT_TENANT
    }
  },
}
