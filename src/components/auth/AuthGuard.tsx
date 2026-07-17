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
import { useAuthStore, useTenantStore } from '@/stores'
import { usePermission } from '@/hooks'
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
  /**
   * When true, this guard also requires `tenantState === 'resolved'` before
   * rendering `children` — i.e. it will never render with `tenant === null`.
   * Distinct `tenantState` values render distinct fallback content instead
   * of the single generic `fallback` node, via `tenantFallback`.
   * Off by default so guards that don't care about tenant context (if any
   * are ever added) are unaffected.
   */
  requireResolvedTenant?: boolean
  /**
   * Rendered when `requireResolvedTenant` is true and tenant resolution has
   * settled into a non-'resolved' terminal state ('not_found' | 'forbidden'
   * | 'error'). The 'loading' state uses `fallback` instead, same as auth
   * loading. Falls back to `fallback` if omitted.
   */
  tenantFallback?: (tenantState: 'not_found' | 'forbidden' | 'error') => ReactNode
}

export function AuthGuard({
  children,
  requiredPermission,
  loginPath = '/login',
  forbiddenPath = '/',
  fallback = null,
  requireResolvedTenant = false,
  tenantFallback,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const tenantState = useTenantStore((s) => s.tenantState)
  const router = useRouter()

  // Phase 2 (RBAC unification) — `dashboard:access` is now a real P7
  // permission granted to every assignable role (ROLE_PERMISSION_MAP,
  // permission.service.ts), so it no longer needs special-casing here:
  // `usePermission()` alone answers both "can reach the Console at all"
  // and any other specific permission, through the same single source
  // (`currentTenantSession`). `requiredPermission` defaults to
  // `'dashboard:access'` so `<AuthGuard>` with no prop still means
  // "authenticated + has some tenant role."
  const hasRequiredPermission = usePermission(requiredPermission ?? 'dashboard:access')
  const permissionGranted = !requiredPermission || hasRequiredPermission

  // Tenant resolution is still settling — wait rather than judge permissions
  // against an unresolved/null tenant (which would read as "denied" and
  // trigger a premature redirect to forbiddenPath before the real answer
  // is known).
  const tenantPending = requireResolvedTenant && tenantState === 'loading'
  const tenantFailed = requireResolvedTenant && !tenantPending && tenantState !== 'resolved'

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace(loginPath)
      return
    }
    if (tenantPending || tenantFailed) return
    if (requiredPermission && !permissionGranted) {
      router.replace(forbiddenPath)
    }
  }, [isAuthenticated, isLoading, requiredPermission, permissionGranted, loginPath, forbiddenPath, router, tenantPending, tenantFailed])

  if (isLoading) return <>{fallback}</>
  if (!isAuthenticated) return <>{fallback}</>
  if (tenantPending) return <>{fallback}</>
  if (tenantFailed) {
    return <>{tenantFallback ? tenantFallback(tenantState as 'not_found' | 'forbidden' | 'error') : fallback}</>
  }
  if (requiredPermission && !permissionGranted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
