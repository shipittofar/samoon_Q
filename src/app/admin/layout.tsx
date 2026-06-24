'use client'

import { type ReactNode } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'

/**
 * Admin layout — Phase 3 (P3.2) / P7.13
 *
 * Wraps all /admin/* routes with AuthGuard requiring the `dashboard:access`
 * permission. This is additive to the Edge middleware auth check (P3.1):
 * the middleware blocks unauthenticated requests; this guard further enforces
 * that only `staff` and `admin` roles (which hold `dashboard:access`) can
 * access admin pages. Customers receive the `dashboard:access` permission
 * denied path and are redirected to the home page.
 *
 * P7.13: AdminBreadcrumbs rendered below the fixed header for nested routes.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredPermission="dashboard:access" forbiddenPath="/">
      <AdminBreadcrumbs className="fixed top-16 inset-x-0 z-30 px-4 py-1.5 bg-[var(--bg)]/80 backdrop-blur border-b border-[var(--border)] max-w-7xl mx-auto" />
      {children}
    </AuthGuard>
  )
}
