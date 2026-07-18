# Backend Implementation Plan (Phase Z)

**Status: planning blueprint only.** No code, no migrations, no
serializers written — this document converts the frozen contract
(`docs/BACKEND_CONTRACT.md`, `docs/FRONTEND_CONTEXT_MODEL.md`,
`docs/API_GAP_REPORT.md`) into an exact Django implementation plan.

**Scope note on §6:** no Django backend repository exists within this
session's accessible scope (verified — this repo is frontend-only,
mock-mode). "Current backend" for gap-analysis purposes is therefore the
mock-service-implied contract already documented in
`docs/API_GAP_REPORT.md` §2 (the endpoints `src/services/tenant.service.ts`
and `src/services/branch.service.ts` call, and what they currently
return in mock mode) — the best available proxy for "what exists today,"
since that is the shape any real backend has been silently promising to
match.

---

## 1. Model Mapping

Recommended Django app boundaries: `accounts` (User), `tenancy` (Tenant,
TenantMembership), `branches` (Branch), `rbac` (Role, Permission,
RolePermission). App names are a suggestion, not a requirement — the
model *shapes* below are the load-bearing part of this plan.

### `accounts.User`

```
User
  id                UUID/BigAutoField, pk
  email             EmailField, NULLABLE, unique-if-present
  phone_number      CharField, NULLABLE, unique-if-present (E.164)
  first_name        CharField
  last_name         CharField
  avatar            URLField, nullable
  account_type      CharField(choices=['customer','business'])
  is_verified       BooleanField(default=False)
  created_at        DateTimeField(auto_now_add=True)
```

- **Required changes vs. a stock `AbstractUser`:** replace the default
  `username`-required behavior (email/phone are both optional per
  `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` — phone-only accounts have
  no email); add `account_type`. Do **not** add a `role` field — the
  frozen contract (`FRONTEND_CONTEXT_MODEL.md` §1) is explicit that
  `accountType` is a UX-only landing hint, never an authorization
  column, and no global "role" concept should exist on this model at
  all.
- **Constraint:** `CheckConstraint` ensuring at least one of
  `email`/`phone_number` is set (mirrors the frontend's own nullable
  handling — an account with neither is not representable client-side).
- **Missing relationship:** reverse accessor to `TenantMembership`
  (`user.memberships`, implicit via the FK below) — this is the entire
  bridge to tenant/branch context; nothing else on `User` should ever
  carry tenant-scoped information.

### `tenancy.Tenant`

```
Tenant
  id                UUID/BigAutoField, pk
  slug              SlugField, unique, indexed
  name              CharField
  business_types    JSONField (list of strings) — or a small lookup
                     M2M if business types need their own metadata later;
                     JSONField is sufficient for the frozen contract,
                     which only ever reads this as a flat list
  status            CharField(choices=['active','trial','suspended',
                     'churned','archived'])
  settings          JSONField (theme, contactEmail, businessHours, etc.
                     — matches Tenant.settings already being a loose bag
                     on the frontend, src/types/index.ts)
  created_at        DateTimeField(auto_now_add=True)
```

- **Index:** `slug` (unique + indexed — this is the primary lookup key
  for every request, resolved from the subdomain per
  `BACKEND_CONTRACT.md` §6's tenant-switching decision).
- **No FK to User for "owner"** — ownership is expressed entirely
  through a `TenantMembership` row with `role='owner'`, not a
  `Tenant.owner` FK. This matches the frontend's own historical finding
  (documented in this project's earlier architecture audits) that a
  separate ownership-identity concept caused more bugs than it solved;
  the frozen contract deliberately has no such field.

### `tenancy.TenantMembership` (the User ↔ Tenant bridge — answers §3 below)

```
TenantMembership
  id                 BigAutoField, pk
  user               FK -> accounts.User, on_delete=CASCADE
  tenant              FK -> tenancy.Tenant, on_delete=CASCADE
  roles              M2M -> rbac.Role  (a membership can hold MULTIPLE
                      roles — frontend's TenantMembership.roles: Role[])
  branch_scope       CharField(choices=['all','assigned'], default='assigned')
  assigned_branches  M2M -> branches.Branch (populated only when
                      branch_scope='assigned'; ignored/empty when 'all')
  status             CharField(choices=['active','suspended','revoked'])
  created_at         DateTimeField(auto_now_add=True)

  constraints:
    unique_together (user, tenant)   -- one membership row per user per tenant
  indexes:
    (user, status)                   -- GET /auth/me's primary query path
    (tenant, status)                 -- future "list tenant's members" queries
```

- **Foreign keys:** `user` → `accounts.User`, `tenant` → `tenancy.Tenant`.
- **Many-to-many:** `roles` → `rbac.Role`; `assigned_branches` →
  `branches.Branch`.
- **Constraint:** `unique_together(user, tenant)` — a user has at most
  one membership row per tenant (multiple roles live inside that one
  row's `roles` M2M, not as multiple rows — this matches the frontend
  type exactly: `TenantMembership.roles: Role[]`, singular membership,
  plural roles).

### `branches.Branch`

```
Branch
  id                 UUID/BigAutoField, pk
  tenant              FK -> tenancy.Tenant, on_delete=CASCADE
  name               CharField
  slug               SlugField
  status             CharField(choices=['active','inactive','maintenance'])
  type               CharField (physical/virtual — matches BranchType)
  location           JSONField (address/city/country/lat/lng)
  contact            JSONField (phone/email/website)
  manager            FK -> accounts.User, nullable, on_delete=SET_NULL
  business_hours     JSONField (array of {day, open, close, isClosed})
  settings           JSONField (delivery/pickup/tableOrdering/etc.)
  image, cover_image URLField, nullable
  is_default         BooleanField(default=False)
  timezone, currency, language   CharField, nullable
  created_at, updated_at  DateTimeField

  constraints:
    unique_together (tenant, slug)
  indexes:
    (tenant, status)   -- GET /tenants/{id}/branches's primary query path
```

- Exactly one `Branch` per `(tenant, slug)` should have `is_default=True`
  — enforce via application logic (a `CheckConstraint` can't easily
  express "exactly one," so this is a signal/service-layer invariant,
  not a DB constraint) — same posture the frontend already takes
  client-side (`isOnlyBranch`/`isDefault` handling in
  `src/app/console/branches/[id]/page.tsx`, unchanged by this plan).

### `rbac.Role`

```
Role
  code    CharField, primary_key (e.g. 'owner', 'manager', 'cashier')
  label   CharField (display name)
```

- **Not custom/tenant-scoped** — per this phase's explicit "no custom
  roles yet" constraint, seed exactly the 8 rows matching the frontend's
  fixed `Role` type (`owner`, `admin`, `manager`, `cashier`, `waiter`,
  `kitchen`, `marketing`, `support`) via a data migration, not a
  user-editable table. Modeling it as a real DB table (rather than a
  `CharField(choices=...)` directly on `TenantMembership.roles`) is
  intentional even though custom roles aren't in scope — it makes
  `RolePermission` a real M2M with an admin-manageable seed, and leaves
  the schema unchanged if per-tenant custom roles are ever added later
  (a `tenant` nullable FK could be added to this table without touching
  `TenantMembership` at all).

### `rbac.Permission`

```
Permission
  code    CharField, primary_key (e.g. 'orders.view', 'menu.manage')
```

- Seed exactly the permission set the frontend's `ALL_PERMISSIONS`
  constant already enumerates (`src/services/permission.service.ts`) —
  this list is the single source of truth to copy from; do not invent
  new permission strings the frontend doesn't already check for.

### `rbac.RolePermission`

Plain M2M (`Role.permissions = ManyToManyField(Permission)`), no extra
metadata needed — Django's implicit through table is sufficient. Seed
data must reproduce `ROLE_PERMISSION_MAP` (`src/services/permission.service.ts`)
row-for-row, including the `owner` role receiving every permission (see
§4's explicit answer on how, not just that).

### Relationship diagram

```
User
 |
 | 1:N (unique per tenant)
 |
TenantMembership ──M:N── Role ──M:N── Permission
 |         |
 | FK      | M:N (only meaningful when branch_scope='assigned')
 |         |
Tenant   Branch (also FK'd directly: Branch.tenant)
```

---

## 2. Auth / Session Implementation Plan

### `GET /auth/me/` — response generation flow

```
Request (Authorization: Bearer <access>, Host: cafe-a.samoonsaas.com)
  │
  ▼
DRF Authentication (SimpleJWT or equivalent) → request.user
  │
  ▼
Tenant resolution middleware (mirrors src/middleware.ts's subdomain
  parsing, server-side now) → resolves `tenant_slug` from Host header
  │
  ▼
Membership queryset:
  TenantMembership.objects
    .filter(user=request.user, status='active')
    .select_related('tenant')
    .prefetch_related('roles', 'assigned_branches')
  │
  ▼
Per-membership serialization:
  for each membership:
    roles = [r.code for r in membership.roles.all()]
    branchAccess = (
      {"scope": "all"} if membership.branch_scope == 'all'
      else {"scope": "assigned", "branchIds": [str(b.id) for b in membership.assigned_branches.all()]}
    )
  │
  ▼
activeMembership resolution:
  match `tenant_slug` (from the tenant-resolution middleware) against
  the membership list's `tenant.slug` — if found, that membership is
  `activeMembership`; if not found (user has no membership for the
  tenant this subdomain belongs to), OMIT activeMembership entirely
  (per API_GAP_REPORT.md item 3 — never guess; the frontend's
  normalizeTenantPermissions() is already built to deny-by-default here)
  │
  ▼
MeResponseSerializer — flat User fields + memberships[] + activeMembership?
  │
  ▼
Response
```

### Serializers needed

| Serializer | Fields | Notes |
|---|---|---|
| `UserSerializer` | `id, email, phone_number, first_name, last_name, avatar, account_type→accountType, is_verified, created_at` | `account_type` → `accountType` is the only field-name transform needed (Python snake_case → the frontend's camelCase — same rename `p7Roles`→`tenantRoles` already required in the legacy contract, `docs/P10.10...md` §9 item 2) |
| `BranchAccessSerializer` | `SerializerMethodField` producing the `{scope:'all'}` / `{scope:'assigned', branchIds:[...]}` union directly (not a model-mirroring serializer, since this is a computed shape, not a stored row) | |
| `TenantMembershipSerializer` | `tenantId (tenant.id), tenantSlug (tenant.slug), tenantName (tenant.name), roles (via roles.all()), branchAccess (nested BranchAccessSerializer), status` | |
| `MeResponseSerializer` | Flattens `UserSerializer`'s fields + `memberships` (list of `TenantMembershipSerializer`) + `activeMembership` (single `TenantMembershipSerializer`, optional) at the top level — **not** nested under a `user` key, matching `BACKEND_CONTRACT.md` §1.3's explicit "flat User, extended in place" requirement |

### Queryset optimization requirements

- `select_related('tenant')` on the membership queryset — every
  membership needs its tenant's `slug`/`name`, and without this each
  membership triggers a separate tenant lookup (N+1).
- `prefetch_related('roles', 'assigned_branches')` — both are M2M;
  without prefetching, each membership triggers 2 more queries per row
  (2N+1 total for N memberships).
- Total query count for `GET /auth/me/` should be **constant** (4
  queries: user lookup via auth, membership list, roles prefetch,
  assigned_branches prefetch) regardless of how many tenants/branches
  the user belongs to — this is the concrete performance bar to test
  against (see §8).

---

## 3. Membership Architecture

**Is `TenantMembership` enough? Yes.** No separate `BranchMembership`
model is needed. Reasoning, directly from the frozen contract:

- `BranchAccess` (`docs/FRONTEND_CONTEXT_MODEL.md` §1) is a property of
  **one membership as a whole**, not of individual branch grants — a
  membership is either `{scope:'all'}` (every current AND future branch,
  per the frontend type's own doc comment in `src/types/rbac.ts`) or
  `{scope:'assigned', branchIds:[...]}` (an explicit, bounded list). This
  is exactly representable as `TenantMembership.branch_scope` (a 2-value
  enum) + `TenantMembership.assigned_branches` (a M2M, only consulted
  when `branch_scope='assigned'`).
- A separate `BranchMembership` row-per-branch model would let two facts
  drift out of sync that must never do so: "which scope am I in" and
  "which branches am I assigned to when in assigned scope." Keeping both
  on the one `TenantMembership` row makes that invariant structural
  (you cannot have `assigned_branches` rows with no parent scope
  decision) rather than something application code has to maintain
  across two tables.
- **"How is 'all branches' represented?"** — `branch_scope='all'`, with
  `assigned_branches` simply unpopulated/ignored. Critically: `'all'`
  means "every **current and future** branch" (per the frontend type's
  own documented semantics) — this is exactly why it must be a scope
  flag, not an M2M snapshot of today's branch list. If it were
  implemented as "M2M to all branches that exist right now," a newly
  created branch would silently be excluded from an owner's access until
  someone remembered to add it — the scope-flag design avoids this by
  construction.

**Recommended approach:** `TenantMembership.branch_scope` +
`TenantMembership.assigned_branches` (M2M), exactly as modeled in §1.
No additional model required.

---

## 4. RBAC Backend Design

### Resolution flow

```
User (request.user, from auth)
  ↓
TenantMembership (filtered: user=request.user, tenant=<resolved tenant>, status='active')
  ↓
roles = membership.roles.all()   -- possibly multiple
  ↓
permissions = Permission.objects.filter(role__in=roles).distinct()
  -- i.e. the UNION of every role's permission set, computed via the
  -- RolePermission M2M — multiple roles union permissions exactly as
  -- the frontend's getPermissionsForRole() already does client-side
```

### Owner bypass: **owner receives all permissions via seed data, not a runtime bypass**

This is the explicit either/or the task asks to resolve. **Answer:
seed data, matching the frontend's existing, unmodified design exactly.**

`ROLE_PERMISSION_MAP.owner` (`src/services/permission.service.ts`) is a
**static mapping to `ALL_PERMISSIONS`**, not a runtime `if role ==
'owner': return True` check anywhere in the frontend's authorization
code. The backend must mirror this precisely: the `RolePermission` seed
migration assigns every `Permission` row to the `owner` `Role` row,
exactly like every other role's permission set is seeded. There is no
special-cased "is this the owner" branch anywhere in the permission-
resolution query above — `permissions = Permission.objects.filter(role__in=roles)`
already returns everything for an owner, for the mundane reason that the
`owner` row is joined to every `Permission` row, not because the query
knows anything about ownership semantics.

**Why this matters, restated from the frontend's own documented
history:** an earlier version of this project's RBAC had a genuine
runtime ownership-identity bypass (a separate "does this user own this
tenant" check, independent of role assignment) — it was found to be an
architectural liability and fully removed (confirmed dead code,
`FRONTEND_CONTEXT_MODEL.md` §5's permission-evaluation algorithm has no
such step). The backend must not reintroduce that pattern under a new
name.

### No custom roles (explicit, per this phase's constraint)

`Role`/`Permission`/`RolePermission` are seeded, admin-manageable via
Django admin if desired, but **not** exposed through any tenant-facing
API this phase — no "create a role" endpoint, no per-tenant role
customization. This mirrors the frozen contract's own explicit
non-goal (`docs/BACKEND_CONTRACT.md` §5: "Do NOT expand complexity").

---

## 5. API Implementation Order

1. **Authentication contract** — `POST /auth/login/`, `/verify-otp/`,
   `/register/`, `GET /auth/me/`, `POST /auth/token/refresh/`, `POST
   /auth/logout/`. Build `User`, get JWT issuance working, get
   `GET /auth/me/` returning the flat User shape with `memberships: []`
   (empty — no `TenantMembership` rows exist yet). This is independently
   testable before `Tenant`/`Branch`/`Role` exist at all.
2. **Membership contract** — `TenantMembership`, `Role`, `Permission`,
   `RolePermission` models + seed migration (§1, §4). `GET
   /auth/memberships/` becomes buildable once these exist; `GET
   /auth/me/`'s `memberships[]` field starts returning real data.
3. **Tenant context API** — `Tenant` model, `GET /me/tenants` (a
   projection of step 2's membership query — see
   `BACKEND_CONTRACT.md` §3), `GET /tenants/{slug}/` detail.
4. **Branch context API** — `Branch` model, `GET
   /tenants/{tenantId}/branches` filtered by the requesting membership's
   `branch_scope`/`assigned_branches` (§3 above; this is the endpoint
   `API_GAP_REPORT.md` item 2 identifies as currently unscoped and
   directly responsible for prior frontend isolation bugs — get the
   filter right here before anything else touches branches).
5. **Permission endpoint if needed** — per `BACKEND_CONTRACT.md` §5,
   **not required as a separate endpoint** — `memberships[].roles` is
   sufficient; the frontend derives permissions client-side via the
   unmodified `ROLE_PERMISSION_MAP`. Build this step only if a future
   requirement (per-user overrides beyond roles) makes server-computed
   permissions necessary — not blocking for anything in this plan.
6. **Existing CRUD migration** — staff/menu/orders/reservations
   endpoints, once steps 1–4 establish the auth/tenant/branch foundation
   every one of them depends on for scoping. Each CRUD endpoint's
   authorization is "does the caller's membership for this tenant grant
   the relevant permission, and (if branch-scoped) does their
   `branch_scope` cover this branch" — a single reusable permission
   class/decorator built once after step 4, not reimplemented per
   endpoint.

---

## 6. Existing Backend Gap Analysis

No real Django backend exists in accessible scope (see the note at the
top of this document). Comparing the frozen contract against the
mock-service-implied baseline (`docs/API_GAP_REPORT.md` §2):

| Endpoint | Mock-implied current behavior | Frozen requirement | Gap |
|---|---|---|---|
| `GET /tenants/` | Returns every tenant on the platform, unfiltered (`tenantService.getTenants()`) | Must not exist in this unscoped form for a tenant-facing caller | **This endpoint must not be reimplemented as-is.** Replace with `GET /me/tenants`, scoped to `TenantMembership.objects.filter(user=request.user)`. If a platform-admin "list every tenant" capability is still needed, it must live behind a distinct, explicitly platform-admin-only permission — never the same route ordinary tenant callers can reach (this is the exact confirmed root cause traced in `API_GAP_REPORT.md` item 2 / the Phase X audit series) |
| `GET /branches/` | Returns every branch of a tenant, unfiltered (`branchManagementService.getBranches(tenantId)`) | Must return only branches within the caller's `branch_scope` | Replace with `GET /tenants/{tenantId}/branches`, filtered per §3's membership-scope logic — never a bare unscoped branch list |
| `GET /branches/{id}/orders`, `/analytics`, `/reservations` | No access check modeled at all (mock data has no real boundary) | Independently re-validate `branch_scope` per request | New authorization logic required at every one of these endpoints — filtering the *list* endpoint alone does not protect a direct request to a specific branch's data |
| `GET /auth/me/` | Returns flat `tenantRoles: Role[]`, no tenant mapping, no branch data at all | Returns `memberships[]`/`activeMembership` per §1.3 of `BACKEND_CONTRACT.md` | Full response-shape change, already fully specified; frontend already consumes both shapes (legacy + new) without further changes needed |

**Unsafe endpoints identified:** `GET /tenants/` and `GET /branches/` (as
currently mock-implied) are the two flagged as unsafe-if-reimplemented-
as-is — both must gain caller-scoping before any real traffic reaches
them, not after.

---

## 7. Security Review

### Tenant isolation — can User A ever receive Tenant B's data?

**Must be structurally impossible, not merely filtered.** Every
tenant-scoped queryset in the backend must originate from
`TenantMembership.objects.filter(user=request.user, ...)` — never from a
client-supplied `tenantId`/`tenantSlug` used to look up data directly
without first confirming a membership row exists for that
`(request.user, tenant)` pair. Concretely: `GET
/tenants/{tenantId}/branches` must first verify
`TenantMembership.objects.filter(user=request.user, tenant_id=tenantId,
status='active').exists()` before returning anything, returning `403`
(not `404`, to match the frontend's `TenantForbiddenError` vs.
`TenantNotFoundError` distinction already modeled in
`src/services/tenant.service.ts`) otherwise.

### Branch isolation — can a user access another branch?

**Must be structurally impossible for `branch_scope='assigned'`
memberships.** Every branch-scoped endpoint must check
`assigned_branches.filter(id=requested_branch_id).exists()` (or
short-circuit true when `branch_scope='all'`) before returning data —
independently at *every* such endpoint, not only at the branch-list
endpoint. This is the same principle `docs/BACKEND_CONTRACT.md` §4
already states as non-negotiable; this section exists to confirm it
survives into the actual authorization-class design, not just the docs.

### Is frontend-only permission checking acceptable?

**No — explicitly, and this has been the consistent position across
every prior audit in this project (Phase 9.4, Phase X, Phase X.2,
`API_GAP_REPORT.md` §5).** Every frontend permission/branch-access check
(`usePermission()`, `PermissionGuard`, `canAccessBranch()`,
`useBranchAccess()`) is explicitly documented, at its own definition, as
UX/defense-in-depth only — none of them are a security boundary, and
none were ever intended to be. The backend is the **sole** enforcement
point. A backend that trusts a client-supplied permission claim, or
skips the membership/scope checks above because "the frontend already
checked," reproduces exactly the class of bug this entire project's
Phase X audit series exists to prevent.

### Backend guarantees this plan commits to

1. Every tenant-scoped query is derived from the authenticated user's
   own `TenantMembership` rows — never from a client-supplied identifier
   alone.
2. Every branch-scoped endpoint independently re-validates
   `branch_scope`/`assigned_branches`, not just the branch-list endpoint.
3. `owner` role's full access comes from seed data (§4), not a runtime
   ownership-identity bypass — there is exactly one permission-resolution
   code path, used identically for every role including `owner`.
4. `401` is reserved exclusively for "this token is invalid" (already
   specified in `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` §4,
   re-confirmed as load-bearing here).

---

## 8. Testing Strategy

Framework assumption: `pytest-django` + DRF `APIClient` (adjust to the
team's actual convention — not a blocking decision for this plan).

### Authentication

- `test_me_returns_empty_memberships_for_user_with_no_tenant_access`
- `test_me_returns_single_membership_for_user_with_one_tenant`
- `test_me_returns_multiple_memberships_for_user_with_multiple_tenants`
- `test_me_sets_activeMembership_when_tenant_slug_resolves_to_a_real_membership`
- `test_me_omits_activeMembership_when_requesting_host_does_not_match_any_membership`
- `test_me_query_count_is_constant_regardless_of_membership_count` (the
  §2 performance bar — assert exactly N queries via
  `django.test.utils.CaptureQueriesContext` or `assertNumQueries`,
  independent of how many memberships/roles/branches are seeded)

### Tenant

- `test_me_tenants_returns_only_the_callers_own_memberships`
- `test_me_tenants_excludes_tenants_the_user_has_no_membership_in`
- `test_me_tenants_excludes_suspended_or_revoked_memberships`

### Branch

- `test_tenant_branches_returns_all_branches_for_scope_all_membership`
- `test_tenant_branches_returns_only_assigned_branches_for_scope_assigned_membership`
- `test_tenant_branches_returns_empty_list_for_assigned_scope_with_no_branches_granted`
- `test_branch_detail_endpoint_rejects_branch_outside_assigned_scope` (403,
  not silently empty — proves per-endpoint re-validation, not just the
  list endpoint)
- `test_branch_scope_all_includes_a_branch_created_after_membership_was_granted`
  (proves `'all'` is a live scope flag, not a stale snapshot — directly
  tests the §3 design rationale)

### Permission

- `test_multiple_roles_on_one_membership_union_permissions` (a
  membership with `roles=['cashier','waiter']` receives the union of
  both role's permissions, including at least one permission unique to
  each — mirrors the frontend's own existing
  `phase-C-staff-assignment.test.tsx` "multiple roles union permissions"
  coverage, now asserted server-side)
- `test_owner_role_receives_every_seeded_permission`
- `test_owner_permission_set_comes_from_role_permission_seed_not_a_special_case`
  (regression guard: seed data intentionally omits `owner` from one
  `RolePermission` mapping in a test fixture and asserts the endpoint
  correctly denies that permission — proving there is no hidden
  "role == owner" bypass anywhere in the query path)

### Isolation

- `test_user_a_cannot_list_user_b_tenant_via_me_tenants`
- `test_user_a_requesting_user_b_tenant_slug_directly_receives_403_not_tenant_data`
- `test_user_a_cannot_list_branches_of_a_tenant_they_have_no_membership_in`
- `test_cross_tenant_role_does_not_leak` (a user who is `owner` in Tenant
  A and has zero membership in Tenant B must receive zero roles/
  permissions when queried in Tenant B's context — no role inheritance
  across tenants, matching `FRONTEND_CONTEXT_MODEL.md` §1's explicit
  "roles in Tenant A say nothing about Tenant B" invariant)

---

## Final Deliverables Summary

This document (`docs/BACKEND_IMPLEMENTATION_PLAN.md`) contains:
1. Model mapping (§1)
2. Required migrations — implied by §1's model definitions + §4's seed
   data (Role/Permission/RolePermission fixture); no migration files
   written this phase, per the task's constraint
3. Serializer plan (§2)
4. API implementation order (§5)
5. Security rules (§7)
6. Testing plan (§8)
7. Remaining decisions (below)

## Remaining Decisions

Carried forward from `docs/API_GAP_REPORT.md`'s final verdict, still
unresolved and still not blocking the plan above:

1. Cross-subdomain session/cookie scope (affects whether `GET
   /auth/me/`'s tenant-resolution middleware needs to handle a
   cross-domain cookie or can assume same-domain).
2. Whether `POST /auth/switch-tenant/` is built at all, or tenant
   switching is pure subdomain navigation with no dedicated endpoint.
3. Branch-URL migration sequencing (`/console/[branchId]/orders`) —
   affects nothing in this plan directly (this plan's endpoints are
   header/subdomain-driven, not path-driven), but affects when the
   frontend starts sending `branchId` as an explicit path segment versus
   a query param on requests to the CRUD endpoints in §5 step 6.
4. Whether `Tenant.business_types`/`settings` need real structured
   sub-models eventually, or JSONField is acceptable long-term — not
   blocking (JSONField is sufficient for everything this plan's contract
   requires today).

---

## Final Question — Answered

**Is Django backend implementation now deterministic, or are there still
architecture decisions blocking coding?**

**Deterministic for everything in §1–§8 above.** Every model, field,
relationship, constraint, index, serializer, query pattern, endpoint,
authorization rule, and test case needed to implement the Auth,
Membership, Tenant, and Branch contracts — the full `GET /auth/me/` →
`GET /me/tenants` → `GET /tenants/{id}/branches` → permission-resolution
chain — is specified with no remaining ambiguity. A Django team can begin
§5's implementation order immediately without guessing any model shape,
query pattern, or authorization rule in that chain.

The four "Remaining Decisions" above are real, but **none of them block
starting or completing §1–§8** — they affect only the tenant-switching
*mechanism* (subdomain navigation vs. a dedicated switch endpoint) and
the *future* branch-URL migration's request shape, both already scoped
in `docs/API_GAP_REPORT.md` as later, separate migration work. The
backend contract this plan implements does not change shape based on how
either of those decisions resolves.
