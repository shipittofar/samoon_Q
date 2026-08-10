import api from './client'
import { ENDPOINTS } from '@/services/endpoints'
import {
  normalizeEffectivePermissions,
  normalizePermissionAuditEntry,
  normalizePermissionOverride,
  normalizeRolePermissions,
  unwrapPermissionAuditList,
  unwrapPermissionOverrideList,
} from './normalizers'
import type {
  CreatePermissionOverridePayload,
  EffectivePermissionsResponse,
  ListPermissionAuditParams,
  MembershipPermissionOverridePayload,
  PaginatedResponse,
  PermissionAuditEntry,
  PermissionOverride,
  ReplaceRolePermissionsPayload,
  RolePermissionsResponse,
  UpdatePermissionOverridePayload,
} from '@/types/rbac-api'

export interface ListPermissionOverridesParams {
  membership_id?: string
  user_id?: string
  page?: number
  page_size?: number
}

export interface EffectivePermissionsParams {
  membership_id?: string
  user_id?: string
}

export async function listPermissionOverrides(
  tenantId: string,
  params?: ListPermissionOverridesParams,
): Promise<PermissionOverride[]> {
  const membershipId = params?.membership_id
  const path = membershipId
    ? ENDPOINTS.RBAC.MEMBERSHIP_PERMISSION_OVERRIDES(tenantId, membershipId)
    : ENDPOINTS.RBAC.PERMISSION_OVERRIDES(tenantId)
  const query = membershipId
    ? { user_id: params?.user_id, page: params?.page, page_size: params?.page_size }
    : params
  const { data } = await api.get<unknown>(path, { params: query })
  return unwrapPermissionOverrideList(data).map((o) => ({ ...o, tenantId }))
}

export async function createPermissionOverride(
  tenantId: string,
  payload: CreatePermissionOverridePayload,
): Promise<PermissionOverride> {
  const membershipId = payload.membership_id
  const path = membershipId
    ? ENDPOINTS.RBAC.MEMBERSHIP_PERMISSION_OVERRIDES(tenantId, membershipId)
    : ENDPOINTS.RBAC.PERMISSION_OVERRIDES(tenantId)
  const body: MembershipPermissionOverridePayload | CreatePermissionOverridePayload = membershipId
    ? { permission_id: payload.permission_id, effect: payload.effect }
    : payload
  const { data } = await api.post<unknown>(path, body)
  const override = normalizePermissionOverride(data)
  if (!override) throw new Error('Invalid permission override response')
  return {
    ...override,
    tenantId: override.tenantId || tenantId,
    membershipId: override.membershipId ?? membershipId,
  }
}

export async function updatePermissionOverride(
  tenantId: string,
  membershipId: string,
  overrideId: string,
  payload: UpdatePermissionOverridePayload,
): Promise<PermissionOverride> {
  const { data } = await api.patch<unknown>(
    ENDPOINTS.RBAC.MEMBERSHIP_PERMISSION_OVERRIDE(tenantId, membershipId, overrideId),
    payload,
  )
  const override = normalizePermissionOverride(data)
  if (!override) throw new Error('Invalid permission override response')
  return { ...override, tenantId: override.tenantId || tenantId, membershipId }
}

export async function deletePermissionOverride(
  tenantId: string,
  membershipId: string,
  overrideId: string,
): Promise<void> {
  await api.delete(
    ENDPOINTS.RBAC.MEMBERSHIP_PERMISSION_OVERRIDE(tenantId, membershipId, overrideId),
  )
}

export async function fetchEffectivePermissions(
  params?: EffectivePermissionsParams,
): Promise<EffectivePermissionsResponse> {
  const { data } = await api.get<unknown>(ENDPOINTS.AUTH.ME_EFFECTIVE_PERMISSIONS, { params })
  return normalizeEffectivePermissions(data)
}

export async function listPermissionAudit(
  tenantId: string,
  params?: ListPermissionAuditParams,
): Promise<PaginatedResponse<PermissionAuditEntry>> {
  const query = { ...params, ordering: params?.ordering ?? '-timestamp' }
  const { data } = await api.get<unknown>(ENDPOINTS.RBAC.PERMISSION_AUDIT(tenantId), { params: query })
  const root = data as PaginatedResponse<unknown>
  if (root && Array.isArray(root.results)) {
    return {
      count: typeof root.count === 'number' ? root.count : root.results.length,
      next: root.next ?? null,
      previous: root.previous ?? null,
      results: unwrapPermissionAuditList(root),
    }
  }
  const list = unwrapPermissionAuditList(data)
  return { count: list.length, next: null, previous: null, results: list }
}

export async function fetchRolePermissions(roleId: string): Promise<RolePermissionsResponse> {
  const { data } = await api.get<unknown>(ENDPOINTS.RBAC.ROLE_PERMISSIONS(roleId))
  return normalizeRolePermissions(data, roleId)
}

export async function replaceRolePermissions(
  roleId: string,
  payload: ReplaceRolePermissionsPayload,
): Promise<RolePermissionsResponse> {
  const { data } = await api.put<unknown>(ENDPOINTS.RBAC.ROLE_PERMISSIONS(roleId), payload)
  return normalizeRolePermissions(data, roleId)
}
