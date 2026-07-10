// ============================================================
// P10.2.1 — StaffAssignment Entity Service (data model foundation)
//
// Implements the StaffAssignment entity from
// docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §1.1/§3 as a standalone mock
// service, following the same USE_MOCK pattern as every other service in
// src/services/. Grant/Revoke/Move are implemented exactly per §3.5's
// lifecycle table; nothing here is wired into permission.service.ts,
// branch-access.service.ts, hooks, stores, or UI (that wiring is P10.2.2
// per docs/P10.2.1_OWNERSHIP_DATA_MODEL_IMPLEMENTATION.md).
//
// Real-mode calls target the endpoints documented in
// docs/BACKEND_API_CONTRACT.md §39.5 — those endpoints do not exist on any
// backend yet, so USE_MOCK=false will 404 until a backend implements them.
// ============================================================
import api from './axios.instance'
import { validateAssignment, resolveAssignmentStatus } from './ownership.service'
import type {
  StaffAssignment,
  GrantStaffAssignmentPayload,
  RevokeStaffAssignmentPayload,
  MoveStaffAssignmentPayload,
} from '@/types/ownership'
import type { StaffMember } from '@/types/staff'
import type { Tenant } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}
function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString()
}

// ── Mock data ─────────────────────────────────────────────────────────────────
//
// Realizes every requirement in P10.1 §9's minimum fixture list and §3.2's
// four worked examples (Accountant / Manager / Cashier / Support), plus
// full lifecycle coverage (§3.5): active, future, temporary (validUntil),
// and revoked. All staffId/tenantId/branchId values reference the real
// fixtures in staff.service.ts / tenant.service.ts / branch.service.ts —
// nothing here is invented in isolation.

const MOCK_STAFF_ASSIGNMENTS: StaffAssignment[] = [
  // ── Accountant (staff-accountant-01, Owner owner-001) ─────────────────────
  // "role=finance-view, mode=read, branchIds=all" on Tenant A (savor) —
  // StaffRole has no 'finance-view' value (P10.1 §4.3 reuses the existing
  // 7-role enum), so this is realized as role='manager', mode='read', which
  // the mode dimension (§3.4) mechanically downgrades to the .view-only
  // subset of manager's permissions — the same effect the brief describes.
  {
    assignmentId: 'assign-001',
    staffId: 'staff-accountant-01',
    tenantId: 'tenant-savor-01',
    branchIds: 'all',
    role: 'manager',
    mode: 'read',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(35),
  },
  // "role=finance-view, mode=read, branchIds=[Branch2,Branch4]" on Tenant B
  // (brew-cafe) — brew-cafe only has 2 branches in the mock fixture set, so
  // this uses its second branch as the "partial subset" example.
  {
    assignmentId: 'assign-002',
    staffId: 'staff-accountant-01',
    tenantId: 'tenant-brew-cafe-01',
    branchIds: ['branch-brewcafe-02'],
    role: 'manager',
    mode: 'read',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(20),
  },

  // ── Legacy 'owner'-role staff collapsing into a Staff assignment ──────────
  // Blake (staff-brewcafe-owner-01) previously held the 'owner' P7 role on
  // tenant-brew-cafe-01. Under this model, tenant-brew-cafe-01 is now owned
  // by owner-001 (Olivia) — Blake is real Staff with full management
  // access to it via an ordinary assignment. Realizes P10.1 §8.2's
  // "'admin' collapses into 'staff'" retirement path in fixture form.
  {
    assignmentId: 'assign-003',
    staffId: 'staff-brewcafe-owner-01',
    tenantId: 'tenant-brew-cafe-01',
    branchIds: 'all',
    role: 'admin',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(180),
  },

  // ── Manager — Tenant, all branches, full management (§3.2 "Manager") ─────
  {
    assignmentId: 'assign-004',
    staffId: 'staff-manager-01',
    tenantId: 'tenant-savor-01',
    branchIds: 'all',
    role: 'manager',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(119),
  },

  // ── Cashier — single branch only (§3.2 "Cashier") ─────────────────────────
  {
    assignmentId: 'assign-005',
    staffId: 'staff-cashier-01',
    tenantId: 'tenant-savor-01',
    branchIds: ['branch-rest-01'],
    role: 'cashier',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-manager-01',
    grantedAt: daysAgo(89),
  },

  // ── Support — two specific branches (§3.2 "Support") ──────────────────────
  {
    assignmentId: 'assign-006',
    staffId: 'staff-support-01',
    tenantId: 'tenant-savor-01',
    branchIds: ['branch-rest-02', 'branch-cafe-01'],
    role: 'support',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(69),
  },

  // ── Future assignment (§3.5) — takes effect on validFrom, not yet active ──
  {
    assignmentId: 'assign-007',
    staffId: 'staff-waiter-02',
    tenantId: 'tenant-brew-cafe-01',
    branchIds: 'all',
    role: 'waiter',
    mode: 'manage',
    status: 'future',
    validFrom: daysFromNow(14),
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(2),
  },

  // ── Temporary assignment (§3.5) — validUntil set at grant time ────────────
  {
    assignmentId: 'assign-008',
    staffId: 'staff-kitchen-02',
    tenantId: 'tenant-savor-01',
    branchIds: ['branch-rest-01'],
    role: 'kitchen',
    mode: 'manage',
    status: 'active',
    validUntil: daysFromNow(30),
    grantedBy: 'user-manager-01',
    grantedAt: daysAgo(49),
  },

  // ── Revoked assignment (§3.5) — retained for audit, grants nothing ────────
  {
    assignmentId: 'assign-009',
    staffId: 'staff-marketing-02',
    tenantId: 'tenant-savor-01',
    branchIds: 'all',
    role: 'marketing',
    mode: 'manage',
    status: 'revoked',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(39),
    revokedBy: 'user-owner-01',
    revokedAt: daysAgo(15),
  },

  // ── Riley (formerly 'owner' of wheels-and-brews, now Staff under Jordan /
  // owner-003, which owns both tenant-central-fc-01 and
  // tenant-wheels-brews-01 in this model) ───────────────────────────────────
  {
    assignmentId: 'assign-010',
    staffId: 'staff-wheelsbrews-owner-01',
    tenantId: 'tenant-wheels-brews-01',
    branchIds: 'all',
    role: 'manager',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-centralfc-owner-01',
    grantedAt: daysAgo(89),
  },

  // ── P10.4.9 — staff@savor.com (staff-staffdemo-01) ────────────────────────
  // Closes the P10.0 J12/J13 id-space gap: this demo login previously had
  // no StaffMember/StaffAssignment fixture, so only the legacy
  // rbacService.hasPermission() fallback ('legacyGranted') granted it
  // /console access. See docs/P10.4.8_LEGACY_COMPATIBILITY_AUDIT.md
  // Phase H and docs/P10.4.9_RBAC_MIGRATION_PREPARATION.md.
  {
    assignmentId: 'assign-011',
    staffId: 'staff-staffdemo-01',
    tenantId: 'tenant-savor-01',
    branchIds: 'all',
    role: 'manager',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(109),
  },

  // ── P10.4.9 — multirole@savor.com (staff-multirole-01) ────────────────────
  // Same id-space gap as assign-011, for the multirole@savor.com demo
  // login. Two separate active assignments (cashier AND kitchen) — not
  // collapsed into one — matching its MOCK_CREDENTIALS p7Roles:
  // ['cashier', 'kitchen'].
  {
    assignmentId: 'assign-012',
    staffId: 'staff-multirole-01',
    tenantId: 'tenant-savor-01',
    branchIds: ['branch-rest-01'],
    role: 'cashier',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(64),
  },
  {
    assignmentId: 'assign-013',
    staffId: 'staff-multirole-01',
    tenantId: 'tenant-savor-01',
    branchIds: ['branch-rest-01'],
    role: 'kitchen',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(64),
  },

  // ── P10.4.9 Phase B finding — admin@savor.com / kitchen@savor.com ─────────
  // Discovered while verifying the Phase C regression test: staff-admin-01
  // and staff-kitchen-01 (distinct from staff-kitchen-02, which already has
  // assign-008) are role-named demo accounts with a real StaffMember
  // record but, unlike manager@savor.com/cashier@savor.com, no
  // StaffAssignment row at all — so useHasDashboardAccess()'s Staff branch
  // (`staffAssignmentService.getEffectiveAssignments(...).length > 0`)
  // returned false for both, and they too depended entirely on
  // legacyGranted for /console access. Same class of gap as
  // staff@savor.com/multirole@savor.com above; closed the same way so the
  // Phase C proof (every console-capable demo account resolves without
  // legacy RBAC) holds for the full account set, not just the two named in
  // this phase's Phase A instructions. See
  // docs/P10.4.9_RBAC_MIGRATION_PREPARATION.md "Diff Safety" for why this
  // is still fixture-only, not a runtime-logic change.
  {
    assignmentId: 'assign-014',
    staffId: 'staff-admin-01',
    tenantId: 'tenant-savor-01',
    branchIds: 'all',
    role: 'admin',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-owner-01',
    grantedAt: daysAgo(149),
  },
  {
    assignmentId: 'assign-015',
    staffId: 'staff-kitchen-01',
    tenantId: 'tenant-savor-01',
    branchIds: ['branch-rest-01'],
    role: 'kitchen',
    mode: 'manage',
    status: 'active',
    grantedBy: 'user-manager-01',
    grantedAt: daysAgo(79),
  },
]

let _assignmentStore: StaffAssignment[] = MOCK_STAFF_ASSIGNMENTS.map((a) => ({ ...a }))

// ── Service ───────────────────────────────────────────────────────────────────

export const staffAssignmentService = {
  async getAssignmentsForStaff(staffId: string): Promise<StaffAssignment[]> {
    if (USE_MOCK) {
      await delay()
      return _assignmentStore.filter((a) => a.staffId === staffId).map((a) => ({ ...a }))
    }
    const { data } = await api.get<StaffAssignment[]>(`/admin/staff/${staffId}/assignments/`)
    return data
  },

  async getAssignmentsForTenant(tenantId: string): Promise<StaffAssignment[]> {
    if (USE_MOCK) {
      await delay()
      return _assignmentStore.filter((a) => a.tenantId === tenantId).map((a) => ({ ...a }))
    }
    const { data } = await api.get<StaffAssignment[]>('/admin/staff/assignments/', {
      params: { tenantId },
    })
    return data
  },

  /** Assignments whose `resolveAssignmentStatus()` is `'active'` right now. */
  getEffectiveAssignments(staffId: string, now: Date = new Date()): StaffAssignment[] {
    return _assignmentStore
      .filter((a) => a.staffId === staffId)
      .filter((a) => resolveAssignmentStatus(a, now) === 'active')
      .map((a) => ({ ...a }))
  },

  /**
   * Grant — creates a new StaffAssignment row (P10.1 §3.5's "Grant" row).
   * Validates the §3.3 invariant (assignment tenant must be owned by the
   * same Owner as the staff member) before writing. Throws on violation —
   * callers (P10.2.2+) are expected to surface this as a 400/validation
   * error, not silently swallow it.
   */
  async grant(
    payload: GrantStaffAssignmentPayload,
    staff: StaffMember[],
    tenants: Tenant[],
  ): Promise<StaffAssignment> {
    const check = validateAssignment(payload, staff, tenants)
    if (!check.valid) {
      throw new Error(`Invalid StaffAssignment: ${check.errors.join('; ')}`)
    }

    if (USE_MOCK) {
      await delay()
      const now = new Date()
      const isFuture = payload.validFrom ? new Date(payload.validFrom) > now : false
      const assignment: StaffAssignment = {
        assignmentId: `assign-${Date.now()}`,
        staffId: payload.staffId,
        tenantId: payload.tenantId,
        branchIds: payload.branchIds,
        role: payload.role,
        mode: payload.mode,
        status: isFuture ? 'future' : 'active',
        validFrom: payload.validFrom,
        validUntil: payload.validUntil,
        grantedBy: payload.grantedBy,
        grantedAt: now.toISOString(),
      }
      _assignmentStore.push(assignment)
      return { ...assignment }
    }
    const { data } = await api.post<StaffAssignment>(
      `/admin/staff/${payload.staffId}/assignments/`,
      payload,
    )
    return data
  },

  /** Revoke — sets status/revokedBy/revokedAt; the row is never deleted. */
  async revoke(
    assignmentId: string,
    payload: RevokeStaffAssignmentPayload,
  ): Promise<StaffAssignment> {
    if (USE_MOCK) {
      await delay()
      const idx = _assignmentStore.findIndex((a) => a.assignmentId === assignmentId)
      if (idx === -1) throw new Error(`StaffAssignment not found: ${assignmentId}`)
      _assignmentStore[idx] = {
        ..._assignmentStore[idx],
        status: 'revoked',
        revokedBy: payload.revokedBy,
        revokedAt: new Date().toISOString(),
      }
      return { ..._assignmentStore[idx] }
    }
    const { data } = await api.delete<StaffAssignment>(
      `/admin/staff/${_assignmentStore.find((a) => a.assignmentId === assignmentId)?.staffId}/assignments/${assignmentId}/`,
      { data: payload },
    )
    return data
  },

  /**
   * Move — P10.1 §3.5/§3.6: revoke the old assignment, grant a new one.
   * Deliberately NOT an in-place mutation of `tenantId`/`branchIds`, so the
   * audit trail (grantedAt/revokedAt on two distinct rows) shows exactly
   * when a staff member's scope changed and to what.
   */
  async move(
    payload: MoveStaffAssignmentPayload,
    staff: StaffMember[],
    tenants: Tenant[],
  ): Promise<{ revoked: StaffAssignment; granted: StaffAssignment }> {
    const revoked = await this.revoke(payload.fromAssignmentId, {
      revokedBy: payload.to.grantedBy,
      reason: 'moved',
    })
    const granted = await this.grant(payload.to, staff, tenants)
    return { revoked, granted }
  },

  /** Test helper — resets the mock store to initial state. */
  _resetMockStore(): void {
    _assignmentStore = MOCK_STAFF_ASSIGNMENTS.map((a) => ({ ...a }))
  },
}
