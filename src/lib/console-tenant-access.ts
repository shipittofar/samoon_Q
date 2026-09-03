import type { Tenant, TenantStatus } from '@/types'
import type { TenantMembership } from '@/types/rbac'
import { isTenantInactive, normalizeTenantStatus } from '@/lib/tenant-state'

/**
 * Console may not select a Tenant whose operational status is INACTIVE.
 * CLOSED remains selectable for management unless classified as INACTIVE.
 */
export function isConsoleMembershipTenantInactive(
  membership: Pick<TenantMembership, 'tenantId' | 'tenantStatus'> | null | undefined,
  loadedTenant?: Pick<Tenant, 'id' | 'status'> | null,
): boolean {
  if (!membership) return false
  if (
    loadedTenant?.id === membership.tenantId &&
    loadedTenant.status != null &&
    String(loadedTenant.status).trim() !== '' &&
    isTenantInactive(loadedTenant)
  ) {
    return true
  }
  if (membership.tenantStatus) {
    return isTenantInactive({ status: membership.tenantStatus })
  }
  return false
}

export function isConsoleTenantSelectable(
  membership: Pick<TenantMembership, 'tenantId' | 'tenantStatus'> | null | undefined,
  loadedTenant?: Pick<Tenant, 'id' | 'status'> | null,
): boolean {
  return Boolean(membership) && !isConsoleMembershipTenantInactive(membership, loadedTenant)
}

export function membershipHasSelectableConsoleTenant(
  memberships: readonly TenantMembership[] | null | undefined,
): boolean {
  return Boolean(memberships?.some((m) => isConsoleTenantSelectable(m)))
}

export function canonicalMembershipTenantStatus(
  membership: Pick<TenantMembership, 'tenantStatus'> | null | undefined,
): TenantStatus | undefined {
  if (!membership?.tenantStatus) return undefined
  return normalizeTenantStatus(membership.tenantStatus)
}
