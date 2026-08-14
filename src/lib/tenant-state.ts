/**
 * Tenant visibility vs operational state — frontend contract.
 *
 *   is_active → "Should I show this tenant?" (public visibility)
 *   status    → "What is this tenant's operational state?"
 *               ACTIVE | INACTIVE | CLOSED
 *
 * Do not use status for visibility, or is_active for ordering/ops.
 * Backend still enforces catalog and operational access; these helpers
 * are for correct UI behavior only.
 */

import type { TenantStatus } from '@/types'

export type TenantVisibilityFields = { is_active?: boolean | null }
export type TenantOperationalFields = { status?: string | null }

/** Canonical operational statuses. */
export const TENANT_OPERATIONAL_STATUSES: readonly TenantStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'CLOSED',
] as const

/**
 * Normalize any wire/legacy status into the operational contract.
 * Accepts uppercase contract values and legacy lowercase lifecycle values.
 */
export function normalizeTenantStatus(raw: string | null | undefined): TenantStatus {
  const trimmed = (raw ?? '').trim()
  const upper = trimmed.toUpperCase()
  if (upper === 'ACTIVE' || upper === 'INACTIVE' || upper === 'CLOSED') {
    return upper
  }

  switch (trimmed.toLowerCase()) {
    case 'active':
    case 'trial':
      return 'ACTIVE'
    case 'inactive':
      return 'INACTIVE'
    case 'suspended':
    case 'churned':
    case 'archived':
      return 'CLOSED'
    default:
      return 'INACTIVE'
  }
}

/**
 * Public / catalog visibility. Never inferred from `status`.
 */
export function isTenantVisible(
  tenant: TenantVisibilityFields | null | undefined,
): boolean {
  return tenant?.is_active === true
}

/** Operational: can the tenant currently operate (ordering/service)? */
export function isTenantOperational(
  tenant: TenantOperationalFields | null | undefined,
): boolean {
  return normalizeTenantStatus(tenant?.status) === 'ACTIVE'
}

export function isTenantInactive(
  tenant: TenantOperationalFields | null | undefined,
): boolean {
  return normalizeTenantStatus(tenant?.status) === 'INACTIVE'
}

export function isTenantClosed(
  tenant: TenantOperationalFields | null | undefined,
): boolean {
  return normalizeTenantStatus(tenant?.status) === 'CLOSED'
}

/**
 * Whether the UI should enable tenant-level ordering/checkout actions.
 * Branch checkout flags still apply separately.
 */
export function canOrderFromTenant(
  tenant: TenantOperationalFields | null | undefined,
): boolean {
  return isTenantOperational(tenant)
}

/**
 * Transitional: coerce missing `is_active` from legacy responses without
 * treating ACTIVE as "visible". Only used inside normalizeTenant when the
 * field is absent on the wire.
 */
export function coerceTenantIsActive(
  rawIsActive: unknown,
  rawStatus: string | null | undefined,
): boolean {
  if (typeof rawIsActive === 'boolean') return rawIsActive

  // Field missing: do not use ACTIVE/INACTIVE as visibility.
  // Map only legacy terminal lifecycle labels that historically meant "hidden".
  const legacy = (rawStatus ?? '').trim().toLowerCase()
  if (legacy === 'archived' || legacy === 'suspended' || legacy === 'churned') {
    return false
  }
  return true
}
