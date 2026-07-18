# Console Tenant Dependency Redesign

**Status: complete.** Console is now an application workspace — tenant
context is optional state inside it, not a precondition for it to load.

## 1. Root Architectural Problem

`src/app/console/layout.tsx` wrapped its ENTIRE chrome (header, sidebar,
context bar, page content) in a single `<AuthGuard requireResolvedTenant
tenantFallback={...}>`. `AuthGuard`'s own render logic:

```ts
if (tenantPending) return <>{fallback}</>          // tenantState === 'loading'
if (tenantFailed) return <>{tenantFallback?.(...)}</>  // tenantState !== 'resolved'
```

made a *successfully resolved tenant* a hard precondition for Console to
render **anything at all**. `TenantBootstrapper` resolves that tenant
purely from the request's subdomain (`docs/modules/TENANT_RESOLUTION_STRATEGY.md`,
by design, for the public storefront) — plus, after the prior phase's fix,
a membership-based fallback (`docs/CONSOLE_TENANT_RESOLUTION_FALLBACK_AUDIT.md`).
Both of those require the user to actually **have** a tenant. A business
owner who has never been assigned one yet (brand-new signup, zero
`memberships`) has no subdomain to be on and no membership to fall back
to — tenant resolution genuinely fails, `tenantState` becomes
`'not_found'`, and `AuthGuard` rendered "Tenant not found" — architecturally
indistinguishable from a real routing bug, for a user who did nothing wrong.

This was never fixable by re-resolving "the right tenant" (the previous
phase's fix) — it needed a different question asked entirely: *does this
user have a tenant at all*, answered independently of whether one
resolved, with a friendly outcome when the answer is no.

## 2. Audit of the Dependency Chain

| Component | Old role | Finding |
|---|---|---|
| `src/app/console/layout.tsx` | Wrapped everything in `<AuthGuard requireResolvedTenant requiredPermission="dashboard:access">` | The single point forcing tenant resolution before ANY Console content, including chrome |
| `AuthGuard` (`src/components/auth/AuthGuard.tsx`) | Generic guard; `requireResolvedTenant` prop makes `tenantState === 'resolved'` a hard gate | Correct generic behavior for a page that legitimately needs one specific tenant — wrong fit for Console, which needs *auth* unconditionally and *tenant* as optional context. No `TenantGuard` component exists in this codebase — Console was the only consumer of `requireResolvedTenant`. |
| `TenantBootstrapper` (`src/providers/index.tsx`) | Resolves tenant from subdomain (+ Console membership fallback) once, at boot | Working as designed — the gap was never here, it was in what Console did with a *failed* resolution |
| `useTenantStore` (`src/stores/index.ts`) | `tenant`/`tenantState` only | No signal existed for "does the user have ANY tenant membership," independent of whether one actually resolved — this is the missing piece |
| `DEFAULT_TENANT` (`src/constants/index.ts`) | Fallback slug `'default'` when no subdomain resolves | Correct for the single-tenant-deployment/public-storefront case; irrelevant to whether a *Console* user has a real business — conflating the two was part of the bug |
| `AuthBootstrapper` (`src/providers/index.tsx`) | Seeds `currentTenantSession` (RBAC) only when a tenant has resolved | Correct for RBAC (a permission is meaningless without a tenant to scope it to) — but nothing else derived "has a tenant at all" from the same session data, so Console had no way to ask that question either |

**Every place "tenant not resolved" blocked all of Console**: exactly
one — `AuthGuard`'s `tenantFailed`/`tenantPending` branches, reached via
`console/layout.tsx`'s `requireResolvedTenant` prop. There was no second
gate to find or remove.

## 3. Fix

### 3.1 New signal: `hasTenantMembership` (`src/stores/index.ts`, `useRbacStore`)

```ts
hasTenantMembership: boolean | null   // null = not yet known, false = confirmed zero
setHasTenantMembership: (value: boolean | null) => void
```

Not persisted (same policy as `currentTenantSession`) — always
reconstructed fresh from the session. Reset to `null` by `_resetStore()`
(on logout / 401).

### 3.2 New pure helper: `hasAnyMembership()` (`src/services/permission.service.ts`)

Mirrors `normalizeTenantPermissions()`'s own shape-priority rule: the
frozen `memberships` field, when present (even empty), is authoritative;
only when it's entirely absent does a non-empty legacy `roles`/`p7Roles`/
`tenantRoles` list count as proof of membership.

### 3.3 Set independently of tenant resolution

Every place a session resolves now sets `hasTenantMembership` **before**
(and regardless of) whether a tenant has actually loaded — previously,
RBAC seeding (`seedTenantSession()`) was itself gated on `if (tenant)`
and simply never ran otherwise, so there was no code path that could
answer "has a tenant" without a tenant already being resolved:

- `useLogin()`, `useRegister()`, `useVerifyOTP()` (`src/hooks/index.ts`)
- `AuthBootstrapper.checkSession()` (`src/providers/index.tsx`) — session
  restore on refresh

### 3.4 `ConsoleWorkspaceGate` (new, `src/components/admin/ConsoleWorkspaceGate.tsx`)

Replaces `AuthGuard`'s tenant/RBAC gating for Console specifically.
Mounted *inside* a now auth-only `<AuthGuard>` in `console/layout.tsx`:

```
hasTenantMembership === null   -> wait (still resolving the session)
hasTenantMembership === false  -> <ConsoleOnboarding />   (Console "loads")
hasTenantMembership === true:
  tenantState === 'loading'    -> wait
  tenantState !== 'resolved'   -> tenant-specific error (this membership's
                                   tenant is suspended/forbidden/etc — a
                                   REAL error, distinct from "no tenant")
  tenantState === 'resolved':
    !dashboard:access          -> <AccessDenied />          (RBAC, unchanged)
    dashboard:access           -> render the full workspace (children)
```

### 3.5 `ConsoleOnboarding` (new, `src/components/admin/ConsoleOnboarding.tsx`)

The zero-membership landing state. No self-serve tenant-provisioning flow
exists in this codebase yet — the platform's `/console/tenants/new`
wizard requires `tenant.manage`, which under this RBAC model can only
ever be granted by an *already-resolved* tenant's session, so it is
structurally unreachable for a zero-membership user. Rather than link to
a page that would just deny them again, this screen points to support
(`mailto:hello@samoon.com`, the existing support address used elsewhere
in the app — `src/components/layout/Footer.tsx`).

### 3.6 `src/app/console/layout.tsx`

```tsx
<AuthGuard>                          {/* auth only now */}
  <ConsoleWorkspaceGate>             {/* tenant context + RBAC, Phase Z.10 */}
    <AdminHeader />
    ...context bar, sidebar, {children}...
  </ConsoleWorkspaceGate>
</AuthGuard>
```

## 4. Why Console No Longer Depends on Tenant Resolution

`<AuthGuard>` with no `requiredPermission` prop is **auth-only** by its
own existing logic (`permissionGranted = !requiredPermission ||
hasRequiredPermission` short-circuits to `true` whenever `requiredPermission`
is falsy — confirmed and documented with a corrected comment in
`AuthGuard.tsx`, which previously had a misleading comment claiming the
opposite). Console's layout no longer passes `requireResolvedTenant`,
`requiredPermission`, or `tenantFallback` to `AuthGuard` at all — those
props still exist on `AuthGuard` (a legitimately generic, reusable
capability; not dead code, still exercised by their own test suites) but
Console simply stops using them. Tenant/RBAC decisions moved to
`ConsoleWorkspaceGate`, which renders **something** (onboarding, an
error, or the workspace) for every authenticated user — never a hard
block on tenant resolution succeeding.

## 5. What Did Not Change (by design)

- **RBAC is completely unchanged.** `dashboard:access` still gates the
  full workspace exactly as before — `ConsoleWorkspaceGate`'s last check
  is the same `usePermission('dashboard:access')` `AuthGuard` used to run.
  A business user with memberships but no permission still sees
  `AccessDenied`, not the workspace.
- **`accountType` grants nothing.** Neither `ConsoleWorkspaceGate` nor
  `ConsoleOnboarding` reads `accountType` at all — `hasTenantMembership`
  is derived purely from `memberships`/legacy `roles`, never from
  `accountType`. A `customer` account with zero memberships hitting
  `/console` directly (defense-in-depth, not the expected flow) gets the
  same onboarding screen a `business` account would — accountType only
  ever decided the *post-login redirect destination* (`docs/POST_LOGIN_ROUTING_ACCOUNT_TYPE_AUDIT.md`),
  never Console's internal gating.
- **Public storefront subdomain resolution is untouched.**
  `src/middleware.ts` and `src/app/[tenantSlug]/layout.tsx` (and its
  `[branchSlug]` counterpart) were not modified — they still resolve
  tenant purely from the URL/subdomain via their own `loadTenant(tenantSlug)`
  calls, completely independent of `useRbacStore.hasTenantMembership`.
- **`TenantBootstrapper`, `resolveConsoleTenantFallbackSlug()`
  (the prior phase's Console membership-based tenant fallback), and
  `normalizeTenantPermissions()`** are all untouched — this phase adds a
  new signal alongside them, it doesn't replace anything they do.

## 6. Files Changed

| File | Change |
|---|---|
| `src/stores/index.ts` | `useRbacStore`: new `hasTenantMembership: boolean \| null` field + setter; reset by `_resetStore()`; not persisted. |
| `src/services/permission.service.ts` | New exported `hasAnyMembership()` pure helper. |
| `src/hooks/index.ts` | `useLogin()`/`useRegister()`/`useVerifyOTP()` now call `setHasTenantMembership()` independent of tenant resolution. |
| `src/providers/index.tsx` | `checkSession()` now calls `setHasTenantMembership()` immediately on `getMe()` resolving. |
| `src/components/admin/ConsoleWorkspaceGate.tsx` (new) | The tenant-context + RBAC decision tree that replaces `AuthGuard`'s old hard gate for Console. |
| `src/components/admin/ConsoleOnboarding.tsx` (new) | The zero-membership landing state. |
| `src/app/console/layout.tsx` | `AuthGuard` reduced to auth-only; wraps `ConsoleWorkspaceGate` instead of gating tenant/RBAC directly. |
| `src/components/auth/AuthGuard.tsx` | No behavior change — corrected a misleading comment about what `<AuthGuard>` with no `requiredPermission` prop actually enforces (nothing — it's auth-only), since Console is now the first real caller relying on exactly that. |
| `src/i18n/locales/{en,fa,ar}.json` | Added `console.onboardingTitle`/`onboardingDesc`/`onboardingContactCta`. |
| `src/test/phase-Z-10-console-workspace-gate.test.tsx` (new) | 8 tests covering all three required scenarios plus the "has membership but tenant genuinely failed" edge case. |
| `docs/CONSOLE_TENANT_DEPENDENCY_REDESIGN_AUDIT.md` (new, this file) | Full audit trail. |

## 7. New Console Initialization Flow

```
/console
  |
  v
AuthGuard (auth only) — redirect to /login if unauthenticated
  |
  v
ConsoleWorkspaceGate
  |
  +-- hasTenantMembership === null  -> wait
  |
  +-- hasTenantMembership === false -> ConsoleOnboarding ("Create your first business")
  |
  +-- hasTenantMembership === true
        |
        v
      tenantState (subdomain resolution, or membership-based fallback)
        |
        +-- loading      -> wait
        +-- not resolved -> tenant-specific error (real failure, has membership)
        +-- resolved
              |
              v
            usePermission('dashboard:access')
              |
              +-- false -> AccessDenied
              +-- true  -> full workspace (AdminHeader, AdminContextBar
                            incl. tenant switcher, AdminSidebar, page content)
```

## 8. Tests and Verification

- `src/test/phase-Z-10-console-workspace-gate.test.tsx` (new, 8 tests):
  1. Business owner WITH a tenant — workspace children render.
  2. Business owner WITH a tenant — the tenant switcher (`tenant.view`-gated)
     renders.
  3. Business owner WITH a tenant but no permission grant — `AccessDenied`,
     not the workspace (RBAC unchanged).
  4. Business user WITHOUT a tenant — onboarding renders, not "Tenant not
     found", and workspace content does not leak through.
  5. `hasTenantMembership` still `null` — renders nothing yet (no
     premature onboarding flash before the session is known).
  6. Has a membership but `tenantState === 'not_found'` — the tenant
     error renders, distinct from onboarding.
  7-8. Public storefront: `[tenantSlug]/layout.tsx` still calls
     `loadTenant(tenantSlug)`; `middleware.ts` still resolves the slug
     from the subdomain — source-text assertions proving this phase
     never touched that path.
- **Live browser verification** (Chromium, mock mode): logged in as
  `owner@samoon.com` (demo one-click login) → `/console` renders the full
  workspace exactly as before (header, sidebar, tenant switcher showing
  "Samoon ▾") — confirms zero regression to the working case.
- `npx tsc --noEmit -p .` — zero new errors (identical to the established
  baseline).
- `npx vitest run` — full suite; only the same pre-existing baseline
  failures (see commit message for the exact count).
- `npm run build` — production build verified clean.
