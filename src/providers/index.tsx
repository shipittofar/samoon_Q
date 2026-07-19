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
import { usePathname } from 'next/navigation'
import type { Role, TenantMembership } from '@/types/rbac'
import { normalizeTenantPermissions, selectActiveMembership, hasAnyMembership } from '@/services/permission.service'
import { DEFAULT_TENANT } from '@/constants'

/**
 * Auth-refresh-persistence fix — the exact shape `normalizeTenantPermissions()`
 * needs to seed a session, or `null` when the getMe() response carries
 * neither the legacy `tenantRoles` field nor the frozen-contract
 * `memberships` field (a genuinely membership-less account, e.g. a new
 * customer).
 *
 * Root cause this fixes: `checkSession()` used to gate the ENTIRE
 * session-restore block on `user.tenantRoles && user.tenantRoles.length > 0`
 * — the legacy, pre-Phase-9 field. `useLogin()`/`useRegister()`/
 * `useVerifyOTP()` (hooks/index.ts) never had this gate — they call
 * seedTenantSession() unconditionally. A backend built purely against the
 * frozen `memberships`/`activeMembership` contract (no `tenantRoles` field
 * at all — exactly the contract this project has been freezing since
 * Phase Y) would satisfy this gate at login (irrelevant, login doesn't use
 * it) but silently skip session restore entirely on every page reload:
 * `useAuthStore.user` would still be set (so the app doesn't look logged
 * out at the token/identity level), but `currentTenantSession` would stay
 * null, `usePermissions()` would return `[]`, and every
 * permission-gated surface (most importantly /console, gated by
 * `dashboard:access`) would render as if the user had never logged in —
 * exactly the reported "auth state lost after refresh" symptom, and only
 * on refresh, never on login. Extracted as a pure, exported function so it
 * is unit-testable without mounting the full provider tree.
 */
export function resolveSessionRestoreInput(user: {
  tenantRoles?: Role[]
  memberships?: TenantMembership[]
  activeMembership?: TenantMembership
}): { roles?: Role[]; memberships?: TenantMembership[]; activeMembership?: TenantMembership } | null {
  const hasLegacyRoles = !!(user.tenantRoles && user.tenantRoles.length > 0)
  // Phase 9's own rule (normalizeTenantPermissions' doc comment): `memberships`
  // even as an EMPTY array signals the new contract — only its complete
  // absence (undefined/null) means "this response used the legacy shape."
  const hasMemberships = user.memberships !== undefined && user.memberships !== null
  if (!hasLegacyRoles && !hasMemberships) return null
  return { roles: user.tenantRoles, memberships: user.memberships, activeMembership: user.activeMembership }
}

/**
 * Phase Z.8 — pure decision: does the current route's tenant need to be
 * re-resolved from the authenticated session's own membership, and if
 * so, which slug? TenantBootstrapper resolves tenant purely from the
 * request's subdomain (docs/modules/TENANT_RESOLUTION_STRATEGY.md) — by
 * design, for the public storefront — and has no path back to the
 * authenticated user's own memberships. A business owner/admin reaching
 * /console from the platform's own domain (no tenant subdomain to be on
 * before logging in) gets no slug at all, TenantBootstrapper falls back
 * to `loadTenant('default')`, and a real backend 404s on a tenant
 * literally named "default" — producing tenantState 'not_found'
 * ("Tenant not found") with zero relation to the user's actual,
 * fully-permissioned membership. Not an RBAC problem:
 * `dashboard:access` is never evaluated because AuthGuard's
 * `requireResolvedTenant` fails first.
 *
 * Extracted as a pure, exported function (same pattern as
 * `resolveSessionRestoreInput()` above) so the decision is unit-testable
 * without mounting the full provider tree.
 *
 * Returns the tenantSlug to load, or `null` when no fallback is needed:
 * not on a `/console` route, the current tenant already resolved to a
 * real (non-`DEFAULT_TENANT`) tenant, or the session carries no
 * membership with a `tenantSlug` to fall back to.
 */
export function resolveConsoleTenantFallbackSlug(
  pathname: string | null | undefined,
  currentTenant: { slug: string; id: string } | null | undefined,
  sessionInput: { memberships?: TenantMembership[]; activeMembership?: TenantMembership } | null | undefined,
): string | null {
  if (!pathname?.startsWith('/console')) return null
  if (currentTenant && currentTenant.slug !== DEFAULT_TENANT.slug) return null
  if (!sessionInput) return null
  const membership = selectActiveMembership(sessionInput.memberships, sessionInput.activeMembership, currentTenant?.id)
  return membership?.tenantSlug ?? null
}

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
 *   1. loadTenant(slug) — resolves tenant by slug. On failure, `tenant` stays
 *      `null` and `tenantState` becomes 'not_found'/'forbidden'/'error' — NO
 *      fallback tenant is substituted (see src/stores/index.ts loadTenant()).
 *   2. setRbacInitialized(true) — P1B.1: RBAC permission map is static; mark ready immediately.
 *                                  Phase 2+: replace with async role fetch if needed.
 *   3. setFeatureFlags(flags)  — P1B.2: resolve module defaults + tenant overrides,
 *      only when a tenant actually resolved (an empty map otherwise).
 *   4. setFeatureFlagsInitialized(true)
 *
 * Both readiness flags are still set unconditionally once loadTenant() settles
 * (successfully or not) — canExecute means "bootstrap finished," not "tenant
 * resolved." Authenticated Console flows must gate on tenantState === 'resolved'
 * specifically (see AuthGuard), not on canExecute alone.
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

      // P1B.2 — Feature flags: resolve from module defaults + tenant setting
      // overrides. `tenant` is null unless resolution succeeded — pass null
      // through untouched; featureFlagsService.resolve() must treat that as
      // "no tenant, no overrides" (module-default flags only).
      const { tenant, tenantState } = useTenantStore.getState()
      setFeatureFlags(featureFlagsService.resolve(tenant))
      setFeatureFlagsInitialized(true)

      // P4.6.3 — Tag Sentry events with the resolved tenant slug, when there is one.
      if (tenantState === 'resolved' && tenant) setSentryTenant(tenant.slug)
    })
  }, [loadTenant, setRbacInitialized, setFeatureFlagsInitialized, setFeatureFlags])
  return <>{children}</>
}

/**
 * Phase 3 — Branch Resolution bootstrap.
 *
 * Reacts to tenant resolution (not just initial boot, unlike
 * TenantBootstrapper's one-shot `booted` ref — a tenant switch must
 * re-trigger this too): fetches the resolved tenant's branches and
 * validates the persisted branch id against them. `useBranchStore`
 * itself never calls out to fetch branches on its own; this is the one
 * and only trigger point, matching the RBAC pattern where
 * currentTenantSession is populated from a single call site.
 *
 * - tenantState !== 'resolved' (loading/not_found/forbidden/error) →
 *   resetBranchResolution() — no stale branch/branchState from a
 *   previous tenant survives into an unresolved or failed context.
 * - tenantState === 'resolved' → loadBranchesForTenant(tenant.id), which
 *   itself never falls back to branches[0] (see stores/index.ts).
 */
function BranchResolutionBootstrapper({ children }: { children: ReactNode }) {
  const tenant = useTenantStore((s) => s.tenant)
  const tenantState = useTenantStore((s) => s.tenantState)
  // Tracks the last tenant id this bootstrapper actually loaded branches
  // for — `undefined` means "nothing loaded yet this session" (the
  // refresh-with-persisted-branch case, where the persisted
  // selectedBranchId must be validated as-is). Any OTHER previous value
  // means a genuine tenant switch happened, so the previous tenant's
  // selectedBranchId must be cleared first — it must never be validated
  // against a different tenant's branch list.
  const lastLoadedTenantId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (tenantState !== 'resolved' || !tenant) {
      if (lastLoadedTenantId.current !== null) {
        lastLoadedTenantId.current = null
        useBranchStore.getState().resetBranchResolution()
      }
      return
    }
    if (lastLoadedTenantId.current === tenant.id) return
    const isGenuineTenantSwitch = lastLoadedTenantId.current !== undefined && lastLoadedTenantId.current !== null
    lastLoadedTenantId.current = tenant.id
    if (isGenuineTenantSwitch) {
      // Clear the previous tenant's branch id before loading — it must
      // never leak into, or be validated against, the new tenant's
      // branch list. On first-ever resolution (page load/refresh) this
      // is skipped so the persisted id gets its one legitimate validation.
      useBranchStore.getState().resetBranchResolution()
    }
    void useBranchStore.getState().loadBranchesForTenant(tenant.id)
  }, [tenant, tenantState])

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
    const theme = tenant?.settings?.theme
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
  const { setUser, setLoading, setSessionCheckFailed } = useAuthStore()
  const setFavorites = useFavoritesStore((s) => s.setFavorites)
  const qc = useQueryClient()
  const booted = useRef(false)
  // TenantBootstrapper and AuthBootstrapper are unordered sibling effects —
  // getMe() can resolve before loadTenant() does. If a session-restore
  // input arrives with no resolved tenant to seed a session against yet,
  // it's queued here instead of dropped; the effect below applies it
  // exactly once, the moment a tenant actually resolves. Phase 2 — this
  // now seeds currentTenantSession (via normalizeTenantPermissions()), the
  // single permission source, not a second/parallel computation. Widened
  // from `Role[] | null` to the full resolveSessionRestoreInput() shape so
  // the queued case gets the exact same memberships-aware fix as the
  // immediate-tenant case below (see resolveSessionRestoreInput()'s doc
  // comment for the bug this closes).
  const pendingAuthSessionRef = useRef<ReturnType<typeof resolveSessionRestoreInput>>(null)
  const tenant = useTenantStore((s) => s.tenant)
  const tenantState = useTenantStore((s) => s.tenantState)
  const pathname = usePathname()
  // Phase Z.8 — one-shot guard so a genuinely tenant-less /console visit
  // (membership resolves to a tenant that itself 404s/is forbidden) tries
  // the membership-based fallback exactly once, instead of looping.
  const consoleFallbackAttempted = useRef(false)

  // TenantBootstrapper resolves tenant purely from the request's
  // subdomain (docs/modules/TENANT_RESOLUTION_STRATEGY.md) — by design,
  // for the public storefront. It has no path back to the authenticated
  // user's own memberships. A business owner/admin reaching /console from
  // the platform's own domain (there is no tenant subdomain to be on
  // before logging in) gets no slug at all, falls back to
  // `loadTenant('default')`, and a real backend 404s on a tenant literally
  // named "default" — producing tenantState 'not_found' ("Tenant not
  // found") with zero relation to the user's actual, fully-permissioned
  // membership. This is NOT an RBAC problem — `dashboard:access` is never
  // evaluated because AuthGuard's `requireResolvedTenant` fails first.
  //
  // Waits for `tenantState !== 'loading'` (host-based resolution has
  // settled, successfully or not) before deciding whether a fallback is
  // needed, so this never races TenantBootstrapper's own in-flight
  // loadTenant() call and clobbers a legitimately-resolved subdomain
  // tenant. Called both reactively (the effect below, for the case where
  // tenant resolution finishes AFTER getMe()) and directly from
  // checkSession() (for the equally common case where tenant resolution
  // already finished by the time getMe() resolves — a ref write alone
  // does not retrigger a useEffect, so relying on the effect alone would
  // silently drop the session in that ordering).
  function applyPendingAuthSession() {
    // Read live store state — checkSession()'s getMe().then() callback can
    // run with a stale render closure where this hook still says 'loading'
    // even though TenantBootstrapper's loadTenant(undefined) already settled
    // to 'not_found'. That ordering (sync host bootstrap before async /me)
    // is the common /console case and used to return here forever, leaving
    // pendingAuthSessionRef populated but never applying the membership fallback.
    const settledTenantState = useTenantStore.getState().tenantState
    if (settledTenantState === 'loading') return
    if (!pendingAuthSessionRef.current) return
    const sessionInput = pendingAuthSessionRef.current
    const currentTenant = useTenantStore.getState().tenant

    const fallbackSlug = resolveConsoleTenantFallbackSlug(pathname, currentTenant, sessionInput)

    if (fallbackSlug && !consoleFallbackAttempted.current) {
      consoleFallbackAttempted.current = true
      pendingAuthSessionRef.current = null
      // Re-resolve tenant identity from the authenticated session's own
      // membership — never from client-held role/permission data, and
      // never bypassing AuthGuard's `dashboard:access` check, which still
      // runs against whatever tenant this settles on.
      useTenantStore.getState().loadTenant(fallbackSlug).then(() => {
        const resolved = useTenantStore.getState().tenant
        if (resolved) {
          const { roles, permissions, branchAccess } = normalizeTenantPermissions(sessionInput, resolved.id)
          useRbacStore.getState().setCurrentTenantSession(resolved.id, roles, permissions, branchAccess)
          if (roles.length > 0) useRbacStore.getState().setTenantRoles(resolved.id, roles)
        }
      })
      return
    }

    if (currentTenant) {
      const { roles, permissions, branchAccess } = normalizeTenantPermissions(sessionInput, currentTenant.id)
      useRbacStore.getState().setCurrentTenantSession(currentTenant.id, roles, permissions, branchAccess)
      if (roles.length > 0) useRbacStore.getState().setTenantRoles(currentTenant.id, roles)
      pendingAuthSessionRef.current = null
    }
  }

  useEffect(() => {
    applyPendingAuthSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, tenantState, pathname])

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
    useBranchStore.getState().resetBranchResolution()
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

  // Phase 7 — extracted so it can be re-run on retry (see the
  // 'auth:retry-session-check' listener below), not just once at boot.
  // Behavior is unchanged from before: a 401 means the session is
  // genuinely invalid (clearSession()); any other failure (network error,
  // timeout, 5xx) is treated as transient and now sets sessionCheckFailed
  // instead of just silently leaving the user in an ambiguous
  // "not loading, not authenticated" state — AuthGuard reads that flag to
  // avoid redirecting to /login on a temporary backend outage.
  function checkSession() {
    const token = getAccessToken()
    if (!token) { setLoading(false); return }
    authService.getMe().then((data) => {
      // Contract update — getMe() nests the User under a `user` key,
      // alongside `memberships`/`activeMembership` as siblings (NOT a flat
      // `User & {...}` shape the way login()/verifyOTP() are). `data.user`
      // carries identity fields; `data` itself (not `data.user`) carries
      // the RBAC-relevant `memberships`/`activeMembership` fields
      // resolveSessionRestoreInput() reads.
      setUser(data.user)
      setSentryUser({ id: data.user.id, email: data.user.email, accountType: data.user.accountType })
      // Phase Z.10 — set independently of tenant resolution (unlike the
      // currentTenantSession seeding below, which needs a resolved tenant
      // to key against). Console reads this to decide full workspace vs.
      // onboarding without waiting on subdomain/membership-based tenant
      // resolution to succeed first — see
      // docs/CONSOLE_TENANT_DEPENDENCY_REDESIGN_AUDIT.md.
      useRbacStore.getState().setHasTenantMembership(hasAnyMembership(data))
      // P10.7 Phase D / Phase 2 — session restore hydrates currentTenantSession
      // the same way useLogin()/useVerifyOTP() do (via normalizeTenantPermissions()),
      // instead of relying entirely on useRbacStore's own localStorage
      // persistence to survive a page reload. currentTenantSession itself is
      // NEVER persisted (see stores/index.ts partialize) — this call is what
      // reconstructs it fresh on every session restore.
      // Auth-refresh-persistence fix — was `if (user.tenantRoles &&
      // user.tenantRoles.length > 0)`, which silently skipped session
      // restore entirely for a backend that only ever sends `memberships`
      // (no legacy `tenantRoles` field). See resolveSessionRestoreInput()'s
      // doc comment above for the full root-cause explanation.
      const sessionInput = resolveSessionRestoreInput(data)
      if (sessionInput) {
        // Queue, then apply immediately — applyPendingAuthSession() is the
        // single place that decides whether the already-resolved tenant is
        // usable as-is, needs the Console membership-based fallback (Phase
        // Z.8), or is still settling. Calling it here (not just relying on
        // the effect below) covers the equally common ordering where
        // TenantBootstrapper's loadTenant() already settled before getMe()
        // resolves — a ref write alone would never retrigger that effect.
        pendingAuthSessionRef.current = sessionInput
        applyPendingAuthSession()
      }
      // `data.ownership`/`data.staffAssignments`, if a backend ever sends
      // them here, are NOT hydrated into any store — Phase 2 removed the
      // client-side ownership/StaffAssignment authorization engine those
      // fields used to feed entirely. The fields remain on the
      // AuthSessionRbacPayload contract only for forward compatibility with
      // a future backend that might use them server-side.
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
      } else {
        setSessionCheckFailed(true)
      }
    })
  }

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUser, setLoading, setFavorites])

  // Phase 7 — mirrors the 'auth:logout' listener above: a plain
  // (unguarded) effect so retry works correctly under React 18 StrictMode's
  // dev-only double-invoke, same reasoning as documented there. Lets
  // AuthGuard's "Retry" affordance re-run the session check without a full
  // page reload, without needing a shared context/prop just for this.
  useEffect(() => {
    function handleRetry() {
      setSessionCheckFailed(false)
      setLoading(true)
      checkSession()
    }
    window.addEventListener('auth:retry-session-check', handleRetry)
    return () => window.removeEventListener('auth:retry-session-check', handleRetry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RTLProvider>
          <TenantBootstrapper>
            <BranchResolutionBootstrapper>
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
            </BranchResolutionBootstrapper>
          </TenantBootstrapper>
        </RTLProvider>
      </ThemeProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      {process.env.NODE_ENV === 'development' && <MissingTranslationInspector />}
    </QueryClientProvider>
  )
}
