# Console "Tenant Not Found" Audit: Subdomain-Only Resolution Has No Membership Fallback

**Status: root cause found and fixed. Frontend architectural gap, not an
RBAC bug and not missing backend data.**

## 1. Root Cause

Console's tenant identity has always been resolved **exclusively from the
request's subdomain**, per the frozen decision in
`src/modules/TENANT_RESOLUTION_STRATEGY.md`:

- `src/middleware.ts`'s `resolveTenantSlug()` extracts a slug only from
  `host` (`{slug}.samoon.app`) or `NEXT_PUBLIC_TENANT_SLUG`, and injects
  it as `X-Tenant-Slug`.
- `TenantBootstrapper` (`src/providers/index.tsx`) reads that via
  `readTenantSlug()` and calls `useTenantStore.loadTenant(slug)` **once,
  on mount, before auth even resolves** — entirely independent of
  `AuthBootstrapper`/`getMe()`.
- `tenantService.getTenant(slug)` defaults `slug` to the literal string
  `'default'` when none was resolved (`src/services/tenant.service.ts`).

This is correct and intentional for the **public storefront** (many
tenants under one app, distinguished by subdomain — the documented
design). It breaks down the moment a **business owner/admin reaches
`/console`** from the platform's own domain: there is no tenant
subdomain to be on before logging in, so no slug is ever resolved,
`loadTenant('default')` runs, and a real backend has no tenant literally
named `"default"` — it 404s, `tenantState` becomes `'not_found'`, and
Console's `AuthGuard` (`requireResolvedTenant`) renders exactly the
reported message: *"Tenant not found — We couldn't find a business at
this address."*

This happens **before** `dashboard:access` is ever evaluated —
`AuthGuard` checks `tenantFailed` ahead of the permission check (see
`src/components/auth/AuthGuard.tsx`). The user's `owner`/`admin` roles
in `memberships[0]` are never consulted, which is exactly why this is
not an RBAC issue, matching the report.

## 2. Console Initialization Flow (traced)

```
Route structure:      src/app/console/layout.tsx (no [tenantSlug] segment — Console has no per-tenant URL)
Middleware:            src/middleware.ts — resolveTenantSlug() from subdomain only
TenantBootstrapper:     src/providers/index.tsx — readTenantSlug() (meta tag from middleware) → loadTenant(slug)
TenantStore:            src/stores/index.ts — useTenantStore.loadTenant(slug) → tenantService.getTenant(slug)
Tenant API:             src/services/tenant.service.ts — getTenant(slug ?? 'default')
Console layout guard:   src/app/console/layout.tsx — <AuthGuard requireResolvedTenant requiredPermission="dashboard:access">
AuthGuard:              src/components/auth/AuthGuard.tsx — tenantFailed (tenantState !== 'resolved') renders BEFORE the permission check
```

## 3. `activeMembership.tenantId` vs `memberships[].tenantSlug`

Both exist in the payload and neither was ever being read for tenant
*identity* resolution — only for RBAC (`selectActiveMembership()`,
fixed in the prior audit). `loadTenant()`/`getTenant()` require a
**slug**, not an id, and `memberships[0].tenantSlug` (`"2cum17xs"`) is
exactly the value needed — it was simply never consulted anywhere in the
Console bootstrap path before this fix. No slug was "required but only
tenantId was stored" — the slug was present in the response the whole
time; nothing in the frontend ever looked at it for tenant resolution.

## 4. Exact reason for "Tenant not found"

- **Not** a wrong identifier sent to the API — no identifier from the
  user's session was ever sent at all; `loadTenant('default')` sends a
  hardcoded placeholder slug, oblivious to who is logged in.
- **Not** missing tenant hydration in the sense of a skipped step — it
  ran exactly as designed, just designed for a different scenario
  (subdomain-per-tenant storefront) than the one Console actually needs
  (a central login the user reaches from the platform's own domain).
- **Not** a race condition — `TenantBootstrapper` and `AuthBootstrapper`
  are unordered sibling effects by design (documented in
  `providers/index.tsx`), but the outcome is the same regardless of
  ordering: no slug ever gets derived from the session either way.
- **Not** a premature redirect before auth bootstrap finishes —
  `AuthGuard` correctly waits for both `isLoading` and `tenantPending`
  before rendering anything; it renders the *correct* `'not_found'`
  fallback for the *wrong* tenant lookup.

**Exact cause:** `TenantBootstrapper`'s subdomain-only resolution has no
fallback path to the authenticated user's own `memberships`, and nothing
in the Console flow ever attempted one.

## 5. Fix

Added `resolveConsoleTenantFallbackSlug()` (`src/providers/index.tsx`,
exported, pure) — the single decision of "does the current route need
its tenant re-resolved from the session's own membership, and which
slug":

```ts
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
```

Wired into `AuthBootstrapper.applyPendingAuthSession()` (replacing the
old inline `if (currentTenant) {...} else { queue }` branch in
`checkSession()`): once auth resolves with a membership, if the route is
`/console*` and the host-resolved tenant is unusable (`null` or the
generic `DEFAULT_TENANT` placeholder), it calls
`useTenantStore.getState().loadTenant(fallbackSlug)` using the
membership's own `tenantSlug`, then seeds `currentTenantSession` against
whatever tenant that call actually resolves — RBAC (`dashboard:access`)
still runs normally afterward, unchanged and un-bypassed.

Guarded so it never races or clobbers a legitimately-resolved subdomain
tenant:
- Waits for `tenantState !== 'loading'` (host-based resolution has
  settled) before deciding anything.
- Only fires when the resolved tenant is genuinely unusable (`null` /
  `'default'`) — a real subdomain tenant is left untouched.
- A one-shot `consoleFallbackAttempted` ref prevents retry loops if the
  membership's own tenant is itself ineligible (suspended/forbidden) —
  that terminates as a real `'forbidden'`/`'not_found'` state, once,
  same as today.
- Called both from the reactive effect (tenant resolves *after*
  `getMe()`) and directly inside `checkSession()` (tenant already
  resolved *before* `getMe()`) — a ref write alone does not retrigger a
  `useEffect`, so only reacting to store changes would silently drop the
  session in the (equally common) second ordering.

Storefront routes (`/menu`, `/checkout`, `/dashboard`, tenant-subdomain
pages) are completely unaffected: the fallback only triggers on
`/console*`, and only when the host-resolved tenant is unusable —
exactly the case this bug reports.

## 6. Required Backend Changes

None. `memberships[].tenantSlug` already carries everything the fix
needs. This was purely a frontend gap.

## 7. Final Console Initialization Flow

```
1. Middleware resolves subdomain slug (if any) → X-Tenant-Slug header.
2. TenantBootstrapper.loadTenant(slug ?? undefined) — usually resolves
   to DEFAULT_TENANT ('default') for a Console visit reached from the
   platform's own domain.
3. AuthBootstrapper.getMe() resolves { user, memberships, activeMembership }.
4. AuthBootstrapper.applyPendingAuthSession():
     - waits for tenantState to settle,
     - resolveConsoleTenantFallbackSlug() detects /console + an unusable
       host-resolved tenant + a membership with a tenantSlug,
     - re-invokes loadTenant(membership.tenantSlug) → the REAL tenant.
5. normalizeTenantPermissions() seeds currentTenantSession against the
   resolved real tenant's id, using memberships[]'s roles/branchAccess
   (already fixed in the prior audit).
6. AuthGuard: tenantState === 'resolved' (real tenant) →
   dashboard:access is now correctly evaluated against real roles →
   Console renders.
```

## 8. Files Changed

| File | Change |
|---|---|
| `src/providers/index.tsx` | Exported `resolveConsoleTenantFallbackSlug()` (pure). `AuthBootstrapper` gained `tenantState`, `pathname` (`usePathname()`), and a `consoleFallbackAttempted` ref. `checkSession()`'s inline tenant-branch replaced by a shared `applyPendingAuthSession()`, called both directly and from the settle-aware effect. |
| `src/test/phase-Z-8-console-tenant-fallback.test.ts` (new) | 7 tests covering the exact reported scenario, the `DEFAULT_TENANT`-placeholder case, non-`/console` routes, an already-resolved real subdomain tenant (no clobber), no session input, a membership with no `tenantSlug`, and a `/console` sub-route. |
| `docs/CONSOLE_TENANT_RESOLUTION_FALLBACK_AUDIT.md` (new, this file) | Full audit trail. |

## 9. Verification

- `npx tsc --noEmit -p .` — zero new errors (identical to the established baseline).
- `npx vitest run` — full suite, only the same pre-existing baseline failures (see commit message for the exact count).
- `npm run build` — production build verified clean.
