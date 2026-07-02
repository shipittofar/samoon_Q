'use client'

/**
 * AdminSidebar — P8.4.2
 *
 * Persistent left-navigation sidebar for all /admin/* routes.
 * Renders the nav items returned by useAdminModuleNav(), which are already
 * filtered by the active tenant's feature flags and the current user's RBAC
 * permissions. Items the user cannot access are simply omitted.
 *
 * Responsive: visible as a fixed drawer on desktop; collapses off-screen on
 * mobile and is toggled via the open/onClose props from AdminLayout.
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { X, ChevronRight, LayoutDashboard, ExternalLink, Home, LogOut } from 'lucide-react'
import { cn } from '@/utils'
import { useAdminModuleNav, useLogout } from '@/hooks'
import { Button } from '@/components/ui/Button'

export interface AdminSidebarProps {
  open: boolean
  onClose: () => void
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = useAdminModuleNav()
  const { mutate: logout, isPending: isLoggingOut } = useLogout()

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

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex w-56 flex-col bg-[var(--card)] border-e border-[var(--border)] pt-16 transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto lg:shrink-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Admin navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
            <LayoutDashboard className="h-4 w-4 text-orange-500" />
            Admin Panel
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto p-2 space-y-0.5"
          role="navigation"
          aria-label="Admin menu"
        >
          {/* Always-visible dashboard home link */}
          <Link
            href="/admin"
            onClick={onClose}
            aria-current={pathname === '/admin' ? 'page' : undefined}
            className={cn(
              'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
              pathname === '/admin'
                ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
            )}
          >
            <span className="flex items-center gap-2">
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              Dashboard
            </span>
            {pathname === '/admin' && <ChevronRight className="h-3 w-3 shrink-0 text-orange-500" />}
          </Link>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                    : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
                )}
              >
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="h-3 w-3 shrink-0 text-orange-500" />}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar footer: public site + logout */}
        <div className="shrink-0 border-t border-[var(--border)] p-3 space-y-0.5">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-all duration-150 group"
            aria-label="Go to customer-facing site"
          >
            <Home className="h-3.5 w-3.5 shrink-0 text-orange-500 group-hover:text-orange-600" />
            <span>Back to Public Site</span>
          </Link>
          <button
            type="button"
            onClick={() => logout(undefined, { onSuccess: () => router.push('/login') })}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-150 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
