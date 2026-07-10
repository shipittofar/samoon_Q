'use client'

/**
 * AuthGuard — Phase 3 (P3.1 / P3.2)
 *
 * Client-side guard that enforces both authentication and optional RBAC.
 * Use in layouts or page components that need a richer client-side check
 * beyond what the Edge middleware can provide (e.g. role-specific access).
 *
 * The middleware (middleware.ts) handles the first-pass redirect for
 * unauthenticated users. AuthGuard is a second layer: it handles in-app
 * navigation (soft routing) after hydration and fine-grained permission checks.
 *
 * @example
 * // Require auth only
 * <AuthGuard><AdminPage /></AuthGuard>
 *
 * @example
 * // Require auth + permission
 * <AuthGuard requiredPermission="dashboard:access"><DashboardPage /></AuthGuard>
 */

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'
import { useHasDashboardAccess, usePermission } from '@/hooks'
import type { P7Permission } from '@/types/rbac'

export interface AuthGuardProps {
  children: ReactNode
  /** When provided, the user must hold this permission. */
  requiredPermission?: P7Permission
  /** Where to redirect unauthenticated users (default: /login). */
  loginPath?: string
  /** Where to redirect users who are authenticated but lack permission. */
  forbiddenPath?: string
  /** Rendered while auth state is still loading. */
  fallback?: ReactNode
}

export function AuthGuard({
  children,
  requiredPermission,
  loginPath = '/login',
  forbiddenPath = '/',
  fallback = null,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const router = useRouter()

  // P10.2.2 — docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §8.1: `dashboard:access`
  // is a derived, ownership/StaffAssignment-aware boolean
  // (`useHasDashboardAccess()`, src/hooks/index.ts), not a plain P7
  // permission lookup — `ROLE_PERMISSION_MAP` never grants the literal
  // `'dashboard:access'` permission to any role (see
  // docs/P10.4.8_LEGACY_COMPATIBILITY_AUDIT.md Phase G), so it stays
  // special-cased. AuthGuard's external contract (the `requiredPermission`
  // prop) is unchanged. P10.4.11 — any other `requiredPermission` now
  // resolves through the P7 permission engine (`usePermission()`),
  // replacing the removed legacy `rbacService.hasPermission()` fallback.
  const hasDashboardAccess = useHasDashboardAccess()
  const hasOtherRequiredPermission = usePermission(requiredPermission ?? 'dashboard:access')
  const isDashboardAccessCheck = requiredPermission === 'dashboard:access'
  const permissionGranted = isDashboardAccessCheck
    ? hasDashboardAccess
    : !requiredPermission || hasOtherRequiredPermission

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace(loginPath)
      return
    }
    if (requiredPermission && !permissionGranted) {
      router.replace(forbiddenPath)
    }
  }, [isAuthenticated, isLoading, requiredPermission, permissionGranted, loginPath, forbiddenPath, router])

  if (isLoading) return <>{fallback}</>
  if (!isAuthenticated) return <>{fallback}</>
  if (requiredPermission && !permissionGranted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
