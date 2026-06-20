'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore, useThemeStore, useLangStore, useFavoritesStore, useTenantStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { userService } from '@/services/combined.service'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: (count, err: any) => {
          if (err?.response?.status === 401) return false
          return count < 2
        },
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined
function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useThemeStore()
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else if (theme === 'light') root.classList.remove('dark')
    else {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', sys)
    }
  }, [theme])
  return <>{children}</>
}

function RTLProvider({ children }: { children: ReactNode }) {
  const { locale } = useLangStore()
  useEffect(() => {
    document.documentElement.dir = ['fa', 'ar'].includes(locale) ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
  }, [locale])
  return <>{children}</>
}

// ── Bootstrap stubs — TEMPORARY (Phase 1B.1 / 1B.2 pending) ─────────────────
// Replace each stub with a real initializer call when its phase ships:
//   P1B.1 → RBAC initializer calls useTenantStore.getState().setRbacInitialized(true)
//   P1B.2 → Feature flag initializer calls useTenantStore.getState().setFeatureFlagsInitialized(true)
// When a real initializer is in place, remove the corresponding line from BOOTSTRAP_STUBS.
const BOOTSTRAP_STUBS = {
  rbacInitialized: true,         // TEMPORARY STUB — remove when P1B.1 RBAC initializer ships
  featureFlagsInitialized: true, // TEMPORARY STUB — remove when P1B.2 feature flag initializer ships
} as const

/**
 * Coordinates the full app bootstrap sequence at startup (P1B.6).
 *
 * Sequence:
 *   1. loadTenant() — resolves tenant; sets tenantState to 'ready' or 'fallback'
 *   2. setRbacInitialized — sourced from BOOTSTRAP_STUBS until P1B.1 ships its real initializer
 *   3. setFeatureFlagsInitialized — sourced from BOOTSTRAP_STUBS until P1B.2 ships
 *
 * After this sequence, useSystemReady().canExecute becomes true and all
 * Phase 1B systems (RBAC, feature flags, routing) are permitted to execute.
 *
 * Phase 1B (P1B.3): middleware will inject X-Tenant-Slug from the subdomain;
 * this bootstrapper will pass the slug to loadTenant() at that point.
 */
function TenantBootstrapper({ children }: { children: ReactNode }) {
  const { loadTenant, setRbacInitialized, setFeatureFlagsInitialized } = useTenantStore()
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    loadTenant().then(() => {
      setRbacInitialized(BOOTSTRAP_STUBS.rbacInitialized)
      setFeatureFlagsInitialized(BOOTSTRAP_STUBS.featureFlagsInitialized)
    })
  }, [loadTenant, setRbacInitialized, setFeatureFlagsInitialized])
  return <>{children}</>
}

function AuthBootstrapper({ children }: { children: ReactNode }) {
  const { setUser, setLoading } = useAuthStore()
  const setFavorites = useFavoritesStore((s) => s.setFavorites)
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) { setLoading(false); return }
    authService.getMe().then((user) => {
      setUser(user)
      userService.getFavorites().then(setFavorites).catch(() => {})
    }).catch(() => setLoading(false))
    const handleLogout = () => setUser(null)
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [setUser, setLoading, setFavorites])
  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RTLProvider>
          <TenantBootstrapper>
            <AuthBootstrapper>
              {children}
              <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '0.875rem' }, success: { iconTheme: { primary: '#f97316', secondary: '#fff' } } }} />
            </AuthBootstrapper>
          </TenantBootstrapper>
        </RTLProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
