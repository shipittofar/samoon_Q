# Auth Refresh Persistence Audit

**Status: root cause found, fixed, and regression-tested.**

Traced the complete runtime flow (browser refresh → middleware → auth
bootstrapper → token storage → auth store hydration → `GET /auth/me` → user
state → route guards → dashboard/console rendering) against the running
application (mock mode, real browser, `chromium` via Playwright) and against
the frozen backend contract (`docs/BACKEND_CONTRACT.md`,
`docs/FRONTEND_CONTEXT_MODEL.md`).

---

## 1. Root Cause

`AuthBootstrapper.checkSession()` (`src/providers/index.tsx`) — the sole
session-restore path run on every page load/refresh — gated its **entire**
RBAC session-restore block on the legacy field `user.tenantRoles`:

```ts
// BEFORE (the bug)
if (user.tenantRoles && user.tenantRoles.length > 0) {
  // ...normalizeTenantPermissions() + setCurrentTenantSession()...
}
```

`useLogin()` / `useRegister()` / `useVerifyOTP()` (`src/hooks/index.ts`) have
**no such gate** — they call `seedTenantSession()` unconditionally on every
successful login. This asymmetry is invisible as long as a backend sends
`tenantRoles` on every auth response (mock mode always does — see §3). It
becomes a real bug the moment a backend implements **only** the frozen
`memberships`/`activeMembership` contract (`docs/BACKEND_CONTRACT.md` §1.3)
with no legacy `tenantRoles` field at all — exactly what this task describes:
`GET /api/auth/me/` returning `memberships: [...]`, `activeMembership`, and
no `user.role` / legacy fields.

**Effect:**
- Login: `useLogin()`'s unconditional `seedTenantSession()` call correctly
  seeds `currentTenantSession` from `memberships`. Everything works, exactly
  as reported ("login works correctly... dashboard opens").
- Refresh: `checkSession()` calls `getMe()`, gets a `user` object back, and
  **does** call `setUser(user)` — so `useAuthStore.user` is not null and the
  raw identity survives. But because `user.tenantRoles` is `undefined` (the
  new backend never sends it), the `if` block is skipped entirely.
  `currentTenantSession` stays `null`. `usePermissions()` returns `[]`.
  Every permission-gated surface — most importantly `/console`, gated by the
  `dashboard:access` permission every role grants — renders as `AccessDenied`
  or empty, which is functionally indistinguishable from being logged out,
  even though the token and `useAuthStore.user` never actually disappeared.

This matches the reported symptom precisely: login works, the dashboard
route (which only checks `isAuthenticated`, not permissions — see §3.2)
still renders, but the user's actual authenticated *experience* (console
access, permissions) is gone, and they perceive it as needing to log in
again.

## 2. Exact Files Causing the Issue

| File | What was wrong |
|---|---|
| `src/providers/index.tsx` — `AuthBootstrapper.checkSession()` | Session-restore block gated on `user.tenantRoles && user.tenantRoles.length > 0` only; ignored `user.memberships`/`user.activeMembership` for the gate decision (it already *used* them once inside the block — Phase Z.1 wired that part — but never as the trigger to enter the block). |
| `src/providers/index.tsx` — `pendingTenantRolesRef` | Same bug in the deferred path: only queued `Role[]` for later application once a tenant resolves, dropping `memberships`/`activeMembership` for the delayed-tenant-resolution case too. |

No other file in the traced flow (middleware, token storage, API client,
Zustand persistence, React Query) had a bug — see §4 below for what was
audited and confirmed already correct.

## 3. Before / After Behavior

| Scenario | Before | After |
|---|---|---|
| Backend sends `tenantRoles` only (legacy contract) | Works | Works (unchanged — this path was never broken) |
| Backend sends `memberships`/`activeMembership` only (frozen contract, no `tenantRoles`) | **Broken** — session restore silently skipped on every refresh | **Fixed** — session restore proceeds from `memberships` |
| Backend sends both (mock mode today) | Works | Works (unchanged) |
| Customer with zero memberships (`memberships: []`) | Restore skipped (same bug — `[]` is also falsy under `.length > 0`... but this case was actually already broken pre-fix too, now explicitly correct) | Explicitly restores an empty, deny-by-default session — not a silent no-op |
| No tenant resolved yet at the moment `getMe()` resolves | `Role[]`-only queued, memberships dropped | Full session-restore input queued and applied once the tenant resolves |
| 401 / expired token | `clearSession()` (unchanged) | `clearSession()` (unchanged — this fix does not touch the `.catch()` branch) |

## 4. Audit of Each Area (per the task's checklist)

### 4.1 Authentication Storage — confirmed correct, no change
- Access/refresh tokens: `localStorage` (`JWT_ACCESS_KEY`/`JWT_REFRESH_KEY`),
  set by `setTokens()` (`src/services/axios.instance.ts`).
- Access token is also mirrored to a non-HttpOnly cookie
  (`document.cookie = access_token=...`) specifically so Edge middleware can
  read it (`src/middleware.ts`) — `localStorage` is not readable from Edge
  middleware, so this mirror is required, not redundant.
- `useAuthStore` (`src/stores/index.ts`) — deliberately **not** wrapped in
  `persist()`. This is correct by design (`docs/FRONTEND_CONTEXT_MODEL.md`
  §4): `user` is always re-derived from `getMe()`, never trusted from a
  stale cache. Confirmed after reload: tokens/cookie survive, `user` is
  re-fetched fresh via `checkSession()`.

### 4.2 Auth Bootstrap Flow — confirmed correct, no change
`AuthBootstrapper` (`src/providers/index.tsx`), mounted once in the root
provider tree (`src/app/layout.tsx` → `<Providers>` → `<AuthBootstrapper>`,
wrapping every route including `/dashboard` and `/console`), runs exactly
the sequence the task requires: check token → `getMe()` → `setUser()` →
restore memberships/permissions (the part this fix corrects) → `isLoading`
set to `false` (via `setUser()`/`setSessionCheckFailed()`, both of which
flip `isLoading`). Confirmed the app does not consider the user logged out
before this resolves (see §4.3).

### 4.3 Race Condition Audit — confirmed correct, no change
Both route guards already implement the correct pattern:
- `src/app/dashboard/layout.tsx`: `if (isLoading || !isAuthenticated) return null` before ever redirecting — never redirects while hydration is in flight.
- `src/components/auth/AuthGuard.tsx` (used by `/console`): same `isLoading`-first pattern (confirmed in a prior phase, unchanged here).

No instance of the "wrong" pattern (`if (!user) redirect`) was found gating
on `user` alone without first checking a loading/initialized flag.

### 4.4 Middleware Audit — confirmed correct, no change
`src/middleware.ts` reads the `access_token` cookie (matches
`JWT_ACCESS_KEY`, the same key `setTokens()` mirrors), validates JWT
structure + `exp` (Edge-runtime-safe, no full signature check — delegated to
the backend), and redirects only when the cookie is missing or expired.
Confirmed this does not fire on a normal, still-valid-token refresh (the
reported bug's premise — "dashboard route still renders" — is consistent
with middleware behaving correctly and the actual problem being downstream,
in `checkSession()`).

### 4.5 API Client Audit — confirmed correct, no change
`src/services/axios.instance.ts`: request interceptor always attaches
`Authorization: Bearer <access_token>` from `localStorage` (not from a
store, so it survives reload independent of any React state). Response
interceptor handles `401` with a single deduplicated refresh attempt, then
`clearTokens()` + `auth:logout` event on failure. Unrelated to this bug and
unchanged.

### 4.6 User Type Contract — confirmed correct, no change
`grep -rn "user\.role\b|tenant\.owner"` across `src/` returns zero matches.
No global-role or ownership-bypass assumption exists anywhere in the
authorization path — this was fully migrated in Phase 9.3 and re-confirmed
in every audit since. The bug in this report is unrelated to `user.role`
assumptions; it is specifically about the `tenantRoles`-only gate.

### 4.7 Zustand / State Management — confirmed correct, no change
`useAuthStore`: not persisted (correct). `useTenantStore`/`useRbacStore`:
persisted, but `currentTenantSession` is explicitly excluded via
`partialize` (never persisted — reconstructed fresh every load, which is
exactly what makes this bug possible: if it were persisted, a stale
"working" session would have masked the bug rather than exposing it).

### 4.8 React Query — confirmed correct, no change
`useMe()` uses `queryKey: ['me']`, `retry: false` — but `AuthBootstrapper`'s
`checkSession()` calls `authService.getMe()` directly, not through this
hook, so React Query caching does not affect session restore at all. No
`enabled` misconfiguration found.

## 5. Files Changed

| File | Change |
|---|---|
| `src/providers/index.tsx` | Added exported `resolveSessionRestoreInput()` — the single, testable gate deciding whether a `getMe()` response has anything to restore, now checking `memberships`/`activeMembership` presence (not just non-empty legacy `tenantRoles`). `checkSession()` and the deferred-tenant queue (`pendingTenantRolesRef` → renamed `pendingAuthSessionRef`, widened to hold the full restore input instead of just `Role[]`) both use it. |
| `src/test/auth-refresh-persistence.test.ts` (new) | Regression suite — see §6. |

## 6. Tests Added

`src/test/auth-refresh-persistence.test.ts` (12 tests, all passing):

- **A — `resolveSessionRestoreInput()` gate**: proves the exact bug (a
  memberships-only response that the old inline gate logic would have
  skipped) and proves the fix resolves it; owner user; customer user (empty
  memberships); legacy-only backend (backward compatibility); a bare
  response with neither field (correctly resolves `null` — nothing to
  restore); multi-membership user.
- **B — Full restore flow** (exercises the real exported function + real
  `normalizeTenantPermissions()` + real `useRbacStore`, not a
  reimplementation): owner user restores correctly from a memberships-only
  response; customer restores to an explicit empty session; multi-membership
  user's `activeMembership` correctly selects Tenant B's roles/branchAccess;
  legacy-only backend still restores correctly; no-tenant-yet case does not
  throw and does not populate prematurely.
- **C — Expired token**: documents why 401/expired-token handling is
  unaffected by this fix (it lives in `checkSession()`'s `.catch()`, never
  reached when `resolveSessionRestoreInput()` runs) and points to the
  existing `p10.9`/`p10.10` regression suites rather than duplicating them.

## 7. Final Verification

- **Manual reproduction**: ran the app in a real Chromium browser (mock
  mode, `NEXT_PUBLIC_USE_MOCK=true`), logged in as `owner@samoon.com`,
  reloaded `/dashboard` and `/console/tenants` repeatedly (including
  sampling every 150ms across a 3s window immediately after reload to catch
  any transient flash of logged-out state) — no regression, session persists
  correctly before and after this fix (mock mode always sends both
  `tenantRoles` and `memberships` together, so it could not reproduce the
  bug itself — confirmed via code trace + the new unit tests instead, which
  isolate the exact gate condition a memberships-only backend would hit).
- `npx tsc --noEmit -p .` — zero new errors (diffed against the pre-existing
  baseline; identical modulo one pre-existing failure's line-number shift).
- `npx vitest run` on the full related suite (`auth-refresh-persistence`,
  `p10.7-rbac-session-hydration`, `p10.9-auth-session-hardening`,
  `phase-X-3-console-context-stabilization`,
  `phase-Z-1-frontend-contract-alignment`,
  `phase-9-2-tenant-membership-types`, `context-integrity`) — 109/109 pass.
- No other files needed changes — the persistence layer, middleware, API
  client, route guards, and Zustand/React Query configuration were all
  already correct (§4).
