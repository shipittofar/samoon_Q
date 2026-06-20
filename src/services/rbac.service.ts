/**
 * RBAC Service — Phase 1B (P1B.1)
 *
 * Provides a static, deterministic permission map for the three user roles.
 * All permission checks are pure functions with no side effects.
 *
 * Extension path (Phase 2+): swap ROLE_PERMISSIONS values for server-fetched
 * permission sets without changing the hasPermission() call sites.
 */
import type { Permission, UserRole } from '@/types'

// ── Permission sets per role ──────────────────────────────────────────────────

const CUSTOMER_PERMISSIONS: readonly Permission[] = [
  'menu:read',
  'orders:read',
  'orders:write',
  'orders:cancel',
  'reservations:read',
  'reservations:write',
  'notifications:read',
  'branches:read',
]

const STAFF_PERMISSIONS: readonly Permission[] = [
  ...CUSTOMER_PERMISSIONS,
  'orders:manage',
  'menu:write',
  'reservations:manage',
  'users:read',
  'dashboard:access',
]

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...STAFF_PERMISSIONS,
  'menu:manage',
  'users:manage',
  'branches:manage',
]

const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  customer: CUSTOMER_PERMISSIONS,
  staff:    STAFF_PERMISSIONS,
  admin:    ADMIN_PERMISSIONS,
}

// ── Public API ────────────────────────────────────────────────────────────────

export const rbacService = {
  /**
   * Returns true if the role holds the requested permission.
   * Null / undefined role → false (safe default deny).
   */
  hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
    if (!role) return false
    return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
  },

  /**
   * Returns all permissions held by the given role.
   * Null / undefined role → empty array.
   */
  getPermissions(role: UserRole | null | undefined): readonly Permission[] {
    if (!role) return []
    return ROLE_PERMISSIONS[role] ?? []
  },
}
