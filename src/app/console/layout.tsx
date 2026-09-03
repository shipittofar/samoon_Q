'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ConsoleAccountTypeGuard } from '@/components/auth/ConsoleAccountTypeGuard'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminContextBar } from '@/components/admin/AdminContextBar'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { ConsoleWorkspaceGate } from '@/components/admin/ConsoleWorkspaceGate'
import { ConsoleWorkspaceRealtime } from '@/components/admin/ConsoleWorkspaceRealtime'
import { Button } from '@/components/ui/Button'

/**
 * Admin layout — P8.9.4
 *
 * Renders an admin-specific chrome instead of the consumer Header:
 *   - AdminHeader: logo, env badge, notifications, theme, user chip (P8.9.4 Phase E)
 *   - AdminContextBar: tenant + branch switchers (P8.7.5)
 *   - AdminBreadcrumbs: contextual breadcrumb showing path from /console (P8.9.4 fixes C4/H10)
 *   - AdminSidebar: grouped nav with icons + role chip + focus trap (P8.9.4 Phase F)
 *   - AuthGuard: auth only. Tenant resolution is a DATA dependency of the
 *     workspace, not an authentication dependency — it must never block
 *     the shell itself. See docs/CONSOLE_ARCHITECTURE_TENANT_DECOUPLING_AUDIT.md.
 *
 * Phase Z.13 — `ConsoleAccountTypeGuard` is the outermost wrapper: customer
 * accounts are redirected to `/dashboard` before the shell or RBAC gate render.
 * `ConsoleWorkspaceBootstrapper` (global Providers tree) skips workspace init
 * for customer accounts via the same account-type rule.
 *
 * Phase Z.11 — the chrome below (header, context bar, sidebar) is now
 * OUTSIDE `ConsoleWorkspaceGate`: it renders unconditionally the instant
 * the user is authenticated, exactly like the required
 * "Authentication success -> Render Console shell" flow. Every one of
 * these components already reads `tenant` defensively (`tenant?.id`,
 * `tenant?.name ?? '—'`, etc. — confirmed in AdminHeader, AdminSidebar,
 * AdminBranchSwitcher) so mounting them before a tenant resolves is safe.
 * `ConsoleWorkspaceGate` now only decides what renders INSIDE `<main>`:
 * a membership/tenant loading state, a retry-capable error state,
 * onboarding, access-denied, or the actual page content — never a
 * full-page replacement of the whole workspace. `dashboard:access` is
 * still enforced exactly as before (via `usePermission('dashboard:access')`
 * inside `ConsoleWorkspaceGate`) — only the tenant/RBAC decision moved one
 * level deeper into the tree, RBAC itself is unchanged.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const t = useTranslations('console')

  return (
    <ConsoleAccountTypeGuard>
      <AuthGuard>
        {/* Admin-specific header — replaces consumer Header */}
        <AdminHeader />

        {/* Context + breadcrumb bar — fixed below admin header */}
        <div className="fixed top-16 inset-x-0 z-30 bg-[var(--bg)]/80 backdrop-blur border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-2 px-4 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile sidebar toggle */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden shrink-0"
                aria-label={t('openAdminMenuAria')}
                aria-expanded={sidebarOpen}
                aria-controls="admin-sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <AdminBreadcrumbs />
            </div>
            {/* Tenant & branch context switchers */}
            <AdminContextBar />
          </div>
        </div>

        <ConsoleWorkspaceRealtime />

        {/* Body: sidebar + page content */}
        <div className="flex pt-28 min-h-screen">
          <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main id="main-content" className="flex-1 min-w-0 px-4 sm:px-6 pb-8 lg:ps-8">
            <ConsoleWorkspaceGate>{children}</ConsoleWorkspaceGate>
          </main>
        </div>
      </AuthGuard>
    </ConsoleAccountTypeGuard>
  )
}
