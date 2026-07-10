'use client'

import { QueryClient, QueryClientProvider, QueryCache, useQueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { useAuthStore, useThemeStore, useLangStore, useFavoritesStore, useTenantStore, useRbacStore, useBranchStore, useCartStore, useDineInStore, useRecentlyViewedStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { getAccessToken, clearTokens } from '@/services/axios.instance'
import { userService } from '@/services/combined.service'
import { featureFlagsService } from '@/services/feature-flags.service'
import { useNotificationWebSocket, useFcmRegistration } from '@/hooks/client'
import { STALE_TIME, CACHE_TIME } from '@/constants'
import { ServiceWorkerUpdateBanner } from '@/components/pwa/ServiceWorkerUpdateBanner'
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator'
import { MissingTranslationInspector } from '@/components/dev/MissingTranslationInspector'
import { setSentryUser, clearSentryUser, setSentryTenant, setEnvironmentTags } from '@/lib/sentry'
import { getDirection } from '@/i18n/runtime'
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
    // P9.5.1A: config-driven RTL detection (Localization Runtime Service)
    // instead of a hardcoded ['fa', 'ar'] literal.
    document.documentElement.dir = getDirection(locale)
    document.documentElement.lang = locale
  }, [locale])
  return <>{children}</>
}

/**
 * Reads the tenant slug injected by the middleware (P1B.3).
 *
 * The middleware sets the X-Tenant-Slug request header. Next.js 15 App Router
 * exposes custom request headers to client components via a meta tag injected
 * by the server; we read it via the `headers()` API on the server. On the
 * client side we fall back to NEXT_PUBLIC_TENANT_SLUG for dev environments.
 *
 * This function is called once per bootstrap, so it reads directly from the
 * DOM meta tag written by the root layout (if present) or falls back to env.
 */
function readTenantSlug(): string | undefined {
  if (typeof document === 'undefined') return undefined
  // Check meta tag written by root layout: <meta name="x-tenant-slug" content="..." />
  const meta = document.querySelector<HTMLMetaElement>('meta[name="x-tenant-slug"]')
  if (meta?.content) return meta.content
  // Dev fallback via env var (available in browser builds)
  return process.env.NEXT_PUBLIC_TENANT_SLUG || undefined
}

/**
 * Coordinates the full app bootstrap sequence at startup (P1B.6).
 *
 * Sequence:
 *   1. loadTenant(slug)        — resolves tenant by slug (P1B.3); falls back to DEFAULT_TENANT
 *   2. setRbacInitialized(true) — P1B.1: RBAC permission map is static; mark ready immediately.
 *                                  Phase 2+: replace with async role fetch if needed.
 *   3. setFeatureFlags(flags)  — P1B.2: resolve module defaults + tenant overrides
 *   4. setFeatureFlagsInitialized(true)
 *
 * After this sequence, useSystemReady().canExecute becomes true and all
 * Phase 1B systems (RBAC, feature flags, routing) are permitted to execute.
 */
function TenantBootstrapper({ children }: { children: ReactNode }) {
  const { loadTenant, setRbacInitialized, setFeatureFlagsInitialized, setFeatureFlags } = useTenantStore()
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    setEnvironmentTags()
    const slug = readTenantSlug()
    loadTenant(slug).then(() => {
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
  const qc = useQueryClient()
  const booted = useRef(false)

  // P10.9 — full session teardown, shared by both places a session can end
  // outside an explicit useLogout() call: a failed getMe() below
  // (invalid/expired token found at boot) and the 'auth:logout' event
  // axios.instance.ts's response interceptor dispatches when a token
  // refresh fails. Mirrors useLogout()'s onSettled cleanup exactly
  // (src/hooks/index.ts) — previously this path only did `setUser(null)`,
  // leaving RBAC/tenant/cart/query-cache state behind
  // (docs/P10.9_AUTH_SESSION_HARDENING_AUDIT.md Phase D).
  function clearSession() {
    setUser(null)
    clearSentryUser()
    clearTokens()
    useRbacStore.getState()._resetStore()
    useBranchStore.getState().setAdminActiveBranch(null)
    useCartStore.getState().clearCart()
    useDineInStore.getState().clearTable()
    useFavoritesStore.getState().setFavorites([])
    useRecentlyViewedStore.getState().clear()
    qc.clear()
  }

  // P10.9 — deliberately a SEPARATE effect from the one-time bootstrap
  // below, with no `booted` guard. Previously the 'auth:logout' listener
  // was registered inside the `booted`-guarded effect: under React 18
  // StrictMode's dev-only double-invoke (mount → cleanup → mount), the
  // first invocation's cleanup calls removeEventListener, but the second
  // invocation immediately bails out on `if (booted.current) return`
  // BEFORE reaching addEventListener — leaving the app with a permanently
  // unattached listener, silently swallowing every subsequent
  // token-refresh-failure event. A standard (unguarded) effect re-attaches
  // correctly on every mount, including StrictMode's second one.
  useEffect(() => {
    window.addEventListener('auth:logout', clearSession)
    return () => window.removeEventListener('auth:logout', clearSession)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc])

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const token = getAccessToken()
    if (!token) { setLoading(false); return }
    authService.getMe().then((user) => {
      setUser(user)
      setSentryUser({ id: user.id, email: user.email, role: user.role })
      // P10.7 Phase D — session restore now hydrates tenantRoles the same
      // way useLogin()/useVerifyOTP() already do, instead of relying
      // entirely on useRbacStore's own localStorage persistence to
      // survive a page reload (docs/P10.6_RBAC_REAL_BACKEND_MIGRATION_PLAN.md
      // §3). No new RBAC logic here — this only calls the store's
      // existing setTenantRoles() action with whatever getMe() returned.
      if (user.tenantRoles && user.tenantRoles.length > 0) {
        const tenantId = useTenantStore.getState().tenant.id
        useRbacStore.getState().setTenantRoles(tenantId, user.tenantRoles)
      }
      // `user.ownership`/`user.staffAssignments`, if a backend ever sends
      // them here, are deliberately NOT hydrated into any store yet:
      // Ownership Resolution and StaffAssignment are still synchronous,
      // mock-service-backed reads (by this phase's own rule — converting
      // them async is explicitly out of scope), so there is no client
      // store for these facts to be written into without inventing new
      // state, which P10.7 also forbids. The fields exist on the
      // AuthSessionRbacPayload contract for forward compatibility only.
      userService.getFavorites().then(setFavorites).catch(() => {})
    }).catch((err: unknown) => {
      // P10.10 — distinguish "session is actually invalid" from "backend
      // is temporarily unreachable." Per docs/P10.10_AUTH_BACKEND_API_CONTRACT.md
      // §4: a 401 (TOKEN_EXPIRED/TOKEN_INVALID) means the token itself is
      // no good — clearSession() is correct (P10.9's fix). Any other
      // failure (network error/timeout with no response, or a 5xx) is a
      // transient backend problem, not proof the session is invalid — the
      // task's own rule is explicit: "Do NOT logout users on temporary
      // backend failures." Mock mode's getMe() never rejects, so this
      // branch only affects real-backend mode.
      const status = (err as { response?: { status?: number } } | undefined)?.response?.status
      if (status === 401) {
        clearSession()
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {process.env.NODE_ENV === 'development' && <MissingTranslationInspector />}
    </QueryClientProvider>
  )
}
