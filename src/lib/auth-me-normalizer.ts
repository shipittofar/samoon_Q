import type { TenantStatus, User } from '@/types'
import type {
  MembershipBranch,
  Permission,
  Role,
  TenantMembership,
  TenantRolePermissionGrant,
} from '@/types/rbac'
import type { GetMeResponse } from '@/services/auth.service'
import { normalizeTenantStatus } from '@/lib/tenant-state'

type WireRecord = Record<string, unknown>

function asRecord(value: unknown): WireRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as WireRecord)
    : null
}

function pickString(record: WireRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

/** Nested `{ tenant: { id, name, slug } }` on a membership / activeMembership wire object. */
function nestedTenantRecord(record: WireRecord): WireRecord | null {
  return asRecord(record.tenant)
}

function pickMembershipTenantId(record: WireRecord): string | undefined {
  return (
    pickString(record, 'tenantId', 'tenant_id') ??
    pickString(nestedTenantRecord(record) ?? {}, 'id', 'tenantId', 'tenant_id')
  )
}

function pickMembershipTenantName(record: WireRecord): string | undefined {
  return (
    pickString(record, 'tenantName', 'tenant_name') ??
    pickString(nestedTenantRecord(record) ?? {}, 'name')
  )
}

function pickMembershipTenantSlug(record: WireRecord): string | undefined {
  return (
    pickString(record, 'tenantSlug', 'tenant_slug') ??
    pickString(nestedTenantRecord(record) ?? {}, 'slug')
  )
}

function pickMembershipTenantStatus(record: WireRecord): TenantStatus | undefined {
  const nested = nestedTenantRecord(record) ?? {}
  const dedicated = pickString(record, 'tenantStatus', 'tenant_status') ?? pickString(nested, 'status')
  if (dedicated) return normalizeTenantStatus(dedicated)
  const flat = pickString(record, 'status')
  if (!flat) return undefined
  const lower = flat.toLowerCase()
  if (lower === 'suspended' || lower === 'revoked') return undefined
  if (lower === 'inactive' || flat.toUpperCase() === 'INACTIVE') return 'INACTIVE'
  return undefined
}

function pickNullableString(record: WireRecord, ...keys: string[]): string | null | undefined {
  for (const key of keys) {
    if (!(key in record)) continue
    const value = record[key]
    if (value === null) return null
    if (typeof value === 'string') return value
  }
  return undefined
}

function pickRoles(record: WireRecord): Role[] {
  const raw = record.roles ?? record.tenant_roles ?? record.tenantRoles
  if (Array.isArray(raw)) {
    const roles: Role[] = []
    for (const entry of raw) {
      if (typeof entry === 'string') {
        roles.push(entry as Role)
        continue
      }
      const roleRecord = asRecord(entry)
      const roleName = roleRecord
        ? pickString(roleRecord, 'role', 'name', 'code', 'key')
        : undefined
      if (roleName) roles.push(roleName as Role)
    }
    if (roles.length > 0) return [...new Set(roles)]
  }

  const singularRole = pickString(record, 'role')
  if (singularRole) return [singularRole as Role]

  return []
}

/** Extract an explicit permission string list from a wire record (or undefined if absent). */
function pickPermissions(record: WireRecord): Permission[] | undefined {
  const raw = record.permissions ?? record.permission_keys ?? record.permissionKeys
  if (!Array.isArray(raw)) return undefined
  const permissions = raw.filter((p): p is string => typeof p === 'string') as Permission[]
  // Empty array is an explicit deny set — preserve it (do not treat as "absent").
  return permissions
}

/**
 * Parses root-level legacy `tenantRoles: [{ role, permissions, tenantId? }]`.
 * Role names alone are insufficient for live auth when permissions are present.
 */
export function pickTenantRoleGrants(raw: unknown): TenantRolePermissionGrant[] {
  if (!Array.isArray(raw)) return []
  const grants: TenantRolePermissionGrant[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      grants.push({ role: entry as Role })
      continue
    }
    const record = asRecord(entry)
    if (!record) continue
    const role = pickString(record, 'role', 'name', 'code', 'key')
    if (!role) continue
    const permissions = pickPermissions(record)
    const tenantId = pickString(record, 'tenantId', 'tenant_id')
    grants.push({
      role: role as Role,
      ...(permissions !== undefined ? { permissions } : {}),
      ...(tenantId ? { tenantId } : {}),
    })
  }
  return grants
}

/**
 * Merge explicit permissions from root `tenantRoles` grants onto memberships.
 * Matching: tenantId when grant carries one; otherwise apply to memberships
 * that include the grant's role (typically the active tenant's owner grant).
 */
export function mergeTenantRolePermissionsOntoMemberships(
  memberships: TenantMembership[],
  grants: TenantRolePermissionGrant[],
): TenantMembership[] {
  if (grants.length === 0) return memberships
  return memberships.map((membership) => {
    if (membership.permissions !== undefined) return membership
    const matched = grants.filter((g) => {
      if (g.tenantId && g.tenantId !== membership.tenantId) return false
      return membership.roles.includes(g.role)
    })
    const withPerms = matched.filter((g) => g.permissions !== undefined)
    if (withPerms.length === 0) return membership
    const permissions = [...new Set(withPerms.flatMap((g) => g.permissions ?? []))] as Permission[]
    return { ...membership, permissions }
  })
}

/**
 * Missing/malformed branchAccess never widens access — except for Owner, the
 * one deliberate exception documented on resolveBranchAccess()
 * (permission.service.ts): Owner already holds every permission, so
 * branch-restricting it because of missing data only breaks Owner.
 * An explicit value from the backend is always taken as-is.
 */
function normalizeBranchAccess(record: WireRecord, roles: readonly Role[]): TenantMembership['branchAccess'] {
  const raw = record.branchAccess ?? record.branch_access
  const access = asRecord(raw)
  if (!access) return roles.includes('owner') ? { scope: 'all' } : { scope: 'selected', branchIds: [] }

  const scopeRaw = pickString(access, 'scope')
  if (scopeRaw === 'all') return { scope: 'all' }

  const branchIdsRaw = access.branchIds ?? access.branch_ids
  const branchIds = Array.isArray(branchIdsRaw)
    ? branchIdsRaw.filter((id): id is string => typeof id === 'string')
    : []
  return { scope: 'selected', branchIds }
}

function normalizeMembershipBranch(raw: unknown, membershipTenantId: string): MembershipBranch | null {
  const record = asRecord(raw)
  if (!record) return null

  const id = pickString(record, 'id')
  const name = pickString(record, 'name')
  const slug = pickString(record, 'slug')
  if (!id || !name || !slug) return null

  const branchTenantId = pickString(record, 'tenantId', 'tenant_id')
  if (branchTenantId && branchTenantId !== membershipTenantId) return null

  const statusRaw = pickString(record, 'status') ?? 'active'
  const status =
    statusRaw === 'inactive' || statusRaw === 'maintenance' ? statusRaw : 'active'

  const isDefault = record.isDefault === true || record.is_default === true

  return { id, name, slug, status, ...(isDefault ? { isDefault: true } : {}) }
}

function normalizeMembershipBranches(
  raw: unknown,
  membershipTenantId: string,
): MembershipBranch[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const branches = raw
    .map((entry) => normalizeMembershipBranch(entry, membershipTenantId))
    .filter((b): b is MembershipBranch => b !== null)
  return branches
}

/**
 * Normalizes a single membership entry from any wire shape (camelCase or snake_case)
 * into the frontend TenantMembership contract.
 */
export function normalizeWireMembership(raw: unknown): TenantMembership | null {
  const record = asRecord(raw)
  if (!record) return null

  const tenantId = pickMembershipTenantId(record)
  if (!tenantId) return null

  const membership: TenantMembership = {
    tenantId,
    tenantSlug: pickMembershipTenantSlug(record),
    tenantName: pickMembershipTenantName(record),
    tenantLogo: pickNullableString(record, 'tenantLogo', 'tenant_logo'),
    roles: pickRoles(record),
    branchAccess: normalizeBranchAccess(record, pickRoles(record)),
    branchId: pickString(record, 'branchId', 'branch_id'),
    status: (() => {
      const status = pickString(record, 'status')
      return status === 'suspended' || status === 'revoked' ? status : 'active'
    })(),
    tenantStatus: pickMembershipTenantStatus(record),
    branches: normalizeMembershipBranches(record.branches, tenantId),
    platformAccess: record.platformAccess === true || record.platform_access === true,
  }

  const permissions = pickPermissions(record)
  if (permissions !== undefined) {
    membership.permissions = permissions
  }

  return membership
}

function normalizeUser(raw: unknown): User | null {
  const record = asRecord(raw)
  if (!record) return null

  const id = pickString(record, 'id')
  if (!id) return null

  return {
    id,
    email: pickString(record, 'email') ?? null,
    phone_number: pickString(record, 'phone_number', 'phoneNumber') ?? undefined,
    first_name: pickString(record, 'first_name', 'firstName') ?? '',
    last_name: pickString(record, 'last_name', 'lastName') ?? '',
    avatar: pickNullableString(record, 'avatar') ?? undefined,
    accountType:
      (pickString(record, 'accountType', 'account_type') as User['accountType'] | undefined) ??
      'customer',
    is_verified: record.is_verified === true || record.isVerified === true,
    is_superuser: record.is_superuser === true || record.isSuperuser === true,
    is_staff: record.is_staff === true || record.isStaff === true,
    created_at: pickString(record, 'created_at', 'createdAt') ?? '',
  }
}

function normalizeActiveMembership(
  raw: unknown,
  memberships: TenantMembership[],
): TenantMembership | undefined {
  const record = asRecord(raw)
  if (!record) return undefined

  const tenantId = pickMembershipTenantId(record)
  if (!tenantId) return undefined

  const membership = memberships.find((m) => m.tenantId === tenantId)
  const branchId = pickString(record, 'branchId', 'branch_id') ?? membership?.branchId
  const tenantName = pickMembershipTenantName(record) ?? membership?.tenantName
  const tenantSlug = pickMembershipTenantSlug(record) ?? membership?.tenantSlug
  const branchName = pickNullableString(record, 'branchName', 'branch_name')

  if (branchId && membership?.branches?.length) {
    const allowed = membership.branches.some((b) => b.id === branchId)
    if (!allowed) {
      return {
        tenantId,
        tenantName,
        tenantSlug,
        roles: membership?.roles ?? [],
        branchAccess: membership?.branchAccess ?? { scope: 'selected', branchIds: [] },
      }
    }
  }

  if (membership) {
    return {
      ...membership,
      ...(tenantName ? { tenantName } : {}),
      ...(tenantSlug ? { tenantSlug } : {}),
      ...(branchId ? { branchId } : {}),
      ...(branchName !== undefined ? { branchName } : {}),
    }
  }

  return {
    tenantId,
    tenantName,
    tenantSlug,
    roles: pickRoles(record),
    branchAccess: normalizeBranchAccess(record, pickRoles(record)),
    ...(branchId ? { branchId } : {}),
    ...(branchName !== undefined ? { branchName } : {}),
  }
}

/**
 * Normalizes GET /auth/me wire payloads into the canonical GetMeResponse.
 *
 * Supports:
 * - nested `{ user: {...} }` (current real contract)
 * - legacy flat user at root
 * - camelCase and snake_case membership fields
 * - legacy `tenantRoles` at root (mapped into active membership when sole tenant)
 */
export function normalizeGetMeResponse(data: unknown): GetMeResponse {
  const root = asRecord(data) ?? {}

  const nestedUser = normalizeUser(root.user)
  const flatUser =
    nestedUser ??
    normalizeUser({
      id: root.id,
      email: root.email,
      phone_number: root.phone_number,
      first_name: root.first_name,
      last_name: root.last_name,
      avatar: root.avatar,
      accountType: root.accountType ?? root.account_type,
      is_verified: root.is_verified,
      is_superuser: root.is_superuser ?? root.isSuperuser,
      is_staff: root.is_staff ?? root.isStaff,
      created_at: root.created_at,
    })

  if (!flatUser) {
    throw new Error('Invalid /auth/me response: missing user')
  }

  const membershipsRaw = root.memberships
  let memberships = Array.isArray(membershipsRaw)
    ? membershipsRaw
        .map((entry) => normalizeWireMembership(entry))
        .filter((m): m is TenantMembership => m !== null)
    : undefined

  // Root-level tenantRoles may carry { role, permissions } — merge onto memberships
  // so explicit effective permissions are not discarded by role-name extraction.
  const tenantRoleGrants = pickTenantRoleGrants(root.tenantRoles ?? root.tenant_roles)
  if (memberships && tenantRoleGrants.length > 0) {
    memberships = mergeTenantRolePermissionsOntoMemberships(memberships, tenantRoleGrants)
  }

  let activeMembership = normalizeActiveMembership(root.activeMembership ?? root.active_membership, memberships ?? [])

  const legacyRoles = pickRoles({ roles: root.tenantRoles ?? root.tenant_roles })
  if (!activeMembership && legacyRoles.length > 0 && memberships?.length === 1) {
    const sole = memberships[0]
    const grantPerms = tenantRoleGrants
      .filter((g) => g.permissions !== undefined)
      .flatMap((g) => g.permissions ?? [])
    activeMembership = {
      ...sole,
      roles: legacyRoles,
      ...(grantPerms.length > 0 || tenantRoleGrants.some((g) => g.permissions !== undefined)
        ? { permissions: [...new Set(grantPerms)] as Permission[] }
        : {}),
    }
  }

  // When memberships are absent but tenantRoles grants carry permissions, synthesize
  // a single-membership session only when we also have an active tenant pointer later
  // via consumers — leave memberships undefined for pure legacy role-string shape.
  // Explicit permissions for the active membership are attached above when possible.

  if (activeMembership && memberships) {
    const fromList = memberships.find((m) => m.tenantId === activeMembership!.tenantId)
    if (fromList?.permissions !== undefined && activeMembership.permissions === undefined) {
      activeMembership = { ...activeMembership, permissions: fromList.permissions }
    }
  }

  return {
    user: flatUser,
    ...(memberships !== undefined ? { memberships } : {}),
    ...(activeMembership ? { activeMembership } : {}),
    ...(root.ownership !== undefined ? { ownership: root.ownership as never } : {}),
    ...(root.staffAssignments !== undefined
      ? { staffAssignments: root.staffAssignments as never }
      : {}),
  }
}

/** Validates branch list tenant isolation after normalization. */
export function assertMembershipBranchIsolation(memberships: readonly TenantMembership[]): void {
  for (const membership of memberships) {
    if (!membership.branches?.length) continue
    for (const branch of membership.branches) {
      const mapped = branch as MembershipBranch & { tenantId?: string }
      if (mapped.tenantId && mapped.tenantId !== membership.tenantId) {
        throw new Error(`Branch ${branch.id} leaked from another tenant`)
      }
    }
  }
}
