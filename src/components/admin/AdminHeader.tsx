'use client'

/**
 * AdminHeader — P8.9.4 Phase E
 *
 * Admin-specific top bar that replaces the consumer-facing Header for all
 * /console/* routes. Shows:
 *   - Logo + "Admin" label (links to /console)
 *   - Mock-mode environment badge (when NEXT_PUBLIC_USE_MOCK=true)
 *   - Notifications (admin-scoped bell)
 *   - Theme toggle
 *   - User avatar + name chip
 *   - Link back to public site
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, Sun, Moon, Monitor, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useAuthStore, useThemeStore, useLangStore, useRbacStore } from '@/stores'
import { useLogout, useSetLocale, useModuleNav, usePermission } from '@/hooks'
import { useConsoleTenantId } from '@/hooks/console-workspace'
import { getTenantDisplayName } from '@/lib/console-tenant-display'
import { Avatar } from '@/components/ui'
import { cn } from '@/utils'
import { Button } from '@/components/ui/Button'
import { resolveSupportedLocales, getLanguageInfo } from '@/i18n/runtime'



const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const FLAG_BY_CODE: Record<string, string> = { en: '🇺🇸', fa: '🇮🇷', ar: '🇸🇦', zh: '🇨🇳', it: '🇮🇹', tr: '🇹🇷' }
const LANGUAGES = resolveSupportedLocales().map((code) => ({
  code,
  label: getLanguageInfo(code)?.nativeName ?? code,
  flag: FLAG_BY_CODE[code] ?? '🌐',
}))

export function AdminHeader() {
  const pathname = usePathname()
  const setLocale = useSetLocale()
  const { locale } = useLangStore()
  const user = useAuthStore((s) => s.user)
  const { theme, setTheme } = useThemeStore()
  const activeTenantId = useConsoleTenantId()
  const sessionMemberships = useRbacStore((s) => s.sessionMemberships)
  const tenantDisplayName = getTenantDisplayName(activeTenantId, { memberships: sessionMemberships })
  const tenantSlug =
    activeTenantId
      ? sessionMemberships?.find((m) => m.tenantId === activeTenantId)?.tenantSlug ?? ''
      : ''
  const t = useTranslations('console')
  const tHeader = useTranslations('header')
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const isTransparentHero = pathname === '/' && !scrolled



  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <>
      {/* Skip-to-content — WCAG 2.4.1 Level A */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-xl focus:font-medium focus:text-sm focus:shadow-lg"
      >
        {tHeader('skipToMainContent')}
      </a>

      <header
        className="fixed top-0 inset-x-0 z-40 h-16 flex items-center bg-[var(--card)]/90 backdrop-blur-xl border-b border-[var(--border)] shadow-sm"
        role="banner"
      >
        <div className="flex items-center justify-between w-full px-4 gap-4">
          {/* Left: logo + admin label + env badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/console"
              className="flex items-center gap-2 group"
              aria-label={t('adminConsoleLinkAria', { name: tenantDisplayName || 'Samoon' })}
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                <span className="text-white text-sm font-bold">S</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-[var(--fg)] group-hover:text-orange-500 transition-colors">
                  {tenantDisplayName || 'Samoon'}
                </span>
                <span className="text-[10px] font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  {t('admin')}
                </span>
              </div>
            </Link>

            {IS_MOCK && (
              <span
                className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                title={t('mockModeTitle')}
              >
                {t('mockBadge')}
              </span>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            {/* Language Switcher */}
            <div className="relative block">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLangMenuOpen((v) => !v)}
                aria-label={t('changeLanguageAria')}
                className={cn(isTransparentHero && 'text-white/80 hover:text-white hover:bg-white/10')}
              >
                <Globe className="h-4 w-4" />
              </Button>
              <AnimatePresence>
                {langMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute end-0 top-full mt-2 w-36 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden"
                  >
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setLocale(lang.code); setLangMenuOpen(false) }}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-start transition-colors',
                          locale === lang.code
                            ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600'
                            : 'hover:bg-[var(--card-hover)] text-[var(--fg)]',
                        )}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>


            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setTheme(nextTheme)}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
              aria-label={t('switchToThemeAria', { theme: nextTheme })}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>

            {/* Public site link — deep-links to this tenant's public page when slug is available */}
            <Link
              href={tenantSlug ? `/${tenantSlug}` : '/'}
              className="hidden sm:flex h-9 items-center gap-1.5 px-3 rounded-xl text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
              aria-label={tenantDisplayName ? t('viewPublicSiteAria', { name: tenantDisplayName }) : t('openPublicWebsiteAria')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t('publicSite')}</span>
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
                  <span className="text-sm font-medium text-[var(--fg)] truncate max-w-[220px]">
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
