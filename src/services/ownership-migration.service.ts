// ============================================================
// P10.2.1 — Ownership Migration Helpers (Phase G)
//
// Implements the backfill rule and legacy-label derivation specified in
// docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §10.3/§8.2. These are pure
// functions only — nothing here mutates a live store, deletes a legacy
// model, or is invoked automatically. `tenant.service.ts` and
// `staff.service.ts`'s mock fixtures were authored fresh with `ownerId`
// already populated (see owner.service.ts's `MOCK_TENANT_OWNER_MAP`)
// rather than run through this backfill at load time, since a freshly-
// authored fixture set doesn't need migrating — this module exists so the
// backfill rule the architecture document specifies is implemented,
// tested, and ready for a real (messy) dataset in a later phase, not left
// as a paragraph of prose.
// ============================================================
import type { Owner } from '@/types/ownership'
import type { StaffMember } from '@/types/staff'
import type { Tenant, UserRole } from '@/types'

export interface BackfillReport {
  /** Tenant ids that received a resolved `ownerId`. */
  resolvedTenantIds: string[]
  /**
   * Tenant ids left untouched because zero or more-than-one 'owner'-role
   * staff record was found — P10.1 §10.3: "require manual resolution
   * (flagged, not auto-resolved)."
   */
  ambiguousTenantIds: string[]
  /** New Owner records synthesized because the resolved userId had none yet. */
  createdOwners: Owner[]
}

export interface BackfillResult {
  tenants: Tenant[]
  owners: Owner[]
  report: BackfillReport
}

/**
 * P10.1 §10.3 backfill rule:
 *
 * "for each Tenant, if exactly one TenantRoleAssignment exists with
 * role: 'owner', that assignment's userId becomes the seed for a new
 * Owner record (creating one if the user doesn't already have one), and
 * Tenant.ownerId is set to it. Tenants with zero or >1 owner-role
 * assignments require manual resolution (flagged, not auto-resolved)."
 *
 * This codebase's legacy "role: 'owner'" data lives on `StaffMember.roles`
 * (P7's tenant-scoped `Role[]`), not a separate `TenantRoleAssignment`
 * table — `staff` here is that source. Pure function: returns new
 * `tenants`/`owners` arrays, never mutates its inputs, and only touches
 * tenants that don't already have an `ownerId`.
 */
export function backfillTenantOwnership(
  tenants: Tenant[],
  staff: StaffMember[],
  existingOwners: Owner[],
): BackfillResult {
  const resultTenants = tenants.map((t) => ({ ...t }))
  const resultOwners = existingOwners.map((o) => ({ ...o }))
  const report: BackfillReport = {
    resolvedTenantIds: [],
    ambiguousTenantIds: [],
    createdOwners: [],
  }

  for (const tenant of resultTenants) {
    if (tenant.ownerId) continue // already has an owner — not this backfill's concern

    const ownerRoleHolders = staff.filter(
      (s) => s.tenantId === tenant.id && s.roles.includes('owner'),
    )

    if (ownerRoleHolders.length !== 1) {
      report.ambiguousTenantIds.push(tenant.id)
      continue
    }

    const holder = ownerRoleHolders[0]
    let owner = resultOwners.find((o) => o.userId === holder.userId)

    if (!owner) {
      owner = {
        ownerId: `owner-backfill-${holder.userId}`,
        userId: holder.userId,
        status: 'active',
        plan: 'starter',
        maxTenants: null,
        billing: { customerId: null, billingEmail: holder.email },
        createdAt: new Date().toISOString(),
      }
      resultOwners.push(owner)
      report.createdOwners.push(owner)
    }

    tenant.ownerId = owner.ownerId
    report.resolvedTenantIds.push(tenant.id)
  }

  return { tenants: resultTenants, owners: resultOwners, report }
}

/**
 * P10.1 §8.2 — `UserRole` (legacy `'customer' | 'staff' | 'owner' | 'admin'`)
 * retirement path, expressed as a pure derivation from the new model:
 *
 *   'customer' → any PlatformUser with no Staff/Owner record
 *   'staff'    → any Staff record with ≥1 active StaffAssignment
 *   'owner'    → any Owner record
 *   'admin'    → collapses into 'staff' (just one StaffRole value now)
 *
 * Not wired into `auth.service.ts`, any store, or any UI badge — per
 * §8.2: "This document does not implement that derivation — it specifies
 * the target shape." This function IS that specification made concrete
 * and testable, for a later phase to call.
 */
export function deriveLegacyUserRoleLabel(params: {
  isOwner: boolean
  hasActiveStaffAssignment: boolean
}): UserRole {
  if (params.isOwner) return 'owner'
  if (params.hasActiveStaffAssignment) return 'staff'
  return 'customer'
}
