/**
 * RBAC Service — P1B.1 (legacy API) + P7.1 delegation
 *
 * This module provides backward-compatible wrappers around the new
 * permission.service.ts (P7.1). All new code should import directly
 * from permission.service or use the React hooks.
 *
 * Legacy API (colon-notation): kept for AuthGuard backward compat.
 * New API (dot-notation):      re-exported from permissionService.
 */
import type { UserRole } from '@/types'
import type { LegacyPermission } from '@/types'
import { permissionService } from './permission.service'

// ── Legacy permission sets (P1B.1 — unchanged for backward compat) ────────────

const CUSTOMER_PERMISSIONS: readonly LegacyPermission[] = [
  'menu:read',
  'orders:read',
  'orders:write',
  'orders:cancel',
  'reservations:read',
  'reservations:write',
  'notifications:read',
  'branches:read',
]

const STAFF_PERMISSIONS: readonly LegacyPermission[] = [
  ...CUSTOMER_PERMISSIONS,
  'orders:manage',
  'menu:write',
  'reservations:manage',
  'users:read',
  'dashboard:access',
]

const OWNER_PERMISSIONS: readonly LegacyPermission[] = [
  ...STAFF_PERMISSIONS,
  'users:manage',
  'branches:manage',
]

const ADMIN_PERMISSIONS: readonly LegacyPermission[] = [
  ...STAFF_PERMISSIONS,
  'menu:manage',
  'branches:manage',
]

const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly LegacyPermission[]>> = {
  customer: CUSTOMER_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
  owner: OWNER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
}

// ── Public API ────────────────────────────────────────────────────────────────

export const rbacService = {
  /**
   * Legacy check — uses colon-notation permissions and UserRole.
   * @deprecated Use permissionService.hasPermission() with P7 roles and dot-notation permissions.
   */
  hasPermission(role: UserRole | null | undefined, permission: LegacyPermission): boolean {
    if (!role) return false
    return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
  },

  /**
   * Legacy getter — returns all colon-notation permissions for a UserRole.
   * @deprecated Use permissionService.getPermissionsForRole() with P7 roles.
   */
  getPermissions(role: UserRole | null | undefined): readonly LegacyPermission[] {
    if (!role) return []
    return ROLE_PERMISSIONS[role] ?? []
  },

  // Convenience re-exports for the P7 API
  p7: permissionService,
}
