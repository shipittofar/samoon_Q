# Frontend Contract Alignment Report (Phase Z.1)

**Status: implementation complete.** This phase aligned existing frontend
boundaries with the frozen backend contract (`BACKEND_CONTRACT.md`,
`FRONTEND_CONTEXT_MODEL.md`, `BACKEND_IMPLEMENTATION_PLAN.md`,
`FRONTEND_CONTRACT_IMPACT_REPORT.md`). It is explicitly **not** a feature
phase: no new UI, no route migration, no database, no backend code. Every
change below is a boundary/naming/data-source alignment on top of
already-existing behavior.

---

## 1. Changes Made

### 1.1 Mock Authentication Contract Unification

| File | Change |
|---|---|
| `src/types/rbac.ts` | `UserTenantRole` gained an optional `branchIds?: string[]` field — lets a mock tenant assignment declare an explicit, non-empty `'assigned'` branch scope instead of always falling through to `resolveBranchAccess()`'s empty-array default. |
| `src/services/permission.service.ts` | Added `getMockMemberships(userId): TenantMembership[]` — the one place `MOCK_RBAC_USERS.tenantAssignments` (the pre-Phase-9 `UserTenantRole[]` shape) is turned into the frozen-contract `TenantMembership[]` shape, reusing `resolveBranchAccess()` rather than a second branch-scope decision. Added `MOCK_TENANT_SLUGS` lookup. Gave `user-multi-01`'s Tenant B (Brew Cafe) assignment an explicit `branchIds: ['branch-brewcafe-01']` — the mock fixture for a real, non-empty "selected branch access" scenario (every other non-owner assignment still resolves to the pre-existing empty-array default, unchanged). |
| `src/services/auth.service.ts` | Added `deriveMockAuthSession(p7Roles)` — the single function `login()`, `register()`, `verifyOTP()`, and `getMe()` all call to produce `memberships`/`activeMembership` from the same `MOCK_CREDENTIALS` entry that already produces `p7Roles`/`tenantRoles`. Widened the return types of all four functions (and `VerifyOTPResult`) with optional `memberships?: TenantMembership[]` and `activeMembership?: TenantMembership` fields. `p7Roles`/`tenantRoles` are **unchanged** — same field names, same values, same call sites — this is additive, not a reshape. |
| `src/hooks/index.ts` | `seedTenantSession()` now accepts and forwards `memberships`/`activeMembership` to `normalizeTenantPermissions()`. `useLogin()`, `useRegister()`, `useVerifyOTP()` destructure and pass through the new fields. |
| `src/providers/index.tsx` | `AuthBootstrapper`'s `checkSession()` passes `user.memberships`/`user.activeMembership` into `normalizeTenantPermissions()` on session restore, not just `user.tenantRoles`. |

This exercises `normalizeTenantPermissions()`'s memberships-priority branch
(built in Phase 9.2, never actually invoked by any real call site until
now) end-to-end for the first time, without changing a single resolved
role, permission, or branch-access value for any existing mock persona —
verified by the new test file (§8 below) asserting `activeMembership.roles`
always equals the unchanged `p7Roles`.

### 1.2 Tenant Service Boundary Preparation

| File | Change |
|---|---|
| `src/services/tenant.service.ts` | Added `getMyTenants()` and `getPlatformTenants()`. Both are placeholder boundaries that currently delegate to the existing `getTenants()` (no backend distinction exists yet) — the boundary is the **name**, not new filtering logic. |
| `src/hooks/index.ts` | Added `useMyTenants()` and `usePlatformTenants()`, sharing `useTenants()`'s `['tenants']` query key (same cache entry, no duplicate fetch). |
| `src/components/admin/AdminTenantSwitcher.tsx` | Now calls `useMyTenants()` — this component means "tenants I can act in." |
| `src/app/console/tenants/page.tsx` | Now calls `usePlatformTenants()` — this page means "every tenant on the platform" (tenant analytics, activate/suspend/archive). |

`useTenants()` itself, and `tenantService.getTenants()`, are unchanged and
still exported — `usePublicTenants()` (public marketplace discovery, a
correctly-scoped third case, not ambiguous) still calls `getTenants()`
directly, as does a large existing test surface.

### 1.3 Branch Service Boundary Preparation

| File | Change |
|---|---|
| `src/services/combined.service.ts` | Added `branchService.getTenantBranches(tenantId: string)` — `tenantId` is **required** (no optional-parameter fallback), delegating to the existing `getBranches(tenantId)`. `getBranches(tenantId?)` is unchanged, including its intentional tenant-less fallback to the legacy global `MOCK_BRANCHES` list (covered by `context-integrity.test.ts`, not something this phase removes). |
| `src/hooks/index.ts` | `useBranches()` now calls `branchService.getTenantBranches(tenantId)` once a tenant has resolved, falling back to the untargeted `getBranches()` only during the bootstrap window before `tenantId` exists — identical runtime behavior, unambiguous intent at the call site. |

`branch.service.ts`'s `branchManagementService.getBranches(tenantId: string)`
(the Console/admin domain — `useAdminBranches()`, `useBranchStore`,
`AdminBranchSwitcher`) was already fully tenant-scoped with a **required**
`tenantId` parameter before this phase — audited, confirmed compliant, no
change needed.

---

## 2. Remaining Technical Debt

| Item | Status | Why not fixed now |
|---|---|---|
| `tenantService.getMyTenants()` / `getPlatformTenants()` still share one unscoped mock implementation | Open | No backend distinction exists yet; per this phase's explicit instruction, only the naming boundary was to be prepared, not a real per-user filter. `AdminTenantSwitcher`'s own `hasAnyTenantAccess()` filter (Phase X.3) remains the actual defense-in-depth on top of this. |
| `/console/tenants` unscoped platform tenant list (which tenants a given platform admin identity may legitimately manage) | Open, tracked separately | Flagged in the prior Staff Management phase as a distinct product-boundary decision (platform admin vs. owner-owned tenants) — explicitly out of scope for this phase too. |
| `MOCK_CREDENTIALS` (auth.service.ts, 10 login personas) and `MOCK_RBAC_USERS` (permission.service.ts, 9 tenant-assignment personas) remain two separate mock identity spaces (different `id` values, e.g. `'4'` vs. `'user-owner-01'`, joined only implicitly by matching email for the 6 personas that overlap) | Open, documented | A previous phase (P10.4.9) deliberately gave `staff@samoon.com`/`multirole@samoon.com` their own distinct StaffMember identities (`user-staffdemo-01`, `user-multirole-01`) separate from `MOCK_RBAC_USERS`'s directory, specifically to avoid conflating "who can log in" with "who has a tenant staff record." Forcing a single id space across both would either re-litigate that decision or require inventing synthetic `MOCK_RBAC_USERS` entries with no corresponding staff-directory purpose. Out of scope for a boundary-alignment phase — `getMockMemberships()` was deliberately layered on top of the existing `MOCK_RBAC_USERS` shape rather than merging the two tables. |
| `console/reservations/page.tsx` uses the public `useBranches()` hook (not `useAdminBranches()`) to populate its branch-filter dropdown | Open, documented | Confirmed low-risk today (tenant is always resolved by the time this console page renders), but `useBranches()`'s branch id space (`combined.service.ts`'s `MOCK_TENANT_BRANCHES`, e.g. `'1'`) and `useAdminBranches()`'s (`branch.service.ts`'s `branch-rest-01` etc.) are **not** the same ids — swapping the hook without also reconciling those two independently-seeded mock branch datasets would silently break the branch-name lookup on that page. Not attempted here; flagged as a future consolidation, not a Z.1 fix. |
| `ownership-resolution.service.ts` still calls unscoped `tenantService.getTenants()`/`branchManagementService.getBranches(tenant.id)` for a cross-tenant owner lookup | Reviewed, no action | This module is the legacy P10.x ownership/StaffAssignment authorization engine, explicitly superseded by Phase 2's RBAC unification and no longer on the live authorization path (`permission.service.ts`'s own comment: "an authorization decision that must never be made client-side"). Its `getTenants()` call is a legitimate cross-tenant lookup (which tenant owns this branch?), not an ambiguous "my vs. platform" case. |

---

## 3. Mock Architecture Status

**Before this phase:** three independent constructions of "what roles does
this session have" — `MOCK_RBAC_USERS` (tenant-assignment directory, keyed
by a synthetic `user-*-01` id), `MOCK_CREDENTIALS` (login-credential table,
keyed by email, hand-typed `p7Roles` per entry with no structural
connection to `MOCK_RBAC_USERS`), and three separate ad-hoc constructions
inside `login()`/`getMe()`/`verifyOTP()` themselves.

**After this phase:**
- `MOCK_RBAC_USERS` → `getMockMemberships()` is the one place that shape is
  translated into `TenantMembership[]`, for any future consumer that wants
  the full multi-tenant picture (e.g. a real `GET /auth/memberships`
  mock).
- `MOCK_CREDENTIALS` → `deriveMockAuthSession()` is the one place a login
  persona's flat `p7Roles` is translated into `memberships`/
  `activeMembership`. `login()`, `register()`, `verifyOTP()`, and `getMe()`
  all call it — zero per-function duplication of that translation.
- The two tables themselves remain separate (see §2 — deliberately, per
  P10.4.9), but each now has exactly one derivation path instead of each
  call site improvising its own.

**Confirmed unchanged:** every existing mock persona's resolved
`p7Roles`/`tenantRoles` value, byte-for-byte (locked by
`p10.7-rbac-session-hydration.test.ts`, which required zero changes and
still passes in full).

---

## 4. Tenant Boundary Status

| Consumer | Meant | Now calls | Status |
|---|---|---|---|
| `AdminTenantSwitcher.tsx` | My accessible tenants | `useMyTenants()` | Named correctly. Underlying data still unscoped (placeholder — see §2). |
| `/console/tenants` (`app/console/tenants/page.tsx`) | All platform tenants | `usePlatformTenants()` | Named correctly. Genuinely wants every tenant (analytics, lifecycle actions) — this was always correct semantically, just previously indistinguishable in code from the switcher's use. |
| `usePublicTenants()` | Public marketplace discovery | `tenantService.getTenants()` (unchanged) | Already correctly scoped/named — public data, no membership concept applies. Not touched. |
| `ownership-resolution.service.ts` (legacy) | Cross-tenant owner lookup | `tenantService.getTenants()` (unchanged) | Legitimate cross-tenant need, not an ambiguity. Not touched. |

---

## 5. Branch Boundary Status

| Consumer | Domain | tenantId required? | Status |
|---|---|---|---|
| `useAdminBranches(tenantId)` / `useBranchStore.loadBranchesForTenant(tenantId)` / `AdminBranchSwitcher` (Console) | `branch.service.ts` (`branchManagementService`, P7.3 model) | Yes, always was | Already compliant — audited, no change. |
| `useBranches()` (public — `BranchSelector`, `/reservation`) | `combined.service.ts` (`branchService`, legacy model) | Now yes, via `getTenantBranches()`, once tenant resolves | Aligned this phase. Bootstrap-window fallback (tenant not yet resolved) intentionally unchanged. |
| `console/reservations/page.tsx` | Uses the public `useBranches()`, not the admin hook | N/A | Known inconsistency, not fixed (see §2 — mismatched mock id spaces). |

---

## 6. Future Migration Points

1. **Tenant/branch service boundary → real filtering.** Once
   `GET /me/tenants` and `GET /tenants/{tenantId}/branches` exist
   (`BACKEND_CONTRACT.md` §3–4), `getMyTenants()` and `getTenantBranches()`
   change their internal implementation only — no call site changes, since
   the naming boundary is already in place.
2. **`/console/tenants` platform-admin scoping decision.** Requires
   deciding the product boundary between platform-admin-visible tenants and
   owner-owned tenants (tracked separately, per the prior Staff Management
   phase's note).
3. **Mock identity-space consolidation** (`MOCK_CREDENTIALS` vs.
   `MOCK_RBAC_USERS` vs. `staff.service.ts`'s StaffMember `userId`s) — only
   worth doing if/when a real backend's user id becomes the join key
   everywhere; forcing it in mock data ahead of that mostly just moves the
   duplication around.
4. **`console/reservations/page.tsx`** → `useAdminBranches(tenantId)`,
   once `combined.service.ts`'s and `branch.service.ts`'s mock branch
   datasets are reconciled onto one id space (or once the real backend
   makes the distinction moot).
5. **Branch-URL migration** (`/console/[branchId]/orders`) — explicitly out
   of scope per this phase's constraints and `API_GAP_REPORT.md` §7;
   unaffected by anything in this phase.

---

## 7. Verification

- `npx tsc --noEmit -p .` — zero new errors (diffed against the pre-phase
  baseline; only pre-existing `createdAt`/`updatedAt`/`dialCode`/
  `RegisterData.email` failures remain, all present before this phase).
- `npx vitest run` — full suite green against the established baseline
  (only the pre-existing `createdAt` mock-fixture failures present before
  this phase); two pre-existing test assertions
  (`phase6-tenant-management.test.ts`, `phase6-tenant-provisioning.test.ts`)
  were updated because they asserted the literal string `useTenants` in
  `/console/tenants`'s source — now `usePlatformTenants`, the correctly
  disambiguated name this phase introduces.
- New test file: `src/test/phase-Z-1-frontend-contract-alignment.test.ts`
  (21 tests) — mock auth derivation (multi-tenant user, single-tenant user,
  owner role, selected/non-empty branch access, all-branch access,
  consistency with `normalizeTenantPermissions()`), tenant service boundary
  naming, branch service boundary (`tenantId` required, tenant isolation).

---

## Final Verification

**1. Can frontend now consume real `GET /auth/me` without mock mismatch?**

Yes. `getMe()`'s return type already declares `memberships?`/
`activeMembership?` as optional fields alongside the legacy `tenantRoles?`
— a real backend implementing exactly `BACKEND_CONTRACT.md` §2's
`memberships`/`activeMembership` shape needs no frontend change:
`normalizeTenantPermissions()` already prioritizes that shape over the
legacy one whenever it's present (Phase 9.2), and this phase's mock
responses are the first thing to actually exercise that path end-to-end,
proving it resolves correctly rather than merely type-checking.

**2. Are tenant and branch services aligned with backend isolation rules?**

Boundary-aligned, not yet isolation-enforced. Every consumer now calls a
correctly-named method (`getMyTenants`/`getPlatformTenants`/
`getTenantBranches`) matching its actual intent, so a future backend swap
is a pure implementation change with zero call-site changes. The
underlying mock data is still shared/unscoped between `getMyTenants()` and
`getPlatformTenants()` — real isolation depends on the two backend
endpoints existing (tracked in `API_GAP_REPORT.md`, unchanged by this
phase per its explicit "placeholder/mock boundary only" instruction).

**3. Are there any remaining frontend assumptions that would block Django
implementation?**

No blockers. The items in §2 (Remaining Technical Debt) are all
non-blocking: they are either (a) already covered by existing
defense-in-depth filtering (`hasAnyTenantAccess()`, `canAccessBranch()`),
(b) deliberately deferred product decisions tracked elsewhere (the
`/console/tenants` platform-admin boundary), or (c) mock-data-only
consolidation work with no bearing on what the real backend needs to
implement. `BACKEND_IMPLEMENTATION_PLAN.md`'s stated build order remains
valid and unblocked.
