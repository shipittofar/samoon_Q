import type { TenantStatus } from '@/types'
import type { TenantProvisionResult } from '@/types/provisioning'

/**
 * Step 6 display fields — always from the provision API response tenant,
 * never from wizard form state or frontend slugify().
 */
export function getProvisionedTenantDisplay(result: TenantProvisionResult): {
  name: string | undefined
  slug: string | undefined
  status: TenantStatus | undefined
  tenantId: string | undefined
  slugMissing: boolean
  isInactive: boolean
} {
  const name = result.tenant?.name
  const slug =
    (result.tenant?.slug && result.tenant.slug.trim()) ||
    (result.slug && result.slug.trim()) ||
    undefined
  const status = result.tenant?.status
  const tenantId = result.tenant?.id || result.tenantId
  return {
    name,
    slug,
    status,
    tenantId,
    slugMissing: Boolean(result.success) && !slug,
    isInactive: status === 'inactive',
  }
}

/**
 * Console route for creating the first branch of a newly provisioned tenant.
 * Uses the existing `/console/branches/new` page with an explicit tenantId query
 * so the CTA does not rely on the previously active workspace tenant.
 */
export function getCreateFirstBranchHref(tenantId: string): string {
  return `/console/branches/new?tenantId=${encodeURIComponent(tenantId)}`
}

/** i18n key under `console` for a TenantStatus value. */
export function tenantStatusLabelKey(status: TenantStatus | string | undefined): string {
  switch (status) {
    case 'active':
      return 'statusActive'
    case 'inactive':
      return 'statusInactive'
    case 'trial':
      return 'tenantStatusTrial'
    case 'suspended':
      return 'statusSuspended'
    case 'churned':
      return 'tenantStatusChurned'
    case 'archived':
      return 'tenantStatusArchived'
    default:
      return 'statusInactive'
  }
}
