'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminContextBar } from '@/components/admin/AdminContextBar'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Button } from '@/components/ui/Button'

/**
 * Admin layout — P8.9.4
 *
 * Renders an admin-specific chrome instead of the consumer Header:
 *   - AdminHeader: logo, env badge, notifications, theme, user chip (P8.9.4 Phase E)
 *   - AdminContextBar: tenant + branch switchers (P8.7.5)
 *   - AdminBreadcrumbs: contextual breadcrumb showing path from /admin (P8.9.4 fixes C4/H10)
 *   - AdminSidebar: grouped nav with icons + role chip + focus trap (P8.9.4 Phase F)
 *   - AuthGuard: staff/admin only; customers → public home
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthGuard requiredPermission="dashboard:access" forbiddenPath="/">
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
              aria-label="Open admin menu"
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

      {/* Body: sidebar + page content */}
      <div className="flex pt-28 min-h-screen">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main id="main-content" className="flex-1 min-w-0 px-4 sm:px-6 pb-8 lg:ps-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
