import type { TenantProvisionResult } from '@/types/provisioning'

/**
 * Step 6 display fields — always from the provision API response tenant,
 * never from wizard form state or frontend slugify().
 */
export function getProvisionedTenantDisplay(result: TenantProvisionResult): {
  name: string | undefined
  slug: string | undefined
  slugMissing: boolean
} {
  const name = result.tenant?.name
  const slug =
    (result.tenant?.slug && result.tenant.slug.trim()) ||
    (result.slug && result.slug.trim()) ||
    undefined
  return {
    name,
    slug,
    slugMissing: Boolean(result.success) && !slug,
  }
}
