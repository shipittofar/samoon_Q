'use client'

/**
 * PermissionGuard — P7.1
 *
 * Declarative permission gate for React trees. Renders children only when
 * the current user's tenant-scoped roles satisfy the permission requirement.
 *
 * Authorization formula: Permission AND Capability AND FeatureFlag.
 * All three must pass. Hooks handle the composition internally.
 *
 * @example Single permission
 * <PermissionGuard permission="analytics.view">
 *   <AnalyticsPanel />
 * </PermissionGuard>
 *
 * @example Multiple permissions — any
 * <PermissionGuard permissions={['orders.manage', 'reservations.manage']} mode="any">
 *   <OperationsPanel />
 * </PermissionGuard>
 *
 * @example Multiple permissions — all
 * <PermissionGuard permissions={['staff.view', 'staff.manage']} mode="all">
 *   <StaffAdmin />
 * </PermissionGuard>
 *
 * @example With fallback
 * <PermissionGuard permission="tenant.manage" fallback={<AccessDenied />}>
 *   <TenantSettings />
 * </PermissionGuard>
 */

import type { ReactNode } from 'react'
import type { P7Permission } from '@/types/rbac'
import { usePermission, useAnyPermission, useAllPermissions } from '@/hooks'

export interface PermissionGuardProps {
  /** Single permission to check. Mutually exclusive with `permissions`. */
  permission?: P7Permission
  /** Multiple permissions to check. Mutually exclusive with `permission`. */
  permissions?: P7Permission[]
  /** Check mode for multiple permissions (default: 'any'). */
  mode?: 'any' | 'all'
  /** Rendered when the check fails (default: null). */
  fallback?: ReactNode
  children: ReactNode
}

// ── Internal sub-guards (avoid conditional hook calls) ────────────────────────

function SinglePermissionGuard({
  permission,
  fallback,
  children,
}: {
  permission: P7Permission
  fallback: ReactNode
  children: ReactNode
}) {
  const granted = usePermission(permission)
  return granted ? <>{children}</> : <>{fallback}</>
}

function AnyPermissionGuard({
  permissions,
  fallback,
  children,
}: {
  permissions: P7Permission[]
  fallback: ReactNode
  children: ReactNode
}) {
  const granted = useAnyPermission(permissions)
  return granted ? <>{children}</> : <>{fallback}</>
}

function AllPermissionsGuard({
  permissions,
  fallback,
  children,
}: {
  permissions: P7Permission[]
  fallback: ReactNode
  children: ReactNode
}) {
  const granted = useAllPermissions(permissions)
  return granted ? <>{children}</> : <>{fallback}</>
}

// ── Public component ──────────────────────────────────────────────────────────

export function PermissionGuard({
  permission,
  permissions,
  mode = 'any',
  fallback = null,
  children,
}: PermissionGuardProps) {
  if (permission !== undefined) {
    return (
      <SinglePermissionGuard permission={permission} fallback={fallback}>
        {children}
      </SinglePermissionGuard>
    )
  }

  if (permissions !== undefined && mode === 'all') {
    return (
      <AllPermissionsGuard permissions={permissions} fallback={fallback}>
        {children}
      </AllPermissionsGuard>
    )
  }

  // Default: any mode (or no permissions specified → open)
  if (permissions !== undefined) {
    return (
      <AnyPermissionGuard permissions={permissions} fallback={fallback}>
        {children}
      </AnyPermissionGuard>
    )
  }

  // No permission constraint — render children
  return <>{children}</>
}
