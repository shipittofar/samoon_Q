'use client'

/**
 * AdminHeader — P8.9.4 Phase E
 *
 * Admin-specific top bar that replaces the consumer-facing Header for all
 * /admin/* routes. Shows:
 *   - Logo + "Admin" label (links to /admin)
 *   - Mock-mode environment badge (when NEXT_PUBLIC_USE_MOCK=true)
 *   - Notifications (admin-scoped bell)
 *   - Theme toggle
 *   - User avatar + name chip
 *   - Link back to public site
 */

import Link from 'next/link'
import { ExternalLink, Sun, Moon, Monitor } from 'lucide-react'
import { useAuthStore, useThemeStore, useTenantStore } from '@/stores'
import { Avatar } from '@/components/ui'
import { cn } from '@/utils'

const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

export function AdminHeader() {
  const user = useAuthStore((s) => s.user)
  const { theme, setTheme } = useThemeStore()
  const tenant = useTenantStore((s) => s.tenant)

  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <>
      {/* Skip-to-content — WCAG 2.4.1 Level A */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-xl focus:font-medium focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header
        className="fixed top-0 inset-x-0 z-40 h-16 flex items-center bg-[var(--card)]/90 backdrop-blur-xl border-b border-[var(--border)] shadow-sm"
        role="banner"
      >
        <div className="flex items-center justify-between w-full px-4 gap-4">
          {/* Left: logo + admin label + env badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/admin"
              className="flex items-center gap-2 group"
              aria-label={`${tenant?.name ?? 'Savor'} Admin — go to dashboard`}
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                <span className="text-white text-sm font-bold">S</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-[var(--fg)] group-hover:text-orange-500 transition-colors">
                  {tenant?.name ?? 'Savor'}
                </span>
                <span className="text-[10px] font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  Admin
                </span>
              </div>
            </Link>

            {IS_MOCK && (
              <span
                className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                title="Mock mode: no real backend calls are made"
              >
                Mock
              </span>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setTheme(nextTheme)}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
              aria-label={`Switch to ${nextTheme} theme`}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>

            {/* Public site link — deep-links to this tenant's public page when slug is available */}
            <Link
              href={tenant?.slug ? `/${tenant.slug}` : '/'}
              className="hidden sm:flex h-9 items-center gap-1.5 px-3 rounded-xl text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
              aria-label={tenant?.name ? `View ${tenant.name} public site` : 'Open public-facing website'}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Public Site</span>
            </Link>

            {/* User chip */}
            {user && (
              <div className="flex items-center gap-2 ps-2 ms-1 border-s border-[var(--border)]">
                <Avatar
                  src={user.avatar}
                  firstName={user.first_name}
                  lastName={user.last_name}
                  size="sm"
                />
                <div className="hidden md:flex flex-col leading-tight">
                  <span className="text-sm font-medium text-[var(--fg)] truncate max-w-[120px]">
                    {user.first_name} {user.last_name}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
