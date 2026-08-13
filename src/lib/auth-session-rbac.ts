import { useRbacStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { refreshPermissionCache } from '@/lib/permission-cache'
import { isMockAuthMode } from '@/lib/effective-permissions'
import type { Role, TenantMembership } from '@/types/rbac'

export interface AuthSessionRbacInput {
  memberships?: TenantMembership[] | null
  activeMembership?: TenantMembership | null
  p7Roles?: Role[]
  tenantRoles?: Role[]
  /** Top-level explicit effective permissions when not embedded on memberships. */
  permissions?: import('@/types/rbac').Permission[] | null
}

/**
 * Seeds currentTenantSession + tenant role catalog and refreshes the
 * permission cache from GET /auth/me/permissions (or mock fallback).
 *
 * Authorization sources (real backend):
 *   1. GET /auth/me/permissions → permissionStore (canonical after fetch)
 *   2. Explicit /auth/me membership|tenantRoles[].permissions → seeded first
 *      so role→ALL_PERMISSIONS never fills the gap before the API returns
 *   3. ROLE_PERMISSION_MAP — mock fixtures only; never live feature auth
 *
 * Console shell entry (useHasDashboardAccess) may use roles; feature
 * menus/routes use the effective permission set only.
 */
export function applyTenantSessionRbac(tenantId: string, input: AuthSessionRbacInput): void {
  const { roles, permissions, branchAccess, permissionsSource } = normalizeTenantPermissions(
    input,
    tenantId,
  )

  // Real backend: never seed ROLE_PERMISSION_MAP expansions into the session.
  // Explicit /auth/me permissions are kept; otherwise leave [] until API cache.
  const sessionPermissions = isMockAuthMode()
    ? permissions
    : permissionsSource === 'explicit'
      ? permissions
      : []

  useRbacStore.getState().setCurrentTenantSession(tenantId, roles, sessionPermissions, branchAccess)
  if (roles.length > 0) useRbacStore.getState().setTenantRoles(tenantId, roles)

  const tenantSlug =
    input.activeMembership?.tenantSlug ??
    input.memberships?.find((m) => m.tenantId === tenantId)?.tenantSlug

  void refreshPermissionCache({
    tenantId,
    tenantSlug,
    memberships: input.memberships,
    activeMembership: input.activeMembership,
    p7Roles: input.p7Roles,
    tenantRoles: input.tenantRoles,
    // Pass explicit list so cache hydrate / API-failure fallback never role-expands.
    explicitPermissions: permissionsSource === 'explicit' ? permissions : undefined,
  })
}
