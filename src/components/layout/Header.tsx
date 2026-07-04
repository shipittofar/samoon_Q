'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Bell, User, Menu, X, Sun, Moon, Globe, ChevronDown, LogOut, Settings, Package, Heart, MapPin, Monitor } from 'lucide-react'
import { useCartStore, useAuthStore, useNotificationStore, useLangStore, useThemeStore, useTenantStore } from '@/stores'
import type { TenantTheme } from '@/types'
import type { NavItem } from '@/types'
import { useLogout, useSetLocale, useModuleNav, usePermission } from '@/hooks'

// Platform-level nav shown on the root site (when no tenant is active).
// Replaces restaurant-specific module nav on the public marketplace surface.
const PLATFORM_NAV: NavItem[] = [
  { href: '/discover', label: 'Discover' },
  { href: '/reservation', label: 'Reservations' },
  { href: '/restaurant', label: 'For Business' },
]
import { cn, formatCurrency } from '@/utils'
import { Avatar } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { NotificationCenter } from '@/components/notification/NotificationCenter'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { BranchSelector } from '@/components/common/BranchSelector'
import toast from 'react-hot-toast'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
]

export function Header() {
  const pathname = usePathname()
  const { isAuthenticated, user } = useAuthStore()
  const { getItemCount, setOpen: setCartOpen, getTotal } = useCartStore()
  const { unreadCount } = useNotificationStore()
  const { locale } = useLangStore()
  const setLocale = useSetLocale()
  const { theme, setTheme } = useThemeStore()
  const { tenant } = useTenantStore()
  const { mutate: logout } = useLogout()
  const canAccessConsole = usePermission('dashboard:access')
  // useModuleNav() returns header nav filtered by resolved feature flags (P6.8).
  // Items with featureFlagKey are hidden when the flag is false (e.g. reservations
  // disabled for food_truck, loyalty disabled for bar).
  // On the root site (default tenant) we show PLATFORM_NAV instead of the
  // restaurant-specific module nav (P8.8.2 — Phase I).
  const moduleNav = useModuleNav()
  const navLinks = tenant.slug === 'default' ? PLATFORM_NAV : moduleNav
  const logoUrl = (tenant.settings?.theme as TenantTheme | undefined)?.logoUrl
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // True only on the landing page before the user scrolls — the header is
  // transparent over the dark hero image, so we flip all text to white for
  // WCAG AA contrast (dark tokens on dark background = ~1:1 contrast ratio).
  const isTransparentHero = pathname === '/' && !scrolled

  const cartCount = getItemCount()

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

  return (
    <>
      {/* Skip-to-content — WCAG 2.4.1 Level A. Visually hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-xl focus:font-medium focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-40 transition-all duration-300',
        scrolled
          ? 'bg-[var(--card)]/90 backdrop-blur-xl border-b border-[var(--border)] shadow-sm'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${tenant.name} logo`}
                width={120}
                height={32}
                className="h-8 w-auto object-contain dark:brightness-0 dark:invert"
              />
            ) : (
              <>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <span className="text-white text-sm font-bold">S</span>
                </div>
                <span className={cn(
                  'font-[var(--font-display)] text-xl font-bold transition-colors',
                  isTransparentHero
                    ? 'text-white group-hover:text-orange-300'
                    : 'text-[var(--fg)] group-hover:text-orange-500',
                )}>
                  Savor
                </span>
              </>
            )}
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  pathname.startsWith(link.href)
                    ? isTransparentHero
                      ? 'bg-white/15 text-white'
                      : 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                    : isTransparentHero
                      ? 'text-white/80 hover:text-white hover:bg-white/10'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className={cn('hidden sm:flex', isTransparentHero && 'text-white/80 hover:text-white hover:bg-white/10')}
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

            {/* Language Switcher */}
            <div className="relative hidden sm:block">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLangMenuOpen((v) => !v)}
                aria-label="Change language"
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

            {/* Notifications */}
            {isAuthenticated && (
              <ErrorBoundary feature="NotificationCenter">
                <NotificationCenter />
              </ErrorBoundary>
            )}
            {isAuthenticated && pathname.startsWith('/console') && (
              <ErrorBoundary feature="BranchSelector">
                <BranchSelector className="hidden sm:flex" />
              </ErrorBoundary>
            )}
            {isAuthenticated && pathname.startsWith('/console') && (
              <ErrorBoundary feature="NotificationBell">
                <NotificationBell tenantId={tenant?.id} />
              </ErrorBoundary>
            )}

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCartOpen(true)}
              className={cn('relative', isTransparentHero && 'text-white/80 hover:text-white hover:bg-white/10')}
              aria-label={`Cart with ${cartCount} items`}
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

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl p-1 hover:bg-[var(--card-hover)] transition-colors"
                  aria-label="User menu"
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
                      className="absolute end-0 top-full mt-2 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden"
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
                        ...(canAccessConsole ? [{ href: '/console', icon: Monitor, label: 'Business Console' }] : []),
                      ].map((item) => (
                        <Link key={item.href} href={item.href} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors">
                          <item.icon className="h-4 w-4 text-[var(--fg-muted)]" />
                          {item.label}
                        </Link>
                      ))}
                      <div className="border-t border-[var(--border)]">
                        <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-start">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(isTransparentHero && 'text-white/80 hover:text-white hover:bg-white/10')}
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="sm"
                    className={cn(isTransparentHero && 'bg-white/15 border border-white/30 text-white hover:bg-white/25 shadow-none')}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile toggle */}
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)} className="md:hidden" aria-label="Toggle menu">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[var(--card)] border-b border-[var(--border)] overflow-hidden"
          >
            <nav className="px-4 py-3 flex flex-col gap-1" aria-label="Mobile navigation">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    pathname.startsWith(link.href)
                      ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600'
                      : 'text-[var(--fg)] hover:bg-[var(--card-hover)]',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && pathname.startsWith('/console') && (
                <ErrorBoundary feature="BranchSelector">
                  <BranchSelector className="mt-1" />
                </ErrorBoundary>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)] mt-2">
                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                {LANGUAGES.map((lang) => (
                  <button key={lang.code} onClick={() => setLocale(lang.code)} className={cn('text-lg', locale === lang.code && 'opacity-100 scale-125', 'transition-all')}>
                    {lang.flag}
                  </button>
                ))}
              </div>
              {!isAuthenticated && (
                <div className="flex gap-2 pt-2">
                  <Link href="/login" className="flex-1"><Button variant="secondary" size="sm" className="w-full">Sign In</Button></Link>
                  <Link href="/register" className="flex-1"><Button size="sm" className="w-full">Get Started</Button></Link>
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
