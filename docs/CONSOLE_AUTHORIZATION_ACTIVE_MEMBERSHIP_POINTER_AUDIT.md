# Console Authorization Audit: `activeMembership` Pointer-Only Bug

**Status: root cause found and fixed. Frontend bug, not a missing backend
field.**

## 1. Root Cause

`GET /auth/me/` sends `activeMembership` as a **minimal pointer** —
`{ tenantId }` only — to indicate which entry in `memberships` is
currently active, not a duplicate of the full membership record:

```json
"memberships": [{ "tenantId": "af09...", "tenantSlug": "2cum17xs", "roles": ["owner", "admin"], "branchAccess": { "scope": "all" } }],
"activeMembership": { "tenantId": "af09..." }
```

`selectActiveMembership()` (`src/services/permission.service.ts`), the
function `normalizeTenantPermissions()` uses to pick which membership a
session restore applies to, previously trusted `activeMembership` as a
**complete** `TenantMembership` the instant it was present:

```ts
// Before
if (activeMembership) return activeMembership
```

Since this payload's `activeMembership` has no `roles`/`branchAccess`,
`selected.roles` was `undefined`. Downstream, `getPermissionsForRole(undefined)`
returns `[]` (its own defensive "null/undefined role → deny" contract —
working exactly as designed, just fed the wrong input) — so
`currentTenantSession.permissions` ended up empty, `dashboard:access` was
false, and `AuthGuard` rendered `AccessDenied` even though the user
genuinely holds `owner`/`admin` on their one and only tenant membership.

This is why the user was never auto-redirected to Console either: nothing
in the redirect/entry logic checks `accountType` (confirmed — see §3) or
membership existence in isolation; both paths (auto-redirect intent and
manual navigation) ultimately gate on the same empty
`currentTenantSession.permissions`.

## 2. Complete Flow Traced

```
authService.getMe()                              (src/services/auth.service.ts)
  → { user, memberships, activeMembership }
  → AuthBootstrapper.checkSession()               (src/providers/index.tsx)
    → resolveSessionRestoreInput(data)             (src/providers/index.tsx)
    → normalizeTenantPermissions(sessionInput, tenant.id)  (src/services/permission.service.ts)
      → selectActiveMembership(memberships, activeMembership, tenant.id)   ← bug was here
    → useRbacStore.setCurrentTenantSession(tenant.id, roles, permissions, branchAccess)
  → AuthGuard (src/components/auth/AuthGuard.tsx)
    → usePermission('dashboard:access')            (src/hooks/index.ts)
      → usePermissions() reads currentTenantSession.permissions
    → permissionGranted === false → renders permissionDeniedFallback (AccessDenied)
```

Stores involved: `useAuthStore` (user/accountType), `useTenantStore`
(resolved tenant + `tenantState`), `useRbacStore` (`currentTenantSession`
— the single permission source; holds `{ tenantId, roles, permissions,
branchAccess }` for the active tenant only).

## 3. Is `accountType` involved in Console access at all?

No, by design (Phase 9.3, `src/test/phase-9-3-account-type-not-authorization.test.tsx`).
`accountType` (`'customer' | 'business'`) is documented and tested as a
**UX hint only** — which experience to start a user in before tenant
context exists — never an authorization signal. Both a `business`
account with no membership and a `customer` account with a real
membership are exercised by that suite, proving membership/roles are the
only thing that has ever granted Console access. Nothing needed to change
here; this rules out "the frontend expects a `consoleAccess` flag on
`accountType`" as a cause.

## 4. Is backend data missing?

No. Everything required is present in the payload:
- `accountType: "business"` — correctly ignored for authorization (§3).
- `memberships[0].roles = ["owner", "admin"]` — the real roles.
- `memberships[0].branchAccess = { scope: "all" }` — the real branch scope.
- `activeMembership.tenantId` — sufficient to identify which membership
  is active, once the frontend treats it as a selector instead of a
  record.

No `permissions` array, `tenantRoles`, `rolePermissions`,
`consoleAccess`, or `modules` field is needed — `ROLE_PERMISSION_MAP`
(permission.service.ts) already derives the full permission set from
`roles` alone, and did so correctly the moment `roles` was read from the
right place.

## 5. Fix

`selectActiveMembership()` now treats `activeMembership` as **only** a
tenantId selector. The returned record is always sourced from
`memberships` — never from `activeMembership` directly:

```ts
function selectActiveMembership(memberships, activeMembership, currentTenantId) {
  if (!memberships || memberships.length === 0) return undefined
  const activeTenantId = activeMembership?.tenantId
  if (activeTenantId) {
    const match = memberships.find((m) => m.tenantId === activeTenantId)
    if (match) return match
  }
  if (currentTenantId) {
    const match = memberships.find((m) => m.tenantId === currentTenantId)
    if (match) return match
  }
  return memberships.length === 1 ? memberships[0] : undefined
}
```

Selection priority is unchanged (`activeMembership.tenantId` →
`currentTenantId` → sole entry); only the *source of truth for the
returned record's fields* changed, from "trust `activeMembership`
verbatim" to "always resolve the full record from `memberships`."
Backward compatible: a caller that already sends a full-record
`activeMembership` whose `tenantId` also appears in `memberships` gets an
identical result (the matching `memberships` entry, which is the same
data). An `activeMembership` pointing at a tenantId absent from
`memberships` (malformed backend response) falls through to
`currentTenantId`/sole-entry, never fabricating roles — deny-by-default
is preserved.

## 6. Files Changed

| File | Change |
|---|---|
| `src/services/permission.service.ts` | `selectActiveMembership()` resolves the full `TenantMembership` from `memberships` by tenantId instead of trusting `activeMembership` as a complete record. |
| `src/test/phase-Z-7-active-membership-pointer.test.ts` (new) | Reproduces the exact reported payload; asserts `dashboard:access` is granted; covers multi-membership selection, backward compatibility with full-record `activeMembership`, and the malformed/unknown-tenantId fallback. |
| `docs/CONSOLE_AUTHORIZATION_ACTIVE_MEMBERSHIP_POINTER_AUDIT.md` (new, this file) | Full audit trail. |

No changes to `AuthGuard`, `ConsoleGuard` (there is no separate
`ConsoleGuard` — Console's layout uses the general-purpose `AuthGuard`
with `requiredPermission="dashboard:access"`), redirect logic, or
`ROLE_PERMISSION_MAP` — none of those were broken; they were all
correctly denying access given the empty permission set they were fed.

## 7. Tests Covering Business Owner/Admin Console Access

- `src/test/phase-Z-7-active-membership-pointer.test.ts` (new, 5 tests) —
  reproduces the exact reported bug payload end-to-end through
  `normalizeTenantPermissions()`.
- `src/test/phase-9-3-account-type-not-authorization.test.tsx` (existing,
  unaffected) — proves `accountType` alone never grants or blocks access;
  still passes, confirming this fix didn't reintroduce an `accountType`
  shortcut.
- `src/test/p10.7-rbac-session-hydration.test.ts`,
  `p10.9-auth-session-hardening.test.tsx`, `p10.10-auth-backend-contract.test.ts`
  (existing, unaffected) — cover the mock-mode `getMe()` path, which
  already sent full-record `activeMembership` and continues to pass
  unchanged.

## 8. Verification

- `npx tsc --noEmit -p .` — zero new errors (identical to the established
  baseline).
- `npx vitest run` — 5942/5961 pass; only the same 19 pre-existing
  baseline failures (unrelated `createdAt`/`updatedAt`/`RegisterData.email`
  fixture mismatches), plus 5 new passing tests from this fix.
- `npm run build` — production build verified clean.
