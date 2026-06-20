'use client'

/**
 * AppShell — Phase 2 (P2.4)
 *
 * Sidebar + content shell for authenticated dashboard views.
 * Navigation is derived from getDashboardNav() via useDashboardNav() and
 * filtered by RBAC (dashboard:access permission). Users without the permission
 * see an empty sidebar; the page itself handles further access control.
 *
 * Responsive: sidebar collapses to a drawer on mobile via the toggle button.
 * All styling via CSS tokens only.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import {
  LayoutDashboard, Package, Heart, MapPin, Calendar, Settings,
  Menu, X, ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils'
import { useDashboardNav } from '@/hooks'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui'
import { useAuthStore } from '@/stores'

// ── Icon map ──────────────────────────────────────────────────────────────────
// Maps NavItem.icon string names to lucide-react components.
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Heart,
  MapPin,
  Calendar,
  Settings,
}

// ── DashboardSidebar ─────────────────────────────────────────────────────────

interface DashboardSidebarProps {
  open: boolean
  onClose: () => void
}

function DashboardSidebar({ open, onClose }: DashboardSidebarProps) {
  const pathname = usePathname()
  const navItems = useDashboardNav()
  const user = useAuthStore((s) => s.user)

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex w-64 flex-col bg-[var(--card)] border-e border-[var(--border)] transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Dashboard navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5">
            {user && (
              <Avatar
                src={user.avatar}
                firstName={user.first_name}
                lastName={user.last_name}
                size="sm"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--fg)] truncate">
                {user ? `${user.first_name} ${user.last_name}` : 'My Account'}
              </p>
              {user?.role && (
                <p className="text-xs text-[var(--fg-muted)] capitalize">{user.role}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="lg:hidden shrink-0"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" role="navigation">
          {navItems.map((item) => {
            const Icon = item.icon ? ICON_MAP[item.icon] : null
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && <ChevronRight className="h-3 w-3 shrink-0 opacity-70" />}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

// ── AppShell ─────────────────────────────────────────────────────────────────

export interface AppShellProps {
  children: ReactNode
  /** Page title displayed in the topbar. */
  title?: string
}

/**
 * AppShell wraps dashboard pages with a collapsible sidebar and a topbar.
 * Use in place of MainLayout for authenticated dashboard routes.
 *
 * @example
 * // app/dashboard/page.tsx
 * export default function DashboardPage() {
 *   return <AppShell title="Overview">{content}</AppShell>
 * }
 */
export function AppShell({ children, title }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 bg-[var(--card)]/90 backdrop-blur-xl border-b border-[var(--border)] shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          {title && (
            <h1 className="text-sm font-semibold text-[var(--fg)] truncate">{title}</h1>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
