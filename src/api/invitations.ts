import {
  createStaffMembership,
  listStaffMemberships,
  removeStaffMembership,
  resendStaffMembershipInvite,
  getStaffMembership,
} from './rbac'
import { normalizeStaffMember } from './staff'
import type { StaffInvite, InviteStatus } from '@/types/staff'
import type { Role } from '@/types/rbac'
import type { AssignmentMode } from '@/types/rbac-api'
import type { StaffMember } from '@/types/staff'

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

function normalizeInvite(raw: unknown): StaffInvite | null {
  const r = asRecord(raw)
  if (!r) return null
  const id = pickString(r, 'id', 'membership_id', 'membershipId')
  const tenantId = pickString(r, 'tenantId', 'tenant_id')
  const userObj = asRecord(r.user)
  const email =
    pickString(r, 'email') ??
    (userObj ? pickString(userObj, 'email') : undefined)
  if (!id || !tenantId || !email) return null

  const rolesRaw = r.roles
  const roles: Role[] | undefined = Array.isArray(rolesRaw)
    ? rolesRaw.filter((x): x is Role => typeof x === 'string')
    : undefined

  const roleId = pickString(r, 'roleId', 'role_id')
  const roleObj = asRecord(r.role)
  const role =
    pickString(r, 'role') ??
    pickString(r, 'role_slug', 'roleSlug') ??
    (roleObj ? pickString(roleObj, 'slug', 'name') : undefined) ??
    (roles && roles.length > 0 ? roles[0] : undefined)

  const modeRaw = pickString(r, 'mode')
  const mode: AssignmentMode | undefined =
    modeRaw === 'read' || modeRaw === 'manage' ? modeRaw : undefined

  const allLocationsRaw = r.allLocations ?? r.all_locations
  const allLocations = typeof allLocationsRaw === 'boolean' ? allLocationsRaw : undefined

  const statusRaw = pickString(r, 'status') ?? 'pending'
  const status: InviteStatus =
    statusRaw === 'pending' ||
    statusRaw === 'accepted' ||
    statusRaw === 'expired' ||
    statusRaw === 'cancelled'
      ? statusRaw
      : 'pending'

  const locationIdsRaw = r.locationIds ?? r.location_ids
  const locationIds = Array.isArray(locationIdsRaw)
    ? locationIdsRaw.filter((x): x is string => typeof x === 'string')
    : undefined

  const validFrom = pickString(r, 'validFrom', 'valid_from') ?? null
  const validUntil = pickString(r, 'validUntil', 'valid_until') ?? null

  return {
    id,
    tenantId,
    email,
    role,
    roleId,
    mode,
    allLocations,
    validFrom: validFrom ?? undefined,
    validUntil: validUntil ?? undefined,
    roles,
    invitedBy: pickString(r, 'invitedBy', 'invited_by', 'created_by', 'createdBy') ?? '',
    expiresAt:
      pickString(r, 'expiresAt', 'expires_at', 'invite_expires_at', 'inviteExpiresAt') ?? '',
    status,
    locationIds,
  }
}

export interface InviteStaffBody {
  email: string
  first_name?: string
  last_name?: string
  role_id: string
  location_ids: string[]
  all_locations: boolean
  mode: AssignmentMode
  valid_from?: string | null
  valid_until?: string | null
}

export async function listInvites(tenantId: string): Promise<StaffInvite[]> {
  const page = await listStaffMemberships(tenantId, { status: 'pending' })
  return page.results
    .map((row) => normalizeInvite(row))
    .filter((i): i is StaffInvite => i !== null)
}

export async function inviteStaff(tenantId: string, body: InviteStaffBody): Promise<StaffInvite> {
  const data = await createStaffMembership(tenantId, {
    email: body.email,
    first_name: body.first_name,
    last_name: body.last_name,
    role_id: body.role_id,
    location_ids: body.location_ids,
    all_locations: body.all_locations,
    mode: body.mode,
    valid_from: body.valid_from ?? null,
    valid_until: body.valid_until ?? null,
  })
  const invite = normalizeInvite(data)
  if (!invite) throw new Error('Invalid invite response')
  return invite
}

export async function cancelInvite(tenantId: string, membershipId: string): Promise<StaffInvite> {
  const existing = await getStaffMembership(tenantId, membershipId)
  await removeStaffMembership(tenantId, membershipId)
  const invite = normalizeInvite(existing)
  if (!invite) throw new Error(`Invite not found: ${membershipId}`)
  return { ...invite, status: 'cancelled' }
}

export async function resendInvite(tenantId: string, membershipId: string): Promise<StaffInvite> {
  const data = await resendStaffMembershipInvite(tenantId, membershipId)
  const invite = normalizeInvite(data)
  if (!invite) throw new Error(`Invite not found: ${membershipId}`)
  return invite
}

export async function acceptInvite(tenantId: string, membershipId: string): Promise<StaffMember | null> {
  const data = await getStaffMembership(tenantId, membershipId)
  const member = normalizeStaffMember(data)
  return member
}
