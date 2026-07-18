# Frontend Context Model (Phase Y)

**Status: descriptive, not prescriptive of new work.** This document
explains how the frontend currently understands (and, once
`BACKEND_CONTRACT.md`'s contract lands, will understand) the relationship

```
User → Membership → Tenant → Branch → Permission
```

It is the reference for "who is this user, inside which tenant, inside
which branch, with which permissions, right now" — the question every
prior Console-context audit in this project (Phase 8, 9, 9.4, X, X.2,
X.3) has been answering piece by piece. This document is the single
consolidated answer.

---

## 1. The Relationship, as Data

```
User (global identity — src/types/index.ts)
  id, email, accountType ('customer' | 'business')
  │
  │  accountType is a UX-only landing hint. It is READ by exactly one
  │  thing: getPostLoginRedirect() (src/utils/auth-redirect.ts), to pick
  │  /dashboard vs /console before any tenant context exists. It is never
  │  read by any permission check anywhere in the codebase (verified,
  │  Phase 9.3 and re-verified in every audit since).
  │
  ├── TenantMembership (src/types/rbac.ts) — one per tenant the user belongs to
  │     tenantId, tenantSlug?, tenantName?, roles: Role[], branchAccess, status?
  │     │
  │     │  This is the ONLY place tenant-scoped RBAC roles live. A user's
  │     │  roles in Tenant A say nothing about Tenant B — there is no
  │     │  inheritance, no fallback, by explicit design
  │     │  (AdminTenantSwitcher.tsx's own comment: "permission inheritance
  │     │  across a tenant switch — never correct").
  │     │
  │     ├── roles[] (e.g. ["owner"], or ["cashier", "waiter"] — a
  │     │     membership can hold MULTIPLE roles; permissions union)
  │     │
  │     └── branchAccess: { scope: 'all' } | { scope: 'assigned', branchIds: string[] }
  │           │
  │           │  Answers "WHERE can this membership act," orthogonal to
  │           │  roles (which answer "WHAT can it do"). Never folded into
  │           │  the permission string itself (Phase 9 architecture
  │           │  decision, unchanged since).
  │           │
  │           └── Branch[] (src/types/branch.ts) — the actual branch
  │                 records this scope resolves to, fetched separately
  │                 (GET /tenants/{tenantId}/branches, BACKEND_CONTRACT.md §4)
  │
  └── (no simultaneous second membership active — see §3)
```

## 2. Runtime State — Where Each Piece Actually Lives

```
┌──────────────────────────────────────────────────────────────────┐
│ useAuthStore (src/stores/index.ts)                                │
│   user: User | null            ← identity, from login/getMe        │
│   isAuthenticated, isLoading, sessionCheckFailed                   │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ useTenantStore                                                     │
│   tenant: Tenant | null        ← the ONE active tenant, resolved   │
│                                   from the request subdomain, NOT   │
│                                   from `memberships[]`              │
│   tenantState: TenantLifecycle ('loading'|'resolved'|'not_found'|  │
│                                  'forbidden'|'error')               │
│   featureFlags                                                     │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ useRbacStore                                                       │
│   currentTenantSession: { tenantId, roles[], permissions[],        │
│                            branchAccess } | null                   │
│     ← THE single live authorization source. Reconstructed on every │
│       login/session-restore/tenant-switch. NEVER persisted to      │
│       localStorage (deliberately — see §4).                        │
│   tenantRoles[]  ← PERSISTED, role-management-UI concern only.     │
│       Must NEVER be read for a live authorization decision (Phase  │
│       X.3 fixed the two call sites that used to do this).          │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ useBranchStore                                                     │
│   branches: Branch[]           ← fetched for the active tenant     │
│   selectedBranch: Branch | null, branchState (BranchResolutionState)│
│   activeBranch                 ← UNRELATED: customer storefront's   │
│                                   own branch selection, structurally │
│                                   separate from Console's           │
│                                   selectedBranch (verified clean,   │
│                                   every audit since Phase 3)         │
└──────────────────────────────────────────────────────────────────┘
```

## 3. The Single-Active-Tenant Constraint

**The frontend can correctly represent** the target scenario —

```
User X
 ├── Tenant A: owner, branches: all
 └── Tenant B: waiter, branch-3 only
```

— **one side at a time**, never simultaneously. `currentTenantSession`
holds exactly one `{tenantId, roles, permissions, branchAccess}` tuple.
This is not a bug; it mirrors how a real multi-tenant SaaS session
actually works (you are "in" one tenant's console at a time) — it is,
however, the reason tenant *switching* is where all of this project's
Console-reliability audits found their bugs (Phase X/X.2/X.3): the
transition between "in Tenant A" and "in Tenant B" is a real state
machine with race conditions and authorization edge cases, even though
each side of it, alone, is correctly modeled.

`memberships[]` (once the backend sends it — see `API_GAP_REPORT.md`
item 1) is what makes BOTH sides of the diagram simultaneously
*knowable* by the frontend (for rendering a tenant switcher), without
making them simultaneously *active*.

## 4. Persistence Boundary — What Survives a Reload, and Why

| State | Persisted? | Why |
|---|---|---|
| `user` | No (re-fetched via `getMe()`) | Tokens are the actual persisted credential (`localStorage`) |
| `tenant` | No | Re-resolved from the subdomain every load — a stale cached tenant object would be actively wrong the moment the user is on a different subdomain |
| `currentTenantSession` | **Never** (explicit `partialize` exclusion) | This is the active authorization decision. Persisting it would let a stale, unrevalidated permission set survive a reload, or worse, leak from one tenant into another if the subdomain changed underneath it |
| `tenantRoles[]` | Yes | Powers the admin role-*management* UI (viewing/editing other users' assignments across tenants you administer) — a different concern from "what can I, right now, do." Documented, known, deliberately scoped away from live authorization (Phase X.3) |
| `selectedBranch` (full object) | No | `selectedBranchId` only, re-validated against a fresh branch fetch on every load — an id that no longer exists or is no longer accessible resolves to "no branch selected," never a silent substitution |
| `activeBranch` (customer storefront) | Yes, full object | Public, non-sensitive UI preference — unrelated to authorization |

## 5. Permission Evaluation — the Exact Algorithm (unchanged by Phase Y)

```
1. membership = memberships.find(m => m.tenantId === activeTenantId)
   if !membership or membership.status !== 'active': DENY

2. rolePermissions = union(ROLE_PERMISSION_MAP[r] for r in membership.roles)

3. effective = (rolePermissions ∪ userOverride.allow) − userOverride.deny
   (userOverride is per-user-per-tenant, client-modeled today,
   unbacked by any endpoint — see BACKEND_CONTRACT.md §5)

4. if the call site is branch-scoped:
     branchAccess = union of branchAccess across membership.roles
                    (scope:'all' wins if any role grants it)
     if branchAccess.scope !== 'all' and branchId not in branchAccess.branchIds: DENY

5. ALLOW
```

Frontend code touches only step 2's inputs (`roles`) and step 5's output
(`permissions.includes(x)`) — it never re-derives *what* a role means.

## 6. What "Understanding Context" Means at Each Layer

| Question | Answered by | Where |
|---|---|---|
| Who is this user? | `useAuthStore.user` | Set once at login/getMe, unrelated to tenant/branch |
| Which tenant? | `useTenantStore.tenant` (subdomain-resolved) | `TenantBootstrapper`, `src/providers/index.tsx` |
| Which membership applies? | `currentTenantSession` (selected via `normalizeTenantPermissions()`'s priority: `activeMembership` → tenantId match → sole entry → deny) | `src/services/permission.service.ts` |
| What can they do? | `currentTenantSession.permissions` | `usePermission()`, `PermissionGuard` |
| Where can they do it? | `currentTenantSession.branchAccess` + `useBranchStore.selectedBranch` | `useBranchAccess()`, `canAccessBranch()` |
| Is this actually enforced, or just UI? | **Only the backend enforces.** Every frontend check listed above is UX/defense-in-depth (explicitly documented at each check's own definition) | See `BACKEND_CONTRACT.md`'s "Authorization responsibility" notes on every endpoint |
