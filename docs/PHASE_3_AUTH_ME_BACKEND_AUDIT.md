# Phase 3 — Auth Session Contract & Real Backend Alignment

**Status:** Frontend normalizer + backend reference implementation delivered.
**Backend repository:** External Django service at `NEXT_PUBLIC_API_BASE_URL` (not in this repo).

---

## 1. Backend Contract Report — Current vs Required

### Observed baseline (pre-Phase 3 real backend)

Based on `docs/API_GAP_REPORT.md`, `docs/BACKEND_IMPLEMENTATION_PLAN.md` §6, and frontend integration audits:

| Area | Current (assumed wire) | Required (Phase 3) | Gap |
|------|------------------------|-------------------|-----|
| `memberships[]` | `{ tenantId, tenantSlug?, roles, branchAccess? }` | Full membership with display + branch hydration | **tenantName, tenantLogo, branches[]** missing |
| `activeMembership` | `{ tenantId }` pointer only | Pointer + display labels | **tenantName, branchId, branchName** missing or incomplete |
| `GET /auth/me` user shape | Nested `{ user: {...} }` (real) | Same | ✅ Frontend aligned (`AUTH_ME_RESPONSE_CONTRACT_MIGRATION.md`) |
| Branch boot | `GET /tenants/:id/branches` fallback | `memberships[].branches[]` | **Backend must embed branches** |
| Tenant selector labels | `GET /tenants/:id` fallback | `membership.tenantName` | **Backend must embed tenant metadata** |

### Field source map (target Django implementation)

| Field | Source model | Serializer | Required? |
|-------|--------------|------------|-----------|
| `memberships[].tenantId` | `TenantMembership.tenant_id` | `TenantMembershipSerializer.tenant_id` → `tenantId` | **Yes** |
| `memberships[].tenantName` | `Tenant.name` | `source='tenant.name'` | **Yes** (Console selectors) |
| `memberships[].tenantSlug` | `Tenant.slug` | `source='tenant.slug'` | **Yes** |
| `memberships[].tenantLogo` | `Tenant.settings.logo` or `Tenant.image` | `SerializerMethodField` | Optional (null OK) |
| `memberships[].roles` | `TenantMembership.roles` M2M → `Role.code` | `SlugRelatedField(many=True)` | **Yes** |
| `memberships[].branchAccess` | `TenantMembership.branch_scope` + `assigned_branches` | `BranchAccessSerializer` | **Yes** |
| `memberships[].branches[]` | `Branch` queryset filtered by membership scope | `MembershipBranchSerializer(many=True)` | **Yes** (Console boot) |
| `memberships[].branches[].isDefault` | `Branch.is_default` | `BooleanField` → `isDefault` | Optional |
| `activeMembership.tenantId` | Session pointer / switch-tenant state | `ActiveMembershipSerializer` | **Yes** |
| `activeMembership.branchId` | Session pointer / switch-branch state | nullable | Optional (manual branch policy) |
| `activeMembership.tenantName` | `Tenant.name` for active tenant | denormalized for chrome | **Yes** |
| `activeMembership.branchName` | `Branch.name` for active branch | denormalized, null when no branch | Optional |

Reference implementation: `backend-reference/phase3/auth_me/`

---

## 2. Backend Changes (reference — apply in Django repo)

| File | Responsibility |
|------|----------------|
| `backend-reference/phase3/auth_me/serializers.py` | `MembershipBranchSerializer`, `TenantMembershipSerializer`, `MeResponseSerializer` |
| `backend-reference/phase3/auth_me/services.py` | `build_auth_me_payload()` — membership queryset + branch filtering |
| `backend-reference/phase3/auth_me/views.py` | `GET /auth/me/` view |
| `backend-reference/phase3/auth_me/tests.py` | Isolation + query-count tests |
| `backend-reference/phase3/README.md` | Integration instructions |

**Security rules enforced in service layer:**

1. `memberships` = only `TenantMembership.objects.filter(user=request.user, status='active')`
2. `branches[]` = branches for `membership.tenant` filtered by `branch_scope` / `assigned_branches`
3. Exclude `status='inactive'` branches unless product requires them (default: active + maintenance only)
4. `activeMembership.branchId` validated against accessible branch set before serialization
5. Never include Tenant B data when resolving Tenant A active pointer

---

## 3. Query Performance Report

### Before (naive implementation — N+1 risk)

```
GET /auth/me/
  1 query  — user lookup (JWT)
  1 query  — memberships list
  N queries — tenant per membership (select_related missing)
  N queries — roles per membership (prefetch missing)
  N queries — assigned_branches per membership
  N×M queries — branches per membership (worst case)
```

**Estimated:** `3 + 3N + NM` queries for N memberships, M branches each.

### After (reference implementation)

```
GET /auth/me/
  1 query — user (auth)
  1 query — memberships + tenant (select_related('tenant'))
  1 query — roles prefetch
  1 query — assigned_branches prefetch
  1 query — branches prefetch (tenant-scoped, filtered in Python)
```

**Target:** **≤ 5 queries** regardless of membership/branch count.

Verify in Django with `assertNumQueries(5)` — see `backend-reference/phase3/auth_me/tests.py`.

---

## 4. Frontend Changes (this repo)

| File | Change |
|------|--------|
| `src/lib/auth-me-normalizer.ts` | **New** — snake_case/camelCase wire normalization, branch tenant isolation |
| `src/services/auth.service.ts` | `getMe()` real mode calls `normalizeGetMeResponse()` + isolation assert |
| `src/types/rbac.ts` | Added `branchName` on `TenantMembership` for activeMembership display |
| `src/test/phase-3-auth-me-normalizer.test.ts` | Unit tests for wire normalization + security filtering |
| `scripts/console-phase3-real-api-validate.mjs` | Playwright validation against real API |

Phase 2B hydration (`hydrateConsoleTenantFromMembership`, `getTenantDisplayName`) unchanged — consumes normalized memberships.

---

## 5. Frontend Real API Validation

### Prerequisites

```env
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_BASE_URL=http://<backend-host>/api
AUDIT_EMAIL=<console-user>
AUDIT_PASSWORD=<password>
AUDIT_BASE_URL=http://localhost:3000
```

### Run

```bash
node scripts/console-phase3-real-api-validate.mjs
```

### Validates

- Login → `GET /auth/me` only (no tenant/branch boot fetches)
- Tenant label parity (selected = dropdown)
- Branch list present from membership
- Network request log saved to `tmp/console-phase3-real-api-validate/report.json`

> **Note:** Automated run requires valid credentials in env vars. The agent cannot call the production backend without explicit approval.

---

## 6. Remaining Risks

| Risk | Mitigation |
|------|------------|
| Backend not yet deployed with Phase 3 fields | Frontend normalizer tolerates partial wire; falls back to API fetches when metadata missing |
| `tenantLogo` not rendered in UI | Modeled; avatar slot deferred |
| Switch-tenant/branch endpoint path mismatch (`/authorization/*` vs `/auth/*`) | Verify against deployed backend; update `endpoints.ts` if needed |
| `activeMembership` without `roles` on pointer-only responses | Frontend merges from `memberships[]` by `tenantId` in normalizer |
| Full tenant settings still lazy-loaded | `ensureFullTenantRecord()` — settings pages may still call `GET /tenants/:id` |

---

## Related docs

- `docs/CONSOLE_AUTH_ME_CONTRACT_REQUEST.md` — Phase 2B contract request
- `docs/BACKEND_CONTRACT.md` — Frozen auth spec (update `§1.3` nesting note)
- `docs/AUTH_ME_RESPONSE_CONTRACT_MIGRATION.md` — Nested `user` key migration
