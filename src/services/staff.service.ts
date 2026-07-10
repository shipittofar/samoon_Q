/**
 * Staff Service — P7.2
 *
 * Tenant-scoped workforce management. Follows the USE_MOCK pattern from
 * loyalty.service.ts and vendor.service.ts.
 *
 * Authorization: all write operations require staff.manage permission.
 * Read operations require staff.view. Enforcement is at the component/hook layer
 * via PermissionGuard — this service does not check permissions itself.
 *
 * Audit: every state-mutating operation emits a StaffAuditEvent via staffAuditHooks.
 * Consumers attach listeners for P7.6 Audit Log integration.
 */

import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_TENANT_OWNER_MAP, ownerService } from './owner.service'
import { tenantService } from './tenant.service'
import type {
  StaffMember,
  StaffInvite,
  StaffStatus,
  InviteStatus,
  InviteStaffPayload,
  UpdateStaffRolesPayload,
  StaffAnalytics,
  StaffAuditEvent,
  StaffAuditAction,
  TenantMembership,
} from '@/types/staff'
import type { Role } from '@/types/rbac'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms))

const MOCK_TENANT_ID      = 'tenant-savor-01'
const TENANT_BREW_CAFE    = 'tenant-brew-cafe-01'
const TENANT_OAK_BAR      = 'tenant-oak-bar-01'
const TENANT_CENTRAL_FC   = 'tenant-central-fc-01'
const TENANT_WHEELS_BREWS = 'tenant-wheels-brews-01'
const TENANT_ROAD_BITES   = 'tenant-road-bites-01'
const MOCK_OWNER_ID = 'user-owner-01'

// ── Staff Audit Hooks (P7.6 readiness) ───────────────────────────────────────

type StaffAuditListener = (event: StaffAuditEvent) => void
let _auditListeners: StaffAuditListener[] = []
const _auditLog: StaffAuditEvent[] = []

export const staffAuditHooks = {
  subscribe(fn: StaffAuditListener): () => void {
    _auditListeners.push(fn)
    return () => {
      _auditListeners = _auditListeners.filter((l) => l !== fn)
    }
  },
  getLog(): StaffAuditEvent[] {
    return [..._auditLog]
  },
  _reset(): void {
    _auditListeners = []
    _auditLog.length = 0
  },
}

function emitAudit(
  action: StaffAuditAction,
  tenantId: string,
  extras?: Partial<StaffAuditEvent>,
): void {
  const event: StaffAuditEvent = {
    action,
    tenantId,
    timestamp: new Date().toISOString(),
    ...extras,
  }
  _auditLog.push(event)
  _auditListeners.forEach((fn) => fn(event))
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const now = new Date()
function daysAgo(n: number) {
  return new Date(now.getTime() - n * 86_400_000).toISOString()
}
function daysFromNow(n: number) {
  return new Date(now.getTime() + n * 86_400_000).toISOString()
}

const INITIAL_MOCK_STAFF: StaffMember[] = [
  {
    id: 'staff-owner-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-owner-01',
    email: 'owner@savor.com',
    firstName: 'Olivia',
    lastName: 'Owner',
    status: 'active',
    roles: ['owner'],
    invitedAt: daysAgo(180),
    activatedAt: daysAgo(179),
    lastSeenAt: daysAgo(0),
    createdBy: 'system',
  },
  {
    id: 'staff-admin-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-admin-01',
    email: 'admin@savor.com',
    firstName: 'Alex',
    lastName: 'Admin',
    status: 'active',
    roles: ['admin'],
    invitedAt: daysAgo(150),
    activatedAt: daysAgo(149),
    lastSeenAt: daysAgo(1),
    createdBy: MOCK_OWNER_ID,
  },
  {
    id: 'staff-manager-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-manager-01',
    email: 'manager@savor.com',
    firstName: 'Maria',
    lastName: 'Manager',
    status: 'active',
    roles: ['manager'],
    invitedAt: daysAgo(120),
    activatedAt: daysAgo(119),
    lastSeenAt: daysAgo(0),
    createdBy: MOCK_OWNER_ID,
  },
  {
    id: 'staff-cashier-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-cashier-01',
    email: 'cashier@savor.com',
    firstName: 'Casey',
    lastName: 'Cashier',
    status: 'active',
    roles: ['cashier'],
    invitedAt: daysAgo(90),
    activatedAt: daysAgo(89),
    lastSeenAt: daysAgo(0),
    createdBy: 'user-manager-01',
  },
  {
    id: 'staff-waiter-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-waiter-01',
    email: 'waiter@savor.com',
    firstName: 'Will',
    lastName: 'Waiter',
    status: 'active',
    roles: ['waiter'],
    invitedAt: daysAgo(85),
    activatedAt: daysAgo(84),
    lastSeenAt: daysAgo(0),
    createdBy: 'user-manager-01',
  },
  {
    id: 'staff-kitchen-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-kitchen-01',
    email: 'kitchen@savor.com',
    firstName: 'Kai',
    lastName: 'Kitchen',
    status: 'active',
    roles: ['kitchen'],
    invitedAt: daysAgo(80),
    activatedAt: daysAgo(79),
    lastSeenAt: daysAgo(0),
    createdBy: 'user-manager-01',
  },
  {
    id: 'staff-marketing-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-marketing-01',
    email: 'marketing@savor.com',
    firstName: 'Morgan',
    lastName: 'Marketing',
    status: 'active',
    roles: ['marketing'],
    invitedAt: daysAgo(75),
    activatedAt: daysAgo(74),
    lastSeenAt: daysAgo(2),
    createdBy: MOCK_OWNER_ID,
  },
  {
    id: 'staff-support-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-support-01',
    email: 'support@savor.com',
    firstName: 'Sam',
    lastName: 'Support',
    status: 'active',
    roles: ['support'],
    invitedAt: daysAgo(70),
    activatedAt: daysAgo(69),
    lastSeenAt: daysAgo(1),
    createdBy: MOCK_OWNER_ID,
  },
  {
    // P10.4.9 — closes the P10.0 J12/J13 id-space gap for the
    // `staff@savor.com` MOCK_CREDENTIALS demo login (auth.service.ts),
    // which previously had no matching StaffMember record, so
    // resolveOwnershipIdentity() returned {} and only the legacy
    // rbacService.hasPermission() fallback (`legacyGranted`) granted it
    // /console access. See docs/P10.4.8_LEGACY_COMPATIBILITY_AUDIT.md
    // Phase H and docs/P10.4.9_RBAC_MIGRATION_PREPARATION.md.
    id: 'staff-staffdemo-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-staffdemo-01',
    email: 'staff@savor.com',
    firstName: 'Stevie',
    lastName: 'Staffdemo',
    status: 'active',
    roles: ['manager'],
    invitedAt: daysAgo(110),
    activatedAt: daysAgo(109),
    lastSeenAt: daysAgo(0),
    createdBy: MOCK_OWNER_ID,
  },
  {
    // P10.4.9 — same id-space gap as staff-staffdemo-01 above, for the
    // `multirole@savor.com` demo login. This account holds two roles
    // (cashier + kitchen), realized as two separate active
    // StaffAssignment rows in staff-assignment.service.ts — not
    // collapsed into one — matching its MOCK_CREDENTIALS p7Roles:
    // ['cashier', 'kitchen'].
    id: 'staff-multirole-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-multirole-01',
    email: 'multirole@savor.com',
    firstName: 'Multi',
    lastName: 'Rolestaff',
    status: 'active',
    roles: ['cashier', 'kitchen'],
    invitedAt: daysAgo(65),
    activatedAt: daysAgo(64),
    lastSeenAt: daysAgo(0),
    createdBy: MOCK_OWNER_ID,
  },
  {
    id: 'staff-cashier-02',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-cashier-02',
    email: 'drew.dollars@savor.com',
    firstName: 'Drew',
    lastName: 'Dollars',
    status: 'active',
    roles: ['cashier'],
    invitedAt: daysAgo(60),
    activatedAt: daysAgo(59),
    lastSeenAt: daysAgo(0),
    createdBy: 'user-manager-01',
  },
  {
    id: 'staff-waiter-02',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-waiter-02',
    email: 'sage.server@savor.com',
    firstName: 'Sage',
    lastName: 'Server',
    status: 'active',
    roles: ['waiter'],
    invitedAt: daysAgo(55),
    activatedAt: daysAgo(54),
    lastSeenAt: daysAgo(1),
    createdBy: 'user-manager-01',
  },
  {
    id: 'staff-kitchen-02',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-kitchen-02',
    email: 'lee.line@savor.com',
    firstName: 'Lee',
    lastName: 'Line',
    status: 'active',
    roles: ['kitchen'],
    invitedAt: daysAgo(50),
    activatedAt: daysAgo(49),
    lastSeenAt: daysAgo(0),
    createdBy: 'user-manager-01',
  },
  {
    id: 'staff-manager-02',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-manager-02',
    email: 'reese.roster@savor.com',
    firstName: 'Reese',
    lastName: 'Roster',
    status: 'suspended',
    roles: ['manager'],
    invitedAt: daysAgo(45),
    activatedAt: daysAgo(44),
    lastSeenAt: daysAgo(10),
    createdBy: MOCK_OWNER_ID,
    metadata: { suspendedReason: 'Policy violation' },
  },
  {
    id: 'staff-marketing-02',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-marketing-02',
    email: 'quinn.promo@savor.com',
    firstName: 'Quinn',
    lastName: 'Promo',
    status: 'suspended',
    roles: ['marketing'],
    invitedAt: daysAgo(40),
    activatedAt: daysAgo(39),
    lastSeenAt: daysAgo(15),
    createdBy: MOCK_OWNER_ID,
  },
  {
    id: 'staff-pending-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-pending-01',
    email: 'pat.pending@savor.com',
    firstName: 'Pat',
    lastName: 'Pending',
    status: 'pending',
    roles: ['manager'],
    invitedAt: daysAgo(2),
    createdBy: MOCK_OWNER_ID,
  },
  {
    id: 'staff-removed-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-removed-01',
    email: 'jordan.gone@savor.com',
    firstName: 'Jordan',
    lastName: 'Gone',
    status: 'removed',
    roles: ['waiter'],
    invitedAt: daysAgo(100),
    activatedAt: daysAgo(99),
    lastSeenAt: daysAgo(20),
    createdBy: 'user-manager-01',
  },
  {
    id: 'staff-cashier-03',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-cashier-03',
    email: 'avery.a@savor.com',
    firstName: 'Avery',
    lastName: 'A',
    status: 'active',
    roles: ['cashier'],
    invitedAt: daysAgo(30),
    activatedAt: daysAgo(29),
    lastSeenAt: daysAgo(0),
    createdBy: 'user-manager-01',
  },

  // ── Brew Cafe staff ────────────────────────────────────────────────────────
  {
    id: 'staff-brewcafe-owner-01',
    tenantId: TENANT_BREW_CAFE,
    userId: 'user-brewcafe-owner-01',
    email: 'owner@brewcafe.com',
    firstName: 'Blake',
    lastName: 'Owner',
    status: 'active',
    roles: ['owner'],
    invitedAt: daysAgo(200),
    activatedAt: daysAgo(199),
    lastSeenAt: daysAgo(1),
    createdBy: 'system',
  },

  // ── The Oak Bar staff ──────────────────────────────────────────────────────
  {
    id: 'staff-oakbar-owner-01',
    tenantId: TENANT_OAK_BAR,
    userId: 'user-oakbar-owner-01',
    email: 'owner@theoakbar.com',
    firstName: 'Drew',
    lastName: 'Owner',
    status: 'active',
    roles: ['owner'],
    invitedAt: daysAgo(150),
    activatedAt: daysAgo(149),
    lastSeenAt: daysAgo(2),
    createdBy: 'system',
  },

  // ── Central Food Court staff ───────────────────────────────────────────────
  {
    id: 'staff-centralfc-owner-01',
    tenantId: TENANT_CENTRAL_FC,
    userId: 'user-centralfc-owner-01',
    email: 'owner@centralfoodcourt.com',
    firstName: 'Jordan',
    lastName: 'Owner',
    status: 'active',
    roles: ['owner'],
    invitedAt: daysAgo(120),
    activatedAt: daysAgo(119),
    lastSeenAt: daysAgo(3),
    createdBy: 'system',
  },

  // ── Wheels & Brews staff ───────────────────────────────────────────────────
  {
    id: 'staff-wheelsbrews-owner-01',
    tenantId: TENANT_WHEELS_BREWS,
    userId: 'user-wheelsbrews-owner-01',
    email: 'owner@wheelsandbrews.com',
    firstName: 'Riley',
    lastName: 'Owner',
    status: 'active',
    roles: ['owner'],
    invitedAt: daysAgo(90),
    activatedAt: daysAgo(89),
    lastSeenAt: daysAgo(4),
    createdBy: 'system',
  },

  // ── Road Bites staff ───────────────────────────────────────────────────────
  {
    id: 'staff-roadbites-owner-01',
    tenantId: TENANT_ROAD_BITES,
    userId: 'user-roadbites-owner-01',
    email: 'owner@roadbites.com',
    firstName: 'Sam',
    lastName: 'Owner',
    status: 'suspended',
    roles: ['owner'],
    invitedAt: daysAgo(60),
    activatedAt: daysAgo(59),
    lastSeenAt: daysAgo(30),
    createdBy: 'system',
  },

  // ── P10.2.1 — cross-tenant Staff, realizing the Accountant example from
  // docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §3.2 (see staff-assignment.service.ts
  // for the two StaffAssignment rows this staff member holds: read-only
  // access to all of Tenant A's branches, and read-only access to a single
  // branch of Tenant B — both tenants owned by the same Owner, owner-001).
  {
    id: 'staff-accountant-01',
    tenantId: MOCK_TENANT_ID,
    userId: 'user-accountant-01',
    email: 'accountant@savor.com',
    firstName: 'Avery',
    lastName: 'Accountant',
    status: 'active',
    roles: ['admin'],
    invitedAt: daysAgo(40),
    activatedAt: daysAgo(39),
    lastSeenAt: daysAgo(1),
    createdBy: MOCK_OWNER_ID,
  },
]

// P10.2.1 — backfill ownerId from the single source of truth
// (owner.service.ts's MOCK_TENANT_OWNER_MAP), derived from each staff
// member's existing `tenantId` — this is exactly the backfill rule
// `ownership-migration.service.ts`'s `backfillTenantOwnership()` documents
// and tests, applied here directly to the fixture set instead of at
// runtime, since these fixtures are authored fresh for this phase rather
// than migrated from a pre-existing "dirty" dataset.
for (const member of INITIAL_MOCK_STAFF) {
  const ownerId = MOCK_TENANT_OWNER_MAP[member.tenantId]
  if (ownerId) member.ownerId = ownerId
}

const INITIAL_MOCK_INVITES: StaffInvite[] = [
  {
    id: 'invite-001',
    tenantId: MOCK_TENANT_ID,
    email: 'pat.pending@savor.com',
    roles: ['manager'],
    invitedBy: MOCK_OWNER_ID,
    expiresAt: daysFromNow(5),
    status: 'pending',
  },
  {
    id: 'invite-002',
    tenantId: MOCK_TENANT_ID,
    email: 'new.staff@savor.com',
    roles: ['cashier'],
    invitedBy: 'user-manager-01',
    expiresAt: daysFromNow(6),
    status: 'pending',
  },
  {
    id: 'invite-003',
    tenantId: MOCK_TENANT_ID,
    email: 'expired.person@savor.com',
    roles: ['support'],
    invitedBy: MOCK_OWNER_ID,
    expiresAt: daysAgo(2),
    status: 'expired',
  },
  {
    id: 'invite-004',
    tenantId: MOCK_TENANT_ID,
    email: 'cancelled.person@savor.com',
    roles: ['waiter'],
    invitedBy: 'user-manager-01',
    expiresAt: daysAgo(1),
    status: 'cancelled',
  },
]

// Mutable in-session stores (reset on module reload)
let MOCK_STAFF_LIST: StaffMember[] = INITIAL_MOCK_STAFF.map((s) => ({ ...s }))
let MOCK_INVITE_LIST: StaffInvite[] = INITIAL_MOCK_INVITES.map((i) => ({ ...i }))
let _inviteCounter = 100

// ── Helpers ───────────────────────────────────────────────────────────────────

function findStaff(id: string): StaffMember | undefined {
  return MOCK_STAFF_LIST.find((s) => s.id === id)
}

function findInvite(id: string): StaffInvite | undefined {
  return MOCK_INVITE_LIST.find((i) => i.id === id)
}

function setStaffStatus(id: string, status: StaffStatus): StaffMember {
  const member = findStaff(id)
  if (!member) throw new Error(`Staff member not found: ${id}`)
  member.status = status
  if (status === 'active' && !member.activatedAt) {
    member.activatedAt = new Date().toISOString()
  }
  return { ...member }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const staffService = {
  // ── Reads ──────────────────────────────────────────────────────────────────

  async getStaff(tenantId: string): Promise<StaffMember[]> {
    if (USE_MOCK) {
      await delay()
      return MOCK_STAFF_LIST.filter((s) => s.tenantId === tenantId).map((s) => ({ ...s }))
    }
    const res = await api.get<StaffMember[]>(ENDPOINTS.STAFF.LIST(tenantId))
    return res.data
  },

  async getStaffMember(id: string): Promise<StaffMember> {
    if (USE_MOCK) {
      await delay()
      const member = findStaff(id)
      if (!member) throw new Error(`Staff member not found: ${id}`)
      return { ...member }
    }
    const res = await api.get<StaffMember>(ENDPOINTS.STAFF.DETAIL(id))
    return res.data
  },

  async getInvites(tenantId: string): Promise<StaffInvite[]> {
    if (USE_MOCK) {
      await delay()
      return MOCK_INVITE_LIST.filter((i) => i.tenantId === tenantId).map((i) => ({ ...i }))
    }
    const res = await api.get<StaffInvite[]>(ENDPOINTS.STAFF.INVITES(tenantId))
    return res.data
  },

  // ── Mutations ──────────────────────────────────────────────────────────────

  async inviteStaff(tenantId: string, payload: InviteStaffPayload): Promise<StaffInvite> {
    if (USE_MOCK) {
      await delay()
      _inviteCounter += 1
      const invite: StaffInvite = {
        id: `invite-${_inviteCounter}`,
        tenantId,
        email: payload.email,
        roles: [...payload.roles],
        invitedBy: MOCK_OWNER_ID,
        expiresAt: daysFromNow(7),
        status: 'pending',
      }
      MOCK_INVITE_LIST.push(invite)
      emitAudit('staff.invited', tenantId, {
        inviteId: invite.id,
        metadata: { email: payload.email, roles: payload.roles },
      })
      return { ...invite }
    }
    const res = await api.post<StaffInvite>(ENDPOINTS.STAFF.INVITE(tenantId), payload)
    return res.data
  },

  async cancelInvite(id: string): Promise<StaffInvite> {
    if (USE_MOCK) {
      await delay()
      const invite = findInvite(id)
      if (!invite) throw new Error(`Invite not found: ${id}`)
      if (invite.status !== 'pending') throw new Error(`Cannot cancel invite with status: ${invite.status}`)
      invite.status = 'cancelled'
      emitAudit('staff.invited', invite.tenantId, {
        inviteId: id,
        metadata: { cancelled: true },
      })
      return { ...invite }
    }
    const res = await api.post<StaffInvite>(ENDPOINTS.STAFF.CANCEL_INVITE(id))
    return res.data
  },

  async resendInvite(id: string): Promise<StaffInvite> {
    if (USE_MOCK) {
      await delay()
      const invite = findInvite(id)
      if (!invite) throw new Error(`Invite not found: ${id}`)
      if (invite.status !== 'pending' && invite.status !== 'expired') {
        throw new Error(`Cannot resend invite with status: ${invite.status}`)
      }
      invite.status = 'pending'
      invite.expiresAt = daysFromNow(7)
      emitAudit('staff.invited', invite.tenantId, {
        inviteId: id,
        metadata: { resent: true },
      })
      return { ...invite }
    }
    const res = await api.post<StaffInvite>(ENDPOINTS.STAFF.RESEND_INVITE(id))
    return res.data
  },

  async acceptInvite(id: string): Promise<StaffMember> {
    if (USE_MOCK) {
      await delay()
      const invite = findInvite(id)
      if (!invite) throw new Error(`Invite not found: ${id}`)
      if (invite.status !== 'pending') throw new Error(`Cannot accept invite with status: ${invite.status}`)
      invite.status = 'accepted'
      // Find the pending staff member with this email
      const member = MOCK_STAFF_LIST.find(
        (s) => s.email === invite.email && s.status === 'pending',
      )
      if (member) {
        member.status = 'active'
        member.activatedAt = new Date().toISOString()
        return { ...member }
      }
      // Create new staff member if not found
      const newMember: StaffMember = {
        id: `staff-new-${Date.now()}`,
        tenantId: invite.tenantId,
        userId: `user-new-${Date.now()}`,
        email: invite.email,
        firstName: invite.email.split('@')[0]!,
        lastName: '',
        status: 'active',
        roles: [...invite.roles],
        invitedAt: invite.id,
        activatedAt: new Date().toISOString(),
        createdBy: invite.invitedBy,
      }
      MOCK_STAFF_LIST.push(newMember)
      return { ...newMember }
    }
    const res = await api.post<StaffMember>(ENDPOINTS.STAFF.ACCEPT_INVITE(id))
    return res.data
  },

  async updateStaffRoles(id: string, payload: UpdateStaffRolesPayload): Promise<StaffMember> {
    if (USE_MOCK) {
      await delay()
      const member = findStaff(id)
      if (!member) throw new Error(`Staff member not found: ${id}`)
      if (member.status === 'removed') throw new Error('Cannot update roles of a removed member')
      const prevRoles = [...member.roles]
      member.roles = [...payload.roles]
      emitAudit('staff.role_changed', member.tenantId, {
        staffMemberId: id,
        metadata: { prevRoles, newRoles: payload.roles },
      })
      return { ...member }
    }
    const res = await api.patch<StaffMember>(ENDPOINTS.STAFF.UPDATE_ROLES(id), payload)
    return res.data
  },

  async activateStaff(id: string): Promise<StaffMember> {
    if (USE_MOCK) {
      await delay()
      const result = setStaffStatus(id, 'active')
      emitAudit('staff.activated', result.tenantId, { staffMemberId: id })
      return result
    }
    const res = await api.post<StaffMember>(ENDPOINTS.STAFF.ACTIVATE(id))
    return res.data
  },

  async suspendStaff(id: string): Promise<StaffMember> {
    if (USE_MOCK) {
      await delay()
      const member = findStaff(id)
      if (!member) throw new Error(`Staff member not found: ${id}`)
      if (member.roles.includes('owner')) throw new Error('Cannot suspend the owner')
      const result = setStaffStatus(id, 'suspended')
      emitAudit('staff.suspended', result.tenantId, { staffMemberId: id })
      return result
    }
    const res = await api.post<StaffMember>(ENDPOINTS.STAFF.SUSPEND(id))
    return res.data
  },

  async removeStaff(id: string): Promise<void> {
    if (USE_MOCK) {
      await delay()
      const member = findStaff(id)
      if (!member) throw new Error(`Staff member not found: ${id}`)
      if (member.roles.includes('owner')) throw new Error('Cannot remove the owner')
      member.status = 'removed'
      emitAudit('staff.removed', member.tenantId, { staffMemberId: id })
      return
    }
    await api.post(ENDPOINTS.STAFF.REMOVE(id))
  },

  /**
   * Transfer ownership from currentOwnerId to targetMemberId.
   * Rules:
   *   - Source must have 'owner' role
   *   - Target must be active
   *   - Source and target must be different
   * After transfer: target gains 'owner', source is downgraded to 'admin'.
   *
   * P10.3 Phase F — this is the ONE entry point for an ownership transfer;
   * it is kept, not replaced, because it's the only place both the legacy
   * P7 `'owner'` role swap AND (see below) the P10.1 `Tenant.ownerId`
   * reassignment can be applied atomically. Previously this function only
   * touched `StaffMember.roles` and never `Tenant.ownerId`/`Owner`,
   * leaving two disconnected ownership mechanisms in sync only by
   * coincidence (P10.2.3 finding F-6). Now: when `current` is the
   * StaffMember that structurally backs this tenant's Owner record (i.e.
   * `current.userId === owner.userId` for the Owner `tenant.ownerId`
   * points at) AND `target` has its own Owner record (via
   * `ownerService.getOwnerByUserIdSync`), `tenantService.transferOwnership()`
   * is also called so `Tenant.ownerId` — the field every permission
   * resolution actually reads — moves in the same operation. If `target`
   * has no Owner record (the common case: an ordinary Staff member being
   * promoted, not a second provisioned business owner), `Tenant.ownerId`
   * is deliberately left unchanged — fabricating a new Owner record with
   * invented billing/plan data is out of scope (see the P10.3 report).
   */
  async transferOwnership(
    currentOwnerId: string,
    targetMemberId: string,
  ): Promise<{ owner: StaffMember; prevOwner: StaffMember }> {
    if (USE_MOCK) {
      await delay()
      if (currentOwnerId === targetMemberId) {
        throw new Error('Cannot transfer ownership to yourself')
      }
      const current = findStaff(currentOwnerId)
      if (!current) throw new Error(`Staff member not found: ${currentOwnerId}`)
      if (!current.roles.includes('owner')) throw new Error('Source is not owner')

      const target = findStaff(targetMemberId)
      if (!target) throw new Error(`Staff member not found: ${targetMemberId}`)
      if (target.status !== 'active') throw new Error('Target must be active to receive ownership')

      // Downgrade current owner to admin
      current.roles = ['admin', ...current.roles.filter((r) => r !== 'owner' && r !== 'admin')]

      // Upgrade target to owner (preserve other roles)
      target.roles = ['owner', ...target.roles.filter((r) => r !== 'owner')]

      // P10.3 Phase F — synchronize Tenant.ownerId when both sides of the
      // transfer are backed by real Owner records.
      const currentOwnerRecord = current.ownerId ? ownerService.getOwnerByUserIdSync(current.userId) : undefined
      const targetOwnerRecord = ownerService.getOwnerByUserIdSync(target.userId)
      if (currentOwnerRecord && targetOwnerRecord) {
        await tenantService.transferOwnership(current.tenantId, targetOwnerRecord.ownerId)
        target.ownerId = targetOwnerRecord.ownerId
      }

      emitAudit('staff.ownership_transferred', current.tenantId, {
        staffMemberId: targetMemberId,
        metadata: { from: currentOwnerId, to: targetMemberId },
      })

      return { owner: { ...target }, prevOwner: { ...current } }
    }
    const res = await api.post<{ owner: StaffMember; prevOwner: StaffMember }>(
      ENDPOINTS.STAFF.TRANSFER_OWNERSHIP(
        MOCK_STAFF_LIST.find((s) => s.id === currentOwnerId)?.tenantId ?? '',
      ),
      { currentOwnerId, targetMemberId },
    )
    return res.data
  },

  // ── Analytics (derived) ────────────────────────────────────────────────────

  computeAnalytics(staff: StaffMember[], invites: StaffInvite[]): StaffAnalytics {
    const byRole: Record<string, number> = {}
    staff
      .filter((s) => s.status !== 'removed')
      .forEach((s) => {
        s.roles.forEach((r) => {
          byRole[r] = (byRole[r] ?? 0) + 1
        })
      })

    return {
      totalStaff: staff.filter((s) => s.status !== 'removed').length,
      activeStaff: staff.filter((s) => s.status === 'active').length,
      pendingInvites: invites.filter((i) => i.status === 'pending').length,
      suspendedStaff: staff.filter((s) => s.status === 'suspended').length,
      byRole: byRole as Record<Role, number>,
    }
  },

  // ── Membership lookup ─────────────────────────────────────────────────────

  getMembership(userId: string, tenantId: string): TenantMembership | undefined {
    if (!USE_MOCK) return undefined
    const member = MOCK_STAFF_LIST.find(
      (s) => s.userId === userId && s.tenantId === tenantId,
    )
    if (!member) return undefined
    return {
      userId: member.userId,
      tenantId: member.tenantId,
      staffMemberId: member.id,
      roles: [...member.roles],
      status: member.status,
      joinedAt: member.activatedAt ?? member.invitedAt,
    }
  },

  /**
   * P10.2.2 — Synchronous staff lookup by email, mock-mode only.
   *
   * Bridges the session identity (`useAuthStore.user.email`, whose `id`
   * space is disjoint from `StaffMember.userId`/`Owner.userId` — a
   * pre-existing mock-data gap, P10.0 J12/J13, not fixed by this phase)
   * to the Staff/Owner id space that `staff.service.ts`,
   * `owner.service.ts`, and `staff-assignment.service.ts` already share.
   * Synchronous (unlike every other lookup in this file) because it is
   * called from `usePermissions()`, a plain memoized selector that cannot
   * await a promise — follows the same synchronous-mock-read precedent as
   * `getMembership()` above.
   */
  findStaffMemberByEmail(email: string): StaffMember | undefined {
    if (!USE_MOCK) return undefined
    const member = MOCK_STAFF_LIST.find((s) => s.email === email)
    return member ? { ...member } : undefined
  },

  // ── Test helpers ───────────────────────────────────────────────────────────

  _resetMockStore(): void {
    MOCK_STAFF_LIST = INITIAL_MOCK_STAFF.map((s) => ({ ...s }))
    MOCK_INVITE_LIST = INITIAL_MOCK_INVITES.map((i) => ({ ...i }))
    _inviteCounter = 100
    staffAuditHooks._reset()
  },

  staffAuditHooks,
}
