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
import { rbacService } from '@/services/rbac.service'
import type { LegacyPermission } from '@/types'

export interface AuthGuardProps {
  children: ReactNode
  /** When provided, the user must hold this permission. */
  requiredPermission?: LegacyPermission
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
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace(loginPath)
      return
    }
    if (requiredPermission && !rbacService.hasPermission(user?.role ?? null, requiredPermission)) {
      router.replace(forbiddenPath)
    }
  }, [isAuthenticated, isLoading, user, requiredPermission, loginPath, forbiddenPath, router])

  if (isLoading) return <>{fallback}</>
  if (!isAuthenticated) return <>{fallback}</>
  if (requiredPermission && !rbacService.hasPermission(user?.role ?? null, requiredPermission)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
