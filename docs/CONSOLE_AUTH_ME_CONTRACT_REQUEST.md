# Console `/auth/me` Contract — Backend Implementation Request

**Phase 2B — Frontend audit complete. No backend changes in this phase.**

This document specifies the fields the Console workspace requires from `GET /auth/me` so tenant/branch selectors can render without secondary `GET /tenants/:id` or `GET /tenants/:id/branches` calls during boot.

---

## Current backend shape (observed / assumed)

```json
{
  "user": { "...": "..." },
  "memberships": [
    {
      "tenantId": "tenant-samoon-01",
      "tenantSlug": "samoon",
      "roles": ["owner"]
    }
  ],
  "activeMembership": {
    "tenantId": "tenant-samoon-01"
  }
}
```

### Missing fields (frontend usage audit)

| Field | Level | Required for | Status |
|-------|-------|--------------|--------|
| `tenantName` | membership | Unified tenant selector label | **Missing** |
| `tenantLogo` | membership | Selector avatar / branding (optional UI) | **Missing** |
| `branches[]` | membership | Branch selector boot without branch API | **Missing** |
| `branchId` | activeMembership | Active branch pointer (manual selection) | Partially present via switch-branch |
| `tenantName` | activeMembership | Active chrome label without tenant fetch | **Missing** |
| `branchName` | activeMembership | Active branch label without branch fetch | **Missing** |

---

## Required membership shape

```json
{
  "tenantId": "tenant-samoon-01",
  "tenantName": "Samoon Restaurant",
  "tenantSlug": "samoon",
  "tenantLogo": null,
  "roles": ["owner"],
  "branchAccess": {
    "scope": "all"
  },
  "branches": [
    {
      "id": "branch-rest-01",
      "name": "Main Branch",
      "slug": "main",
      "status": "active",
      "isDefault": true
    },
    {
      "id": "branch-rest-02",
      "name": "Downtown Branch",
      "slug": "downtown",
      "status": "active"
    }
  ],
  "status": "active"
}
```

### Branch summary fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Required — matches branch store id |
| `name` | string | Required — selector label |
| `slug` | string | Required — routing / preview URLs |
| `status` | `'active' \| 'inactive' \| 'maintenance'` | Required — status dot in selector |
| `isDefault` | boolean | Optional — **not used for auto-selection** (manual branch policy) |

---

## Required activeMembership shape

```json
{
  "tenantId": "tenant-samoon-01",
  "branchId": null,
  "tenantName": "Samoon Restaurant",
  "branchName": null
}
```

When the user explicitly selects a branch (`POST /auth/switch-branch/`):

```json
{
  "tenantId": "tenant-samoon-01",
  "branchId": "branch-rest-02",
  "tenantName": "Samoon Restaurant",
  "branchName": "Downtown Branch"
}
```

---

## Frontend consumption map

| Consumer | Fields used |
|----------|-------------|
| `getTenantDisplayName()` | `membership.tenantName` → `Tenant.name` → `tenantSlug` → `tenantId` |
| `AdminTenantSwitcher` | `getTenantDisplayName` for selected + dropdown labels |
| `AdminBranchSwitcher` | `membership.branches[]`, `activeMembership.branchId` |
| `ConsoleWorkspaceBootstrapper` | `memberships`, `activeMembership.tenantId` |
| `useConsoleWorkspaceStore.switchTenant` | `tenantName`, `tenantSlug`, `tenantLogo`, `branches[]` |
| `loadBranchesFromMembership` | `memberships[].branches[]` |
| Settings / theme pages | Full `GET /tenants/:id` (lazy — not boot-critical) |

---

## Boot sequence (target)

```
Login
  → GET /auth/me (single call)
  → hydrate tenant shell from membership metadata
  → hydrate branches from membership.branches[]
  → workspacePhase = ready
  → selectors render (no tenant/branch API during boot)
```

### When frontend still calls tenant/branch APIs

| API | Trigger |
|-----|---------|
| `GET /tenants/:id` | Membership missing `tenantName` or `tenantSlug`; or settings/theme page calls `ensureFullTenantRecord()` |
| `GET /tenants/:id/branches` | Membership missing `branches[]`; explicit user retry; permission refresh |

---

## Default branch policy (product decision)

**Option B — manual selection** is implemented:

- `activeMembership.branchId` is `null` after login unless the user selects a branch or navigates to `/console/branches/:id`.
- `isDefault` on membership branches is **informational only** — not used to auto-select.

---

## Mock alignment

`deriveMockAuthSession()` in mock mode now emits the full contract via `buildSamoonMembership()` (`src/lib/mock-console-memberships.ts`).

---

## Acceptance criteria for backend

1. Every membership in `GET /auth/me` includes `tenantName`, `tenantSlug`, and `branches[]` (may be empty).
2. `activeMembership` includes `tenantName`; includes `branchId`/`branchName` only when a branch is active.
3. Branch list in membership is filtered to branches the user can access (respecting `branchAccess`).
4. Switch-tenant / switch-branch responses are reflected on the next `GET /auth/me` call.
