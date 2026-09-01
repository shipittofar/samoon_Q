'use client'

/**
 * Route gate for /platform-admin: authenticated Django superuser only.
 * Does not read platformRole, tenant RBAC, or is_staff.
 *
 * Unknown user (loading) never allows children.
 */
import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'

export interface PlatformSuperuserGuardProps {
  /** Shown when auth is still hydrating (user not yet known). */
  loadingFallback?: ReactNode
  /** Shown when the user is known and is not a superuser. */
  fallback?: ReactNode
  children: ReactNode
}

export function PlatformSuperuserGuard({
  loadingFallback = null,
  fallback = null,
  children,
}: PlatformSuperuserGuardProps) {
  const isLoading = useAuthStore((s) => s.isLoading)
  const user = useAuthStore((s) => s.user)

  if (isLoading) return <>{loadingFallback}</>
  if (!isPlatformSuperuser(user)) return <>{fallback}</>
  return <>{children}</>
}
