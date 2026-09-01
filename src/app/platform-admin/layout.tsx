'use client'

/**
 * Platform Administration Center — auth + Django superuser shell.
 *
 * Middleware is the first-pass cookie check (same as `/console`).
 * This layout is the second layer: AuthGuard then `user.is_superuser === true`.
 * Tenant RBAC, is_staff, and platformRole are never consulted here.
 */
import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { PlatformSuperuserGuard } from '@/components/auth/PlatformSuperuserGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard permissionDeniedFallback={<AccessDenied />}>
      <PlatformSuperuserGuard loadingFallback={null} fallback={<AccessDenied />}>
        {children}
      </PlatformSuperuserGuard>
    </AuthGuard>
  )
}
