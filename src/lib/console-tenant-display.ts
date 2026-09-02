import type { Tenant } from '@/types'
import type { TenantMembership } from '@/types/rbac'
import { useRbacStore, useTenantStore } from '@/stores'

export function findSessionMembership(
  tenantId: string,
  memberships: readonly TenantMembership[] | null | undefined = useRbacStore.getState().sessionMemberships,
): TenantMembership | undefined {
  return memberships?.find((m) => m.tenantId === tenantId)
}

/**
 * Unified tenant display resolver for all Console selectors and chrome.
 *
 * Priority:
 *   membership.tenantName → loaded Tenant.name → tenantSlug → tenantId
 */
export function getTenantDisplayName(
  tenantId: string | null | undefined,
  options?: {
    memberships?: readonly TenantMembership[] | null
    loadedTenant?: Pick<Tenant, 'id' | 'name'> | null
  },
): string {
  if (!tenantId) return ''
  const memberships = options?.memberships ?? useRbacStore.getState().sessionMemberships
  const membership = findSessionMembership(tenantId, memberships)
  if (membership?.tenantName) return membership.tenantName

  const tenant =
    options?.loadedTenant ??
    (useTenantStore.getState().tenant?.id === tenantId ? useTenantStore.getState().tenant : null)
  if (tenant?.name) return tenant.name

  if (membership?.tenantSlug) return membership.tenantSlug
  return tenantId
}

/**
 * Tenant Selector dropdown row label — membership fields only.
 * Never reads useTenantStore (would paint the selected Tenant's name onto other rows).
 *
 *   tenantName → tenantSlug → tenantId
 */
export function getTenantSelectorOptionLabel(
  membership: Pick<TenantMembership, 'tenantId' | 'tenantName' | 'tenantSlug'>,
): string {
  if (membership.tenantName) return membership.tenantName
  if (membership.tenantSlug) return membership.tenantSlug
  return membership.tenantId
}

/** @deprecated Use getTenantDisplayName — kept for import stability. */
export function membershipLabel(membership: TenantMembership): string {
  return getTenantDisplayName(membership.tenantId, { memberships: [membership] })
}

export function hasMembershipTenantDisplayMetadata(
  membership: Pick<TenantMembership, 'tenantName' | 'tenantSlug'> | null | undefined,
): boolean {
  return Boolean(membership?.tenantName && membership?.tenantSlug)
}

export function getTenantLogoUrl(
  tenantId: string | null | undefined,
  memberships: readonly TenantMembership[] | null | undefined = useRbacStore.getState().sessionMemberships,
): string | null | undefined {
  if (!tenantId) return undefined
  const membership = findSessionMembership(tenantId, memberships)
  if (membership && 'tenantLogo' in membership) {
    return membership.tenantLogo ?? null
  }
  const tenant = useTenantStore.getState().tenant
  return tenant?.id === tenantId ? tenant.image : undefined
}
