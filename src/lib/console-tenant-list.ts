import { membershipToTenantShell } from '@/lib/console-membership-hydration'
import {
  isTenantClosed,
  isTenantInactive,
  isTenantOperational,
  normalizeTenantStatus,
} from '@/lib/tenant-state'
import type { Tenant, TenantStatus } from '@/types'
import type { TenantMembership } from '@/types/rbac'

export type ConsoleTenantStatusFilter = 'all' | TenantStatus

/**
 * Union tenant records by id. Earlier lists win; later lists only fill gaps.
 * Never drops INACTIVE / CLOSED / is_active=false rows.
 */
export function mergeTenantsById(lists: readonly (readonly Tenant[])[]): Tenant[] {
  const byId = new Map<string, Tenant>()
  for (const list of lists) {
    for (const tenant of list) {
      if (!tenant?.id || byId.has(tenant.id)) continue
      byId.set(tenant.id, tenant)
    }
  }
  return Array.from(byId.values())
}

/**
 * Keep API tenants and add any session membership the list omitted
 * (typical when console-tenants is active-only).
 */
export function mergeConsoleTenantsWithMemberships(
  tenants: readonly Tenant[],
  memberships: readonly TenantMembership[] | null | undefined,
): Tenant[] {
  const fromMemberships = (memberships ?? []).map(membershipToTenantShell)
  return mergeTenantsById([tenants, fromMemberships])
}

export function filterConsoleTenantsByStatus(
  tenants: readonly Tenant[],
  filter: ConsoleTenantStatusFilter,
): Tenant[] {
  if (filter === 'all') return [...tenants]
  return tenants.filter((tenant) => normalizeTenantStatus(tenant.status) === filter)
}

export function countConsoleTenantsByStatus(tenants: readonly Tenant[]) {
  return {
    total: tenants.length,
    active: tenants.filter((tn) => isTenantOperational(tn)).length,
    inactive: tenants.filter((tn) => isTenantInactive(tn)).length,
    closed: tenants.filter((tn) => isTenantClosed(tn)).length,
  }
}
