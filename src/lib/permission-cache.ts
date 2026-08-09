import { permissionStore } from '@/stores/permission-store'
import { useTenantStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { setActiveTenantSlugForRequests } from '@/lib/tenant-request-context'
import type { TenantMembership } from '@/types/rbac'
import type { Role } from '@/types/rbac'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

export interface RefreshPermissionCacheInput {
  tenantId?: string
  tenantSlug?: string
  memberships?: TenantMembership[] | null
  activeMembership?: TenantMembership | null
  p7Roles?: Role[]
  tenantRoles?: Role[]
}

/**
 * Loads effective permissions from GET /auth/me/permissions (real backend)
 * or derives from session roles in mock mode only.
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

  if (!USE_MOCK) {
    permissionStore.clear()
    if (tenantSlug) setActiveTenantSlugForRequests(tenantSlug)
    return await permissionStore.fetchPermissions(tenantSlug, tenantId)
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
