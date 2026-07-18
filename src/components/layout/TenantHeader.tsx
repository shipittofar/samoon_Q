'use client'

/**
 * P8.8.11.1 — Tenant-branded navigation header
 * P8.8.11.2 — Intelligent, data-driven, context-aware header
 *
 * This component is a pure renderer. All navigation business logic lives in
 * src/utils/navigation.ts → buildTenantNavigation(). No nav logic here.
 *
 * Features (P8.8.11.2):
 *   B  — Nav generated from buildTenantNavigation(), never hardcoded
 *   C  — Feature-flag items hidden automatically (via useModuleNav())
 *   D  — Single vs. multi-branch: "Locations" injected only when needed
 *   E  — "Explore Businesses" as the marketplace re-entry item
 *   F  — Business type badge (☕ Cafe, 🍽️ Restaurant, etc.) beside logo
 *   G  — Smart CTA awareness (not in header itself — in hero sections)
 *   H  — Active state: exact match for marketplace, startsWith for branches
 *   I  — Website Builder nav config wired via buildTenantNavigation()
 *   J  — Zero nav logic in this component
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ShoppingCart, User, Menu, X, Sun, Moon, Globe,
  ChevronDown, LogOut, Settings, Package, Heart, MapPin,
} from 'lucide-react'
import {
  useCartStore, useAuthStore, useLangStore, useThemeStore,
  useTenantStore, useBranchStore,
} from '@/stores'
import { useLogout, useSetLocale, useModuleNav } from '@/hooks'
import { cn, buildPublicCTAs, buildCustomerJourney } from '@/utils'
import { buildTenantNavigation, getBusinessTypeBadge } from '@/utils/navigation'
import { Avatar } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useHomepageLayout } from '@/hooks'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import { resolveSupportedLocales, getLanguageInfo } from '@/i18n/runtime'

// P9.5.1A Phase C: sourced from the config-driven supported-locale list +
// the language registry's native names, instead of a hardcoded literal.
const FLAG_BY_CODE: Record<string, string> = { en: '🇺🇸', fa: '🇮🇷', ar: '🇸🇦', zh: '🇨🇳', it: '🇮🇹', tr: '🇹🇷' }
const LANGUAGES = resolveSupportedLocales().map((code) => ({
  code,
  label: getLanguageInfo(code)?.nativeName ?? code,
  flag: FLAG_BY_CODE[code] ?? '🌐',
}))

export function TenantHeader() {
  const t = useTranslations('header')
  const pathname = usePathname()
  const { isAuthenticated, user } = useAuthStore()
  const { getItemCount, setOpen: setCartOpen } = useCartStore()
  const { locale } = useLangStore()
  const setLocale = useSetLocale()
  const { theme, setTheme } = useThemeStore()
  const { tenant } = useTenantStore()
  const activeBranch = useBranchStore((s) => s.activeBranch)
  const { mutate: logout } = useLogout()
  const tAuth = useTranslations('auth')

  // Feature-flag-filtered nav items from the active module.
  // useModuleNav() already applies feature flags — buildTenantNavigation receives
  // the filtered list so no second-pass filtering is needed here.
  const moduleNavItems = useModuleNav()

  // Website Builder nav config for this tenant's homepage layout (Phase I).
  // Optional — when undefined the module registry defaults are used.
  const { data: layout } = useHomepageLayout(tenant?.slug ?? '')
  const layoutNavConfig = layout?.navItems

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const prefersReducedMotion = useReducedMotion()

  const cartCount = getItemCount()
  const branchSlug = activeBranch?.slug

  // P8.8.11.4: journey nav priority — business-type-aware nav ordering hint.
  // Website Builder config (layoutNavConfig) overrides this when present.
  const featureFlags = useTenantStore((s) => s.featureFlags)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setUserMenuOpen(false)
    setLangMenuOpen(false)
  }, [pathname])

  // This is a tenant-branded storefront header — it has nothing meaningful
  // to render without a resolved tenant. All hooks above this point run
  // unconditionally (Rules of Hooks); everything below is plain computation,
  // so it's safe to bail out here rather than null-guard every `tenant.`
  // access individually.
  if (!tenant) return null

  const logoUrl = tenant.settings?.theme?.logoUrl
  const meta = tenant.settings?.marketplace
  const journeyCTAs = buildPublicCTAs({
    tenantSlug: tenant.slug,
    branchSlug,
    featureFlags,
    meta,
  })
  const journey = buildCustomerJourney({ businessTypes: tenant.businessTypes ?? [], ctas: journeyCTAs })

  // Phase J: buildTenantNavigation() owns all nav business logic.
  const navLinks = buildTenantNavigation({
    tenant,
    branchSlug,
    moduleNavItems,
    layoutNavConfig,
    journeyNavPriority: journey.navPriority,
  })

  // Phase F: business type badge (☕ Cafe, 🍽️ Restaurant, …)
  const businessBadge = getBusinessTypeBadge(tenant.businessTypes ?? [])

  // Phase H: active state — exact for marketplace, prefix for business routes.
  const isActive = (href: string): boolean =>
    href === '/discover' ? pathname === '/discover' : pathname.startsWith(href)

  const handleLogout = () => {
    logout(undefined, { onSuccess: () => toast.success(tAuth('logoutSuccess')) })
  }

  return (
    <>
      {/* Skip-to-content — WCAG 2.4.1 Level A */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-xl focus:font-medium focus:text-sm focus:shadow-lg"
      >
        {t('skipToMainContent')}
      </a>

      <header
        className={cn(
          'fixed top-0 inset-x-0 z-40 bg-[var(--card)]/95 backdrop-blur-xl border-b border-[var(--border)] transition-all duration-300',
          scrolled ? 'shadow-sm' : 'shadow-none',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* ── Phase C + F: Business logo + type badge + platform signature ── */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/${tenant.slug}`}
                className="flex items-center gap-2.5 group shrink-0"
                aria-label={t('tenantHomeAria', { name: tenant.name })}
              >
                {logoUrl ? (
                  <div className="relative h-8 w-24">
                    <Image
                      src={logoUrl}
                      alt={t('logoAlt', { name: tenant.name })}
                      fill
                      className="object-contain dark:brightness-0 dark:invert"
                      sizes="96px"
                    />
                  </div>
                ) : (
                  <>
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                      <span className="text-white text-sm font-bold">
                        {tenant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden sm:flex flex-col leading-none">
                      <span className="font-[var(--font-display)] text-base font-bold text-[var(--fg)] group-hover:text-orange-500 transition-colors truncate max-w-[140px]">
                        {tenant.name}
                      </span>
                      {/* Phase F: business type badge */}
                      {businessBadge && (
                        <span className="text-[10px] text-[var(--fg-subtle)] leading-tight mt-px">
                          {businessBadge}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Link>

              {/* Platform signature — subtle secondary identity */}
              <Link
                href="/discover"
                className="hidden sm:flex flex-col leading-none border-s border-[var(--border)] ps-3 text-[var(--fg-subtle)] hover:text-orange-500 transition-colors shrink-0"
                aria-label={t('poweredBySamoonAria')}
              >
                <span className="text-[9px] uppercase tracking-wide">{t('poweredBy')}</span>
                <span className="text-[11px] font-semibold">Samoon</span>
              </Link>
            </div>

            {/* ── Phase B + H: Desktop navigation ──────────────────────── */}
            <nav
              className="hidden md:flex items-center gap-0.5"
              aria-label={t('tenantNavigationAria', { name: tenant.name })}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive(link.href)
                      ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                      : link.isMarketplace
                        ? 'text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] hover:bg-[var(--card-hover)]'
                        : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* ── Actions ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5">

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={t('toggleThemeAria')}
                className="hidden sm:flex"
              >
                <AnimatePresence mode="wait">
                  {theme === 'dark' ? (
                    <motion.div key="sun" initial={{ rotate: prefersReducedMotion ? 0 : -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: prefersReducedMotion ? 0 : 90, opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}>
                      <Sun className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <motion.div key="moon" initial={{ rotate: prefersReducedMotion ? 0 : 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: prefersReducedMotion ? 0 : -90, opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}>
                      <Moon className="h-4 w-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>

              {/* Language switcher */}
              <div className="relative hidden sm:block">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLangMenuOpen((v) => !v)}
                  aria-label={t('changeLanguageAria')}
                  aria-expanded={langMenuOpen}
                >
                  <Globe className="h-4 w-4" />
                </Button>
                <AnimatePresence>
                  {langMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8, scale: prefersReducedMotion ? 1 : 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 8, scale: prefersReducedMotion ? 1 : 0.95 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                      className="absolute end-0 top-full mt-2 w-36 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50"
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

              {/* Cart */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCartOpen(true)}
                className="relative"
                aria-label={t('cartWithItemsAria', { count: cartCount })}
              >
                <ShoppingCart className="h-4 w-4" />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key="cart-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -end-0.5 h-4 min-w-4 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center px-1"
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              {/* User menu */}
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-xl p-1 hover:bg-[var(--card-hover)] transition-colors"
                    aria-label={t('userMenuAria')}
                    aria-expanded={userMenuOpen}
                  >
                    <Avatar src={user?.avatar} firstName={user?.first_name} lastName={user?.last_name} size="sm" />
                    <ChevronDown className={cn('h-3 w-3 text-[var(--fg-muted)] transition-transform hidden md:block', userMenuOpen && 'rotate-180')} />
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8, scale: prefersReducedMotion ? 1 : 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 8, scale: prefersReducedMotion ? 1 : 0.95 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                        className="absolute end-0 top-full mt-2 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50"
                      >
                        <div className="p-3 border-b border-[var(--border)]">
                          <p className="text-sm font-medium text-[var(--fg)]">{user?.first_name} {user?.last_name}</p>
                          <p className="text-xs text-[var(--fg-muted)] truncate">{user?.email}</p>
                        </div>
                        {[
                          { href: '/dashboard', icon: User, labelKey: 'myAccount' },
                          { href: '/dashboard/orders', icon: Package, labelKey: 'myOrders' },
                          { href: '/dashboard/favorites', icon: Heart, labelKey: 'favorites' },
                          { href: '/dashboard/addresses', icon: MapPin, labelKey: 'addresses' },
                          { href: '/dashboard/settings', icon: Settings, labelKey: 'settings' },
                        ].map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
                          >
                            <item.icon className="h-4 w-4 text-[var(--fg-muted)]" />
                            {t(item.labelKey)}
                          </Link>
                        ))}
                        <div className="border-t border-[var(--border)]">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-start"
                          >
                            <LogOut className="h-4 w-4" />
                            {t('signOut')}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm">{t('signIn')}</Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm">{t('getStarted')}</Button>
                  </Link>
                </div>
              )}

              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden"
                aria-label={mobileOpen ? t('closeMenuAria') : t('openMenuAria')}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Phase H: Mobile drawer ─────────────────────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[var(--card)] border-b border-[var(--border)] overflow-hidden"
            >
              <nav
                className="px-4 py-3 flex flex-col gap-1"
                aria-label={t('tenantMobileNavigationAria', { name: tenant.name })}
              >
                {/* Platform signature — mobile */}
                <Link
                  href="/discover"
                  className="flex items-center gap-1 px-4 py-2 text-xs text-[var(--fg-subtle)] hover:text-orange-500 transition-colors mb-1"
                >
                  {t('poweredBy')} <span className="font-semibold">Samoon</span>
                </Link>

                {navLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={cn(
                      'px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      isActive(link.href)
                        ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600'
                        : link.isMarketplace
                          ? 'text-[var(--fg-subtle)] hover:bg-[var(--card-hover)]'
                          : 'text-[var(--fg)] hover:bg-[var(--card-hover)]',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)] mt-2">
                  <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('toggleThemeAria')}>
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLocale(lang.code)}
                      className={cn('text-lg transition-all', locale === lang.code && 'scale-125')}
                      aria-label={t('switchToLanguageAria', { language: lang.label })}
                    >
                      {lang.flag}
                    </button>
                  ))}
                </div>

                {!isAuthenticated && (
                  <div className="flex gap-2 pt-2">
                    <Link href="/login" className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">{t('signIn')}</Button>
                    </Link>
                    <Link href="/register" className="flex-1">
                      <Button size="sm" className="w-full">{t('getStarted')}</Button>
                    </Link>
                  </div>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
