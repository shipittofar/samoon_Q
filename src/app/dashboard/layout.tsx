'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, Heart, MapPin, Calendar, Settings,
  User, LogOut, ChevronRight, Monitor, type LucideIcon
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores'
import { useLogout, useHasDashboardAccess } from '@/hooks'
import { cn } from '@/utils'
import { getDashboardNav } from '@/modules/registry'
import toast from 'react-hot-toast'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Heart,
  MapPin,
  Calendar,
  Settings,
}

// Maps DASHBOARD_MODULE.navItems (src/modules/registry.ts) hrefs to `dashboard`
// namespace keys. The registry itself stays English-only (shared module
// architecture, out of localization scope) — this local map is how the
// customer-facing sidebar renders translated labels without touching it.
const NAV_LABEL_KEYS: Record<string, string> = {
  '/dashboard': 'overview',
  '/dashboard/orders': 'orders',
  '/dashboard/favorites': 'favorites',
  '/dashboard/addresses': 'addresses',
  '/dashboard/reservations': 'reservations',
  '/dashboard/settings': 'settings',
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const { mutate: logout } = useLogout()
  const canAccessConsole = useHasDashboardAccess()
  const t = useTranslations('dashboard')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) return null

  const handleLogout = () => {
    logout(undefined, { onSuccess: () => { toast.success(t('loggedOut')); router.push('/') } })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <aside className="lg:w-72 shrink-0">
              {/* Profile Card */}
              <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar src={user?.avatar} firstName={user?.first_name} lastName={user?.last_name} size="lg" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--fg)] truncate">{user?.first_name} {user?.last_name}</p>
                    <p className="text-sm text-[var(--fg-muted)] truncate">{user?.email}</p>
                  </div>
                </div>
                <Link href="/dashboard/settings">
                  <Button variant="secondary" size="sm" className="w-full" leftIcon={<User className="h-3.5 w-3.5" />}>
                    {t('editProfile')}
                  </Button>
                </Link>
              </div>

              {/* Nav */}
              <nav className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
                {getDashboardNav().map((item) => {
                  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                  const IconComponent = item.icon ? (ICON_MAP[item.icon] ?? null) : null
                  const labelKey = NAV_LABEL_KEYS[item.href]
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center justify-between px-4 py-3.5 text-sm font-medium transition-colors border-b border-[var(--border)] last:border-0',
                        active
                          ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]',
                      )}
                    >
                      <span className="flex items-center gap-3">
                        {IconComponent && <IconComponent className={cn('h-4 w-4', active ? 'text-orange-500' : 'text-[var(--fg-subtle)]')} />}
                        {labelKey ? t(labelKey) : item.label}
                      </span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-orange-500" />}
                    </Link>
                  )
                })}
                {canAccessConsole && (
                  <Link
                    href="/console"
                    className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors border-t border-[var(--border)]"
                  >
                    <Monitor className="h-4 w-4" />
                    {t('businessConsole')}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t('signOut')}
                </button>
              </nav>
            </aside>

            {/* Content */}
            <motion.main
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-w-0"
            >
              {children}
            </motion.main>
          </div>
        </div>
      </div>
    </div>
  )
}
