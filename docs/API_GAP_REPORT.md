# API Gap Report (Phase Y)

Everything the current frontend assumes that `BACKEND_CONTRACT.md` does
not yet guarantee, plus the two architecture decisions the task
explicitly asked to be resolved before backend work starts. Read
alongside `FRONTEND_CONTEXT_MODEL.md` for the target relationship these
gaps prevent from being fully realized today.

---

## 1. Missing backend fields

| Field | Currently sent? | Frontend readiness |
|---|---|---|
| `memberships[]` on login/verify-otp/register/getMe | **No** — no backend exists; the mock layer only ever produces flat `tenantRoles`/`p7Roles` | **Ready.** `normalizeTenantPermissions()` (`src/services/permission.service.ts`) already accepts this shape in addition to the legacy one (Phase 9.2), with zero further frontend change required once sent |
| `activeMembership` | **No** | **Ready**, same function, same phase |
| `TenantMembership.branchAccess` | **No** | **Ready** — `CurrentTenantSession.branchAccess` is fully wired (Phase 9.2/9.4); currently always computed client-side via `resolveBranchAccess()`'s safe-default fallback because the backend never sends a real value |
| `TenantMembership.tenantSlug` / `.tenantName` | **No** | Typed optional; a real tenant-switcher UI (gap #4 below) needs these to render without a second lookup |

## 2. Incorrect / unscoped endpoints

| Endpoint | Current behavior | Required behavior | Severity |
|---|---|---|---|
| `GET /tenants/` (`tenantService.getTenants()`) | Returns **every platform tenant**, unfiltered | Must not exist in this unscoped form for any non-platform-admin caller — replace with `GET /me/tenants` or `GET /auth/memberships/` (`BACKEND_CONTRACT.md` §2/§3) | **Critical** — this is the confirmed root cause of the Phase X "kicked out when switching tenants" bug. Currently mitigated client-side only, by `hasAnyTenantAccess()` filtering `AdminTenantSwitcher`'s list (Phase X.3) — a UI safety net, not a real fix, since the underlying call still fetches every tenant's name/status/business-type to the browser regardless of whether the user was permitted to see it |
| `GET /branches/` (`branchManagementService.getBranches(tenantId)`) | Returns every branch of the tenant, unfiltered | Must return only branches within the caller's `branchAccess` (`BACKEND_CONTRACT.md` §4) | **High** — mitigated client-side by `canAccessBranch()` filtering `AdminBranchSwitcher`'s list (Phase 9.4), explicitly documented there as non-authoritative |
| `GET /branches/{id}/*` (orders/analytics/reservations) | No branch-ownership check modeled at all — works today because mock data has no real access boundary | Must independently re-validate `branchAccess` per request | **High** — the 3 frontend routes with `useBranchAccess()` guards (Phase 9.4) only stop *navigation*; a direct API call bypasses them entirely, since there is no backend to enforce anything yet |

## 3. Unsafe assumptions currently baked into frontend code

1. **`AdminTenantSwitcher`'s client-side membership check (`hasAnyTenantAccess`) is treated as sufficient in the mock world, but is explicitly documented as NOT a security boundary.** Once a real backend exists, `POST /auth/switch-tenant/` (or equivalent) MUST independently reject an unauthorized switch — the frontend check is only a UX/defense-in-depth stopgap for a gap that shouldn't exist post-backend.
2. **`useUpdateOrderStatus()` sends no explicit `tenantId`/`branchId`** (`src/hooks/index.ts`) — relies entirely on the order `id` being globally unique (true in mock data, not guaranteed by any real schema). The backend must derive tenant/branch ownership from `id` + the caller's token, not expect an explicit scoping parameter the frontend never sends.
3. **`getPermissionsForRole()` is trusted to compute the "correct" permission set from a role name.** This is fine as long as the backend's role vocabulary matches `ROLE_PERMISSION_MAP` exactly (`owner|admin|manager|cashier|waiter|kitchen|marketing|support`) — any backend role value outside this set silently resolves to zero permissions (`getPermissionsForRole()` returns `[]` for unrecognized roles), not an error. This is safe-by-default but silent; a backend that introduces a 9th role without a frontend release will not surface visibly.
4. **`normalizeTenantPermissions()`'s ambiguous-multi-membership case denies by default** when `memberships.length > 1` and no `activeMembership`/matching `currentTenantId` is available. This means: if the backend ever sends a real `memberships[]` array with 2+ entries but omits `activeMembership`, and the frontend hasn't yet resolved which tenant it's on (a real possible boot-sequence race, since `TenantBootstrapper` and `AuthBootstrapper` are unordered sibling effects), the user could see a temporary zero-permission state. The backend should always send `activeMembership` whenever the request carried resolvable tenant context (which, per §7 below, should be true on every request post-subdomain-migration).

## 4. Hidden Zustand context (state that exists only in the browser, with no backend equivalent, that a backend implementer must be aware of)

| Zustand field | Why it's invisible to the backend | Implication |
|---|---|---|
| `useBranchStore.selectedBranch` | Pure client UI state, never sent to the backend as "current branch" | Every branch-scoped request explicitly carries `branchId` as a URL/param — there is no session-level "active branch" concept to model server-side, and there should not be one (see §4 of `BACKEND_CONTRACT.md`) |
| `useRbacStore.tenantRoles[]` (persisted) | A local cache for the role-*management* UI, not a live authorization source | Must never be reconstructed as if it were a real backend concept — it's a read-model convenience the frontend built for itself before `memberships[]` existed. Once `memberships[]` is real, evaluate whether this persisted duplicate can be removed entirely (out of Phase Y's scope to decide) |
| `useBranchStore.activeBranch` | Customer storefront's own, unrelated branch preference | Do not conflate with Console's `selectedBranch` when designing any "current branch" backend concept — they must stay two different things, as they already are on the frontend |
| `currentTenantSession` | Deliberately never persisted, reconstructed every load | Confirms the backend does not need a "resume my last session's tenant" feature — the frontend already treats every load as "re-resolve from scratch," which is the correct posture for a subdomain-driven tenant model |

## 5. Required backend guarantees (the non-negotiable list)

1. A user only ever receives `TenantMembership` entries for tenants they
   actually belong to (§2/§3 of `BACKEND_CONTRACT.md`) — enforced from the
   auth token, never from a client-supplied id.
2. `GET /tenants/{tenantId}/branches` (or equivalent) returns only
   branches within the caller's `branchAccess` for that tenant.
3. Every branch-scoped endpoint independently re-validates `branchAccess`
   per request — list-endpoint filtering alone is not sufficient.
4. A `401` response code is reserved exclusively for "this token is
   genuinely invalid" — never reused for permission-denied, rate-limit,
   or transient failures (already specified in
   `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` §4, restated here because
   Phase 7's frontend fix for this is load-bearing on the backend
   honoring it).
5. `activeMembership` (§1) is sent whenever the request carried
   resolvable tenant context, so the frontend never has to guess which
   membership applies.

---

## 6. Tenant Switching Architecture Decision

**Current state (audited in Phase X):** "switching tenant" is a pure
in-memory Zustand mutation (`AdminTenantSwitcher.switchTenant()`) — no
URL change, no subdomain navigation. Meanwhile tenant *resolution*
(`middleware.ts`) is entirely subdomain-driven. These two facts
contradict each other, and that contradiction is the structural root of
the "kicked out on switch" bug family this project's Phase X/X.2/X.3
audits and fixes addressed.

**Decision: tenant context becomes URL/domain-based.**

```
cafe-a.samoonsaas.com   →  switch  →   cafe-b.samoonsaas.com
```

**Frontend responsibility (future migration, not built yet):**
- Replace `AdminTenantSwitcher.switchTenant()`'s in-memory
  `loadTenant(slug)` call with `window.location.href =
  https://${targetSlug}.samoonsaas.com${currentPath}` (a real navigation,
  not a client-side route change — this deliberately forces a full
  reload, which is correct: it re-runs `middleware.ts`, re-resolves
  `X-Tenant-Slug`, and re-fetches everything cleanly, eliminating the
  entire class of "stale in-memory state after switch" bugs by
  construction).
- `useTenantStore`/`useRbacStore`/`useBranchStore` need no structural
  change — they already re-resolve from scratch on every load (§4 of
  `FRONTEND_CONTEXT_MODEL.md`); a full navigation is exactly the
  "re-resolve from scratch" trigger they were already designed around.
- The only genuinely new frontend work is the navigation call itself and
  updating `AdminTenantSwitcher`'s list source to `GET /me/tenants`
  (§2/§3 gap above).

**Backend responsibility:**
- DNS/routing: every tenant's subdomain must resolve to the same
  application, with the subdomain itself being the only per-tenant
  routing signal needed (already how `middleware.ts` expects it).
- Auth token scope: confirm whether access tokens should remain valid
  across subdomains of the same root domain (`samoonsaas.com`) — likely
  yes, since login is tenant-independent (an email/password pair
  authenticates the *user*, not a specific tenant) — or whether a
  subdomain switch should force a lightweight re-auth check. This is a
  session-cookie-domain decision (`Domain=.samoonsaas.com` vs.
  per-subdomain) that must be made before implementation, not inferred
  from current frontend code (which has no opinion on it yet, since it
  has never navigated cross-subdomain for this purpose).

**Migration path:**
1. Ship `GET /me/tenants` / `GET /auth/memberships/` (§2/§3).
2. Confirm the cross-subdomain cookie-domain decision above.
3. Swap `AdminTenantSwitcher`'s data source and switch mechanism
   together, in one change (not two — an intermediate state where the
   list is scoped but the switch is still in-memory reintroduces the
   exact URL/state mismatch this decision exists to close).
4. Remove the client-side `hasAnyTenantAccess()` stopgap filter only
   after step 3 ships and the backend's own switch-rejection (§2 of
   `BACKEND_CONTRACT.md`) is live — keep it as defense-in-depth
   otherwise, per this project's established posture on every other
   client-side check (never remove a UX safety net just because the
   backend now also enforces the same rule).

---

## 7. Branch URL Context Decision

**Current state:** `/console/orders`, `/console/kitchen`,
`/console/analytics`, `/console/reservations`, `/console/staff` all read
branch context from `useBranchStore.selectedBranch` (Zustand, in-memory,
UI-selected) — the URL itself carries no branch information for these
routes. Only 3 routes are URL-addressable by branch:
`/console/branches/[id]`, `/edit`, `/analytics` (Phase 9.4).

**Options evaluated:**

| | Option A: `/console/[branchId]/orders` | Option B: `/console/orders?branch=x` (current pattern, extended) |
|---|---|---|
| Multi-tenant fit | Neutral — tenant is already subdomain-scoped (§6), so branch as a path segment doesn't conflict | Same |
| Multi-branch fit | **Bookmarkable, shareable, SSR-friendly per branch** — a link to a specific branch's orders is a real URL | Query params work but are more easily dropped (copy-paste without the `?branch=`, internal links that forget to forward it) |
| SSR | Branch becomes available to server components/middleware exactly like tenant slug already is — consistent pattern | Query params are available to SSR too, but as an optional, easy-to-omit parameter rather than a required path segment |
| Security | **Better** — makes "which branch is this request for" explicit and impossible to silently omit, which is exactly the property `useBranchAccess()`'s defense-in-depth guards need a URL to check against in the first place (they already do this for the 3 existing `[id]` routes) | Weaker by construction — a route with no `?branch=` param falls back to Zustand's `selectedBranch`, which is exactly the ambiguity that let the Phase 10/X audits' "stale/implicit branch context" findings exist |
| Refresh persistence | **Free** — the URL itself is the source of truth, survives reload with zero extra persistence logic | Requires `?branch=` to be preserved through every internal link/redirect, or falls back to Zustand's persisted `selectedBranchId` (already the current, more fragile mechanism) |

**Recommendation: Option A — `/console/[branchId]/orders`** for every
route that is meaningfully branch-scoped (orders, kitchen, analytics,
reservations; staff and settings remain tenant-scoped, unchanged, per
Phase C's and Phase 8's confirmed finding that staff/settings are
intentionally not branch-exclusive).

**Reasoning, restated directly:** the current `selectedBranch`-from-Zustand
pattern is exactly the mechanism the Phase 10 audit traced as *safe from
data leakage* (every query key is correctly parameterized) but *not
architecturally sound* (no URL durability, no bookmarkability, implicit
rather than explicit branch context on every page). Moving branch into
the URL doesn't fix a data-safety bug — none was found — it fixes the
structural mismatch between "branch is supposed to be a real navigable
context" and "branch is actually invisible to the URL," the same class
of mismatch §6 identifies for tenant/subdomain. `useBranchAccess(id)`
already expects to read `id` from a route param (that's its exact
signature today, used on the 3 existing branch routes) — extending that
same pattern to `/console/[branchId]/orders` etc. is additive, not a
redesign of the branch-access model itself.

**Not implemented this phase** — Phase Y is contract-freeze only, per
its own constraints. This is the recommended target for a future
migration phase, sequenced after §6's tenant/subdomain work (branch URLs
nested under a tenant subdomain: `cafe-a.samoonsaas.com/console/branch-1/orders`).

---

## Final Verdict

### Can the Django backend be implemented now without guessing?

**Partially — for auth, membership, and permission shape: YES. For
tenant/branch switching mechanics: NOT YET, pending the two architecture
decisions above.**

**What can be built immediately, with zero remaining ambiguity:**
- `POST /auth/login/`, `/verify-otp/`, `/register/`, `GET /auth/me/` with
  the `memberships[]`/`activeMembership` shape (`BACKEND_CONTRACT.md` §1)
  — the frontend already fully consumes this shape (Phase 9.2), tested,
  merged.
- `GET /auth/memberships/`, `GET /me/tenants` (§2/§3) — shapes are fully
  specified above; scoping rule is unambiguous (caller's own token only).
- `GET /tenants/{tenantId}/branches` filtered by `branchAccess` (§4) —
  shape and scoping rule fully specified.
- Permission computation (§5) — no new backend logic needed at all if the
  backend simply sends `roles[]` and lets the frontend derive permissions
  via the existing, unchanged `ROLE_PERMISSION_MAP`.
- All existing CRUD endpoints already documented in each service file's
  JSDoc (§6 of `BACKEND_CONTRACT.md`) — unaffected by Phase Y.

**What remains genuinely ambiguous, and must be decided (not
guessed) before implementation:**
1. **Cross-subdomain session/cookie scope** (§6) — does one login session
   span all of a user's tenant subdomains, or does switching subdomains
   require a fresh auth check? This is a product/security decision with
   no frontend precedent to infer it from (the frontend has never
   navigated cross-subdomain for this purpose).
2. **Whether `POST /auth/switch-tenant/` needs to exist at all**, or
   whether tenant switching becomes pure subdomain navigation with no
   dedicated switch endpoint (§6's migration path implies the latter is
   sufficient once §2/§3 exist, but this should be an explicit product
   decision, not an inferred one).
3. **Branch URL migration timing** (§7) — recommended, not scheduled;
   whether it ships before or after the tenant/subdomain work affects
   route-nesting design (`/console/[branchId]/orders` vs. a
   tenant-subdomain-nested equivalent) and should be sequenced
   deliberately.
4. **Whether `TenantMembership.tenantSlug`/`.tenantName` are populated
   from day one** — typed optional today because nothing sends them, but
   a real tenant switcher (built after §2/§3 ship) needs them to avoid an
   N+1 lookup per membership.

None of these four block starting backend implementation on the
already-frozen parts (auth/membership/permission/branch-list contracts)
— they block only the tenant-switch and branch-URL *mechanics*, which
are frontend-side migration work sequenced for a later phase per this
project's explicit "no architecture changes, no staff/RBAC feature work"
constraints on every phase since Phase X.
