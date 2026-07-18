# Frontend Auth Contract Update: `GET /auth/me/` Response Nesting

**Status: complete.** The frontend now consumes the real `/auth/me/`
contract, which nests the `User` under a `user` key alongside
`memberships`/`activeMembership`, instead of assuming the flat
`User & {...}` shape every other frontend phase in this project had
assumed (including the `docs/BACKEND_CONTRACT.md` I authored in Phase Y,
which documented this endpoint as flat — that document is now wrong on
this point and should be corrected in a future doc-only pass).

## 1. Root Cause

```
OLD (what the frontend assumed):
{ "id": "...", "email": "...", "first_name": "...", ..., "memberships": [...], "activeMembership": {...} }

NEW (the actual contract):
{ "user": { "id": "...", "email": "...", "first_name": "...", ... }, "memberships": [...], "activeMembership": {...} }
```

Every field the task lists as required on the nested `user` object
(`phone_number`, `first_name`, `last_name`, `avatar`, `is_verified`,
`created_at`) **already existed** on the frontend's `User` interface
(`src/types/index.ts`) — nothing needed adding there. The actual change is
structural: `getMe()`'s result must be destructured as `{ user, memberships,
activeMembership }`, not read directly as a `User`.

## 2. Complete Flow Traced

```
authService.getMe()                          (src/services/auth.service.ts)
  → AuthBootstrapper.checkSession()           (src/providers/index.tsx)
  → useConfirmEmailVerification()'s onSuccess (src/hooks/index.ts)
  → useMe() [dead code — see §5]              (src/hooks/index.ts)
  → GetMeResponse type                        (src/services/auth.service.ts)
  → useAuthStore.user / useRbacStore.currentTenantSession
```

## 3. Changes

### 3.1 `src/services/auth.service.ts`
Added `export interface GetMeResponse extends AuthSessionRbacPayload {
user: User; memberships?: TenantMembership[]; activeMembership?:
TenantMembership }` and changed `getMe()`'s return type to it. Mock mode
now returns `{ user: entry.user, ...deriveMockAuthSession(entry.p7Roles) }`
instead of spreading `User` fields at the root. Real mode's `api.get<...>`
call is typed to the same shape — no transformation, the axios response
`data` is returned as-is (the backend is the one doing the nesting; the
frontend just types it correctly now).

### 3.2 `src/providers/index.tsx` — `AuthBootstrapper.checkSession()`
```ts
// Before
authService.getMe().then((user) => {
  setUser(user)
  setSentryUser({ id: user.id, email: user.email, accountType: user.accountType })
  const sessionInput = resolveSessionRestoreInput(user)
  ...
})

// After
authService.getMe().then((data) => {
  setUser(data.user)
  setSentryUser({ id: data.user.id, email: data.user.email, accountType: data.user.accountType })
  const sessionInput = resolveSessionRestoreInput(data)  // memberships/activeMembership live on `data`, not `data.user`
  ...
})
```
`resolveSessionRestoreInput()` (the Auth-Refresh-Persistence fix's gate
function) needed no signature change — it already reads
`memberships`/`activeMembership` off its argument, and those still live at
the response root, not on `user`.

### 3.3 `src/hooks/index.ts`
- `useConfirmEmailVerification()`'s `onSuccess`: `setUser(fresh)` →
  `setUser(fresh.user)`.
- `useMe()`: removed `meta: { onSuccess: setUser }`. This was already dead
  code — `QueryCache`'s only global handler in this app is `onError`
  (`providers/index.tsx`'s `makeQueryClient()`); nothing reads
  `query.meta.onSuccess`, so this option has never actually fired. Left in
  place, it would have been a **latent bug** under the new contract
  (`setUser(wholeResponseObject)` instead of `setUser(user)`) the moment
  anyone wired up a handler that reads it — removed rather than "fixed"
  to fire correctly, since fixing dead code to do something it's never
  actually asked to do is not this task's job; `useMe()` itself has zero
  real consumers anywhere in the app (confirmed via full-repo search).

## 4. Files Changed

| File | Change |
|---|---|
| `src/services/auth.service.ts` | Added `GetMeResponse` type; `getMe()` returns it (mock + real). |
| `src/providers/index.tsx` | `checkSession()` destructures `data.user` for identity, passes `data` to `resolveSessionRestoreInput()`. |
| `src/hooks/index.ts` | `useConfirmEmailVerification()` unwraps `.user`; `useMe()`'s dead `meta.onSuccess` removed. |
| `src/test/p10.7-rbac-session-hydration.test.ts` | Rewrote every `getMe()`-consuming assertion to destructure `{ user, memberships, activeMembership }`; `simulateSessionRestoreHydration()` now uses the real exported `resolveSessionRestoreInput()` instead of a hand-rolled tenantRoles-only mirror. |
| `src/test/p10.9-auth-session-hardening.test.tsx`, `src/test/p10.10-auth-backend-contract.test.ts` | `meResult.tenantRoles` → `meResult.activeMembership?.roles`. |
| `src/test/phase4-e2e.test.ts` | `const user = await promise` → `const { user } = await promise`. |
| `src/test/phase4-sentry.test.ts` | Source-text assertion updated from `setUser(user)` to `setUser(data.user)`, matching the intentional rename in `checkSession()`. |
| `docs/AUTH_ME_RESPONSE_CONTRACT_MIGRATION.md` (new, this file) | Full audit trail. |

`login()`, `register()`, and `verifyOTP()` were **not** touched — their
contract (flat `{ user, tokens, p7Roles, memberships, activeMembership }`,
per `docs/BACKEND_CONTRACT.md` §1.1) is unaffected by this task, which is
scoped explicitly to `/auth/me/`.

## 5. Before / After API Response Shape

| | Before (assumed) | After (real contract) |
|---|---|---|
| Identity fields | `response.id`, `response.email`, ... | `response.user.id`, `response.user.email`, ... |
| Membership fields | `response.memberships`, `response.activeMembership` | unchanged — still at the response root |
| `useAuthStore.user` after session restore | `setUser(response)` (would now be wrong — sets `user` to the wrapper) | `setUser(response.user)` |

## 6. Verification

- `npx tsc --noEmit -p .` — zero new errors (diffed against the
  established baseline; identical modulo the one pre-existing failure's
  line-number shift).
- `npx vitest run` — 5937/5956 pass; only the same 19 pre-existing
  `createdAt`/`updatedAt`/`RegisterData.email` baseline failures
  (unrelated). 6 test files updated to match the intentional contract
  change (all now passing).
- **Manual verification**: ran the app in a real Chromium browser (mock
  mode), logged in as `owner@samoon.com`, confirmed `/console` renders
  with full identity ("Olivia Owner") and permissions, then hard-reloaded
  — session, identity, and console access all survive correctly through
  the new nested `getMe()` response, proving the
  Auth-Refresh-Persistence fix (`resolveSessionRestoreInput()`) and this
  contract update compose correctly.
- `npm run build` — production build compiled successfully; all routes
  generated with no new type or lint errors.
