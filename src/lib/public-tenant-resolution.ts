import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import type { Tenant } from '@/types'

/** React Query key for the Discover tenant list — shared with usePublicTenants(). */
export const PUBLIC_TENANTS_QUERY_KEY = ['public-tenants'] as const

export type ResolvePublicTenantOptions = {
  /**
   * Pre-fetched tenants (e.g. React Query discover cache).
   * When a match is found, avoids an extra GET /tenants/ list round-trip.
   */
  cachedTenants?: Tenant[]
}

function findTenantIdBySlug(tenants: Tenant[], slug: string): string | undefined {
  return tenants.find((t) => t.slug === slug)?.id
}

/**
 * Single source of truth: map a public URL slug to the canonical tenant UUID.
 *
 * Priority:
 *   1. `cachedTenants` (Discover / usePublicTenants React Query cache)
 *   2. GET /api/tenants/ list lookup
 *
 * Never calls GET /api/tenants/{slug}/ — the production backend is UUID-only.
 */
export async function resolvePublicTenantId(
  slug: string,
  options: ResolvePublicTenantOptions = {},
): Promise<string> {
  const { cachedTenants } = options

  if (cachedTenants?.length) {
    const cachedId = findTenantIdBySlug(cachedTenants, slug)
    if (cachedId) return cachedId
  }

  const tenants = await tenantService.getTenants()
  const tenantId = findTenantIdBySlug(tenants, slug)
  if (!tenantId) throw new TenantNotFoundError(slug)
  return tenantId
}

/**
 * Fetch full tenant detail for a public URL slug via the UUID detail endpoint.
 */
export async function fetchPublicTenantBySlug(
  slug: string,
  options: ResolvePublicTenantOptions = {},
): Promise<Tenant> {
  const tenantId = await resolvePublicTenantId(slug, options)
  return tenantService.getTenantById(tenantId)
}
