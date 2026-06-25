'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { Button } from '@/components/ui/Button'

/**
 * Admin layout — Phase 3 (P3.2) / P7.13 / P8.4.2
 *
 * Wraps all /admin/* routes with:
 *   - AuthGuard: requires `dashboard:access` (staff/admin only; customers → home)
 *   - AdminSidebar: persistent left nav driven by useAdminModuleNav() (P8.4.2)
 *   - AdminBreadcrumbs: contextual breadcrumb bar below the fixed header
 *
 * P8.4.2: Added AdminSidebar — previously useAdminModuleNav() existed but was
 * never rendered, leaving all admin routes navigable only by direct URL.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthGuard requiredPermission="dashboard:access" forbiddenPath="/">
      {/* Breadcrumb bar — fixed below the global header */}
      <div className="fixed top-16 inset-x-0 z-30 bg-[var(--bg)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="flex items-center gap-2 px-4 py-1.5 max-w-7xl mx-auto">
          {/* Mobile sidebar toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden shrink-0"
            aria-label="Open admin menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <AdminBreadcrumbs />
        </div>
      </div>

      {/* Body: sidebar + page content */}
      <div className="flex pt-28 min-h-screen">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 pb-8 lg:ps-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
