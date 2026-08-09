import api from './client'
import { ENDPOINTS } from '@/services/endpoints'
import {
  listStaffMemberships,
  getStaffMembership,
  removeStaffMembership,
  type ListStaffMembershipsParams,
} from './rbac'
import type { StaffMember, StaffStatus } from '@/types/staff'
import type { Role } from '@/types/rbac'
import type { PaginatedResponse } from '@/types/rbac-api'

type WireRecord = Record<string, unknown>

function asRecord(value: unknown): WireRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as WireRecord)
    : null
}

function pickString(record: WireRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

function rolesFromMembershipWire(r: WireRecord): Role[] {
  const rolesRaw = r.roles
  if (Array.isArray(rolesRaw)) {
    return rolesRaw.filter((x): x is Role => typeof x === 'string')
  }
  const assignments = r.assignments
  if (Array.isArray(assignments)) {
    const slugs: Role[] = []
    for (const entry of assignments) {
      const a = asRecord(entry)
      if (!a) continue
      const roleObj = asRecord(a.role)
      const slug =
        pickString(a, 'role') ??
        (roleObj ? pickString(roleObj, 'slug', 'name') : undefined)
      if (slug && !slugs.includes(slug as Role)) slugs.push(slug as Role)
    }
    return slugs
  }
  return []
}

export function normalizeStaffMember(raw: unknown): StaffMember | null {
  const r = asRecord(raw)
  if (!r) return null

  const userObj = asRecord(r.user)
  const id = pickString(r, 'id', 'membership_id', 'membershipId')
  const tenantId = pickString(r, 'tenantId', 'tenant_id')
  const userId =
    pickString(r, 'userId', 'user_id') ??
    (userObj ? pickString(userObj, 'id') : undefined)
  const email =
    pickString(r, 'email') ??
    (userObj ? pickString(userObj, 'email') : undefined)

  if (!id || !tenantId || !email) return null

  const roles = rolesFromMembershipWire(r)

  const locationIdsRaw = r.locationIds ?? r.location_ids
  const locationIds = Array.isArray(locationIdsRaw)
    ? locationIdsRaw.filter((x): x is string => typeof x === 'string')
    : undefined

  const membershipId = pickString(r, 'membershipId', 'membership_id') ?? id

  const statusRaw = pickString(r, 'status') ?? 'active'
  const status: StaffStatus =
    statusRaw === 'pending' ||
    statusRaw === 'active' ||
    statusRaw === 'suspended' ||
    statusRaw === 'removed'
      ? statusRaw
      : 'active'

  return {
    id,
    tenantId,
    userId: userId ?? id,
    email,
    firstName:
      pickString(r, 'firstName', 'first_name') ??
      (userObj ? pickString(userObj, 'first_name', 'firstName') : undefined) ??
      '',
    lastName:
      pickString(r, 'lastName', 'last_name') ??
      (userObj ? pickString(userObj, 'last_name', 'lastName') : undefined) ??
      '',
    avatar:
      pickString(r, 'avatar') ??
      (userObj ? pickString(userObj, 'avatar') : undefined) ??
      undefined,
    status,
    roles,
    invitedAt: pickString(r, 'invitedAt', 'invited_at', 'created_at', 'createdAt') ?? '',
    activatedAt: pickString(r, 'activatedAt', 'activated_at') ?? undefined,
    lastSeenAt: pickString(r, 'lastSeenAt', 'last_seen_at') ?? undefined,
    createdBy: pickString(r, 'createdBy', 'created_by') ?? '',
    locationIds,
    membershipId,
    ownerId: pickString(r, 'ownerId', 'owner_id') ?? undefined,
    metadata: asRecord(r.metadata) ?? undefined,
  }
}

export type ListStaffParams = ListStaffMembershipsParams

export async function listStaff(
  tenantId: string,
  params?: ListStaffParams,
): Promise<PaginatedResponse<StaffMember>> {
  const page = await listStaffMemberships(tenantId, params)
  const results = page.results
    .map((row) => normalizeStaffMember(row))
    .filter((m): m is StaffMember => m !== null && m.status !== 'pending')
  return {
    count: typeof page.count === 'number' ? page.count : results.length,
    next: page.next,
    previous: page.previous,
    results,
  }
}

export async function getStaffMember(tenantId: string, membershipId: string): Promise<StaffMember> {
  const data = await getStaffMembership(tenantId, membershipId)
  const member = normalizeStaffMember(data)
  if (!member) throw new Error(`Staff member not found: ${membershipId}`)
  return member
}

export async function suspendStaffMember(tenantId: string, membershipId: string): Promise<StaffMember> {
  const { data } = await api.post<unknown>(ENDPOINTS.STAFF.SUSPEND(tenantId, membershipId))
  const member = normalizeStaffMember(data)
  if (!member) throw new Error(`Staff member not found: ${membershipId}`)
  return member
}

export async function activateStaffMember(
  tenantId: string,
  membershipId: string,
): Promise<StaffMember> {
  const { data } = await api.post<unknown>(ENDPOINTS.STAFF.ACTIVATE(tenantId, membershipId))
  const member = normalizeStaffMember(data)
  if (!member) throw new Error(`Staff member not found: ${membershipId}`)
  return member
}

export async function removeStaffMember(tenantId: string, membershipId: string): Promise<void> {
  await removeStaffMembership(tenantId, membershipId)
}

export interface UpdateStaffRolesBody {
  roles: Role[]
  location_ids?: string[]
}

export async function updateStaffRoles(
  id: string,
  payload: UpdateStaffRolesBody,
): Promise<StaffMember> {
  const { data } = await api.patch<unknown>(`/staff/${id}/roles/`, {
    roles: payload.roles,
    location_ids: payload.location_ids,
    branch_ids: undefined,
  })
  const member = normalizeStaffMember(data)
  if (!member) throw new Error(`Staff member not found: ${id}`)
  return member
}

export async function transferOwnership(
  tenantId: string,
  currentOwnerId: string,
  targetMemberId: string,
): Promise<{ owner: StaffMember; prevOwner: StaffMember }> {
  const { data } = await api.post<unknown>(ENDPOINTS.TENANTS.TRANSFER_OWNERSHIP(tenantId), {
    currentOwnerId,
    targetMemberId,
  })
  const root = asRecord(data)
  if (!root) throw new Error('Invalid transfer response')
  const owner = normalizeStaffMember(root.owner)
  const prevOwner = normalizeStaffMember(root.prevOwner ?? root.prev_owner)
  if (!owner || !prevOwner) throw new Error('Invalid transfer response')
  return { owner, prevOwner }
}
