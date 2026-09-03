import { permissionStore } from '@/stores/permission-store'
import { useRbacStore, useTenantStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { setActiveTenantSlugForRequests } from '@/lib/tenant-request-context'
import { isUsableTenantSlug } from '@/lib/identifier-brands'
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
  /**
   * Explicit effective permissions from GET /auth/me (membership /
   * tenantRoles[].permissions). Used as real-mode seed + API-failure
   * fallback. Never a ROLE_PERMISSION_MAP expansion.
   */
  explicitPermissions?: string[]
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
 * Loads effective permissions for feature authorization.
 *
 * Authoritative sources:
 *   Real backend — GET /auth/me/permissions (canonical after successful fetch).
 *     Before fetch / on failure: explicitPermissions from GET /auth/me when present.
 *     Never ROLE_PERMISSION_MAP / getPermissionsForRole (owner ≠ ALL_PERMISSIONS).
 *   Mock mode — role-map via normalizeTenantPermissions (fixtures only).
 */
export async function refreshPermissionCache(input: RefreshPermissionCacheInput = {}): Promise<string[]> {
  const tenantId =
    input.tenantId ??
    input.activeMembership?.tenantId ??
    input.memberships?.[0]?.tenantId

  const storeTenant =
    typeof window !== 'undefined' ? useTenantStore.getState().tenant : undefined
  const storeSlug =
    storeTenant && tenantId && storeTenant.id === tenantId ? storeTenant.slug : undefined

  const rawSlug =
    input.tenantSlug ??
    input.activeMembership?.tenantSlug ??
    input.memberships?.find((m) => m.tenantId === tenantId)?.tenantSlug ??
    storeSlug

  const tenantSlug = isUsableTenantSlug(rawSlug, tenantId) ? rawSlug.trim() : undefined

  if (!isMockAuthMode()) {
    // Seed from explicit /auth/me permissions so owner+restricted list is
    // visible immediately and role-map never fills an empty store.
    if (input.explicitPermissions !== undefined && tenantId) {
      const seeded = withDashboardAccess(input.explicitPermissions, {
        hasTenantRoles: sessionHasRoles(useRbacStore.getState().currentTenantSession?.roles),
      })
      permissionStore.setPermissions(seeded, tenantId)
      syncSessionPermissionsFromApi(tenantId, input.explicitPermissions)
    } else {
      permissionStore.clear()
    }

    if (tenantSlug) {
      setActiveTenantSlugForRequests(tenantSlug, tenantId)
    } else if (rawSlug != null && String(rawSlug).trim() !== '') {
      // Explicit non-slug (id/UUID) must not remain as the previous tenant header.
      setActiveTenantSlugForRequests(undefined)
    }
    try {
      const apiPermissions = await permissionStore.fetchPermissions(tenantSlug, tenantId)
      syncSessionPermissionsFromApi(tenantId, apiPermissions)
      return withDashboardAccess(apiPermissions, {
        hasTenantRoles: sessionHasRoles(useRbacStore.getState().currentTenantSession?.roles),
      })
    } catch {
      // fetchPermissions clears to [] on error — restore explicit /auth/me seed.
      if (input.explicitPermissions !== undefined && tenantId) {
        const restored = withDashboardAccess(input.explicitPermissions, {
          hasTenantRoles: sessionHasRoles(useRbacStore.getState().currentTenantSession?.roles),
        })
        permissionStore.setPermissions(restored, tenantId)
        syncSessionPermissionsFromApi(tenantId, input.explicitPermissions)
        return restored
      }
      return []
    }
  }

  const normalized = normalizeTenantPermissions(
    {
      memberships: input.memberships,
      activeMembership: input.activeMembership,
      p7Roles: input.p7Roles,
      tenantRoles: input.tenantRoles,
      permissions: input.explicitPermissions as never,
    },
    tenantId,
  )
  // Prefer explicit when provided even in mock (tests asserting restricted owner).
  const mockPermissions =
    input.explicitPermissions !== undefined
      ? input.explicitPermissions
      : normalized.permissionsSource === 'explicit'
        ? normalized.permissions
        : normalized.permissions
  permissionStore.setPermissions(mockPermissions, tenantId ?? normalized.tenantId)
  return mockPermissions
}

export function clearPermissionCache(): void {
  permissionStore.clear()
}
