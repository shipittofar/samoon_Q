# Post-Login Routing Audit: `accountType` as the Authoritative Landing-Page Gate

**Status: two real gaps found and fixed. Not an authorization change —
`dashboard:access` continues to gate Console exactly as before.**

## 1. Root Cause

Two independent gaps, both in the *initial landing-page direction* logic
— never in authorization:

**Gap A — `getPostLoginRedirect()` checked `tenantRoles` before
`accountType`.** (`src/utils/auth-redirect.ts`)

```ts
// Before
export function getPostLoginRedirect(accountType, tenantRoles) {
  if (tenantRoles && tenantRoles.length > 0) return resolveWorkspace(tenantRoles)
  return accountType === 'business' ? '/console' : '/dashboard'
}
```

`tenantRoles` (when present) won the decision outright, in *either*
direction. `getPostLoginRedirect('customer', ['owner'])` resolved to
`/console` — a `customer` accountType landing on Console purely because
some tenant-scoped role data was attached to the session. This is exactly
backwards from the newly explicit requirement: `customer` must always
land on `/dashboard`, full stop.

(For `business`, this ordering happened to still produce the right
answer in every traced path, because `Role` — the tenant-role union,
`src/types/rbac.ts` — has no `'customer'` member, so `resolveWorkspace()`
can never route a `business` account back out to `/dashboard`. The
`customer` direction was the one actually broken.)

**Gap B — `complete-profile/page.tsx` never called
`getPostLoginRedirect()` at all.**

```ts
// Before
onSuccess: () => {
  toast.success(t('completeProfileSuccess'))
  router.push('/dashboard')  // hardcoded, regardless of the new account's accountType
},
```

This is the phone-OTP registration-completion page
(`/verify` → `is_new_user: true` → `/complete-profile` →
`useRegister()`). Its success handler hardcoded `/dashboard`
unconditionally — the one post-auth success handler in the app that
didn't route through `getPostLoginRedirect()` at all. A `business`
signup completed through this flow always landed on `/dashboard`,
regardless of `result.user.accountType`.

**`AccessDenied.tsx`** (the Console "go to my workspace" link, not a
login handler, but part of the same decision family) had the identical
ordering bug as Gap A, hand-rolled independently instead of reusing
`getPostLoginRedirect()` — fixed for consistency, closing a second copy
of the same defect.

## 2. Trace: All Post-Authentication Redirect Logic Found

| Handler | File | Status before |
|---|---|---|
| Email/password login success | `src/app/login/LoginClientPage.tsx:141` | Already used `getPostLoginRedirect()` — inherited Gap A only |
| Demo one-click login | `src/app/login/LoginClientPage.tsx:123` | Uses `getDemoRedirect()` (unaffected — keyed by fixed per-account demo map, not accountType/tenantRoles) |
| OTP verify (existing user) | `src/app/verify/page.tsx:123-129` | Already used `getPostLoginRedirect()` — inherited Gap A only |
| OTP verify (new user) → complete-profile → register success | `src/app/complete-profile/page.tsx:80-83` | **Gap B** — hardcoded `/dashboard`, bypassed `getPostLoginRedirect()` entirely |
| `AuthBootstrapper`/`checkSession()` (session restore on refresh) | `src/providers/index.tsx` | No redirect at all — correctly does not re-route an already-landed user on every page load (see `docs/CONSOLE_TENANT_RESOLUTION_FALLBACK_AUDIT.md` for its separate tenant-resolution concern) |
| `middleware.ts` | `src/middleware.ts` | No accountType-based redirect — only auth-cookie gating + tenant-slug header injection; unaffected |
| Console `AccessDenied` "go to my workspace" | `src/components/admin/AccessDenied.tsx` | Same ordering bug as Gap A, hand-rolled independently |
| `AuthGuard` (`src/components/auth/AuthGuard.tsx`) | — | No accountType logic at all — confirmed still gates purely on `dashboard:access`, per constraint |

## 3. Why a business user could land on `/dashboard`

Not from `LoginClientPage.tsx`'s email/password path — that one already
correctly resolved `business` → `/console` in every traced input,
including the exact reported `/auth/me` payload
(`accountType: "business"`, `memberships[0].roles: ["owner","admin"]`).

The concrete, reproducible path is **Gap B**: any business account whose
session originates from the phone-OTP `/complete-profile` registration
flow landed on `/dashboard` unconditionally, because that handler never
consulted `accountType` at all.

## 4. Fix

**`src/utils/auth-redirect.ts`** — `accountType` now gates direction
first; `tenantRoles` only refines *which* `/console/*` sub-page a
`business` account lands on:

```ts
export function getPostLoginRedirect(accountType: AccountType, tenantRoles?: Role[] | null): string {
  if (accountType === 'business') {
    if (tenantRoles && tenantRoles.length > 0) return resolveWorkspace(tenantRoles)
    return '/console'
  }
  return '/dashboard'
}
```

**`src/app/complete-profile/page.tsx`** — routed through the same
function every other success handler uses:

```ts
onSuccess: (result) => {
  toast.success(t('completeProfileSuccess'))
  router.push(getPostLoginRedirect(result.user.accountType, result.p7Roles))
},
```

**`src/components/admin/AccessDenied.tsx`** — replaced its independent
hand-rolled decision with a call to `getPostLoginRedirect()`, so there is
exactly one implementation of "accountType decides direction" in the
codebase, not two that can drift apart.

## 5. What Did Not Change (by design)

- `AuthGuard`'s `requiredPermission="dashboard:access"` check
  (`src/components/auth/AuthGuard.tsx`) is untouched. A `business`
  account with no permission on its resolved tenant still lands on
  `/console` (per the fix) and sees `AccessDenied` there — that is the
  correct, expected outcome per the task's own acceptance criteria, not
  a bug.
- Console tenant *resolution* (which tenant loads once `/console` is
  reached) is a separate concern, already fixed in
  `docs/CONSOLE_TENANT_RESOLUTION_FALLBACK_AUDIT.md` — this fix is only
  about which URL a client is sent to immediately after login/register.
- `resolveWorkspace()`/`ROLE_WORKSPACE_MAP`
  (`src/utils/navigation-intelligence.ts`) are unchanged — `Role` has no
  `'customer'` member, so a `business` account can never resolve outside
  `/console/*` through this path.
- `middleware.ts` and `AuthBootstrapper` — confirmed to contain no
  accountType-based redirect logic at all; nothing to change.

## 6. Files Changed

| File | Change |
|---|---|
| `src/utils/auth-redirect.ts` | `getPostLoginRedirect()` — `accountType` is now the authoritative gate on direction; `tenantRoles` only refines the `business` sub-path. |
| `src/app/complete-profile/page.tsx` | Register-success handler now calls `getPostLoginRedirect(result.user.accountType, result.p7Roles)` instead of hardcoding `router.push('/dashboard')`. |
| `src/components/admin/AccessDenied.tsx` | "Go to my workspace" link now reuses `getPostLoginRedirect()` instead of a second, independently-drifted accountType/roles decision. |
| `src/test/p10.3-login-routing.test.ts` | Rewritten: customer-with-tenant-roles now asserts `/dashboard` (was `/console`), matching the fixed contract. |
| `src/test/phase8-9-1-auth-redirect.test.ts` | Same assertion update. |
| `src/test/phase8-9-7-3-navigation-intelligence.test.ts` | Added a customer-never-console case. |
| `src/test/phase-Z-9-account-type-post-login-routing.test.ts` (new) | Reproduces the exact reported payload; covers both closed gaps via unit tests plus source-text assertions confirming every post-auth success handler routes through `getPostLoginRedirect()`. |
| `docs/POST_LOGIN_ROUTING_ACCOUNT_TYPE_AUDIT.md` (new, this file) | Full audit trail. |

## 7. Verification

- Business owner/admin (exact reported payload) →
  `getPostLoginRedirect('business', ['owner','admin'])` → `/console`. ✓
- Business user without permission → still lands on `/console`
  (unchanged `AuthGuard` behavior) → sees `AccessDenied` there. ✓ (correct
  per task's own acceptance criteria)
- Customer account → `/dashboard`, unconditionally, including with
  tenant roles present (the closed gap). ✓
- `npx tsc --noEmit -p .` — zero new errors (identical to the established
  baseline).
- `npx vitest run` — full suite; only the same pre-existing baseline
  failures (see commit message for the exact count).
- `npm run build` — production build verified clean.
