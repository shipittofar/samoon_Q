import api from './client'
import { ENDPOINTS } from '@/services/endpoints'
import {
  normalizeRoleEntry,
  unwrapAssignmentList,
  unwrapAssignmentResponse,
} from './normalizers'
import type {
  CreateAssignmentPayload,
  PaginatedResponse,
  RbacAssignment,
  RoleCatalogEntry,
  UpdateAssignmentPayload,
} from '@/types/rbac-api'

export async function fetchTenantRoles(tenantId: string): Promise<RoleCatalogEntry[]> {
  const { data } = await api.get<unknown>(ENDPOINTS.RBAC.TENANT_ROLES(tenantId))
  if (!Array.isArray(data)) return []
  return data
    .map((entry) => normalizeRoleEntry(entry))
    .filter((r): r is RoleCatalogEntry => r !== null)
}

export interface ListAssignmentsParams {
  user_id?: string
  location_id?: string
  status?: string
  page?: number
  page_size?: number
}

export async function listAssignments(
  tenantId: string,
  params?: ListAssignmentsParams,
): Promise<PaginatedResponse<RbacAssignment>> {
  const { data } = await api.get<unknown>(ENDPOINTS.RBAC.ASSIGNMENTS(tenantId), { params })
  const root = data as PaginatedResponse<unknown>
  if (root && Array.isArray(root.results)) {
    return {
      count: typeof root.count === 'number' ? root.count : root.results.length,
      next: root.next ?? null,
      previous: root.previous ?? null,
      results: unwrapAssignmentList(root),
    }
  }
  const list = unwrapAssignmentList(data)
  return { count: list.length, next: null, previous: null, results: list }
}

export async function getAssignment(
  tenantId: string,
  assignmentId: string,
): Promise<RbacAssignment> {
  const { data } = await api.get<unknown>(ENDPOINTS.RBAC.ASSIGNMENT(tenantId, assignmentId))
  const assignment = unwrapAssignmentResponse(data)
  if (!assignment) throw new Error('Assignment not found')
  return assignment
}

export async function createAssignment(
  tenantId: string,
  payload: CreateAssignmentPayload,
): Promise<RbacAssignment> {
  const body: Record<string, unknown> = {
    role_id: payload.role_id,
    location_ids: payload.location_ids,
    all_locations: payload.all_locations,
    mode: payload.mode,
    valid_from: payload.valid_from ?? null,
    valid_until: payload.valid_until ?? null,
  }
  if (payload.membership_id) body.membership_id = payload.membership_id
  if (payload.user_id) body.user_id = payload.user_id
  const { data } = await api.post<unknown>(ENDPOINTS.RBAC.ASSIGNMENTS(tenantId), body)
  const assignment = unwrapAssignmentResponse(data)
  if (!assignment) throw new Error('Invalid assignment response')
  return assignment
}

export async function updateAssignment(
  tenantId: string,
  assignmentId: string,
  payload: UpdateAssignmentPayload,
): Promise<RbacAssignment> {
  const body = {
    location_ids: payload.location_ids,
    all_locations: payload.all_locations,
    mode: payload.mode,
    valid_from: payload.valid_from,
    valid_until: payload.valid_until,
  }
  const { data } = await api.patch<unknown>(
    ENDPOINTS.RBAC.ASSIGNMENT(tenantId, assignmentId),
    body,
  )
  const assignment = unwrapAssignmentResponse(data)
  if (!assignment) throw new Error('Invalid assignment response')
  return assignment
}

export async function revokeAssignment(tenantId: string, assignmentId: string): Promise<void> {
  await api.delete(ENDPOINTS.RBAC.ASSIGNMENT(tenantId, assignmentId))
}

/** Convenience: grant role via assignment API with user_id. */
export async function grantUserRole(
  tenantId: string,
  userId: string,
  body: Omit<CreateAssignmentPayload, 'membership_id' | 'user_id'>,
): Promise<RbacAssignment> {
  return createAssignment(tenantId, { ...body, user_id: userId })
}

export async function revokeUserRole(
  tenantId: string,
  _userId: string,
  assignmentId: string,
): Promise<void> {
  await revokeAssignment(tenantId, assignmentId)
}

// ── Staff memberships (tenant workforce membership records) ───────────────────

export interface ListStaffMembershipsParams {
  page?: number
  page_size?: number
  search?: string
  status?: string
  role?: string
  location_id?: string
}

export interface CreateStaffMembershipPayload {
  email: string
  first_name?: string
  last_name?: string
  role_id: string
  location_ids: string[]
  all_locations: boolean
  mode: string
  valid_from?: string | null
  valid_until?: string | null
}

function unwrapMembershipList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  const root = data as PaginatedResponse<unknown>
  if (root?.results && Array.isArray(root.results)) return root.results
  const record = data as Record<string, unknown>
  if (record && Array.isArray(record.data)) return record.data
  return []
}

export async function listStaffMemberships(
  tenantId: string,
  params?: ListStaffMembershipsParams,
): Promise<PaginatedResponse<unknown>> {
  const { data } = await api.get<unknown>(ENDPOINTS.RBAC.STAFF_MEMBERSHIPS(tenantId), { params })
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data }
  }
  const root = data as PaginatedResponse<unknown>
  if (root?.results && Array.isArray(root.results)) {
    return {
      count: typeof root.count === 'number' ? root.count : root.results.length,
      next: root.next ?? null,
      previous: root.previous ?? null,
      results: root.results,
    }
  }
  const list = unwrapMembershipList(data)
  return { count: list.length, next: null, previous: null, results: list }
}

export async function getStaffMembership(
  tenantId: string,
  membershipId: string,
): Promise<unknown> {
  const { data } = await api.get<unknown>(
    ENDPOINTS.RBAC.STAFF_MEMBERSHIP(tenantId, membershipId),
  )
  return data
}

export async function createStaffMembership(
  tenantId: string,
  payload: CreateStaffMembershipPayload,
): Promise<unknown> {
  const { data } = await api.post<unknown>(
    ENDPOINTS.RBAC.STAFF_MEMBERSHIPS(tenantId),
    {
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      role_id: payload.role_id,
      location_ids: payload.location_ids,
      all_locations: payload.all_locations,
      mode: payload.mode,
      valid_from: payload.valid_from ?? null,
      valid_until: payload.valid_until ?? null,
    },
  )
  return data
}

export async function removeStaffMembership(
  tenantId: string,
  membershipId: string,
): Promise<void> {
  await api.delete(ENDPOINTS.RBAC.STAFF_MEMBERSHIP_REMOVE(tenantId, membershipId))
}

export async function resendStaffMembershipInvite(
  tenantId: string,
  membershipId: string,
): Promise<unknown> {
  const { data } = await api.post<unknown>(
    ENDPOINTS.RBAC.STAFF_MEMBERSHIP_RESEND(tenantId, membershipId),
  )
  return data
}
