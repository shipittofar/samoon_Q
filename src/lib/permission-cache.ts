import { permissionStore } from '@/stores/permission-store'
import { useRbacStore, useTenantStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { setActiveTenantSlugForRequests } from '@/lib/tenant-request-context'
import { isMockAuthMode, sessionHasRoles, withDashboardAccess } from '@/lib/effective-permissions'
import type { TenantMembership } from '@/types/rbac'
import type { Role } from '@/types/rbac'

export interface RefreshPermissionCacheInput {
  tenantId?: string
  tenantSlug?: string
  memberships?: TenantMembership[] | null
  activeMembership?: TenantMembership | null
  p7Roles?: Role[]
  tenantRoles?: Role[]
}

/**
 * Sync currentTenantSession.permissions to the API permission list so every
 * consumer (nav, PermissionGuard, console index redirect) shares one source.
 */
function syncSessionPermissionsFromApi(tenantId: string | undefined, apiPermissions: string[]): void {
  if (!tenantId) return
  const session = useRbacStore.getState().currentTenantSession
  if (!session || session.tenantId !== tenantId) return
  const next = withDashboardAccess(apiPermissions, { hasTenantRoles: sessionHasRoles(session.roles) })
  useRbacStore.getState().setCurrentTenantSession(
    session.tenantId,
    session.roles,
    next,
    session.branchAccess,
  )
  permissionStore.setPermissions(next, tenantId)
}

/**
 * Loads effective permissions from GET /auth/me/permissions (real backend)
 * or derives from session roles in mock mode only.
 *
 * Real backend: API response is the source of truth. Session permissions are
 * rewritten to match (plus synthesized `dashboard:access`), never merged with
 * client-side ROLE_PERMISSION_MAP expansions.
 */
export async function refreshPermissionCache(input: RefreshPermissionCacheInput = {}): Promise<string[]> {
  const tenantId =
    input.tenantId ??
    input.activeMembership?.tenantId ??
    input.memberships?.[0]?.tenantId

  const tenantSlug =
    input.tenantSlug ??
    input.activeMembership?.tenantSlug ??
    input.memberships?.find((m) => m.tenantId === tenantId)?.tenantSlug ??
    (typeof window !== 'undefined' ? useTenantStore.getState().tenant?.slug : undefined)

  if (!isMockAuthMode()) {
    permissionStore.clear()
    if (tenantSlug) setActiveTenantSlugForRequests(tenantSlug)
    const apiPermissions = await permissionStore.fetchPermissions(tenantSlug, tenantId)
    syncSessionPermissionsFromApi(tenantId, apiPermissions)
    return withDashboardAccess(apiPermissions, {
      hasTenantRoles: sessionHasRoles(useRbacStore.getState().currentTenantSession?.roles),
    })
  }

  const normalized = normalizeTenantPermissions(
    {
      memberships: input.memberships,
      activeMembership: input.activeMembership,
      p7Roles: input.p7Roles,
      tenantRoles: input.tenantRoles,
    },
    tenantId,
  )
  permissionStore.setPermissions(normalized.permissions, tenantId ?? normalized.tenantId)
  return normalized.permissions
}

export function clearPermissionCache(): void {
  permissionStore.clear()
}
