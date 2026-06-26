'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminContextBar } from '@/components/admin/AdminContextBar'
import { Button } from '@/components/ui/Button'

/**
 * Admin layout — Phase 3 (P3.2) / P7.13 / P8.4.2 / P8.7.5
 *
 * Wraps all /admin/* routes with:
 *   - AuthGuard: requires `dashboard:access` (staff/admin only; customers → home)
 *   - AdminSidebar: persistent left nav driven by useAdminModuleNav() (P8.4.2)
 *   - AdminContextBar: tenant/branch switchers for context-aware admin (P8.7.5)
 *   - AdminBreadcrumbs: contextual breadcrumb bar below the fixed header
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthGuard requiredPermission="dashboard:access" forbiddenPath="/">
      {/* Context + breadcrumb bar — fixed below the global header */}
      <div className="fixed top-16 inset-x-0 z-30 bg-[var(--bg)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-2 px-4 py-1.5 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 min-w-0">
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
          {/* Tenant & branch context switchers */}
          <AdminContextBar />
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
