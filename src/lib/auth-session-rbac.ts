import { useRbacStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { refreshPermissionCache } from '@/lib/permission-cache'
import type { Role, TenantMembership } from '@/types/rbac'

export interface AuthSessionRbacInput {
  memberships?: TenantMembership[] | null
  activeMembership?: TenantMembership | null
  p7Roles?: Role[]
  tenantRoles?: Role[]
}

/**
 * Seeds currentTenantSession + tenant role catalog and refreshes the
 * permission cache from GET /auth/me/permissions (or mock fallback).
 */
export function applyTenantSessionRbac(tenantId: string, input: AuthSessionRbacInput): void {
  const { roles, permissions, branchAccess } = normalizeTenantPermissions(input, tenantId)
  useRbacStore.getState().setCurrentTenantSession(tenantId, roles, permissions, branchAccess)
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
  })
}
