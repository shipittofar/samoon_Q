import type { User } from '@/types'
import type { MembershipBranch, Role, TenantMembership } from '@/types/rbac'
import type { GetMeResponse } from '@/services/auth.service'

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

function normalizeBranchAccess(record: WireRecord): TenantMembership['branchAccess'] {
  const raw = record.branchAccess ?? record.branch_access
  const access = asRecord(raw)
  if (!access) return { scope: 'selected', branchIds: [] }

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

  const tenantId = pickString(record, 'tenantId', 'tenant_id')
  if (!tenantId) return null

  const membership: TenantMembership = {
    tenantId,
    tenantSlug: pickString(record, 'tenantSlug', 'tenant_slug'),
    tenantName: pickString(record, 'tenantName', 'tenant_name'),
    tenantLogo: pickNullableString(record, 'tenantLogo', 'tenant_logo'),
    roles: pickRoles(record),
    branchAccess: normalizeBranchAccess(record),
    branchId: pickString(record, 'branchId', 'branch_id'),
    status: (() => {
      const status = pickString(record, 'status')
      return status === 'suspended' || status === 'revoked' ? status : 'active'
    })(),
    branches: normalizeMembershipBranches(record.branches, tenantId),
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
    created_at: pickString(record, 'created_at', 'createdAt') ?? '',
  }
}

function normalizeActiveMembership(
  raw: unknown,
  memberships: TenantMembership[],
): TenantMembership | undefined {
  const record = asRecord(raw)
  if (!record) return undefined

  const tenantId = pickString(record, 'tenantId', 'tenant_id')
  if (!tenantId) return undefined

  const membership = memberships.find((m) => m.tenantId === tenantId)
  const branchId = pickString(record, 'branchId', 'branch_id') ?? membership?.branchId
  const tenantName =
    pickString(record, 'tenantName', 'tenant_name') ?? membership?.tenantName
  const branchName = pickNullableString(record, 'branchName', 'branch_name')

  if (branchId && membership?.branches?.length) {
    const allowed = membership.branches.some((b) => b.id === branchId)
    if (!allowed) {
      return {
        tenantId,
        tenantName,
        tenantSlug: membership?.tenantSlug,
        roles: membership?.roles ?? [],
        branchAccess: membership?.branchAccess ?? { scope: 'selected', branchIds: [] },
      }
    }
  }

  if (membership) {
    return {
      ...membership,
      ...(tenantName ? { tenantName } : {}),
      ...(branchId ? { branchId } : {}),
      ...(branchName !== undefined ? { branchName } : {}),
    }
  }

  return {
    tenantId,
    tenantName,
    tenantSlug: pickString(record, 'tenantSlug', 'tenant_slug'),
    roles: pickRoles(record),
    branchAccess: normalizeBranchAccess(record),
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
      created_at: root.created_at,
    })

  if (!flatUser) {
    throw new Error('Invalid /auth/me response: missing user')
  }

  const membershipsRaw = root.memberships
  const memberships = Array.isArray(membershipsRaw)
    ? membershipsRaw
        .map((entry) => normalizeWireMembership(entry))
        .filter((m): m is TenantMembership => m !== null)
    : undefined

  let activeMembership = normalizeActiveMembership(root.activeMembership ?? root.active_membership, memberships ?? [])

  const legacyRoles = pickRoles({ roles: root.tenantRoles ?? root.tenant_roles })
  if (!activeMembership && legacyRoles.length > 0 && memberships?.length === 1) {
    activeMembership = { ...memberships[0], roles: legacyRoles }
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
