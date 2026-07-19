# Post-Login Redirect Loop: Root Cause and Fix

**Status: root cause found and fixed. Middleware bug, not React/auth-store,
not tenant context, not a race condition.**

## 1. Root Cause

The exact reported URL — `/login?redirect=%2Fconsole` — is constructed in
**exactly one place** in this codebase: `src/middleware.ts`'s
unauthenticated-redirect branch (`loginUrl.searchParams.set('redirect',
pathname)`). Nothing in `AuthGuard`, `ConsoleWorkspaceGate`, or any
client-side routing logic builds this URL. This single fact rules out
every client-side investigation avenue (auth store, tenant context,
React race conditions) as the *origin* — by the time any of that code
would run, middleware had already rejected the request and the
`/console` React tree never mounted.

`middleware.ts`'s `isValidJWT()` — a fast Edge-runtime heuristic gate,
explicitly documented as *not* a security boundary ("full signature
verification is delegated to the backend on every API call") — returned
`false` ("not logged in") for **any** access-token cookie value it could
not parse as a well-formed 3-segment JWT with a numeric `exp` claim in
seconds:

```ts
// Before
function isValidJWT(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false        // <- any non-JWT-shaped token
  try {
    ...
    if (typeof exp !== 'number') return false  // <- any unrecognized exp claim
    return exp * 1000 > Date.now()
  } catch {
    return false                                // <- any parse failure
  }
}
```

A **present** token that merely doesn't match this parser's assumptions
(an opaque, non-JWT access token; a JWT whose `exp` claim isn't in the
exact shape expected) is not proof the user is logged out — it only
proves the heuristic couldn't read it. Treating "can't parse" the same
as "invalid" turned any such token into a false logout.

## 2. The Loop Mechanism

The false rejection alone would be a single bad redirect. It became a
**loop** because of what middleware does on rejection:

```ts
const redirectResponse = NextResponse.redirect(loginUrl)
if (token) {
  redirectResponse.cookies.delete(JWT_ACCESS_KEY)   // <- deletes the COOKIE
}
```

`setTokens()` (`src/services/axios.instance.ts`) writes the access token
to **both** `localStorage` and a mirrored cookie, synchronously, before
`login()`'s promise resolves — confirmed by trace: `authService.login()`
calls `setTokens(data.tokens.access, data.tokens.refresh)` before
`return data`, and `LoginClientPage.tsx`'s `onSuccess` (which calls
`router.push(getPostLoginRedirect(...))`) only runs after that promise
resolves. There is no race here — the cookie is already set before
navigation begins.

But when middleware falsely rejects the cookie and deletes it, only the
**cookie** is cleared — `localStorage`'s copy is untouched (nothing
client-side calls `clearTokens()` for this path; that only happens on a
real 401 from `checkSession()`/the axios interceptor). So:

1. Login succeeds. `localStorage` + cookie both hold the access token.
2. `router.push('/console')` → middleware reads the cookie →
   `isValidJWT()` false-negatives → redirects to `/login?redirect=%2Fconsole`
   **and deletes the cookie**.
3. The app's client-side auth state is still backed by `localStorage`
   (`getAccessToken()` reads `localStorage`, not the cookie) — so on the
   `/login` page, `AuthBootstrapper.checkSession()` still finds a token
   and (correctly, since the token itself was never actually invalid)
   authenticates successfully again.
4. Any subsequent attempt to reach `/console` — a retry, a nav click, a
   next login submission — hits middleware again. The cookie is now
   **missing** (deleted in step 2), so it redirects again, unconditionally.

Every login attempt reproduces the identical bounce — exactly the
reported "stuck in a redirect loop."

## 3. Investigation Checklist (as requested)

| Item | Finding |
|---|---|
| Login API response includes complete auth token + user object | Not the cause — `setTokens()` runs synchronously before `login()` resolves; `localStorage` and cookie are both written correctly. |
| Auth state is stored and accessible | Yes — confirmed via source trace, not reproducible as a storage bug. |
| Auth guard allows immediate redirect for verified users | `AuthGuard`/`ConsoleWorkspaceGate` never even run for this bug — middleware rejects before the React tree mounts. `is_verified`/RBAC/tenant context are irrelevant to this specific failure. |
| Redirect URL is decoded correctly from query params | No code in this app reads `?redirect=` at all (grepped, zero matches) — it is set once by middleware and never consumed, so decoding is not part of the failure path. |
| No middleware is blocking access to `/console` | **This was exactly the issue** — `isValidJWT()`'s false-negative. |
| Active tenant is set before navigation | Irrelevant — the user has `activeMembership`/`memberships` and Console's tenant-resolution architecture (see prior audits) is unaffected; the request never reaches that code. |

Point 4 of the task ("is `/console` tenant-specific and needs
`/{tenantSlug}/console` routing?") — no. `/console` is deliberately
membership-based, not URL-slug-based (see
`docs/CONSOLE_TENANT_RESOLUTION_FALLBACK_AUDIT.md` and
`docs/CONSOLE_TENANT_DEPENDENCY_REDESIGN_AUDIT.md`) — introducing
`/{tenantSlug}/console` routing was correctly not needed and is not part
of this fix.

## 4. Fix

`isValidJWT()` (`src/middleware.ts`) now only rejects a token it can
**positively prove** is expired — a well-formed JWT with a past numeric
`exp`. Anything it cannot parse (non-JWT shape, unparseable payload,
non-numeric `exp`) is treated as possibly valid and let through; the
real authority remains the backend's own 401 responses on actual API
calls (already handled by the axios interceptor + `AuthBootstrapper.clearSession()`,
unchanged). The "no cookie at all" case — genuinely logged out — is
completely unaffected and still redirects correctly.

```ts
function isValidJWT(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return true
  try {
    ...
    if (typeof exp !== 'number') return true
    return exp * 1000 > Date.now()
  } catch {
    return true
  }
}
```

## 5. Files Changed

| File | Change |
|---|---|
| `src/middleware.ts` | `isValidJWT()` — parse failures / unrecognized shapes now default to "possibly valid" instead of "invalid." Only a positively-proven-expired JWT is rejected. |
| `src/test/phase-Z-12-middleware-jwt-redirect-loop.test.ts` (new) | 8 tests: baseline (valid JWT accepted), the reported bug (opaque token no longer redirects), unparseable payload, non-numeric `exp`, a genuinely expired JWT (still correctly rejected), no-cookie-at-all (still correctly rejected), unprotected routes unaffected, and a source-trace proving `setTokens()` writes both storages synchronously before `login()` resolves (ruling out the race-condition investigation avenue). |
| `docs/POST_LOGIN_REDIRECT_LOOP_AUDIT.md` (new, this file) | Full audit trail. |

## 6. Verification

- `npx tsc --noEmit -p .` — zero new errors (identical to the established
  baseline).
- `npx vitest run` — full suite; only the same pre-existing baseline
  failures (see commit message for the exact count).
- `npm run build` — production build verified clean.
