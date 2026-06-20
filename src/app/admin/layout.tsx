'use client'

import { type ReactNode } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'

/**
 * Admin layout — Phase 3 (P3.2)
 *
 * Wraps all /admin/* routes with AuthGuard requiring the `dashboard:access`
 * permission. This is additive to the Edge middleware auth check (P3.1):
 * the middleware blocks unauthenticated requests; this guard further enforces
 * that only `staff` and `admin` roles (which hold `dashboard:access`) can
 * access admin pages. Customers receive the `dashboard:access` permission
 * denied path and are redirected to the home page.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredPermission="dashboard:access" forbiddenPath="/">
      {children}
    </AuthGuard>
  )
}
