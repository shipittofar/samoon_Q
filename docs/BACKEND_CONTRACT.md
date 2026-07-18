# Backend Contract — Frozen Specification (Phase Y)

**Status: FROZEN.** This document is derived exclusively from the current
frontend implementation (types, services, stores, hooks) as of the
`claude/dashboard-settings-profile-itc4fj` branch, HEAD `01a635b`. It
describes what the Django backend must return for the frontend to work
correctly, without any frontend code changes. No backend exists yet — this
is the target contract, not a description of a running system.

Companion documents:
- `FRONTEND_CONTEXT_MODEL.md` — the User → Membership → Tenant → Branch →
  Permission relationship this contract exists to serve.
- `API_GAP_REPORT.md` — every place the current frontend still assumes
  something this contract doesn't (yet) guarantee.

---

## 1. Auth API

### 1.1 `POST /auth/login/`

**Request**
```json
{ "email": "owner@samoon.com", "password": "hunter2" }
```

**Response — 200 OK**
```json
{
  "user": {
    "id": "u_123",
    "email": "owner@samoon.com",
    "phone_number": null,
    "first_name": "Olivia",
    "last_name": "Owner",
    "avatar": null,
    "accountType": "business",
    "is_verified": true,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "tokens": { "access": "<jwt>", "refresh": "<opaque-or-jwt>" },
  "memberships": [
    {
      "tenantId": "tenant-samoon-01",
      "tenantSlug": "samoon",
      "tenantName": "Samoon Restaurant",
      "roles": ["owner"],
      "branchAccess": { "scope": "all" },
      "status": "active"
    }
  ],
  "activeMembership": { "tenantId": "tenant-samoon-01" }
}
```

**Errors:** `401 INVALID_CREDENTIALS`, `403 ACCOUNT_SUSPENDED`, `429 LOGIN_RATE_LIMIT`.

**Frontend consumer:** `useLogin()` (`src/hooks/index.ts`) → `useAuthStore.setUser(user)`, `seedTenantSession()` → `useRbacStore.setCurrentTenantSession()`.

**`activeMembership` resolution rule:** the backend determines which
membership is "active" from the request's tenant context (subdomain — see
§6), the same way `middleware.ts` already resolves `X-Tenant-Slug`
server-side today. The frontend never guesses this from the list; if
`activeMembership` is absent, the frontend must NOT assume one (see
`normalizeTenantPermissions()`'s documented ambiguous-multi-membership
deny-by-default rule, `src/services/permission.service.ts`).

### 1.2 `POST /auth/send-otp/` / `POST /auth/verify-otp/`

Unchanged from the existing `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md`
§2.2/§2.3 contract — phone/OTP mechanics are out of scope for Phase Y
(no tenant/branch context is established until the discriminated
`is_new_user: false` branch, which then carries the same `memberships`/
`activeMembership` shape as §1.1).

### 1.3 `GET /auth/me/`

**Request:** none (Bearer token).

**Response — 200 OK** — flat `User`, extended in place (NOT wrapped in a
`user` key — this matches the existing documented contract convention):

```json
{
  "id": "u_123",
  "email": "owner@samoon.com",
  "phone_number": null,
  "first_name": "Olivia",
  "last_name": "Owner",
  "avatar": null,
  "accountType": "business",
  "is_verified": true,
  "created_at": "2024-01-01T00:00:00Z",
  "memberships": [
    {
      "tenantId": "tenant-samoon-01",
      "tenantSlug": "samoon",
      "tenantName": "Samoon Restaurant",
      "roles": ["owner"],
      "branchAccess": { "scope": "all" },
      "status": "active"
    },
    {
      "tenantId": "tenant-brew-cafe-01",
      "tenantSlug": "brew-cafe",
      "tenantName": "Brew Cafe",
      "roles": ["cashier"],
      "branchAccess": { "scope": "assigned", "branchIds": ["branch-5"] },
      "status": "active"
    }
  ],
  "activeMembership": { "tenantId": "tenant-samoon-01" }
}
```

**Errors:** `401 TOKEN_EXPIRED`, `401 TOKEN_INVALID`.

**Frontend consumer:** `AuthBootstrapper.checkSession()`
(`src/providers/index.tsx`) — the sole session-restore mechanism, called
on every app boot. A `401` triggers full session teardown
(`clearSession()`); any other failure (network/5xx) sets
`sessionCheckFailed` and does NOT clear tokens (Phase 7 — see §"Token
Lifecycle" below).

**Field-by-field requirement:**

| Field | Required? | Frontend consumer | Notes |
|---|---|---|---|
| `id`, `email`, `first_name`, `last_name`, `is_verified`, `created_at` | **Required** | `useAuthStore.user` | Display, identity |
| `phone_number`, `avatar` | Optional | Display only | Phone-only accounts have no email; nullable |
| `accountType` | **Required** | Post-login/no-membership landing redirect only (`getPostLoginRedirect()`, `src/utils/auth-redirect.ts`) | **Never** an authorization signal — see §5 and `FRONTEND_CONTEXT_MODEL.md` |
| `memberships[]` | **Required** (empty array valid) | `normalizeTenantPermissions()`, tenant switcher (once built — see `API_GAP_REPORT.md` item 1) | Absent field ≠ empty array; absent means "legacy contract," empty means "genuinely no memberships" — the frontend's `normalizeTenantPermissions()` already distinguishes these (checks `!== undefined && !== null`) |
| `memberships[].tenantId`, `.roles[]`, `.branchAccess` | **Required** per entry | RBAC seeding | `roles[]` may be empty only if `status !== 'active'` |
| `memberships[].tenantSlug`, `.tenantName`, `.status` | Optional (typed optional in `TenantMembership`, `src/types/rbac.ts`) | Tenant switcher display | Frontend degrades gracefully without them today, but a real tenant switcher (§2) needs `tenantSlug`+`tenantName` to render a usable list |
| `activeMembership` | Optional, but **strongly recommended always present when the request carried tenant context** | `normalizeTenantPermissions()`'s membership-selection priority (`activeMembership` > `currentTenantId` match > sole-entry) | Its absence with >1 membership and no other disambiguation hint is defined to **deny by default** — never guessed |

### 1.4 `POST /auth/register/`, `POST /auth/token/refresh/`, `POST /auth/logout/`, password-reset endpoints

Unchanged from `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` §2.4, §2.6–§2.9 —
these were already fully specified and are not affected by the
membership-contract upgrade in this document. `register`'s `SessionResponse`
gains the same `memberships`/`activeMembership` fields as §1.1.

### Token Lifecycle (unchanged, restated for completeness)

- Storage: `localStorage` (`JWT_ACCESS_KEY`/`JWT_REFRESH_KEY`) + one
  non-HttpOnly cookie mirror for Edge middleware.
- Refresh: on any `401` (except from the refresh call itself), exactly one
  refresh attempt, deduplicated across concurrent 401s.
- **Error classification is load-bearing** (`docs/P10.10...md` §4): `401`
  → session is invalid, clear everything. Anything else (5xx, network,
  429) → transient, tokens untouched, `sessionCheckFailed` set
  (`src/stores/index.ts` `useAuthStore`).

---

## 2. Membership API

### `GET /auth/memberships/`

A dedicated endpoint for re-fetching the caller's own membership list
without a full `/auth/me/` round trip (e.g. after an admin grants a new
membership server-side, or for a "my organizations" UI). Same
`TenantMembership[]` shape as §1.3's `memberships` field.

**Request:** none (Bearer token).

**Response — 200 OK**
```json
[
  { "tenantId": "tenant-samoon-01", "tenantSlug": "samoon", "tenantName": "Samoon Restaurant", "roles": ["owner"], "branchAccess": { "scope": "all" }, "status": "active" },
  { "tenantId": "tenant-brew-cafe-01", "tenantSlug": "brew-cafe", "tenantName": "Brew Cafe", "roles": ["cashier"], "branchAccess": { "scope": "assigned", "branchIds": ["branch-5"] }, "status": "active" }
]
```

**Access rule (non-negotiable):** the backend returns **only the
memberships the authenticated caller actually holds** — derived from the
auth token, never from a client-supplied user id or tenant id. This is the
single guarantee that makes §3's tenant list safe.

**Frontend consumer:** not yet built — this is the endpoint a correctly-scoped
tenant switcher needs (see `API_GAP_REPORT.md` item 1; the current
`AdminTenantSwitcher` calls the unscoped `GET /tenants/` instead, mitigated
client-side by `hasAnyTenantAccess()` as a stopgap — see §6 and the gap
report).

### `POST /auth/switch-tenant/` (optional, only needed if tenant switching stays in-app rather than becoming subdomain navigation — see §6)

**Request:** `{ "tenantSlug": "brew-cafe" }`

**Response — 200 OK:** same shape as one `TenantMembership` entry, PLUS a
freshly-issued `permissions[]` (or the frontend recomputes via the
existing `getPermissionsForRole()`, unchanged).

**Authorization responsibility:** the backend **must** reject a switch to
any `tenantSlug` not present in the caller's own memberships (`403
TENANT_ACCESS_DENIED`) — this is the server-side twin of the frontend's
`hasAnyTenantAccess()` defense-in-depth check (`src/components/admin/AdminTenantSwitcher.tsx`),
which is NOT a security boundary on its own.

---

## 3. Tenant API

### `GET /me/tenants` (recommended) — see §2's rationale for the naming/scoping decision

Effectively a projection of `GET /auth/memberships/` for consumers that
only need `{id, name, slug, roles}`, not the full membership shape
(`branchAccess`, `status`). Whether this is a literal second endpoint or
just a field-subset of §2's response is a backend implementation
choice — the frontend contract only requires that **whichever endpoint
powers "list my tenants" is caller-scoped**, never `GET /tenants/`'s
current unscoped behavior.

**Response — 200 OK**
```json
[
  { "id": "tenant-samoon-01", "name": "Samoon Restaurant", "slug": "samoon", "roles": ["owner"] }
]
```

### `GET /tenants/{slug}/` — tenant detail

**Unchanged** from current mock behavior (`src/services/tenant.service.ts:getTenant`) —
returns the full `Tenant` object (settings, businessTypes, theme, etc.)
for the tenant resolved from the request's subdomain/slug. This endpoint
is NOT membership-filtered — it returns one tenant by slug, and the
caller's *right* to be looking at it is enforced by whether their token
carries a membership for it (checked via §1.3's `memberships`, not by
this endpoint itself, which has no caller-identity dependency beyond
"does this tenant exist and is it eligible" — `ELIGIBLE_TENANT_STATUSES`
in `src/services/tenant.service.ts`).

### `GET /tenants/{slug}/settings/`, tenant CRUD (activate/suspend/archive/provision/clone/transfer-ownership)

Unchanged from current mock service shapes
(`src/services/tenant.service.ts`) — these are pre-existing, already
partially documented via the service's own JSDoc, and out of Phase Y's
scope to re-derive. Flagged in `API_GAP_REPORT.md` only insofar as their
**authorization** (who may call activate/suspend/archive on which
tenants) still needs a real backend check, since the frontend's
`PermissionGuard permission="tenant.manage"` is UI-only.

---

## 4. Branch API

### `GET /tenants/{tenantId}/branches` (replaces the current unscoped `GET /branches/`)

**Response — 200 OK**, **already filtered to the caller's `branchAccess`**:
```json
[
  { "id": "branch-1", "tenantId": "tenant-samoon-01", "name": "Main Branch", "slug": "main", "status": "active", "...": "full Branch shape, src/types/branch.ts" }
]
```

**Access rule (non-negotiable):** if the caller's active membership for
this tenant has `branchAccess: { scope: 'assigned', branchIds: [...] }`,
this endpoint returns **only those branches** — never the full tenant
roster. If `scope: 'all'`, every branch. This is the server-side
enforcement the frontend's `canAccessBranch()`/`useBranchAccess()`
(`src/services/permission.service.ts`, `src/hooks/index.ts`) are
explicitly documented as NOT providing — they are UX/defense-in-depth
only (Phase 9.4).

**Frontend consumer:** `useBranchStore.loadBranchesForTenant()`
(`src/stores/index.ts`) → populates `branches[]`, which
`AdminBranchSwitcher` renders. Once this endpoint is access-filtered,
the switcher's own client-side `canAccessBranch()` filter (added Phase
9.4) becomes a pure no-op safety net rather than doing real work — it
should NOT be removed even then (defense-in-depth is still correct
practice), but it stops being load-bearing.

### `GET /branches/{id}/*` (orders, analytics, reservations, metrics)

**Authorization responsibility:** each of these must **independently**
re-validate the caller's `branchAccess` includes `{id}` — the fact that
`GET /tenants/{tenantId}/branches` was filtered does not, by itself,
protect a direct request to `/branches/{other-id}/orders`. This is
exactly the property Phase 9.4's `useBranchAccess()` guards on 3 frontend
routes (`/console/branches/[id]`, `/edit`, `/analytics`) but — as
documented there — cannot enforce; only the backend can.

### Branch selection model (frontend behavior, unchanged, documented for backend awareness)

There is no "current branch" concept on the backend side to build —
branch selection (`selectedBranch` in `useBranchStore`) is a pure
client-side UI preference, scoped to whichever tenant is active, filtered
to the branches this endpoint returns. The backend has no need to persist
or expose a "last selected branch" per user (nothing in the frontend asks
for one); if product wants that to survive across devices, it would be a
new, explicitly-scoped preference field, not part of this contract.

---

## 5. Permission API

**Deliberately not a separate endpoint.** Per the existing, unmodified
`ROLE_PERMISSION_MAP` design (`src/services/permission.service.ts`),
permissions are a pure function of roles, computed identically whether
the roles came from mock data or a real backend:

```
permissions = union(ROLE_PERMISSION_MAP[role] for role in membership.roles)
```

The backend does not need to invent a permissions-serialization format —
`memberships[].roles` (§1.3) is sufficient, and the frontend's existing
`getPermissionsForRole()` derives permissions client-side, exactly as it
already does with mock data today. **If** a future backend wants to
support per-user permission overrides beyond roles (the frontend already
has a client-side-only `UserPermissionOverride` model,
`src/types/rbac.ts`, currently unbacked by any endpoint), the response
shape below is what the frontend already expects for that (no frontend
change needed to consume it once sent):

```json
{
  "roles": ["manager"],
  "permissions": ["orders.view", "orders.edit", "menu.manage"]
}
```

**Role source:** `memberships[].roles` (§1.3), always tenant-scoped, never
global.
**Permission source:** either (a) frontend-derived from roles via
`ROLE_PERMISSION_MAP` (current, correct, zero backend work required), or
(b) backend-sent `permissions[]` directly if overrides are ever
implemented server-side — the frontend's `normalizeTenantPermissions()`
already accepts an explicit `permissions` field and prefers it over
recomputing when present (`src/services/permission.service.ts`).
**Ownership bypass:** yes, by design — `owner` role maps to
`ALL_PERMISSIONS` in `ROLE_PERMISSION_MAP` unconditionally. This is a
static role-to-permission mapping, not a runtime bypass computed from
"is this user the tenant's registered owner" — there is no such
ownership-identity check left anywhere in the live authorization path
(the old `ownership-resolution.service.ts` engine that used to do this
was fully removed from the runtime in Phase 2/Phase 5 of this project's
history and is now dead code).
**Frontend responsibility:** exactly `permissions.includes('menu.edit')`
(`usePermission()`, `src/hooks/index.ts`) — no role-name string matching,
no client-side re-derivation of what a role "should" grant, anywhere in
application code. This is already true today and this contract changes
nothing about it.

---

## 6. Future CRUD Requirements (documented, not implemented)

Only endpoints the current frontend's mock services already model and
call are listed — no new capability is invented:

| Domain | Endpoints already assumed by frontend services | Source |
|---|---|---|
| Staff | invite, list, detail, update-roles (now incl. `branchIds`), suspend/activate/remove, transfer-ownership | `src/services/staff.service.ts`, extended Phase C |
| Menu | items/categories/extras CRUD, branch-scoped | `src/services/menu.service.ts` (not modified this phase) |
| Orders | list/detail/status-update, tenant+branch scoped | `src/services/admin.service.ts` |
| Reservations | list/detail/status-update, branch-scoped | same |
| Branches | list/detail/create/update/activate/deactivate/maintenance/delete/set-default/metrics | `src/services/branch.service.ts` |
| Tenants | list(mine)/detail/settings/activate/suspend/archive/provision/clone/transfer-ownership | `src/services/tenant.service.ts` |

Full request/response shapes for these are already documented in each
service file's existing JSDoc and are not re-derived here — Phase Y's
scope is specifically the auth/membership/tenant/branch/permission
context contract, not the full CRUD surface.
