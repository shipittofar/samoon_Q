'use client'

/**
 * P8.8.11.1 — Tenant-branded navigation header
 *
 * Replaces the shared platform Header on all tenant and branch pages.
 * Shows the business logo as the primary identity and "Powered by Savor"
 * as a subtle secondary signature.
 *
 * Nav links are built from useModuleNav() (already feature-flag filtered)
 * and converted to branch-aware full paths so every link stays inside the
 * current /{tenantSlug}/{branchSlug}/ context.
 *
 * The platform Header is left unchanged and continues to serve /, /discover,
 * /admin, /dashboard, and all other non-tenant routes.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, User, Menu, X, Sun, Moon, Globe,
  ChevronDown, LogOut, Settings, Package, Heart, MapPin,
} from 'lucide-react'
import { useCartStore, useAuthStore, useLangStore, useThemeStore, useTenantStore, useBranchStore } from '@/stores'
import type { TenantTheme } from '@/types'
import { useLogout, useSetLocale, useModuleNav } from '@/hooks'
import { cn } from '@/utils'
import { Avatar } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
]

export function TenantHeader() {
  const pathname = usePathname()
  const { isAuthenticated, user } = useAuthStore()
  const { getItemCount, setOpen: setCartOpen } = useCartStore()
  const { locale } = useLangStore()
  const setLocale = useSetLocale()
  const { theme, setTheme } = useThemeStore()
  const { tenant } = useTenantStore()
  const activeBranch = useBranchStore((s) => s.activeBranch)
  const { mutate: logout } = useLogout()
  // Feature-flag-filtered nav items from the active module (same hook Header uses).
  // Items with disabled feature flags are already removed — no additional filtering needed.
  const moduleNav = useModuleNav()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const cartCount = getItemCount()
  const logoUrl = (tenant.settings?.theme as TenantTheme | undefined)?.logoUrl
  const tenantSlug = tenant.slug
  const branchSlug = activeBranch?.slug

  // Convert module nav items (relative paths like "/menu") to full branch-aware paths.
  // Discover is always the first item — it links back to the platform marketplace.
  const branchNavLinks = moduleNav.map((item) => ({
    ...item,
    href: branchSlug
      ? `/${tenantSlug}/${branchSlug}${item.href}`
      : `/${tenantSlug}${item.href}`,
    baseHref: item.href,
  }))
  const navLinks = [
    { href: '/discover', label: 'Discover', baseHref: '/discover' },
    ...branchNavLinks,
  ]

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

  const handleLogout = () => {
    logout(undefined, { onSuccess: () => toast.success('See you next time!') })
  }

  const isActive = (href: string) =>
    href === '/discover' ? pathname === '/discover' : pathname.startsWith(href)

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
        className={cn(
          'fixed top-0 inset-x-0 z-40 bg-[var(--card)]/95 backdrop-blur-xl border-b border-[var(--border)] transition-all duration-300',
          scrolled ? 'shadow-sm' : 'shadow-none',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* ── Business logo + platform signature ───────────────────── */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/${tenantSlug}`}
                className="flex items-center gap-2 group shrink-0"
                aria-label={`${tenant.name} home`}
              >
                {logoUrl ? (
                  <div className="relative h-8 w-24">
                    <Image
                      src={logoUrl}
                      alt={`${tenant.name} logo`}
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
                    <span className="font-[var(--font-display)] text-lg font-bold text-[var(--fg)] group-hover:text-orange-500 transition-colors hidden sm:block truncate max-w-[160px]">
                      {tenant.name}
                    </span>
                  </>
                )}
              </Link>

              {/* Powered by Savor — subtle platform signature */}
              <Link
                href="/discover"
                className="hidden sm:flex flex-col leading-none border-s border-[var(--border)] ps-3 text-[var(--fg-subtle)] hover:text-orange-500 transition-colors shrink-0"
                aria-label="Powered by Savor — browse the marketplace"
              >
                <span className="text-[9px] uppercase tracking-wide">Powered by</span>
                <span className="text-[11px] font-semibold">Savor</span>
              </Link>
            </div>

            {/* ── Desktop navigation ────────────────────────────────────── */}
            <nav className="hidden md:flex items-center gap-0.5" aria-label={`${tenant.name} navigation`}>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive(link.href)
                      ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                      : link.href === '/discover'
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
                aria-label="Toggle theme"
                className="hidden sm:flex"
              >
                <AnimatePresence mode="wait">
                  {theme === 'dark' ? (
                    <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <Sun className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
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
                  aria-label="Change language"
                  aria-expanded={langMenuOpen}
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
                aria-label={`Cart, ${cartCount} item${cartCount !== 1 ? 's' : ''}`}
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
                    aria-label="User menu"
                    aria-expanded={userMenuOpen}
                  >
                    <Avatar src={user?.avatar} firstName={user?.first_name} lastName={user?.last_name} size="sm" />
                    <ChevronDown className={cn('h-3 w-3 text-[var(--fg-muted)] transition-transform hidden md:block', userMenuOpen && 'rotate-180')} />
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute end-0 top-full mt-2 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50"
                      >
                        <div className="p-3 border-b border-[var(--border)]">
                          <p className="text-sm font-medium text-[var(--fg)]">{user?.first_name} {user?.last_name}</p>
                          <p className="text-xs text-[var(--fg-muted)] truncate">{user?.email}</p>
                        </div>
                        {[
                          { href: '/dashboard', icon: User, label: 'My Account' },
                          { href: '/dashboard/orders', icon: Package, label: 'My Orders' },
                          { href: '/dashboard/favorites', icon: Heart, label: 'Favorites' },
                          { href: '/dashboard/addresses', icon: MapPin, label: 'Addresses' },
                          { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
                        ].map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
                          >
                            <item.icon className="h-4 w-4 text-[var(--fg-muted)]" />
                            {item.label}
                          </Link>
                        ))}
                        <div className="border-t border-[var(--border)]">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-start"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm">Sign In</Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm">Get Started</Button>
                  </Link>
                </div>
              )}

              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Mobile drawer ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[var(--card)] border-b border-[var(--border)] overflow-hidden"
            >
              <nav className="px-4 py-3 flex flex-col gap-1" aria-label={`${tenant.name} mobile navigation`}>
                {/* Platform signature — mobile */}
                <Link
                  href="/discover"
                  className="flex items-center gap-1 px-4 py-2 text-xs text-[var(--fg-subtle)] hover:text-orange-500 transition-colors mb-1"
                >
                  Powered by <span className="font-semibold">Savor</span>
                </Link>

                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={cn(
                      'px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      isActive(link.href)
                        ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600'
                        : link.href === '/discover'
                          ? 'text-[var(--fg-subtle)] hover:bg-[var(--card-hover)]'
                          : 'text-[var(--fg)] hover:bg-[var(--card-hover)]',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)] mt-2">
                  <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLocale(lang.code)}
                      className={cn('text-lg transition-all', locale === lang.code && 'scale-125')}
                      aria-label={`Switch to ${lang.label}`}
                    >
                      {lang.flag}
                    </button>
                  ))}
                </div>

                {!isAuthenticated && (
                  <div className="flex gap-2 pt-2">
                    <Link href="/login" className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">Sign In</Button>
                    </Link>
                    <Link href="/register" className="flex-1">
                      <Button size="sm" className="w-full">Get Started</Button>
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
