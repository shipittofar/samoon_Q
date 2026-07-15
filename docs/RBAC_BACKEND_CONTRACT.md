# RBAC Backend Contract

**Status:** Production-ready specification, reverse-engineered from the
live frontend implementation. Every role, permission, rule, and payload
in this document is copied — not redesigned, not simplified — from the
frontend source files listed under each section. A backend engineer
should be able to implement this without asking the frontend team
anything.

**Source files audited** (Phase 1):
`src/services/permission.service.ts`,
`src/services/ownership-resolution.service.ts`,
`src/services/ownership.service.ts`,
`src/services/branch-access.service.ts`,
`src/services/staff-assignment.service.ts`,
`src/services/owner.service.ts`, `src/services/staff.service.ts`,
`src/services/rbac-audit.service.ts`, `src/hooks/index.ts`,
`src/stores/index.ts`, `src/types/rbac.ts`, `src/types/ownership.ts`,
`src/types/staff.ts`, `src/types/branch.ts`, `src/types/audit-log.ts`,
`src/types/index.ts`, `src/components/auth/AuthGuard.tsx`,
`src/components/auth/PermissionGuard.tsx`, `src/middleware.ts`,
`src/app/console/staff/**`, `src/app/console/permissions/**`,
`src/app/console/roles/**`.

**Note on scope:** the task text asked to inspect a `RoleGuard`
component and a `src/store/` directory — neither exists in this
codebase. The equivalent of "RoleGuard" is `AuthGuard`'s
`requiredPermission` prop plus `PermissionGuard` (documented in full
below); Zustand stores live in the single file `src/stores/index.ts`,
not a `src/store/` directory. This is stated explicitly so the absence
is understood as "verified not present," not an oversight.

---

## Table of Contents

1. [Phase 1 — RBAC Inventory](#phase-1--rbac-inventory)
2. [Phase 2 — Database Schema](#phase-2--database-schema)
3. [Phase 3 — Role System](#phase-3--role-system-extraction)
4. [Phase 4 — Permission Registry](#phase-4--permission-registry)
5. [Phase 5 — Authorization Engine](#phase-5--authorization-engine-specification)
6. [Phase 6 — Tenant & Location Security](#phase-6--tenant-and-location-security)
7. [Phase 7 — API Contract](#phase-7--api-contract)
8. [Phase 8 — Auth Response Contract](#phase-8--auth-response-contract)
9. [Phase 9 — Error Contract](#phase-9--error-contract)
10. [Phase 10 — Django Implementation Guide](#phase-10--django-implementation-guide)
11. [Phase 11 — Frontend/Backend Integration Rules](#phase-11--frontendbackend-integration-rules)
12. [Phase 12 — Validation Checklist](#phase-12--validation-checklist)

---

## Phase 1 — RBAC Inventory

### 1. Roles (8, fixed, system-owned)

`owner`, `admin`, `manager`, `cashier`, `waiter`, `kitchen`,
`marketing`, `support` — source: `Role` union type, `src/types/rbac.ts`
line 9-17. Full extraction in Phase 3.

### 2. Permissions (48 canonical + 2 reserved-unused + 1 legacy-derived)

Source: `ALL_PERMISSIONS`, `src/services/permission.service.ts` lines
26-93. Full extraction in Phase 4.

### 3. Permission dependencies (advisory only, not enforced server-side today)

Source: `PERMISSION_DEPENDENCIES`,
`src/services/permission.service.ts` lines 707-737. E.g.
`orders.manage` requires `orders.view`; `staff.delete` requires
`staff.view` + `staff.manage`. Full table in Phase 4.

### 4. Permission → UI mapping

Full table in Phase 4 ("UI usage" column).

### 5. Ownership rules

Source: `src/services/ownership-resolution.service.ts`. An `Owner` is a
business entity (not a `Role` value) that owns zero-or-more `Tenant`s
via `Tenant.ownerId`. An eligible (`status === 'active'`) Owner of an
eligible (`status !== 'archived'`) tenant receives **every** permission
for that tenant — structurally, never via a role-lookup table. Full
algorithm in Phase 5.

### 6. Tenant isolation rules

Source: `assertOwnershipTenantAccess()`,
`ownership-resolution.service.ts` lines 364-389. Full spec in Phase 6.

### 7. Branch/location isolation rules

Source: `src/services/branch-access.service.ts`,
`buildBranchAccessContextFromAssignments()` in
`ownership-resolution.service.ts` lines 261-286. Full spec in Phase 6.

### 8. Feature flag interactions

Source: `PERMISSION_RESOURCE_FLAG` (`permission.service.ts` lines
280-289) and `PERMISSION_FEATURE_FLAG_MAP` (`hooks/index.ts` lines
230-238) — **two independently-maintained but identical maps**, both
mapping a permission's resource prefix to a tenant feature-flag key:

```
orders      → ordering.enabled
menu        → menu.enabled
reservations → reservations.enabled
loyalty     → loyalty.enabled
promotions  → promotions.enabled
vendors     → food_court.vendor_management.enabled
reviews     → reviews.enabled
```

Any resource **not** in this map (analytics, staff, branches,
settings, tenant, audit, notifications, operations, payments, tables,
kitchen, customers) has **no** feature-flag gate — permission alone
decides. If the tenant's flag for a gated resource resolves `false`,
the permission is denied **regardless of role** (`hasPermission()`,
`permission.service.ts` lines 347-377, step 3).

### 9. Capability/module restrictions

Source: `opts.capabilities` param on `hasPermission()`/`usePermission()`
— when supplied, a `false` value for the permission's resource
(matched by prefix, e.g. `vendors`) denies the permission regardless of
role, independent of the feature-flag check. This is how a
business-type module (e.g. a `food_truck` tenant with no `vendors`
capability) hard-disables an entire resource's permissions, distinct
from a tenant admin's feature-flag toggle. Both gates apply on top of
the base Permission check — see Phase 5's authorization formula.

### 10. Session payload requirements

Full spec in Phase 8. Summary: `login`/`verifyOTP`(existing user)/
`register`/`getMe` must each optionally carry `tenantRoles`,
`ownership`, `staffAssignments` alongside the base user/token payload.

---

## Phase 2 — Database Schema

All tables use `UUID` primary keys (`gen_random_uuid()` default,
Postgres `pgcrypto`/`uuid-ossp` — adjust for your DB). Soft-delete is
used only where the frontend's source data explicitly models a
non-destructive lifecycle (`StaffAssignment.status='revoked'`,
`Owner.status='suspended'`) — everything else uses hard-delete with
`ON DELETE CASCADE` where the child record is meaningless without the
parent, or `ON DELETE RESTRICT` where deletion must be explicitly
handled first.

### 2.1 `users`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `email` | VARCHAR(255) | YES | NULL | UNIQUE (partial index `WHERE email IS NOT NULL`) — nullable per P10.9's phone-only registration path |
| `phone_number` | VARCHAR(32) | YES | NULL | E.164-adjacent local number, no country prefix (see `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md`) |
| `first_name` | VARCHAR(100) | NO | — | |
| `last_name` | VARCHAR(100) | NO | — | |
| `avatar` | VARCHAR(500) | YES | NULL | URL |
| `status` | VARCHAR(20) | NO | `'active'` | CHECK IN `('active','suspended','pending_verification')` |
| `is_verified` | BOOLEAN | NO | `false` | |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | trigger-maintained |

**Indexes:** `UNIQUE (email) WHERE email IS NOT NULL`, `UNIQUE (phone_number) WHERE phone_number IS NOT NULL`, `INDEX (status)`.
**Soft delete:** not modeled by the frontend — hard delete acceptable, or add `deleted_at` if your compliance requirements demand it (frontend has no opinion either way).

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255),
    phone_number    VARCHAR(32),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    avatar          VARCHAR(500),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','pending_verification')),
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_uq ON users (phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX users_status_idx ON users (status);
```

### 2.2 `tenants`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `name` | VARCHAR(255) | NO | — | |
| `slug` | VARCHAR(100) | NO | — | UNIQUE |
| `type` | VARCHAR(50) | NO | — | CHECK IN `('restaurant','cafe','bar','food_court','food_truck','mobile_cafe','hotel','other')` — matches `BusinessType`, `src/types/index.ts` lines 248-257 |
| `status` | VARCHAR(20) | NO | `'trial'` | CHECK IN `('active','trial','suspended','churned','archived')` — matches `TenantStatus` |
| `owner_id` | UUID | YES | NULL | FK → `owners(id)`, `ON DELETE SET NULL` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |

**Indexes:** `UNIQUE (slug)`, `INDEX (owner_id)`, `INDEX (status)`.
**Soft delete:** `status = 'archived'` **is** the soft-delete state per Phase 6's isolation rule (`isTenantEligible()`) — do not add a separate `deleted_at`; `'archived'` already means "zero access to everyone."

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    type            VARCHAR(50) NOT NULL
                        CHECK (type IN ('restaurant','cafe','bar','food_court','food_truck','mobile_cafe','hotel','other')),
    status          VARCHAR(20) NOT NULL DEFAULT 'trial'
                        CHECK (status IN ('active','trial','suspended','churned','archived')),
    owner_id        UUID REFERENCES owners(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tenants_owner_idx ON tenants (owner_id);
CREATE INDEX tenants_status_idx ON tenants (status);
```

*(`owners` is defined below — Postgres allows forward FK references
within one migration transaction; if your migration tool doesn't,
create `owners` first.)*

### 2.3 `locations`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `tenant_id` | UUID | NO | — | FK → `tenants(id)`, `ON DELETE CASCADE` |
| `name` | VARCHAR(255) | NO | — | |
| `slug` | VARCHAR(100) | NO | — | UNIQUE within tenant |
| `code` | VARCHAR(50) | YES | NULL | short display code |
| `status` | VARCHAR(20) | NO | `'active'` | CHECK IN `('active','inactive','maintenance')` — matches `BranchStatus`, `src/types/branch.ts` line 5 |
| `type` | VARCHAR(20) | NO | `'physical'` | CHECK IN `('physical','mobile')` — matches `BranchType` |
| `manager_id` | UUID | YES | NULL | FK → `users(id)`, `ON DELETE SET NULL` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |

**Indexes:** `UNIQUE (tenant_id, slug)`, `INDEX (tenant_id)`, `INDEX (status)`.
**Cascade:** deleting a tenant cascades to its locations (a location is meaningless without its tenant). Deleting a manager user does not delete the location (`SET NULL`).

```sql
CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    code            VARCHAR(50),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','maintenance')),
    type            VARCHAR(20) NOT NULL DEFAULT 'physical'
                        CHECK (type IN ('physical','mobile')),
    manager_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX locations_tenant_slug_uq ON locations (tenant_id, slug);
CREATE INDEX locations_tenant_idx ON locations (tenant_id);
CREATE INDEX locations_status_idx ON locations (status);
```

### 2.4 `owners`

Source: `Owner` interface, `src/types/ownership.ts` lines 39-50.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK (frontend field: `ownerId`) |
| `user_id` | UUID | NO | — | FK → `users(id)`, `ON DELETE CASCADE` |
| `status` | VARCHAR(30) | NO | `'pending_verification'` | CHECK IN `('active','suspended','pending_verification')` |
| `plan` | VARCHAR(50) | NO | — | billing plan id |
| `max_tenants` | INTEGER | YES | NULL | NULL = unlimited |
| `billing_customer_id` | VARCHAR(100) | YES | NULL | |
| `billing_email` | VARCHAR(255) | NO | — | |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `verified_at` | TIMESTAMPTZ | YES | NULL | |

**Indexes:** `INDEX (user_id)`, `INDEX (status)`.

```sql
CREATE TABLE owners (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending_verification'
                            CHECK (status IN ('active','suspended','pending_verification')),
    plan                VARCHAR(50) NOT NULL,
    max_tenants         INTEGER,
    billing_customer_id VARCHAR(100),
    billing_email       VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at         TIMESTAMPTZ
);
CREATE INDEX owners_user_idx ON owners (user_id);
CREATE INDEX owners_status_idx ON owners (status);
```

### 2.5 `roles`

Source: `ROLE_TEMPLATES`, `permission.service.ts` lines 562-619. Fixed,
code-owned seed data — 8 rows, `system_role = true`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `slug` | VARCHAR(50) | NO | — | UNIQUE, one of the 8 values in Phase 3 |
| `name` | VARCHAR(100) | NO | — | display label |
| `description` | TEXT | NO | — | |
| `system_role` | BOOLEAN | NO | `true` | `true` for all 8 seeded rows; `false` reserved for future custom roles (out of scope — see Migration Checklist) |
| `tenant_id` | UUID | YES | NULL | FK → `tenants(id)` `ON DELETE CASCADE`; NULL = system role (all 8 today) |

**Indexes:** `UNIQUE (slug) WHERE tenant_id IS NULL`, `UNIQUE (tenant_id, slug) WHERE tenant_id IS NOT NULL`, `INDEX (tenant_id)`.
**Constraint:** application-layer — reject `DELETE`/`slug` rename where `system_role = true`.

```sql
CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(50) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    system_role     BOOLEAN NOT NULL DEFAULT true,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX roles_system_slug_uq ON roles (slug) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX roles_tenant_slug_uq ON roles (tenant_id, slug) WHERE tenant_id IS NOT NULL;
CREATE INDEX roles_tenant_idx ON roles (tenant_id);
```

### 2.6 `permissions`

Source: `ALL_PERMISSIONS`, `permission.service.ts` lines 26-93. Fixed,
code-owned seed data — 48 rows (Phase 4 has the full list).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `resource` | VARCHAR(50) | NO | — | e.g. `'orders'` |
| `action` | VARCHAR(50) | NO | — | e.g. `'manage'` |
| `key` | VARCHAR(100) | NO | — | UNIQUE, `resource || '.' || action` |
| `description` | TEXT | NO | — | |

**Indexes:** `UNIQUE (key)`, `INDEX (resource)`.

```sql
CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource        VARCHAR(50) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    key             VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT NOT NULL
);
CREATE INDEX permissions_resource_idx ON permissions (resource);
```

### 2.7 `role_permissions`

Source: `ROLE_PERMISSION_MAP`, `permission.service.ts` lines 97-274.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `role_id` | UUID | NO | FK → `roles(id)`, `ON DELETE CASCADE` |
| `permission_id` | UUID | NO | FK → `permissions(id)`, `ON DELETE CASCADE` |

**PK:** `(role_id, permission_id)`. **Indexes:** `INDEX (permission_id)` (reverse lookup).

```sql
CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX role_permissions_permission_idx ON role_permissions (permission_id);
```

### 2.8 `user_tenant_roles`

Source: `UserTenantRole`, `src/types/rbac.ts` lines 101-105. Used for
**Owner/Admin** tenant-wide role grants (a user can be `owner` or
`admin` for a tenant without a location-scoped `StaffAssignment` row).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `user_id` | UUID | NO | — | FK → `users(id)`, `ON DELETE CASCADE` |
| `tenant_id` | UUID | NO | — | FK → `tenants(id)`, `ON DELETE CASCADE` |
| `role_id` | UUID | NO | — | FK → `roles(id)`, `ON DELETE RESTRICT` (do not silently orphan a grant by deleting a system role) |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |

**Indexes:** `UNIQUE (user_id, tenant_id, role_id)`, `INDEX (tenant_id)`, `INDEX (user_id)`.

```sql
CREATE TABLE user_tenant_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, tenant_id, role_id)
);
CREATE INDEX user_tenant_roles_tenant_idx ON user_tenant_roles (tenant_id);
CREATE INDEX user_tenant_roles_user_idx ON user_tenant_roles (user_id);
```

### 2.9 `staff_assignments`

Source: `StaffAssignment`, `src/types/ownership.ts` lines 64-86. This
is the **primary** grant mechanism for `manager`/`cashier`/`waiter`/
`kitchen`/`marketing`/`support` — location-scoped, soft-deleted via
`status`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK (frontend: `assignmentId`) |
| `staff_id` | UUID | NO | — | FK → `users(id)`, `ON DELETE CASCADE` |
| `tenant_id` | UUID | NO | — | FK → `tenants(id)`, `ON DELETE CASCADE` |
| `all_locations` | BOOLEAN | NO | `false` | `true` = every current AND future location of the tenant |
| `role_id` | UUID | NO | — | FK → `roles(id)`, `ON DELETE RESTRICT`; **must never be the `owner` role** (app-layer CHECK below) |
| `mode` | VARCHAR(10) | NO | `'manage'` | CHECK IN `('read','manage')` |
| `status` | VARCHAR(20) | NO | `'active'` | CHECK IN `('active','future','revoked','expired')` — last **explicitly set** value; effective status is *derived* at read time (Phase 5) |
| `valid_from` | TIMESTAMPTZ | YES | NULL | |
| `valid_until` | TIMESTAMPTZ | YES | NULL | |
| `granted_by` | UUID | NO | — | FK → `users(id)`, `ON DELETE RESTRICT` |
| `granted_at` | TIMESTAMPTZ | NO | `now()` | |
| `revoked_by` | UUID | YES | NULL | FK → `users(id)`, `ON DELETE SET NULL` |
| `revoked_at` | TIMESTAMPTZ | YES | NULL | |

**Indexes:** `INDEX (staff_id)`, `INDEX (tenant_id)`, `INDEX (tenant_id, status)`, `INDEX (staff_id, tenant_id, status)` (the hot-path lookup — see Phase 5 pseudocode).
**Constraint:** `CHECK (role_id NOT IN (SELECT id FROM roles WHERE slug = 'owner'))` — best enforced as an application-layer service check + a DB trigger, since a subquery `CHECK` isn't portable across engines.
**Soft delete:** `status = 'revoked'` — never hard-delete a `staff_assignments` row (audit trail requirement, Phase 8/11).

```sql
CREATE TABLE staff_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    all_locations   BOOLEAN NOT NULL DEFAULT false,
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    mode            VARCHAR(10) NOT NULL DEFAULT 'manage' CHECK (mode IN ('read','manage')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','future','revoked','expired')),
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,
    granted_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX staff_assignments_staff_idx ON staff_assignments (staff_id);
CREATE INDEX staff_assignments_tenant_idx ON staff_assignments (tenant_id);
CREATE INDEX staff_assignments_tenant_status_idx ON staff_assignments (tenant_id, status);
CREATE INDEX staff_assignments_hotpath_idx ON staff_assignments (staff_id, tenant_id, status);
```

### 2.10 `staff_assignment_locations`

Junction table for `staff_assignments.location_ids` (a Postgres native
`UUID[]` column is an alternative — this normalized form is given as
the portable/indexable default; use whichever your team prefers, the
frontend has no opinion on the storage strategy, only on the resolved
set of location IDs).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `assignment_id` | UUID | NO | FK → `staff_assignments(id)`, `ON DELETE CASCADE` |
| `location_id` | UUID | NO | FK → `locations(id)`, `ON DELETE CASCADE` |

**PK:** `(assignment_id, location_id)`.

```sql
CREATE TABLE staff_assignment_locations (
    assignment_id   UUID NOT NULL REFERENCES staff_assignments(id) ON DELETE CASCADE,
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (assignment_id, location_id)
);
```

### 2.11 `user_permission_overrides`

Source: `UserPermissionOverride`, `src/types/rbac.ts` lines 149-156.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `user_id` | UUID | NO | FK → `users(id)`, `ON DELETE CASCADE` |
| `tenant_id` | UUID | NO | FK → `tenants(id)`, `ON DELETE CASCADE` |
| `permission_id` | UUID | NO | FK → `permissions(id)`, `ON DELETE CASCADE` |
| `effect` | VARCHAR(10) | NO | CHECK IN `('allow','deny')` |
| `created_at` | TIMESTAMPTZ | NO DEFAULT `now()` | |

**PK:** `(user_id, tenant_id, permission_id)` — a permission can only have one override effect per user per tenant (not both allow and deny simultaneously — enforced by the composite PK itself since `effect` isn't part of it).

```sql
CREATE TABLE user_permission_overrides (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    effect          VARCHAR(10) NOT NULL CHECK (effect IN ('allow','deny')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id, permission_id)
);
```

### 2.12 `rbac_audit_log`

Source: `RbacAuditEvent`, `src/types/rbac.ts` lines 220-246 (in-session
audit trail the frontend already models — persisting it server-side is
new, but the shape is copied exactly).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `type` | VARCHAR(30) | NO | — | CHECK IN `('role_assigned','role_removed','role_disabled','role_enabled','permission_granted','permission_denied','permission_reset','override_cleared','custom_role_created','custom_role_edited','custom_role_deleted','branch_role_set','branch_role_cleared')` |
| `actor_id` | UUID | NO | — | FK → `users(id)`, `ON DELETE RESTRICT` |
| `target_user_id` | UUID | NO | — | FK → `users(id)`, `ON DELETE RESTRICT` |
| `tenant_id` | UUID | NO | — | FK → `tenants(id)`, `ON DELETE CASCADE` |
| `location_id` | UUID | YES | NULL | FK → `locations(id)`, `ON DELETE SET NULL` |
| `role_slug` | VARCHAR(50) | YES | NULL | |
| `permission_key` | VARCHAR(100) | YES | NULL | |
| `old_value` | JSONB | YES | NULL | |
| `new_value` | JSONB | YES | NULL | |
| `reason` | TEXT | YES | NULL | |
| `timestamp` | TIMESTAMPTZ | NO | `now()` | |

**Indexes:** `INDEX (tenant_id, timestamp DESC)`, `INDEX (target_user_id)`, `INDEX (actor_id)`.
**Retention:** append-only, never updated or deleted by application code (compliance/audit requirement — matches the frontend's own `auditHooks.getLog()` semantics, which only ever appends).

```sql
CREATE TABLE rbac_audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                VARCHAR(30) NOT NULL,
    actor_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
    role_slug           VARCHAR(50),
    permission_key      VARCHAR(100),
    old_value           JSONB,
    new_value           JSONB,
    reason              TEXT,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rbac_audit_tenant_ts_idx ON rbac_audit_log (tenant_id, timestamp DESC);
CREATE INDEX rbac_audit_target_idx ON rbac_audit_log (target_user_id);
CREATE INDEX rbac_audit_actor_idx ON rbac_audit_log (actor_id);
```

### 2.13 `tenant_feature_flags`

Backing store for Phase 1 item 8 (feature flag interactions).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `tenant_id` | UUID | NO | — | FK → `tenants(id)`, `ON DELETE CASCADE` |
| `flag_key` | VARCHAR(100) | NO | — | e.g. `'ordering.enabled'` |
| `enabled` | BOOLEAN | NO | `true` | |

**PK:** `(tenant_id, flag_key)`.

```sql
CREATE TABLE tenant_feature_flags (
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    flag_key        VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (tenant_id, flag_key)
);
```

### 2.14 `tenant_capabilities`

Backing store for Phase 1 item 9 (capability/module restrictions) —
distinct from feature flags: capabilities are module-level (business
type), flags are admin-toggleable.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `tenant_id` | UUID | NO | — | FK → `tenants(id)`, `ON DELETE CASCADE` |
| `capability_key` | VARCHAR(100) | NO | — | e.g. `'vendors'`, matches a permission resource prefix |
| `enabled` | BOOLEAN | NO | `true` | |

**PK:** `(tenant_id, capability_key)`.

```sql
CREATE TABLE tenant_capabilities (
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    capability_key  VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (tenant_id, capability_key)
);
```

---

## Phase 3 — Role System Extraction

Source, byte-for-byte: `ROLE_PERMISSION_MAP` in
`src/services/permission.service.ts` lines 97-274 and `ROLE_TEMPLATES`
lines 562-619. **Every permission a role does NOT have is listed
explicitly** — the frontend source itself documents these via
commented-out array entries, reproduced below.

---

### Role: `owner`

- **Slug:** `owner`
- **Description:** "Full platform access including tenant ownership and billing operations."
- **Scope:** tenant-wide (structural — see Phase 5; **not** granted via `role_permissions` lookup for an actual Owner, but the role row/slug still exists for typing, display, and the (rare) case of an `admin`-equivalent `user_tenant_roles` grant using this slug)
- **System role:** yes

**Allowed permissions (36):**
```
orders.view, orders.manage, orders.create, orders.edit, orders.cancel,
menu.view, menu.manage,
reservations.view, reservations.manage,
customers.view,
payments.process, payments.refund,
tables.view, tables.assign,
kitchen.view, kitchen.manage,
vendors.view, vendors.manage,
promotions.view, promotions.manage,
loyalty.view, loyalty.manage,
analytics.view,
staff.view, staff.manage, staff.create, staff.edit, staff.delete,
branches.view, branches.manage,
settings.view,
tenant.view, tenant.manage,
audit.view,
notifications.view,
operations.view
```

**Forbidden permissions (12, intentionally excluded — verbatim from source comments):**
```
orders.delete          -- commented out in source: "// 'orders.delete',"
customers.manage       -- "// 'customers.manage',"
analytics.export       -- "// 'analytics.export',"
settings.manage        -- "// 'settings.manage',"
featureflags.manage    -- "// 'featureflags.manage',"
audit.export           -- "// 'audit.export',"
audit.manage           -- "// 'audit.manage',"
notifications.manage   -- "// 'notifications.manage',"
notifications.preferences -- "// 'notifications.preferences',"
operations.manage      -- "// 'operations.manage',"
```

**Note:** this list is the `role_permissions` seed for the `owner`
role **row**. A real Owner **never actually looks up this table** to
get their permissions — Phase 5's Owner short-circuit grants
`ALL_PERMISSIONS` (all 48, unconditionally) to an eligible Owner of an
eligible tenant. This 36-permission `role_permissions` list only
matters for the rare case where `owner` is assigned as a
`user_tenant_roles` role slug to someone who is *not* the structural
Owner (not currently exercised by any frontend flow, but the schema
supports it — see Phase 5 "Priority order").

---

### Role: `admin`

- **Slug:** `admin`
- **Description:** "Full operational administration. Cannot perform tenant ownership actions."
- **Scope:** tenant-wide
- **System role:** yes

**Allowed permissions (46):** `ALL_PERMISSIONS` **minus** `tenant.view`, `tenant.manage`.

**Forbidden permissions (2):**
```
tenant.view    -- structurally reserved for the actual Owner
tenant.manage  -- structurally reserved for the actual Owner
```

This is the **one and only** permission-level difference between
`owner` (structural grant) and `admin` — everything else `admin` can do
that `owner`'s `role_permissions` row above lists as excluded
(`orders.delete`, `customers.manage`, `analytics.export`,
`settings.manage`, `featureflags.manage`, `audit.export`,
`audit.manage`, `notifications.manage`, `notifications.preferences`,
`operations.manage`) — `admin` **does** get all of those, since its
grant is `ALL_PERMISSIONS` minus only the 2 tenant permissions. Do not
conflate `admin`'s allowed set with `owner`'s `role_permissions` row —
they differ by 10 permissions in `admin`'s favor, offset by the 2
tenant permissions in `owner`'s favor (and `owner`'s structural grant
supersedes its own `role_permissions` row entirely, per the note
above).

---

### Role: `manager`

- **Slug:** `manager`
- **Description:** "Restaurant management — floor, staff, schedules, menus, and orders."
- **Scope:** location-scoped (via `staff_assignments`)
- **System role:** yes

**Allowed permissions (22):**
```
orders.view, orders.manage, orders.create, orders.edit, orders.cancel,
menu.view, menu.manage,
reservations.view, reservations.manage,
customers.view, customers.manage, customers.create, customers.edit,
payments.process,
tables.view, tables.assign,
staff.view, staff.manage, staff.create, staff.edit, staff.delete,
branches.view,
notifications.view,
operations.view
```

**Forbidden permissions (26):** everything not listed above, notably:
```
orders.delete, payments.refund, kitchen.*, vendors.*, promotions.*,
loyalty.*, analytics.*, settings.*, tenant.*, audit.*,
notifications.manage, notifications.preferences, operations.manage
```

---

### Role: `cashier`

- **Slug:** `cashier`
- **Description:** "Orders, payments, and POS operations."
- **Scope:** location-scoped
- **System role:** yes

**Allowed permissions (10):**
```
orders.view, orders.manage, orders.create, orders.cancel,
customers.view,
payments.process, payments.refund,
tables.view, tables.assign,
notifications.view,
operations.view
```

**Forbidden permissions (38):** notably `orders.edit`, `orders.delete`,
all of `menu.*`, `reservations.*`, `kitchen.*`, `staff.*`,
`analytics.*`, `settings.*`, `tenant.*`, `audit.*`.

---

### Role: `waiter`

- **Slug:** `waiter`
- **Description:** "Tables, orders, and reservations."
- **Scope:** location-scoped
- **System role:** yes

**Allowed permissions (13):**
```
orders.view, orders.manage, orders.create, orders.edit,
menu.view,
reservations.view, reservations.manage,
customers.view,
payments.process,
tables.view, tables.assign,
notifications.view, notifications.preferences,
operations.view
```

**Forbidden permissions (35):** notably `orders.cancel`, `orders.delete`, `payments.refund`, all of `staff.*`, `analytics.*`, `kitchen.*`.

---

### Role: `kitchen`

- **Slug:** `kitchen`
- **Description:** "Kitchen display + order status updates + queue management."
- **Scope:** location-scoped
- **System role:** yes

**Allowed permissions (5):**
```
orders.view,
kitchen.view, kitchen.manage,
operations.view,
notifications.view
```

**Forbidden permissions (43):** everything else — this is the most
restrictive operational role; no `orders.manage`/`create`/`edit`, no
`menu.*`, no `payments.*`, no `tables.*`.

---

### Role: `marketing`

- **Slug:** `marketing`
- **Description:** "Promotions, loyalty, analytics, and campaign management."
- **Scope:** location-scoped (typically `all_locations = true` in practice, since marketing is rarely branch-specific, but the schema does not enforce this — it is a legitimate configuration choice per assignment)
- **System role:** yes

**Allowed permissions (7):**
```
analytics.view, analytics.export,
customers.view,
promotions.view, promotions.manage,
loyalty.view, loyalty.manage,
notifications.view
```

**Forbidden permissions (41):** all order/payment/kitchen/staff/settings/tenant/audit permissions.

---

### Role: `support`

- **Slug:** `support`
- **Description:** "Read-only customer assistance — no mutations, no financials."
- **Scope:** location-scoped
- **System role:** yes

**Allowed permissions (4):**
```
customers.view,
reservations.view,
branches.view,
notifications.view
```

**Forbidden permissions (44):** everything with a `.manage`/`.create`/`.edit`/`.delete`/`.assign`/`.process`/`.refund`/`.export` suffix, and all of `orders.*`, `menu.*`, `payments.*`, `staff.*`, `analytics.*`, `settings.*`, `tenant.*`, `audit.*`. `support` is the most restricted role by permission count (4).

---

## Phase 4 — Permission Registry

**48 permissions total**, across 18 resources. Source:
`ALL_PERMISSIONS`, `permission.service.ts` lines 26-93.
`PERMISSION_DEPENDENCIES` column sourced from lines 707-737.

| Key | Resource | Action | Description | UI usage | Required dependencies |
|---|---|---|---|---|---|
| `orders.view` | orders | view | View order list/detail | `/console/orders`, POS order screens | — |
| `orders.manage` | orders | manage | Update order status/details | `/console/orders` | `orders.view` |
| `orders.create` | orders | create | Create a new order (POS) | POS order flow | `orders.view` |
| `orders.edit` | orders | edit | Edit an existing order | `/console/orders` | `orders.view` |
| `orders.cancel` | orders | cancel | Cancel an order | `/console/orders` | `orders.view` |
| `orders.delete` | orders | delete | Permanently delete an order record | `/console/orders` (destructive action) | `orders.view`, `orders.manage` |
| `menu.view` | menu | view | View menu items/categories | `/console/menu` | — |
| `menu.manage` | menu | manage | Create/edit/delete menu items | `/console/menu` | `menu.view` |
| `reservations.view` | reservations | view | View reservation list | `/console/reservations` | — |
| `reservations.manage` | reservations | manage | Confirm/cancel/edit reservations | `/console/reservations` | `reservations.view` |
| `customers.view` | customers | view | View customer profiles | `/console/customers`, Customer 360° | — |
| `customers.manage` | customers | manage | Edit/merge customer records | `/console/customers` | `customers.view` |
| `customers.create` | customers | create | Manually create a customer record | `/console/customers` | `customers.view` |
| `customers.edit` | customers | edit | Edit a specific customer's fields | `/console/customers/[id]` | `customers.view` |
| `payments.process` | payments | process | Charge/process a payment | POS checkout | — |
| `payments.refund` | payments | refund | Issue a refund | `/console/orders` refund action | `payments.process` |
| `tables.view` | tables | view | View table layout/status | Table management, QR flow | — |
| `tables.assign` | tables | assign | Assign a table to an order/party | Table management | `tables.view` |
| `kitchen.view` | kitchen | view | View kitchen display / order queue | `/console/kitchen` (KDS) | — |
| `kitchen.manage` | kitchen | manage | Update prep status in KDS | `/console/kitchen` | `kitchen.view` |
| `vendors.view` | vendors | view | View food-court vendor list | `/console/vendors` (food_court capability-gated) | — |
| `vendors.manage` | vendors | manage | Onboard/edit/suspend vendors | `/console/vendors` | `vendors.view` |
| `promotions.view` | promotions | view | View promotions/happy-hour rules | `/console/promotions` | — |
| `promotions.manage` | promotions | manage | Create/edit promotions | `/console/promotions` | `promotions.view` |
| `loyalty.view` | loyalty | view | View loyalty program state | `/console/loyalty` | — |
| `loyalty.manage` | loyalty | manage | Edit loyalty rules/rewards | `/console/loyalty` | `loyalty.view` |
| `analytics.view` | analytics | view | View analytics dashboards | `/console/analytics` | — |
| `analytics.export` | analytics | export | Export analytics data (CSV etc.) | `/console/analytics` export button | `analytics.view` |
| `staff.view` | staff | view | View staff roster | `/console/staff` | — |
| `staff.manage` | staff | manage | Edit staff roles/assignments | `/console/staff` | `staff.view` (implies `staff.view`) |
| `staff.create` | staff | create | Invite a new staff member | `/console/staff` | `staff.view`, `staff.manage` |
| `staff.edit` | staff | edit | Edit an existing staff member | `/console/staff/[id]` | `staff.view`, `staff.manage` |
| `staff.delete` | staff | delete | Remove a staff member | `/console/staff` | `staff.view`, `staff.manage` |
| `branches.view` | branches | view | View branch/location list | `/console/branches` | — |
| `branches.manage` | branches | manage | Create/edit branches; **also grants all-locations read override** (Phase 6) | `/console/branches` | `branches.view` |
| `settings.view` | settings | view | View tenant settings | `/console/settings` | — |
| `settings.manage` | settings | manage | Edit tenant settings | `/console/settings` | `settings.view` |
| `featureflags.manage` | settings | manage (flags) | Toggle tenant feature flags | `/console/settings/feature-flags` | `settings.view`, `settings.manage` |
| `tenant.view` | tenant | view | View tenant ownership/billing info | Tenant settings ownership panel | — |
| `tenant.manage` | tenant | manage | Tenant transfer/archive/suspend (**Owner-exclusive**) | Tenant transfer flow | `tenant.view` |
| `audit.view` | audit | view | View audit log | `/console/audit-logs` | — |
| `audit.export` | audit | export | Export audit log | `/console/audit-logs` export button | `audit.view` |
| `audit.manage` | audit | manage | Administer audit retention/settings | `/console/audit-logs` settings | `audit.view` |
| `notifications.view` | notifications | view | View notification center | Notification bell, `/console/notifications` | — |
| `notifications.manage` | notifications | manage | Send/manage broadcast notifications | `/console/notifications` | `notifications.view` |
| `notifications.preferences` | notifications | preferences | Edit own notification preferences | Notification settings panel | `notifications.view` |
| `operations.view` | operations | view | View real-time operations dashboard | `/console/operations` | — |
| `operations.manage` | operations | manage | Modify live operational state | `/console/operations` | `operations.view` |

### Reserved / non-canonical (do not seed `role_permissions` rows for these — Phase 1 item 2)

| Key | Status | Notes |
|---|---|---|
| `reviews.view` | reserved, unused | Declared in the `P7Permission` TypeScript union (`src/types/rbac.ts`) but absent from `ALL_PERMISSIONS` and every role's grant list. No UI gates on it today. |
| `reviews.manage` | reserved, unused | Same as above. |
| `dashboard:access` | **not a real permission** | Declared in the type union but **never appears in `ROLE_PERMISSION_MAP`**. `AuthGuard` special-cases the literal string and routes to `useHasDashboardAccess()` (a derived boolean — Phase 5) instead of a permission lookup. **The backend must never create a `permissions` row for this key or accept it in a role-assignment request** — there is no corresponding grantable concept. |

---

## Phase 5 — Authorization Engine Specification

Source: `src/services/ownership-resolution.service.ts` (whole file),
`src/services/permission.service.ts` `hasPermission()` (lines
347-377), `src/hooks/index.ts` `usePermissions()` (lines 175-222).

### Owner resolution

**How ownership is detected:** `tenants.owner_id → owners.id →
owners.user_id`. A user is "the Owner" of a tenant if and only if
`owners.user_id = <this user>` AND `tenants.owner_id = <that owner's
id>` for the specific tenant being checked.

**When Owner gets full permissions:** all three must hold simultaneously:
1. `owners.status = 'active'` (source: `isOwnerEligible()`, line 85-87)
2. `tenants.status != 'archived'` (source: `isTenantEligible()`, line 102-104)
3. The specific tenant's `owner_id` resolves to this Owner (source: `ownerOwnsTenant()`)

If all three hold → **all 48 `ALL_PERMISSIONS`**, unconditionally, for
that tenant. This is a structural short-circuit — it does **not**
consult `role_permissions` at all.

**Owner restrictions:** none within a tenant they own (full access).
An Owner has **zero** access to a tenant they do not own — ownership
never generalizes across tenants. A suspended/pending-verification
Owner (`status != 'active'`) has **zero** permissions everywhere,
including tenants they nominally own.

### Staff assignment resolution

**Role lookup:** for each of the staff member's `staff_assignments`
rows matching the target `tenant_id` with **effective status =
'active'** (derivation below), look up `role_permissions` for that
row's `role_id`.

**Location filtering:** each assignment's resolved location set is
either "every current+future location of the tenant" (`all_locations =
true`) or the explicit `staff_assignment_locations` rows
(`all_locations = false`). This location set gates data access (Phase
6), not the permission computation itself — a staff member's
*permission set* is the same regardless of which locations they're
scoped to; the *data* they can see through that permission is filtered
by location separately.

**Mode handling:**
- `mode = 'manage'` → the role's full permission set applies unmodified.
- `mode = 'read'` → **downgrade to `.view`-suffixed permissions only**
  (source: `downgradeToReadOnly()`, lines 149-163). Algorithm: for each
  permission in the role's set, if it already ends in `.view`, keep it;
  otherwise, check if `{resource}.view` exists in `ALL_PERMISSIONS` — if
  so, substitute it; if the resource has **no** `.view` sibling (e.g.
  `payments.process`, `tables.assign`), **drop the permission entirely**
  (there is no read-only projection of an action with no view
  counterpart).

**Multiple assignments merging rule:** a staff member may hold more
than one `staff_assignments` row for the **same** tenant (e.g. `manage`
mode Manager at Location A, `read` mode Manager at Location B, or even
different roles at different locations). Effective permissions are the
**union** (not intersection) of every effective assignment's resolved
permission set. Effective locations are also unioned separately.

### Override rules

Source: `applyOverrides()`, `permission.service.ts` lines 529-537.

- `allow[]` — permissions explicitly granted on top of the base
  (role/ownership-derived) set, even if the role doesn't include them.
- `deny[]` — permissions explicitly denied even if the role (or an
  `allow` override) would otherwise grant them.
- **Deny always wins.** Evaluation order: **User Deny → User Allow →
  Role Permissions → Default Deny.**

```
effective = (rolePermissions ∪ allow) \ deny
```

### Final permission calculation — pseudocode

Direct translation of `usePermissions()` (`hooks/index.ts` lines
203-221) + `resolveOwnershipDrivenPermissions()`
(`ownership-resolution.service.ts` lines 236-245):

```
function resolveEffectivePermissions(user, tenant):
    # ── Path 1: tenant-wide role grant (user_tenant_roles) ──
    tenantWideRoles = SELECT role_id FROM user_tenant_roles
                      WHERE user_id = user.id AND tenant_id = tenant.id
    base = UNION(role_permissions[r] for r in tenantWideRoles)

    override = SELECT allow[], deny[] FROM user_permission_overrides
               WHERE user_id = user.id AND tenant_id = tenant.id
    tenantRolePermissions = (base ∪ override.allow) \ override.deny

    # ── Path 2: ownership-driven (structural Owner + StaffAssignment) ──
    identity = resolveOwnershipIdentity(user)   # → { owner?, staffMember? }

    ownerPermissions = []
    if identity.owner and isOwnerEligible(identity.owner) and isTenantEligible(tenant)
       and ownerOwnsTenant(identity.owner.id, tenant.id):
        ownerPermissions = ALL_PERMISSIONS          # short-circuit, full stop
    
    if ownerPermissions is not empty:
        return ownerPermissions                     # Owner short-circuits; overrides do NOT apply on top of Owner (Owner already has everything)
    
    staffPermissions = []
    if identity.staffMember and isStaffMemberEligible(identity.staffMember) and isTenantEligible(tenant):
        assignments = getEffectiveAssignments(identity.staffMember.id, tenant.id, now())
        for a in assignments:
            rolePerms = role_permissions[a.role_id]
            effective = downgradeToReadOnly(rolePerms) if a.mode == 'read' else rolePerms
            staffPermissions = staffPermissions ∪ effective

    # ── Union both paths ──
    if staffPermissions is empty:
        return tenantRolePermissions
    return UNIQUE(tenantRolePermissions ∪ staffPermissions)


function isOwnerEligible(owner):
    return owner.status == 'active'

function isStaffMemberEligible(staffMember):
    return staffMember.status == 'active'

function isTenantEligible(tenant):
    return tenant.status != 'archived'   # NOTE: trial/suspended/churned still eligible — this is intentional, see Phase 6

function getEffectiveAssignments(staffId, tenantId, now):
    rows = SELECT * FROM staff_assignments
           WHERE staff_id = staffId AND tenant_id = tenantId
    return [r for r in rows if effectiveStatus(r, now) == 'active']

function effectiveStatus(assignment, now):
    if assignment.status == 'revoked':
        return 'revoked'
    if assignment.valid_until is not null and assignment.valid_until < now:
        return 'expired'
    if assignment.valid_from is not null and assignment.valid_from > now:
        return 'future'
    return 'active'


# ── Full three-gate check for a SINGLE permission (hasPermission()) ──
function hasPermission(effectivePermissions, permission, tenant):
    if permission not in effectivePermissions:
        return false                                          # 1. Permission gate

    resource = permission.split('.')[0]

    capability = SELECT enabled FROM tenant_capabilities
                 WHERE tenant_id = tenant.id AND capability_key = resource
    if capability exists and capability.enabled == false:
        return false                                          # 2. Capability gate

    flagKey = PERMISSION_RESOURCE_FLAG[resource]                # only for the 7 gated resources
    if flagKey is not null:
        flag = SELECT enabled FROM tenant_feature_flags
               WHERE tenant_id = tenant.id AND flag_key = flagKey
        if flag exists and flag.enabled == false:
            return false                                       # 3. Feature flag gate

    return true
```

**Diagram (as requested), annotated with the actual short-circuit
behavior — not a simplification:**

```
User
 │
Tenant Membership (is user_tenant_roles OR staff_assignments present for this tenant?)
 │
 ├─→ Ownership check (structural, via tenants.owner_id) ──eligible?──→ ALL_PERMISSIONS, STOP
 │
 └─→ Staff Assignment (role_id, mode, effective_status='active')
        │
        Role Permissions (role_permissions lookup, downgraded if mode='read')
        │
        ∪ tenant-wide user_tenant_roles permissions (Path 1 above, independently)
        │
        Overrides (user_permission_overrides: deny wins over allow wins over role)
        │
        ▼
   Effective Permissions
        │
        AND Capability (tenant_capabilities)
        AND FeatureFlag (tenant_feature_flags, only for 7 gated resources)
        │
        ▼
   hasPermission(permission) → true/false
```

---

## Phase 6 — Tenant and Location Security

Source: `assertOwnershipTenantAccess()` (lines 364-389),
`assertOwnershipBranchAccess()` (lines 308-335) in
`ownership-resolution.service.ts`; `branch-access.service.ts` (whole
file).

### Preventing cross-tenant access

**Rule:** every tenant-scoped request must verify the caller is
**either**:
1. The eligible Owner of the tenant (Phase 5's Owner check), **or**
2. Holds at least one `staff_assignments` row for that `tenant_id`
   with `effective_status = 'active'` AND `isStaffMemberEligible()`.

Anyone else → `403 TENANT_ACCESS_DENIED`, unconditionally — a valid
access token proves identity, never tenant membership.

```python
class TenantAccessResolver:
    def is_member(self, user, tenant_id) -> bool:
        tenant = Tenant.objects.get(id=tenant_id)
        if tenant.status == 'archived':
            return False
        owner = getattr(user, 'owner_profile', None)
        if owner and owner.status == 'active' and tenant.owner_id == owner.id:
            return True
        return StaffAssignment.objects.filter(
            staff_id=user.id, tenant_id=tenant_id,
        ).filter(effective_status_active_q(now())).exists()

    def assert_member(self, user, tenant_id):
        if not self.is_member(user, tenant_id):
            raise TenantAccessDenied(tenant_id)
```

### Preventing cross-branch/location access

**Rule:** a **second, independent** check from tenant membership. Every
location-scoped request must verify the caller's resolved location set
includes the target `location_id`.

- **Owner:** always passes — full access to every location of every
  tenant they own (mirrors `resolveOwnerPermissions()`'s structural
  grant).
- **Holder of `branches.manage`:** passes for **every** location of the
  tenant, regardless of their specific `staff_assignments` location
  scope — this is the one permission that overrides location scoping
  for read access (source: `branch-access.service.ts`
  `getAccessibleBranches()` lines 18-27, checked via `hasPermission()`).
- **Everyone else:** passes only if `location_id` is in their resolved
  `staff_assignments` location set (union across all effective
  assignments for that tenant).

```python
class LocationAccessResolver:
    def accessible_location_ids(self, user, tenant_id) -> set[UUID] | Literal['ALL']:
        if TenantAccessResolver().owner_of(user, tenant_id):
            return 'ALL'
        effective_permissions = PermissionResolver(user, tenant_id).effective_permissions()
        if 'branches.manage' in effective_permissions:
            return 'ALL'
        assignments = StaffAssignment.objects.filter(
            staff_id=user.id, tenant_id=tenant_id,
        ).filter(effective_status_active_q(now()))
        if any(a.all_locations for a in assignments):
            return 'ALL'
        ids = set()
        for a in assignments:
            ids |= set(a.location_ids.all().values_list('location_id', flat=True))
        return ids

    def can_access(self, user, tenant_id, location_id) -> bool:
        accessible = self.accessible_location_ids(user, tenant_id)
        return accessible == 'ALL' or location_id in accessible

    def assert_access(self, user, tenant_id, location_id):
        if not self.can_access(user, tenant_id, location_id):
            raise LocationAccessDenied(location_id)
```

### `PermissionResolver` (composes both + the permission check)

```python
class PermissionResolver:
    def __init__(self, user, tenant_id):
        self.user = user
        self.tenant_id = tenant_id

    def effective_permissions(self) -> set[str]:
        # implements the Phase 5 pseudocode exactly
        ...

    def has_permission(self, permission_key: str) -> bool:
        perms = self.effective_permissions()
        if permission_key not in perms:
            return False
        resource = permission_key.split('.')[0]
        cap = TenantCapability.objects.filter(
            tenant_id=self.tenant_id, capability_key=resource,
        ).first()
        if cap and not cap.enabled:
            return False
        flag_key = PERMISSION_RESOURCE_FLAG.get(resource)
        if flag_key:
            flag = TenantFeatureFlag.objects.filter(
                tenant_id=self.tenant_id, flag_key=flag_key,
            ).first()
            if flag and not flag.enabled:
                return False
        return True

    def assert_permission(self, permission_key: str):
        if not self.has_permission(permission_key):
            raise PermissionDenied(permission_key)
```

### `isTenantEligible` scope note (do not silently broaden)

`isTenantEligible()` denies access **only** for `status = 'archived'`.
`trial`/`suspended`/`churned` tenants still grant access per the
current frontend logic (this was a deliberately scoped fix — P10.2.3
finding F-8 — not a general "any non-active status blocks access"
rule). **Do not** implement `status != 'active'` as the eligibility
check — that would deny access the frontend currently still grants for
3 of the 4 non-active statuses, causing a frontend/backend behavior
mismatch.

---

## Phase 7 — API Contract

All endpoints require `Authorization: Bearer <access_token>` unless
stated otherwise. All error bodies follow:
`{ "code": "...", "message": "...", "errors"?: {...} }` (matches
`docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` §4's shape).

### 7.1 `GET /api/auth/me`

**Auth:** required. **Permission:** none (any authenticated user).
**Headers:** `Authorization: Bearer <token>`.
**Query params:** none.
**Request body:** none.

**Success response (200):**
```json
{
  "id": "usr_123",
  "email": "manager@samoon.com",
  "phone_number": "+14255552222",
  "first_name": "Maria",
  "last_name": "Manager",
  "avatar": null,
  "role": "staff",
  "is_verified": true,
  "created_at": "2025-01-15T00:00:00Z",
  "tenantRoles": [
    { "tenant_id": "tnt_samoon01", "tenant_slug": "samoon-downtown", "role": "manager", "permissions": ["orders.view", "orders.manage"] }
  ],
  "ownership": [],
  "staffAssignments": [
    {
      "assignmentId": "sa_1", "staffId": "usr_123", "tenantId": "tnt_samoon01",
      "branchIds": ["loc_downtown"], "role": "manager", "mode": "manage",
      "status": "active", "validFrom": null, "validUntil": null,
      "grantedBy": "usr_owner_1", "grantedAt": "2025-01-15T00:00:00Z"
    }
  ]
}
```

**Error responses:**
- `401` — `{ "code": "TOKEN_INVALID", "message": "Access token is missing, expired, or malformed." }`

---

### 7.2 `GET /api/auth/me/permissions`

**Auth:** required. **Permission:** none.
**Headers:** `Authorization: Bearer <token>`, optionally `X-Tenant-Slug: <slug>` to disambiguate a multi-tenant user (falls back to the user's sole tenant membership if only one exists; `400` if ambiguous and header omitted).
**Query params:** none. **Request body:** none.

**Success response (200):**
```json
{ "permissions": ["orders.view", "orders.manage", "menu.view", "branches.view"] }
```

**Error responses:**
- `401` — `TOKEN_INVALID`
- `400` — `{ "code": "AMBIGUOUS_TENANT", "message": "User belongs to multiple tenants; specify X-Tenant-Slug." }`

---

### 7.3 `GET /api/permissions`

**Auth:** required. **Permission:** none (static reference data).
**Query params:** none. **Request body:** none.

**Success response (200):**
```json
[
  { "key": "orders.view", "resource": "orders", "action": "view", "description": "View order list/detail" },
  { "key": "orders.manage", "resource": "orders", "action": "manage", "description": "Update order status/details" }
]
```
(Full 48-entry array — see Phase 4 table.)

**Error responses:**
- `401` — `TOKEN_INVALID`

---

### 7.4 `GET /api/tenants/{tenant_id}/roles`

**Auth:** required. **Permission:** `staff.view` for `{tenant_id}`.
**Path params:** `tenant_id` (UUID, required).
**Query params:** none. **Request body:** none.

**Success response (200):**
```json
[
  { "id": "role_owner",   "name": "Owner",   "slug": "owner",   "permissions": ["orders.view", "..."] },
  { "id": "role_admin",   "name": "Admin",   "slug": "admin",   "permissions": ["orders.view", "..."] },
  { "id": "role_manager", "name": "Manager", "slug": "manager", "permissions": ["orders.view", "..."] },
  { "id": "role_cashier", "name": "Cashier", "slug": "cashier", "permissions": ["orders.view", "..."] },
  { "id": "role_waiter",  "name": "Waiter",  "slug": "waiter",  "permissions": ["orders.view", "..."] },
  { "id": "role_kitchen", "name": "Kitchen", "slug": "kitchen", "permissions": ["orders.view", "..."] },
  { "id": "role_marketing","name": "Marketing","slug": "marketing","permissions": ["analytics.view", "..."] },
  { "id": "role_support", "name": "Support", "slug": "support", "permissions": ["customers.view", "..."] }
]
```

**Error responses:**
- `401` — `TOKEN_INVALID`
- `403` — `{ "code": "PERMISSION_DENIED", "message": "Requires staff.view for this tenant." }`
- `403` — `{ "code": "TENANT_ACCESS_DENIED", "message": "Caller is not a member of this tenant." }`
- `404` — `{ "code": "TENANT_NOT_FOUND", "message": "No tenant with this id." }`

---

### 7.5 `POST /api/tenants/{tenant_id}/staff-assignments`

**Auth:** required. **Permission:** `staff.manage` for `{tenant_id}`.
**Path params:** `tenant_id` (UUID, required).
**Headers:** `Content-Type: application/json`.

**Request body:**

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `user_id` | string (UUID) | yes | The staff member being granted access | `"usr_123"` |
| `role_id` | string (UUID) | yes | Must not resolve to the `owner` role slug | `"role_manager"` |
| `location_ids` | string[] (UUID) | conditionally | Required unless `all_locations: true` | `["loc_downtown"]` |
| `all_locations` | boolean | no, default `false` | Grant applies to every current+future location | `false` |
| `mode` | `"read"` \| `"manage"` | no, default `"manage"` | `"read"` downgrades to `.view`-only | `"manage"` |
| `valid_from` | string (ISO 8601) | no | Grant becomes effective at this time | `"2025-08-01T00:00:00Z"` |
| `valid_until` | string (ISO 8601) | no | Grant expires at this time | `null` |

```json
{
  "user_id": "usr_123",
  "role_id": "role_manager",
  "location_ids": ["loc_downtown"],
  "all_locations": false,
  "mode": "manage",
  "valid_from": null,
  "valid_until": null
}
```

**Success response (201):**
```json
{
  "success": true,
  "assignment": {
    "id": "sa_42",
    "userId": "usr_123",
    "tenantId": "tnt_samoon01",
    "locationIds": ["loc_downtown"],
    "allLocations": false,
    "role": "manager",
    "mode": "manage",
    "status": "active",
    "validFrom": null,
    "validUntil": null,
    "grantedBy": "usr_owner_1",
    "grantedAt": "2025-07-10T00:00:00Z"
  }
}
```

**Error responses:**
- `401` — `TOKEN_INVALID`
- `403` — `PERMISSION_DENIED` (caller lacks `staff.manage`)
- `403` — `TENANT_ACCESS_DENIED`
- `404` — `{ "code": "ROLE_NOT_FOUND", "message": "No role with this id." }`
- `409` — `{ "code": "ROLE_ALREADY_ASSIGNED", "message": "An active assignment with this exact user+tenant+location+role already exists." }`
- `400` — `{ "code": "VALIDATION_ERROR", "message": "role_id must not be the owner role.", "errors": { "role_id": ["cannot assign the owner role via this endpoint"] } }`

---

### 7.6 `GET /api/tenants/{tenant_id}/staff-assignments`

**Auth:** required. **Permission:** `staff.view` for `{tenant_id}`.
**Path params:** `tenant_id` (UUID, required).
**Query params:**

| Param | Type | Required | Description | Example |
|---|---|---|---|---|
| `user_id` | string (UUID) | no | Filter to one staff member | `?user_id=usr_123` |
| `location_id` | string (UUID) | no | Filter to assignments covering this location | `?location_id=loc_downtown` |
| `status` | string | no | Filter by effective status | `?status=active` |
| `page` | integer | no, default 1 | Pagination | `?page=2` |
| `page_size` | integer | no, default 20, max 100 | Pagination | `?page_size=50` |

**Success response (200):**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "sa_42", "userId": "usr_123", "tenantId": "tnt_samoon01",
      "locationIds": ["loc_downtown"], "allLocations": false,
      "role": "manager", "mode": "manage", "status": "active",
      "validFrom": null, "validUntil": null,
      "grantedBy": "usr_owner_1", "grantedAt": "2025-07-10T00:00:00Z",
      "revokedBy": null, "revokedAt": null
    }
  ]
}
```

**Error responses:** `401 TOKEN_INVALID`, `403 PERMISSION_DENIED`, `403 TENANT_ACCESS_DENIED`.

---

### 7.7 `GET /api/tenants/{tenant_id}/staff-assignments/{id}`

**Auth:** required. **Permission:** `staff.view` for `{tenant_id}`.
**Path params:** `tenant_id`, `id` (both UUID, required).

**Success response (200):** single assignment object (same shape as 7.6's `results[0]`).

**Error responses:** `401 TOKEN_INVALID`, `403 PERMISSION_DENIED`, `403 TENANT_ACCESS_DENIED`, `404` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "No assignment with this id for this tenant." }`.

---

### 7.8 `PATCH /api/tenants/{tenant_id}/staff-assignments/{id}`

**Auth:** required. **Permission:** `staff.manage` for `{tenant_id}`.
**Path params:** `tenant_id`, `id` (both UUID, required).

**Request body** (all fields optional — only provided fields change; **`role_id` and `user_id` are NOT patchable** — see note below):

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `location_ids` | string[] (UUID) | no | Replaces the full location set | `["loc_downtown", "loc_uptown"]` |
| `all_locations` | boolean | no | | `true` |
| `mode` | `"read"` \| `"manage"` | no | | `"read"` |
| `valid_from` | string (ISO 8601) \| null | no | | `null` |
| `valid_until` | string (ISO 8601) \| null | no | | `"2025-12-31T00:00:00Z"` |

```json
{ "location_ids": ["loc_downtown", "loc_uptown"], "mode": "read", "valid_until": "2025-12-31T00:00:00Z" }
```

**Note — role/user changes are a "Move," not a PATCH:** changing
`role_id` or `user_id` on an existing assignment must be implemented as
revoke-old + grant-new (two operations, preserving the audit trail),
mirroring `MoveStaffAssignmentPayload`'s documented semantics in
`src/types/ownership.ts`. Reject a `PATCH` body containing `role_id` or
`user_id` with `400 VALIDATION_ERROR`.

**Success response (200):** the updated assignment object.

**Error responses:** `401 TOKEN_INVALID`, `403 PERMISSION_DENIED`, `403 TENANT_ACCESS_DENIED`, `404 ASSIGNMENT_NOT_FOUND`, `400 VALIDATION_ERROR` (attempted `role_id`/`user_id` change).

---

### 7.9 `DELETE /api/tenants/{tenant_id}/staff-assignments/{id}`

**Auth:** required. **Permission:** `staff.manage` for `{tenant_id}`.
**Path params:** `tenant_id`, `id` (both UUID, required).
**Request body:** none.

Soft-deletes: sets `status = 'revoked'`, `revoked_by = <caller>`, `revoked_at = now()`. Never hard-deletes.

**Success response (200):** `{ "success": true }`

**Error responses:** `401 TOKEN_INVALID`, `403 PERMISSION_DENIED`, `403 TENANT_ACCESS_DENIED`, `404 ASSIGNMENT_NOT_FOUND` (already revoked counts as not-found for this purpose).

---

### 7.10 `POST /api/tenants/{tenant_id}/users/{user_id}/roles`

Convenience alias of 7.5, scoped to a specific user via the path
instead of the body. **Identical request/response/error shape**, minus
`user_id` in the body (it's in the path instead).

**Path params:** `tenant_id`, `user_id` (both UUID, required).

**Request body:**
```json
{ "role_id": "role_manager", "location_ids": ["loc_downtown"], "all_locations": false, "mode": "manage" }
```

**Success response (201):**
```json
{ "success": true, "assignment": { "id": "sa_42", "userId": "usr_123", "...": "..." } }
```

**Errors:** identical to 7.5.

---

### 7.11 `DELETE /api/tenants/{tenant_id}/users/{user_id}/roles/{assignment_id}`

**Auth:** required. **Permission:** `staff.manage` for `{tenant_id}`.
**Path params:** `tenant_id`, `user_id`, `assignment_id` (all UUID, required).
**Request body:** none.

Identical soft-delete semantics to 7.9, additionally validating that
`assignment_id` actually belongs to `user_id` (returns `404` if not,
not `403` — do not leak whether the assignment exists for a different
user).

**Success response (200):** `{ "success": true }`

**Errors:** identical to 7.9.

---

## Phase 8 — Auth Response Contract

Full field documentation for every field below is in
`docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` §2 and
`docs/P10.11_RBAC_BACKEND_CONTRACT.md` §5 — this section gives the
**complete, RBAC-focused JSON examples** those documents summarize.

### After `login` / `verifyOTP` (existing user) / `register`

**Success (200/201):**
```json
{
  "user": {
    "id": "usr_owner_1",
    "email": "owner@samoon.com",
    "phone_number": null,
    "first_name": "Olivia",
    "last_name": "Owner",
    "avatar": null,
    "role": "owner",
    "is_verified": true,
    "created_at": "2024-06-01T00:00:00Z"
  },
  "tokens": { "access": "eyJhbGciOi...", "refresh": "eyJhbGciOi..." },
  "tenantRoles": [
    { "tenant_id": "tnt_samoon01", "tenant_slug": "samoon-downtown", "role": "owner", "permissions": ["orders.view", "orders.manage", "..."] }
  ],
  "ownership": [
    {
      "ownerId": "own_1", "userId": "usr_owner_1", "status": "active",
      "plan": "pro", "maxTenants": 5,
      "billing": { "customerId": "cus_1", "billingEmail": "billing@samoon.com" },
      "createdAt": "2024-06-01T00:00:00Z", "verifiedAt": "2024-06-02T00:00:00Z"
    }
  ],
  "staffAssignments": []
}
```

**Error (login, 401):**
```json
{ "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect." }
```

### After `refresh`

**Success (200):**
```json
{ "access": "eyJhbGciOi...", "refresh": "eyJhbGciOi..." }
```
*(Refresh does not re-send `tenantRoles`/`ownership`/`staffAssignments`
— the frontend's next `getMe()` call handles re-sync if needed, per
`docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` §2.6.)*

**Error (401):**
```json
{ "code": "REFRESH_TOKEN_INVALID", "message": "Refresh token is invalid or has been revoked." }
```

### After `GET /me`

**Success (200):** see Phase 7.1 example (identical shape, `User`
fields flattened at top level, not nested under a `user` key — this
differs intentionally from `login`/`register`/`verifyOTP`'s wrapper
shape).

**Error (401):**
```json
{ "code": "TOKEN_EXPIRED", "message": "Access token has expired." }
```

### Field-by-field: `tenantRoles[]`, `ownership[]`, `staffAssignments[]`

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `tenantRoles[].tenant_id` | string | yes | Tenant this role applies to | `"tnt_samoon01"` |
| `tenantRoles[].tenant_slug` | string | yes | URL slug | `"samoon-downtown"` |
| `tenantRoles[].role` | string | yes | One of the 8 role slugs | `"owner"` |
| `tenantRoles[].permissions` | string[] | recommended | Pre-resolved effective permissions | `["orders.view", "..."]` |
| `ownership[].ownerId` | string | yes | | `"own_1"` |
| `ownership[].userId` | string | yes | | `"usr_owner_1"` |
| `ownership[].status` | string | yes | `active`\|`suspended`\|`pending_verification` | `"active"` |
| `ownership[].plan` | string | yes | | `"pro"` |
| `ownership[].maxTenants` | number \| null | yes | `null` = unlimited | `5` |
| `ownership[].billing.customerId` | string \| null | yes | | `"cus_1"` |
| `ownership[].billing.billingEmail` | string | yes | | `"billing@samoon.com"` |
| `ownership[].createdAt` | string (ISO 8601) | yes | | `"2024-06-01T00:00:00Z"` |
| `ownership[].verifiedAt` | string (ISO 8601) \| undefined | no | | `"2024-06-02T00:00:00Z"` |
| `staffAssignments[].assignmentId` | string | yes | | `"sa_1"` |
| `staffAssignments[].staffId` | string | yes | | `"usr_123"` |
| `staffAssignments[].tenantId` | string | yes | | `"tnt_samoon01"` |
| `staffAssignments[].branchIds` | string[] \| `"all"` | yes | Frontend field name for `location_ids`/`all_locations` | `["loc_downtown"]` |
| `staffAssignments[].role` | string | yes | Never `"owner"` | `"manager"` |
| `staffAssignments[].mode` | `"read"` \| `"manage"` | yes | | `"manage"` |
| `staffAssignments[].status` | `"active"`\|`"future"`\|`"revoked"`\|`"expired"` | yes | | `"active"` |
| `staffAssignments[].validFrom` | string (ISO 8601) \| null | no | | `null` |
| `staffAssignments[].validUntil` | string (ISO 8601) \| null | no | | `null` |
| `staffAssignments[].grantedBy` | string | yes | | `"usr_owner_1"` |
| `staffAssignments[].grantedAt` | string (ISO 8601) | yes | | `"2025-01-15T00:00:00Z"` |

---

## Phase 9 — Error Contract

| HTTP | Code | Meaning | When backend sends it | Frontend behavior |
|---|---|---|---|---|
| 401 | `TOKEN_INVALID` | Access token missing/expired/malformed | Any authenticated endpoint, no valid Bearer token or signature check fails | Triggers `AuthBootstrapper.clearSession()` — full teardown (tokens, RBAC store, cart, branch, query cache). See `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md` §4 category A. |
| 403 | `PERMISSION_DENIED` | Authenticated, correct tenant, lacks the specific permission | Any RBAC-gated endpoint where `PermissionResolver.has_permission()` returns `false` | Shows "Access Denied" via `PermissionGuard`'s `fallback` or `AuthGuard`'s `forbiddenPath` redirect. **Does not** clear the session — this is routine, expected UX. |
| 403 | `TENANT_ACCESS_DENIED` | Authenticated, but not a member (Owner or Staff) of the tenant | `TenantAccessResolver.assert_member()` fails | Frontend treats as "wrong tenant context" — prompts a tenant switch or redirects to the user's actual tenant list. Never a logout. |
| 403 | `LOCATION_ACCESS_DENIED` | Authenticated, correct tenant, lacks assignment to the requested location | `LocationAccessResolver.assert_access()` fails | Frontend filters the location out of pickers; on direct navigation, redirects to an accessible location or shows empty state. |
| 404 | `ROLE_NOT_FOUND` | `role_id` doesn't exist (role-assignment endpoints), or the target assignment doesn't exist (GET/PATCH/DELETE by id) | Role-assignment/staff-assignment endpoints | Frontend refetches `GET /api/permissions`/role list (stale client cache) and shows a "not found" toast. |
| 409 | `ROLE_ALREADY_ASSIGNED` | Duplicate active assignment (same user+tenant+location+role) | `POST` staff-assignment endpoints | Frontend shows inline "already assigned" validation error, does not retry automatically. |

**Absolute rule:** only `401 TOKEN_INVALID` may trigger a session
teardown. A `403`/`404`/`409` here means the session is perfectly
valid — logging the user out on any of these would be a backend bug,
not correct security behavior.

---

## Phase 10 — Django Implementation Guide

### App structure

```
apps/
  authentication/   # User model — see docs/P10.10_AUTH_BACKEND_API_CONTRACT.md
  tenants/           # Tenant, Location, Owner models
  permissions/        # Permission model + ALL_PERMISSIONS seed migration
  roles/              # Role, RolePermission + 8-system-role seed migration
  staff/              # StaffAssignment, UserTenantRole, UserPermissionOverride + services
```

### Models

```python
# apps/tenants/models.py
class Owner(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('authentication.User', on_delete=models.CASCADE, related_name='owner_profiles')
    status = models.CharField(max_length=30, choices=[('active','Active'),('suspended','Suspended'),('pending_verification','Pending Verification')], default='pending_verification')
    plan = models.CharField(max_length=50)
    max_tenants = models.IntegerField(null=True, blank=True)
    billing_customer_id = models.CharField(max_length=100, null=True, blank=True)
    billing_email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    type = models.CharField(max_length=50, choices=BUSINESS_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=TENANT_STATUS_CHOICES, default='trial')
    owner = models.ForeignKey(Owner, null=True, on_delete=models.SET_NULL, related_name='tenants')
    created_at = models.DateTimeField(auto_now_add=True)

class Location(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='locations')
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100)
    code = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[('active','Active'),('inactive','Inactive'),('maintenance','Maintenance')], default='active')
    type = models.CharField(max_length=20, choices=[('physical','Physical'),('mobile','Mobile')], default='physical')
    manager = models.ForeignKey('authentication.User', null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('tenant', 'slug')]


# apps/permissions/models.py
class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resource = models.CharField(max_length=50, db_index=True)
    action = models.CharField(max_length=50)
    key = models.CharField(max_length=100, unique=True)
    description = models.TextField()


# apps/roles/models.py
class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    description = models.TextField()
    system_role = models.BooleanField(default=True)
    tenant = models.ForeignKey('tenants.Tenant', null=True, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['slug'], condition=models.Q(tenant__isnull=True), name='roles_system_slug_uq'),
            models.UniqueConstraint(fields=['tenant', 'slug'], condition=models.Q(tenant__isnull=False), name='roles_tenant_slug_uq'),
        ]

    def delete(self, *args, **kwargs):
        if self.system_role:
            raise ValidationError("System roles cannot be deleted.")
        super().delete(*args, **kwargs)

class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = [('role', 'permission')]


# apps/staff/models.py
class UserTenantRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('authentication.User', on_delete=models.CASCADE)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    role = models.ForeignKey('roles.Role', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'tenant', 'role')]

class StaffAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey('authentication.User', on_delete=models.CASCADE, related_name='staff_assignments')
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    locations = models.ManyToManyField('tenants.Location', through='StaffAssignmentLocation')
    all_locations = models.BooleanField(default=False)
    role = models.ForeignKey('roles.Role', on_delete=models.PROTECT)
    mode = models.CharField(max_length=10, choices=[('read','Read'),('manage','Manage')], default='manage')
    status = models.CharField(max_length=20, choices=[('active','Active'),('future','Future'),('revoked','Revoked'),('expired','Expired')], default='active')
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    granted_by = models.ForeignKey('authentication.User', on_delete=models.PROTECT, related_name='granted_assignments')
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_by = models.ForeignKey('authentication.User', null=True, on_delete=models.SET_NULL, related_name='revoked_assignments')
    revoked_at = models.DateTimeField(null=True, blank=True)

    def clean(self):
        owner_role = Role.objects.filter(slug='owner', tenant__isnull=True).first()
        if owner_role and self.role_id == owner_role.id:
            raise ValidationError("StaffAssignment.role must never be the 'owner' role.")

    def effective_status(self, now=None) -> str:
        now = now or timezone.now()
        if self.status == 'revoked':
            return 'revoked'
        if self.valid_until and self.valid_until < now:
            return 'expired'
        if self.valid_from and self.valid_from > now:
            return 'future'
        return 'active'

class StaffAssignmentLocation(models.Model):
    assignment = models.ForeignKey(StaffAssignment, on_delete=models.CASCADE)
    location = models.ForeignKey('tenants.Location', on_delete=models.CASCADE)

    class Meta:
        unique_together = [('assignment', 'location')]

class UserPermissionOverride(models.Model):
    user = models.ForeignKey('authentication.User', on_delete=models.CASCADE)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    permission = models.ForeignKey('permissions.Permission', on_delete=models.CASCADE)
    effect = models.CharField(max_length=10, choices=[('allow','Allow'),('deny','Deny')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'tenant', 'permission')]
```

### Serializers

```python
class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['key', 'resource', 'action', 'description']

class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'name', 'slug', 'permissions']

    def get_permissions(self, obj):
        return list(obj.rolepermission_set.values_list('permission__key', flat=True))

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'phone_number', 'first_name', 'last_name', 'avatar', 'status', 'is_verified', 'created_at']

class OwnerSerializer(serializers.ModelSerializer):
    billing = serializers.SerializerMethodField()

    class Meta:
        model = Owner
        fields = ['id', 'user_id', 'status', 'plan', 'max_tenants', 'billing', 'created_at', 'verified_at']

    def get_billing(self, obj):
        return {'customerId': obj.billing_customer_id, 'billingEmail': obj.billing_email}

class StaffAssignmentSerializer(serializers.ModelSerializer):
    branchIds = serializers.SerializerMethodField()

    class Meta:
        model = StaffAssignment
        fields = ['id', 'staff_id', 'tenant_id', 'branchIds', 'role', 'mode', 'status', 'valid_from', 'valid_until', 'granted_by', 'granted_at']

    def get_branchIds(self, obj):
        return 'all' if obj.all_locations else list(obj.locations.values_list('id', flat=True))

class RBACSerializer(serializers.Serializer):
    """Composite serializer producing the exact Phase 8 payload shape."""
    tenantRoles = serializers.SerializerMethodField()
    ownership = OwnerSerializer(many=True, source='owner_profiles')
    staffAssignments = StaffAssignmentSerializer(many=True, source='staff_assignments')

    def get_tenantRoles(self, user):
        rows = UserTenantRole.objects.filter(user=user).select_related('tenant', 'role')
        return [
            {
                'tenant_id': str(r.tenant_id),
                'tenant_slug': r.tenant.slug,
                'role': r.role.slug,
                'permissions': list(r.role.rolepermission_set.values_list('permission__key', flat=True)),
            }
            for r in rows
        ]
```

### DRF Permission classes

```python
class RequiresTenantPermission(BasePermission):
    """
    Usage: permission_classes = [RequiresTenantPermission]
           required_permission = 'staff.manage'   # class attribute on the view
    tenant_id is read from view.kwargs['tenant_id'].
    """
    def has_permission(self, request, view):
        tenant_id = view.kwargs.get('tenant_id')
        required = getattr(view, 'required_permission', None)
        if not tenant_id or not required:
            return True  # not a tenant-scoped view

        resolver = TenantAccessResolver()
        if not resolver.is_member(request.user, tenant_id):
            raise TenantAccessDenied(tenant_id)

        perm_resolver = PermissionResolver(request.user, tenant_id)
        if not perm_resolver.has_permission(required):
            raise PermissionDeniedError(required)
        return True


class RequiresLocationPermission(RequiresTenantPermission):
    """Additionally checks location scope. location_id read from view.kwargs['location_id']
    or from the request body/query for write endpoints — configure per-view."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        tenant_id = view.kwargs.get('tenant_id')
        location_id = view.kwargs.get('location_id') or request.data.get('location_id')
        if location_id:
            LocationAccessResolver().assert_access(request.user, tenant_id, location_id)
        return True
```

### Middleware

```python
class TenantContextMiddleware:
    """Mirrors src/middleware.ts's tenant-slug resolution (subdomain-based)
    for server-rendered/API-adjacent needs — injects request.tenant_slug."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = request.get_host().split(':')[0]
        parts = host.split('.')
        request.tenant_slug = parts[0] if len(parts) >= 3 and parts[0] != 'www' else None
        return self.get_response(request)
```

---

## Phase 11 — Frontend/Backend Integration Rules

### What frontend sends

- Credentials (`email`/`password`, or `country_code`/`phone_number`/`otp`) on login/OTP/register — see `docs/P10.10_AUTH_BACKEND_API_CONTRACT.md`.
- `Authorization: Bearer <access_token>` on every authenticated request.
- Role-assignment request bodies (Phase 7.5/7.10) when an admin uses the Staff Management UI — `role_id`, `location_ids`/`all_locations`, `mode`, `valid_from`/`valid_until`.

### What backend sends

- The full RBAC payload (Phase 8) on every identity-producing response.
- Resolved, effective permission arrays (`tenantRoles[].permissions`, `GET /me/permissions`) — pre-computed server-side, not raw role slugs the frontend would have to resolve itself against a stale local copy of `ROLE_PERMISSION_MAP`.
- RBAC-specific error codes (Phase 9) distinguishable by HTTP status + `code` field.

### What frontend caches

- `tenantRoles`, `ownership`, `staffAssignments` — held in `useRbacStore` (Zustand, `src/stores/index.ts`), persisted to `localStorage` under key `samoon-rbac` for UX responsiveness across reloads, but **re-synced from `GET /me` on every app boot** (not trusted as the sole source after a reload — see `docs/P10.7_RBAC_SESSION_HYDRATION_IMPLEMENTATION.md`).
- Resolved effective permissions are recomputed client-side via `usePermissions()` (memoized on user/tenant/tenantRoles/overrides) rather than cached as a flat array — this is a derived value, not separately persisted.

### What backend must NEVER trust

- **Any RBAC field in an incoming request body** (`permissions`, `role`, `tenantRoles`, etc.) as an authorization input. These fields, wherever they appear in a request, are informational/display-only from an already-authorized action (e.g. showing a role name in a form) — the backend must independently derive the caller's actual role/permissions from `user_tenant_roles`/`staff_assignments`/`user_permission_overrides` looked up by the authenticated user's ID, never from anything the client asserts about itself.
- `localStorage`'s `samoon-rbac` cache — assume it is arbitrarily readable/writable by anyone with access to the browser's dev tools; it is a UX cache, not a credential.
- The presence/absence of a 403 in the frontend's own client-side permission check as proof the backend would also deny — client-side `PermissionGuard`/`usePermission()` failing to render a button does not mean the corresponding API call is safe to skip authorization on; **every** API endpoint independently re-checks per Phase 5/6.

**Explicit statement (per task requirement):** Frontend RBAC
(`usePermissions()`, `PermissionGuard`, `AuthGuard`,
`useHasDashboardAccess()`) exists **only** to hide UI a user isn't
allowed to use — pure UX. **The backend is the final, sole
authorization authority.** No frontend check, however faithfully it
mirrors this document's rules, is a substitute for the backend
independently enforcing every rule in Phases 5, 6, and 9 on every
request.

---

## Phase 12 — Validation Checklist

Backend implementation checklist:

- [ ] Database migrated — all 14 tables from Phase 2 created with the specified columns, types, nullability, indexes, and FK cascade behavior
- [ ] Roles seeded — exactly the 8 system roles from Phase 3, `system_role = true`, slugs matching `owner`/`admin`/`manager`/`cashier`/`waiter`/`kitchen`/`marketing`/`support` exactly (case-sensitive)
- [ ] Permissions seeded — exactly the 48 canonical permissions from Phase 4 (not the 2 reserved `reviews.*` entries, not `dashboard:access`)
- [ ] `role_permissions` seeded — the exact grant lists from Phase 3 for each of the 8 roles, including the documented intentional exclusions
- [ ] API implemented — all 11 endpoints from Phase 7 (7.1–7.11), each returning the exact success/error shapes documented
- [ ] Tenant isolation tested — a non-member's request to a tenant's resources returns `403 TENANT_ACCESS_DENIED`, not `403 PERMISSION_DENIED` or a silent empty result
- [ ] Branch/location isolation tested — a Staff member's request to a location outside their `staff_assignments` scope returns `403 LOCATION_ACCESS_DENIED`, and a `branches.manage` holder's request succeeds for every location of their tenant
- [ ] Permission tests added — for each of the 8 roles, verify the exact allowed/forbidden permission sets from Phase 3 (both directions — allowed permissions pass, forbidden permissions are denied)
- [ ] Security tests added — verify: (1) a request body's `permissions`/`role` fields are never read as an authorization input, (2) `staff_assignments.role_id` can never be set to the `owner` role via any endpoint, (3) an eligible Owner's structural grant is scoped to tenants they actually own (not "any tenant"), (4) an archived tenant denies access to everyone including its Owner, (5) a `403 PERMISSION_DENIED`/`404`/`409` never triggers a session/token invalidation — only `401 TOKEN_INVALID` does
- [ ] Effective-status derivation tested — a `staff_assignments` row with a past `valid_until` is treated as `expired` even if its stored `status` column still reads `'active'`
- [ ] Override precedence tested — `deny` wins over `allow` wins over role-derived permissions, for both the tenant-wide (`user_tenant_roles`) and StaffAssignment paths
- [ ] Multi-assignment union tested — a staff member with two active assignments to the same tenant (different roles/locations) receives the union of both permission sets and both location sets
- [ ] `mode: 'read'` downgrade tested — verify the `.view`-only substitution/drop logic matches Phase 5's `downgradeToReadOnly()` pseudocode exactly, including permissions with no `.view` sibling being dropped entirely
