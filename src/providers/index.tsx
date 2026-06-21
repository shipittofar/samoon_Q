'use client'

import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { useAuthStore, useThemeStore, useLangStore, useFavoritesStore, useTenantStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { userService } from '@/services/combined.service'
import { featureFlagsService } from '@/services/feature-flags.service'
import { useNotificationWebSocket, useFcmRegistration } from '@/hooks/client'
import { STALE_TIME, CACHE_TIME } from '@/constants'
import { ServiceWorkerUpdateBanner } from '@/components/pwa/ServiceWorkerUpdateBanner'
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator'
import { setSentryUser, clearSentryUser, setSentryTenant, setEnvironmentTags } from '@/lib/sentry'
import type { TenantTheme } from '@/types'

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      // P4.3.3 — Route query failures to the toast system.
      // Ignored: cancelled requests (name === 'CancelledError' or status === 0)
      // and 401s (handled by auth flow). Deduplication is handled by react-hot-toast's
      // id-based deduplication: one toast per error message per window.
      onError(error: unknown) {
        const err = error as any
        if (err?.name === 'CancelledError') return
        if (err?.response?.status === 401) return
        if (err?.response?.status === 0) return
        const message =
          err?.response?.data?.detail ??
          err?.response?.data?.message ??
          err?.message ??
          'Something went wrong'
        toast.error(message, { id: `query-error-${message}` })
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
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

/**
 * Coordinates the full app bootstrap sequence at startup (P1B.6).
 *
 * Sequence:
 *   1. loadTenant()            — resolves tenant; sets tenantState to 'ready' or 'fallback'
 *   2. setRbacInitialized(true) — P1B.1: RBAC permission map is static; mark ready immediately.
 *                                  Phase 2+: replace with async role fetch if needed.
 *   3. setFeatureFlags(flags)  — P1B.2: resolve module defaults + tenant overrides
 *   4. setFeatureFlagsInitialized(true)
 *
 * After this sequence, useSystemReady().canExecute becomes true and all
 * Phase 1B systems (RBAC, feature flags, routing) are permitted to execute.
 *
 * Phase 1B (P1B.3): middleware will inject X-Tenant-Slug from the subdomain;
 * this bootstrapper will pass the slug to loadTenant() at that point.
 */
function TenantBootstrapper({ children }: { children: ReactNode }) {
  const { loadTenant, setRbacInitialized, setFeatureFlagsInitialized, setFeatureFlags } = useTenantStore()
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    setEnvironmentTags()
    loadTenant().then(() => {
      // P1B.1 — RBAC: static permission map; initialization is synchronous
      setRbacInitialized(true)

      // P1B.2 — Feature flags: resolve from module defaults + tenant setting overrides
      const { tenant } = useTenantStore.getState()
      setFeatureFlags(featureFlagsService.resolve(tenant))
      setFeatureFlagsInitialized(true)

      // P4.6.3 — Tag Sentry events with the resolved tenant slug
      setSentryTenant(tenant.slug)
    })
  }, [loadTenant, setRbacInitialized, setFeatureFlagsInitialized, setFeatureFlags])
  return <>{children}</>
}

/**
 * Applies per-tenant CSS variable overrides at runtime (Phase 2 — P2.2).
 * Reads Tenant.settings.theme and mutates document root CSS vars.
 * Isolated from the bootstrap sequence: reacts to tenant changes reactively.
 * Cleans up overrides on unmount or when tenant changes back to no theme.
 *
 * Permitted override targets: --accent, --accent-hover, --font-body.
 * See TENANT_OVERRIDABLE_VARS in src/lib/tokens.ts.
 */
function TenantThemeProvider({ children }: { children: ReactNode }) {
  const tenant = useTenantStore((s) => s.tenant)
  useEffect(() => {
    const theme = tenant.settings?.theme as TenantTheme | undefined
    const root = document.documentElement
    if (theme?.primaryColor) {
      root.style.setProperty('--accent', theme.primaryColor)
      root.style.setProperty('--accent-hover', theme.accentHoverColor ?? theme.primaryColor)
    }
    if (theme?.fontBody) {
      root.style.setProperty('--font-body', theme.fontBody)
    }
    return () => {
      if (theme?.primaryColor) {
        root.style.removeProperty('--accent')
        root.style.removeProperty('--accent-hover')
      }
      if (theme?.fontBody) root.style.removeProperty('--font-body')
    }
  }, [tenant])
  return <>{children}</>
}

/**
 * Activates the notification WebSocket for authenticated users (P3.6).
 * Placed inside AuthBootstrapper so it only runs after auth hydration.
 * Wraps children transparently — no visual output.
 */
function NotificationWebSocketProvider({ children }: { children: ReactNode }) {
  useNotificationWebSocket()
  return <>{children}</>
}

/**
 * Requests FCM permission + token after login and registers the device
 * with the backend (P4.2). Placed inside AuthBootstrapper so it only
 * runs when an authenticated session is present.
 */
function FcmRegistrationProvider({ children }: { children: ReactNode }) {
  useFcmRegistration()
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
      setSentryUser({ id: user.id, email: user.email, role: user.role })
      userService.getFavorites().then(setFavorites).catch(() => {})
    }).catch(() => setLoading(false))
    const handleLogout = () => { setUser(null); clearSentryUser() }
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
            <TenantThemeProvider>
              <AuthBootstrapper>
                <FcmRegistrationProvider>
                <NotificationWebSocketProvider>
                  {children}
                  {/* P4.8.5 — SW update banner (non-blocking) */}
                  <ServiceWorkerUpdateBanner />
                  {/* P4.8.6 — Offline status indicator */}
                  <OfflineIndicator />
                  <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '0.875rem' }, success: { iconTheme: { primary: '#f97316', secondary: '#fff' } } }} />
                </NotificationWebSocketProvider>
                </FcmRegistrationProvider>
              </AuthBootstrapper>
            </TenantThemeProvider>
          </TenantBootstrapper>
        </RTLProvider>
      </ThemeProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
