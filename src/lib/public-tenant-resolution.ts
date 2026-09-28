import { cache } from 'react'
import { notFound } from 'next/navigation'
import { tenantService, TenantNotFoundError, TenantForbiddenError } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import {
  findPublicBranchBySlug,
  publicBranchesFromCatalog,
  resolvePublicBranchList,
} from '@/lib/public-branches'
import {
  composeMarketplacePresentation,
  getMarketplaceMeta,
  publicBranchFromDetail,
  type MarketplaceMeta,
  type PublicBranchInfo,
} from '@/types/marketplace'
import { pickTenantContact } from '@/lib/tenant-settings'
import type { Tenant } from '@/types'

/** React Query key for the Discover tenant list — shared with usePublicTenants(). */
export const PUBLIC_TENANTS_QUERY_KEY = ['public-tenants'] as const

/** First path segments that are app routes, not `/{tenantSlug}`. */
const RESERVED_PUBLIC_PATH_SEGMENTS = new Set([
  'api',
  'cart',
  'checkout',
  'complete-profile',
  'console',
  'dashboard',
  'discover',
  'events',
  'forgot-password',
  'location',
  'login',
  'loyalty',
  'menu',
  'offline',
  'order',
  'platform-admin',
  'promotions',
  'register',
  'reservation',
  'restaurant',
  'reviews',
  'table',
  'vendors',
  'verify',
  'verify-otp',
])

/**
 * Tenant slug from a path-based public URL (`/acme`, `/acme/main`).
 * Does not use hostname / `x-tenant-slug`. Reserved first segments are ignored.
 */
export function readPublicPathTenantSlug(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined
  const segment = pathname.split('/').filter(Boolean)[0]
  if (!segment || RESERVED_PUBLIC_PATH_SEGMENTS.has(segment)) return undefined
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export type ResolvePublicTenantOptions = {
  cachedTenants?: Tenant[]
  /** Bypass the same-slug skip so a public page can reload after a Console mutation. */
  force?: boolean
}

export type PublicBranchPageData = {
  tenant: Tenant
  meta: MarketplaceMeta
  marketplaceBranch: PublicBranchInfo
  branch: PublicBranchInfo
}

function findTenantIdBySlug(tenants: Tenant[], slug: string): string | undefined {
  return tenants.find((t) => t.slug === slug)?.id
}

/**
 * Map a public URL slug to tenant.id (UUID in production).
 * Does not GET /tenants/{slug}/.
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
  return tenantService.resolvePublicTenantIdBySlug(slug)
}

/**
 * Public Tenant by URL slug.
 * Cache hit: the cached catalog row.
 * Cache miss: GET /public/discover/ and the matching row. Never GET /tenants/{slug}/.
 */
export async function fetchPublicTenantBySlug(
  slug: string,
  options: ResolvePublicTenantOptions = {},
): Promise<Tenant> {
  const { cachedTenants } = options
  if (cachedTenants?.length) {
    const cached = cachedTenants.find((tenant) => tenant.slug === slug && tenant.id)
    if (cached) return cached
  }
  // Discover catalog only. Never GET /tenants/{slug}/ or the slow /tenants/{id}/ detail.
  return tenantService.getTenantBySlug(slug)
}

export const resolvePublicTenantForPage = cache(async (slug: string): Promise<Tenant> => {
  try {
    return await fetchPublicTenantBySlug(slug)
  } catch (err) {
    if (err instanceof TenantNotFoundError || err instanceof TenantForbiddenError) {
      notFound()
    }
    throw err
  }
})

function plainRequestError(err: unknown): Error {
  const axios = err as { isAxiosError?: boolean; name?: string; message?: string }
  if (axios?.isAxiosError || axios?.name === 'AxiosError') {
    const error = new Error(axios.message || 'Request failed')
    error.name = 'RequestError'
    return error
  }
  return err instanceof Error ? err : new Error('Request failed')
}

export const resolvePublicBranchPageForPage = cache(async (
  tenantSlug: string,
  branchSlug: string,
): Promise<PublicBranchPageData> => {
  const tenant = await resolvePublicTenantForPage(tenantSlug)
  const catalogBranches = publicBranchesFromCatalog(tenant)
  let branchList: PublicBranchInfo[]
  if (catalogBranches) {
    branchList = catalogBranches
  } else {
    try {
      branchList = await resolvePublicBranchList(tenant.id)
    } catch (err) {
      throw plainRequestError(err)
    }
  }
  const listMatch = findPublicBranchBySlug(branchList, branchSlug)

  if (!listMatch?.id) {
    notFound()
  }

  let branch: PublicBranchInfo = listMatch
  if (!catalogBranches) {
    try {
      const detail = await branchManagementService.getPublicBranch(tenant.id, listMatch.id)
      branch = publicBranchFromDetail(detail)
    } catch {
      notFound()
    }
  }

  const meta = composeMarketplacePresentation({
    listing: getMarketplaceMeta(tenant.settings),
    branches: branchList,
    tenantContact: pickTenantContact(tenant.settings),
  })

  return { tenant, meta, marketplaceBranch: listMatch, branch }
})
