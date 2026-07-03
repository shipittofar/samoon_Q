'use client'

/**
 * AdminSidebar — P8.9.4
 *
 * Redesigned with:
 * - Grouped nav sections (Operations / Content / Customers / Analytics / People / Platform / System)
 * - Lucide icons on every item
 * - Role chip in header
 * - Focus trap on mobile
 * - aria-expanded on mobile toggle handled by parent via aria-controls
 * - 44px+ touch targets
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
  X,
  LayoutDashboard,
  Home,
  LogOut,
  ShoppingBag,
  CalendarDays,
  ChefHat,
  Activity,
  UtensilsCrossed,
  Tag,
  Star,
  Heart,
  Contact,
  TrendingUp,
  BarChart3,
  Users,
  UserCog,
  Shield,
  KeyRound,
  Layers,
  GitBranch,
  Globe,
  ScrollText,
  Bell,
  Settings,
  Zap,
  Plus,
} from 'lucide-react'
import { cn } from '@/utils'
import { useAdminModuleNav, useLogout } from '@/hooks'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { Button } from '@/components/ui/Button'
import type { NavItem } from '@/types'

// ── Icon registry ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingBag,
  CalendarDays,
  ChefHat,
  Activity,
  UtensilsCrossed,
  Tag,
  Star,
  Heart,
  Contact,
  TrendingUp,
  BarChart3,
  Users,
  UserCog,
  Shield,
  KeyRound,
  Layers,
  GitBranch,
  Globe,
  ScrollText,
  Bell,
  Settings,
  LayoutDashboard,
  Zap,
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'New Menu Item', href: '/console/menu', icon: UtensilsCrossed },
  { label: 'New Promotion', href: '/console/promotions', icon: Tag },
  { label: 'New Reservation', href: '/console/reservations', icon: CalendarDays },
  { label: 'Invite Staff', href: '/console/staff', icon: Users },
] as const

function QuickActions({ onClose }: { onClose: () => void }) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] px-2 pt-2 pb-1">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] opacity-60 select-none flex items-center gap-1">
        <Zap className="h-3 w-3" />
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-1">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
          <a
            key={href}
            href={href}
            onClick={onClose}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors min-h-[36px] border border-[var(--border)] border-dashed"
          >
            <Plus className="h-3 w-3 shrink-0 text-orange-500" />
            <span className="truncate leading-tight">{label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function NavIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name ? (ICON_MAP[name] ?? LayoutDashboard) : LayoutDashboard
  return <Icon className={className ?? 'h-3.5 w-3.5 shrink-0'} />
}

// ── Group ordering ────────────────────────────────────────────────────────────

const GROUP_ORDER = ['Operations', 'Content', 'Customers', 'Analytics', 'People', 'Platform', 'System']

function groupNavItems(items: NavItem[]): { group: string; items: NavItem[] }[] {
  const map = new Map<string, NavItem[]>()
  for (const item of items) {
    const g = item.group ?? 'Other'
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  const ordered: { group: string; items: NavItem[] }[] = []
  for (const g of GROUP_ORDER) {
    if (map.has(g)) ordered.push({ group: g, items: map.get(g)! })
  }
  for (const [g, its] of map) {
    if (!GROUP_ORDER.includes(g)) ordered.push({ group: g, items: its })
  }
  return ordered
}

// ── Role chip ─────────────────────────────────────────────────────────────────

function RoleChip() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const getRoles = useRbacStore((s) => s.getRolesForTenant)
  const user = useAuthStore((s) => s.user)
  if (!tenantId || !user) return null
  const roles = getRoles(tenantId)
  if (roles.length === 0) return null
  const label = roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' · ')
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 truncate max-w-[140px]">
      {label}
    </span>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export interface AdminSidebarProps {
  open: boolean
  onClose: () => void
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = useAdminModuleNav()
  const { mutate: logout, isPending: isLoggingOut } = useLogout()
  const sidebarRef = useRef<HTMLElement>(null)

  // Focus trap on mobile when open
  useEffect(() => {
    if (!open) return
    const el = sidebarRef.current
    if (!el) return
    const focusables = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    first?.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const groups = groupNavItems(navItems)

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
        ref={sidebarRef}
        id="admin-sidebar"
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex w-60 flex-col bg-[var(--card)] border-e border-[var(--border)] pt-16 transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto lg:shrink-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Admin navigation"
      >
        {/* Header: identity */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
              <LayoutDashboard className="h-4 w-4 text-orange-500 shrink-0" />
              Admin Panel
            </span>
            <RoleChip />
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2" role="navigation" aria-label="Admin menu">
          {/* Always-visible dashboard link */}
          <div className="px-2 mb-1">
            <Link
              href="/console"
              onClick={onClose}
              aria-current={pathname === '/console' ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 min-h-[44px]',
                pathname === '/console'
                  ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Grouped nav items */}
          {groups.map(({ group, items }) => (
            <div key={group} className="px-2 mb-3">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] opacity-60 select-none">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 min-h-[44px]',
                        isActive
                          ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                          : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
                      )}
                    >
                      <NavIcon
                        name={item.icon}
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-orange-500' : 'text-[var(--fg-muted)]',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Quick actions */}
        <QuickActions onClose={onClose} />

        {/* Footer: public site + logout */}
        <div className="shrink-0 border-t border-[var(--border)] p-2 space-y-0.5">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-all duration-150 min-h-[44px]"
            aria-label="Return to the customer-facing public website"
          >
            <Home className="h-4 w-4 shrink-0 text-orange-500" />
            <span>Back to Public Site</span>
          </Link>
          <button
            type="button"
            onClick={() => logout(undefined, { onSuccess: () => router.push('/login') })}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--fg-muted)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-150 disabled:opacity-50 min-h-[44px]"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
