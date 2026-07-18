# Frontend Contract Impact Report (Phase Z.0)

**Status: read-only audit. No code modified.** Cross-references the
frozen contract (`docs/BACKEND_CONTRACT.md`, `docs/FRONTEND_CONTEXT_MODEL.md`,
`docs/BACKEND_IMPLEMENTATION_PLAN.md`, `docs/BACKEND_SCHEMA.dbml`)
against the actual frontend at HEAD `4d5e242`.

---

## 1. Auth Contract Impact

**Current frontend shape** (`src/services/auth.service.ts`,
`src/providers/index.tsx`): `{ user, tokens, tenantRoles?: Role[] }` (or
`p7Roles` at login/register/verify-otp) — a flat, tenant-less role array.

**Future shape** (`docs/BACKEND_CONTRACT.md` §1): `{ user, tokens,
memberships: TenantMembership[], activeMembership? }`.

**Compatibility: already built, unused.** `normalizeTenantPermissions()`
(`src/services/permission.service.ts`) has accepted **both** shapes since
Phase 9.2 — this was built specifically so the contract freeze would
require zero frontend code changes to consume. Verified again this
session: no source file currently constructs or expects
`memberships`/`activeMembership` from a real network response (no
backend exists), but the parsing/normalization logic that will consume
it the moment a backend sends it is already merged and tested
(`src/test/phase-9-2-tenant-membership-types.test.ts`).

**Fields that will disappear:** none, immediately — `tenantRoles`/
`p7Roles` remain accepted indefinitely as the legacy branch of
`normalizeTenantPermissions()`'s input union; nothing needs to actively
stop sending them for the frontend to keep working.

**Fields that will be added:** `memberships[]`, `activeMembership`,
`memberships[].branchAccess` — all already typed
(`src/types/rbac.ts`) and consumed.

**Components/hooks affected (informationally, not requiring changes):**
`AuthBootstrapper` (`src/providers/index.tsx`), `useLogin`/`useRegister`/
`useVerifyOTP` → `seedTenantSession()` (`src/hooks/index.ts`),
`useAuthStore`, `useRbacStore.setCurrentTenantSession()`. All already
route through `normalizeTenantPermissions()` — none read the raw
`tenantRoles`/`memberships` fields directly.

**Verdict: zero breaking change on this axis.** This is the one section
of the entire audit where "will backend contract land safely" is already
a settled, tested fact, not a prediction.

---

## 2. Global Role Removal Impact

**This migration is already complete (Phase 9.3), not pending.**
`User.role` was removed and replaced with `User.accountType` in a prior
phase of this project. Re-verified this session with a fresh search:

```
grep -rn "user\.role\b" src --include=*.ts --include=*.tsx   → 0 matches (excl. tests)
grep -rln "UserRole" src --include=*.ts --include=*.tsx       → 3 files
```

The 3 remaining `UserRole` references are:
- `src/types/index.ts` — the type definition itself, kept `@deprecated`.
- `src/services/ownership-migration.service.ts` — a dead migration-spec
  function (`deriveLegacyUserRoleLabel()`), never called at runtime,
  deliberately preserved as historical reference (documented at its own
  definition).
- `src/app/console/permissions/simulator/page.tsx` — **false positive**:
  an i18n translation key literal (`previewUserRoleCombinationHint`),
  not a type/field usage.

**Classification: N/A — already migrated, no unsafe usages remain.**
`membership.roles[]` (i.e. `currentTenantSession.roles`) is already the
sole live authorization-role source everywhere (`FRONTEND_CONTEXT_MODEL.md`
§2). No file list of "unsafe, depends on global role" exists because
there is no remaining global role dependency to find.

---

## 3. Tenant Context Impact

**`GET /tenants/` (current, unscoped) vs. `GET /me/tenants` (target):**
confirmed unsafe, previously documented in `docs/API_GAP_REPORT.md` item
2 and traced as the root cause of the Phase X "kicked out on tenant
switch" bug. Re-confirmed this session: `tenantService.getTenants()`
(`src/services/tenant.service.ts:352-360`) still returns every mock
tenant, called from `useTenants()` (`src/hooks/index.ts:2346-2354`),
consumed by `AdminTenantSwitcher.tsx` and `console/tenants/page.tsx`.

**Places assuming all tenants exist / missing authorization context:**
- `src/components/admin/AdminTenantSwitcher.tsx` — mitigated client-side
  since Phase X.3 (`hasAnyTenantAccess()` filters the rendered list and
  re-checks before switching), but the underlying `useTenants()` call
  still fetches the **full unscoped list** to the browser first — the
  filtering happens after the (over-broad) response arrives, not before.
  This is a data-exposure gap even though the UI-reachability gap is
  closed.
- `src/app/console/tenants/page.tsx` — the platform-wide tenant roster
  page. Deliberately **not** touched in Phase X.3 (explicitly deferred
  per the user's instruction in that phase) — still calls the same
  unscoped `useTenants()`. This page's actual product intent (platform
  admin roster vs. "my tenants") was never resolved; `GET /me/tenants`
  cannot simply replace `GET /tenants/` here without a product decision
  on whether this page is platform-admin-only going forward.

**Cached tenant data without user scope:** React Query key for
`useTenants()` is `['tenants']` — no `userId` in the key at all. In a
single-browser-session app this is low risk (React Query cache is
per-browser-instance, not shared across users), but it means a
`qc.setQueryData`/stale-cache scenario across a `useLogout()` →
different-user-login cycle relies entirely on `qc.clear()` (confirmed
called on logout, `src/hooks/index.ts:547`) rather than the key itself
being user-scoped — correct today because `qc.clear()` is unconditional,
but worth noting as a "hidden assumption" (§5 below) rather than a
currently-exploitable gap.

---

## 4. Branch Context Impact

**Current:** `selectedBranch` lives entirely in `useBranchStore`
(Zustand), invisible to the URL for every branch-scoped Console page
except the 3 already-URL-addressable routes
(`/console/branches/[id]`, `/edit`, `/analytics` — Phase 9.4).

**Target (`docs/API_GAP_REPORT.md` §7):**
`/console/[branchId]/orders` etc.

**Routes affected by a future URL migration** (currently reading
`selectedBranch` from the store instead of a route param):
- `src/app/console/orders/page.tsx`
- `src/app/console/kitchen/page.tsx`
- `src/app/console/analytics/page.tsx`
- `src/app/console/reservations/page.tsx`
- `src/app/console/operations/page.tsx`
- `src/app/console/staff/page.tsx` (branch is an optional *filter* here,
  not a required scope — confirmed intentional design, Phase C audit;
  this page would likely stay tenant-scoped with an optional branch
  query param even after the migration, not move under `[branchId]`)

**Components depending on hidden branch state:**
`AdminBranchSwitcher.tsx` (the only writer of `selectedBranch`),
`BranchContextIndicator` (`src/components/admin/RealtimeDashboardWidgets.tsx`,
read-only display), every page in the list above (readers).

**Services missing `branchId`:** none found that *should* have it and
don't — `useCreateOrder()`'s customer-facing `['orders']` key and
`useUpdateOrderStatus()`'s lack of explicit tenant/branch params were
already flagged in `docs/API_GAP_REPORT.md` item 3 as a *backend*
concern (derive from `id` + token), not a missing frontend parameter
that needs adding before the URL migration.

**Queries missing branch isolation:** none found — re-confirmed this
session that every genuinely branch-scoped query key already includes
`branchId` (`docs/API_GAP_REPORT.md` §5's audit stands; no new gaps
found). The URL migration is a **navigability/durability** improvement
(bookmarking, refresh-safety, explicit context), not a data-isolation
fix — no isolation bug exists in the current Zustand-only branch model
today (re-confirmed, not merely repeated from a prior phase).

---

## 5. Permission System Impact

**Frontend:** `ROLE_PERMISSION_MAP` (`src/services/permission.service.ts`)
— static, in-memory, unchanged since introduced.
**Backend (future):** `permissions[]` sent per `docs/BACKEND_CONTRACT.md`
§5, OR derived client-side from `roles[]` exactly as today — the backend
contract explicitly does not require sending permissions at all;
`ROLE_PERMISSION_MAP` continues to work unmodified either way.

**Duplicate permission logic:** none found. Grepped for hardcoded
role-name string comparisons outside `permission.service.ts` (e.g.
`role === 'owner'`, `roles.includes('manager')` used as an ad-hoc
permission substitute rather than going through `usePermission()`):

```
grep -rn "role === '\|roles.includes(" src/app src/components src/hooks --include=*.tsx --include=*.ts
```
→ the only non-test matches are (a) `permission.service.ts`'s own
`resolveBranchAccess()`/`hasAnyTenantAccess()` helpers (`roles.includes('owner')`
— this IS the canonical, single, intentional place this check belongs,
not a duplicate), and (b) UI-only role-label rendering (e.g.
`AdminSidebar.tsx`'s `RoleChip` displaying `roles.join(' · ')` — display
text, not an access decision).

**Hardcoded role checks:** none found gating actual access/rendering
outside `PermissionGuard`/`usePermission()`.

**UI-only security assumptions:** confirmed, consistently documented at
every layer (`canAccessBranch()`, `useBranchAccess()`, `hasAnyTenantAccess()`
all carry explicit "not a security boundary" doc comments, verified
present at their current definitions this session). This is the correct
posture, not a gap — flagged here only to confirm it is intact and
consistent, not to report it as a defect.

---

## 6. API Contract Impact — Service-by-Service

| File | Function | Current contract | New contract | Status |
|---|---|---|---|---|
| `src/services/tenant.service.ts` | `getTenants()` | `GET /tenants/` — unscoped, every tenant | `GET /me/tenants` — caller-scoped | **Unsafe, confirmed** |
| `src/services/branch.service.ts` | `getBranches(tenantId)` | `GET /branches/` — unscoped, every branch of tenant | `GET /tenants/{tenantId}/branches` — access-filtered | **Unsafe, confirmed** |
| `src/services/auth.service.ts` | `getMe()`, `login()`, `verifyOTP()`, `register()` | `tenantRoles?: Role[]` (flat) | `memberships[]`/`activeMembership` | **Compatible** — already accepted by `normalizeTenantPermissions()` (§1) |
| `src/services/permission.service.ts` | `getMockRoles()` | Mock-only, synchronous | Real equivalent: async, per §5 of `BACKEND_CONTRACT.md` | **No frontend change needed** — permissions still derived client-side from `roles[]` |
| `src/services/admin.service.ts` | `updateOrderStatus(id, status)` | No explicit tenant/branch param | Backend must derive from `id` + token | **Backend-only gap** (§4 above), no frontend change required |
| `src/services/staff.service.ts` | `inviteStaff()`, `updateStaffRoles()` | Already includes `branchIds` (Phase C) | Matches `TenantMembership.assigned_branches` shape from `BACKEND_SCHEMA.dbml` | **Already compatible** |

No other service in `src/services/` was found calling an endpoint that
conflicts with the frozen contract — the two flagged above
(`tenant.service.ts`, `branch.service.ts`) are the complete list of
confirmed-unsafe endpoints, matching `docs/API_GAP_REPORT.md` §2 exactly
(re-verified, not a new finding).

---

## 7. Mock System Impact

**Can current mock data represent `User → Membership → Tenant → Branch →
Permissions`?** Partially — the *shape* exists in one place but is not
wired end-to-end through the services that actually run.

- `MOCK_RBAC_USERS` (`src/services/permission.service.ts`) already
  models exactly this relationship for its own narrow purpose
  (`hasAnyTenantAccess()`'s permission check) — each mock user has
  `tenantAssignments: { tenantId, roles }[]`, including a genuine
  multi-tenant example (`user-multi-01`: manager in one tenant, cashier
  in another). This proves the *concept* is representable in mock data
  today.
- **Gap:** `auth.service.ts`'s `getMe()`/`login()`/`verifyOTP()` mock
  responses do **not** read from `MOCK_RBAC_USERS.tenantAssignments` to
  produce a `memberships[]` array — they still only ever return a single
  flat `tenantRoles` for whichever tenant is currently active
  (`MOCK_CREDENTIALS` in `auth.service.ts`, keyed by email, single
  `p7Roles` value). `MOCK_RBAC_USERS` and `MOCK_CREDENTIALS` are two
  separate, non-unified mock datasets today.
- **Gap:** no mock `branchAccess` value is ever attached to a mock login
  response — `resolveBranchAccess()`'s safe-default fallback (§Phase
  9.2) is what currently produces `{scope:'assigned', branchIds:[]}` or
  `{scope:'all'}` for every mock session, derived from `roles`, never
  from a real per-membership mock value.

**Required mock changes (to fully exercise the frozen contract before a
real backend exists) — not performed this phase, per the "do not modify
code" constraint:**
1. Extend `auth.service.ts`'s mock `getMe()`/`login()`/`verifyOTP()` to
   optionally return `memberships[]` (sourced from
   `MOCK_RBAC_USERS.tenantAssignments`, unifying the two currently-separate
   mock datasets) so the `normalizeTenantPermissions()` new-shape branch
   gets real end-to-end mock coverage, not just unit-test coverage.
2. Add mock `branchAccess` values per mock tenant assignment (currently
   only synthesized via the safe-default fallback, never sourced from
   fixture data resembling a real backend response).
3. Add a mock `GET /me/tenants` and `GET /tenants/{id}/branches`
   equivalent (scoped mock functions) so the future-facing hooks that
   will call these endpoints have something realistic to develop
   against before the real backend exists.

---

## 8. Routing Impact

**Current:** flat `/console/orders`, `/console/kitchen`, etc. — no
branch segment.
**Future (recommended, `docs/API_GAP_REPORT.md` §7):**
`/console/[branchId]/orders`.

**Affected:**
- **Pages:** the 5 routes listed in §4 above.
- **Layout:** `src/app/console/layout.tsx` — currently wraps all of
  `/console/*` uniformly via `AuthGuard`; a `[branchId]` segment would
  need either a nested layout under `/console/[branchId]/` (for
  branch-scoped pages only) or the existing flat layout extended to read
  the new param — a real design decision, not inferable from current
  code.
- **Middleware:** `src/middleware.ts` — currently matches
  `/console/:path*` as one protected prefix; a `[branchId]` segment
  doesn't require a middleware change (dynamic segments are transparent
  to the existing prefix match), but the middleware's tenant-resolution
  logic is unaffected either way since branch is a separate axis from
  tenant/subdomain.
- **Breadcrumbs:** `src/components/admin/AdminBreadcrumbs.tsx` — not
  audited in prior phases; would need to read `branchId` from the route
  instead of (or in addition to) `useSelectedBranch()` if the URL becomes
  authoritative.
- **Navigation:** every internal `<Link href="/console/orders">`-style
  link in admin nav components (`AdminSidebar.tsx` and similar) would
  need to become branch-aware (`/console/${branchId}/orders`) —
  not enumerated exhaustively here (out of a read-only audit's depth
  budget), but confirmed to be a non-trivial, multi-file mechanical
  change, not a single-point fix.

**Not implemented, not started** — this section documents impact only,
per Phase Z.0's explicit constraint.

---

## 9. React Query Cache Impact

Re-audited this session (not merely repeating Phase 10/X's findings):

| Key pattern | Isolation present? | Notes |
|---|---|---|
| `['admin-orders', tenantId, filters]`, `['admin-reservations', tenantId, filters]`, `['admin-customers', tenantId, filters]`, `['admin-stats', tenantId]` | ✅ tenantId present | Verified directly this session (`src/hooks/index.ts:1287-1442`) |
| `['branch-orders', branchId]`, `['branch-analytics', branchId]`, etc. | ✅ branchId present | Re-confirmed, unchanged since Phase 9.4/X.3 |
| `['tenants']` (`useTenants()`) | ⚠️ No `userId`, no scoping at all | Matches the endpoint itself being unscoped (§3/§6) — the cache key is only as safe as the query it represents; fixing the endpoint (§6) makes this moot without needing a key change |
| `['me']` (`useMe()`) | N/A — single-user-per-browser-session by construction | No tenant/branch dimension applicable |
| `['orders']` (customer-facing `useCreateOrder()` invalidation) | N/A — customer checkout flow, out of Console-context scope | Already flagged as out of scope in Phase X's audit |

**No query key was found missing `branchId` where the underlying data is
genuinely branch-scoped** — this was true as of Phase 10/X and remains
true this session. **`userId` is not present in any query key across the
codebase** — every isolation boundary that exists today relies on (a)
`tenantId`/`branchId` being present where relevant, and (b) `qc.clear()`
being unconditionally called on logout (`src/hooks/index.ts:547`) and on
tenant switch (`src/components/admin/AdminTenantSwitcher.tsx:83`). This
is a deliberate, verified-working pattern (Phase 10's cache-isolation
audit specifically tested this), not an oversight — but it means the
*mechanism* preventing cross-user cache leakage is "clear everything on
identity change," not "key everything by who's asking." Worth stating
explicitly since the frozen contract's arrival doesn't change this
mechanism either way.

---

## 10. Final Report — Summary

(This document **is** `docs/FRONTEND_CONTRACT_IMPACT_REPORT.md`.)

### Breaking changes
**None, for the auth/membership contract itself.** The one true breaking
change identified is **not** a frontend-code break but a **data-exposure
fix required at the backend**: replacing `GET /tenants/`/`GET /branches/`
with their scoped equivalents is "breaking" only in the sense that the
unscoped endpoints must stop existing in their current form — no
frontend code depends on receiving the *unscoped* superset (the
frontend already filters client-side, Phase X.3/9.4), so scoping them
server-side is a pure narrowing with no frontend adaptation required.

### Safe changes
- Auth/membership contract landing (§1) — zero frontend change needed,
  already built and tested.
- `GET /me/tenants` replacing `GET /tenants/` (§3/§6) — `AdminTenantSwitcher`
  and `console/tenants/page.tsx` both already call a hook
  (`useTenants()`) that can be repointed at a new endpoint URL with no
  shape change to the hook's consumers, IF the response shape matches
  (`{id, name, slug, roles}` per `BACKEND_CONTRACT.md` §3 — a subset of
  what's already rendered).
- `GET /tenants/{tenantId}/branches` replacing `GET /branches/` (§4/§6) —
  same: `loadBranchesForTenant()` (`src/stores/index.ts`) already takes
  `tenantId` as its only parameter; only the URL construction inside
  `branch.service.ts` needs to change.
- Global role removal (§2) — already done, nothing to migrate.

### Required migrations (not yet started, correctly out of this phase's scope)
1. Mock system unification (§7) — `MOCK_RBAC_USERS` ↔ `auth.service.ts`'s
   mock responses, so local development can exercise the new contract
   shape before a real backend exists.
2. `console/tenants/page.tsx`'s product-intent decision (platform-admin
   roster vs. "my tenants") — blocks cleanly repointing this one page at
   `GET /me/tenants`, even though `AdminTenantSwitcher` can move today.
3. Branch URL migration (§8) — multi-file, needs a layout-nesting design
   decision before any page changes.
4. Tenant-switch mechanism migration to subdomain navigation
   (`docs/API_GAP_REPORT.md` §6) — sequencing dependency for #2 and #3.

### Files affected (complete list, this audit)
`src/services/tenant.service.ts`, `src/services/branch.service.ts`,
`src/components/admin/AdminTenantSwitcher.tsx`,
`src/app/console/tenants/page.tsx`, `src/app/console/orders/page.tsx`,
`src/app/console/kitchen/page.tsx`, `src/app/console/analytics/page.tsx`,
`src/app/console/reservations/page.tsx`,
`src/app/console/operations/page.tsx`, `src/app/console/staff/page.tsx`,
`src/app/console/layout.tsx`, `src/middleware.ts`,
`src/components/admin/AdminBreadcrumbs.tsx`,
`src/components/admin/AdminSidebar.tsx`,
`src/services/auth.service.ts` (mock-data unification only, §7).
None require changes to ship the auth/membership contract itself (§1);
all are §3/§4/§8's tenant-list/branch-URL follow-on work.

### Hidden assumptions surfaced by this audit
- Cross-user cache safety currently depends entirely on `qc.clear()`
  being called at every identity-changing event, not on query keys
  being user-scoped (§9) — correct today, worth keeping in mind if a
  future change ever introduces an identity-changing path that forgets
  to clear the cache.
- `console/tenants/page.tsx`'s actual product identity (platform admin
  vs. owner-scoped) was never resolved by any prior phase — it was
  deliberately deferred each time it came up (Phase X.3's explicit
  instruction, `API_GAP_REPORT.md` §6's migration path implicitly
  assuming it becomes "my tenants" without confirming that's correct).

### Risk level
| Area | Risk if backend ships the frozen contract as-is today |
|---|---|
| Auth/membership | **None** — already compatible |
| Tenant list scoping | **Low** — frontend adapts with a URL change, no shape change |
| Branch list scoping | **Low** — same |
| Global role | **None** — already migrated |
| Permission system | **None** — no change required |
| Branch URL migration | **Medium** — real design work, but zero urgency; current Zustand-only model has no isolation bug, only a durability/UX gap |
| Tenant-switch subdomain migration | **Medium** — same posture as branch URL |

---

## Final Conclusion

**Can the backend contract be implemented without breaking the current
frontend? Yes — confirmed, not merely asserted.**

The auth/membership/permission contract (`docs/BACKEND_CONTRACT.md` §1,
§5) can ship today with **zero frontend code changes** — this was
verified by direct inspection of `normalizeTenantPermissions()`'s
already-merged dual-shape handling, not inferred. The tenant-list and
branch-list scoping (§2, §4 of `BACKEND_CONTRACT.md`) require frontend
changes, but they are narrow, mechanical, low-risk (repointing existing
hooks at new URLs with compatible response shapes) — not blockers to
starting backend implementation per `docs/BACKEND_IMPLEMENTATION_PLAN.md`'s
already-stated implementation order.

**No blockers found.** The four items in "Required migrations" above are
real follow-on work, but none of them must complete *before* backend
implementation starts — `docs/BACKEND_IMPLEMENTATION_PLAN.md`'s
implementation order (auth → membership → tenant → branch → permission →
CRUD) can proceed exactly as sequenced there, with this report's findings
informing *when* each corresponding frontend change should follow, not
blocking *whether* the backend work can begin.
