# Frontend Menu ↔ Tenant ↔ Branch Architecture Audit

Scope: **frontend only** (`/home/user/samoon_Q/src`). The backend is treated as an opaque HTTP endpoint; nothing below assumes or infers backend behavior — only what the frontend code actually sends and does with responses.

# Executive Summary

The frontend has real, working tenant and branch state (`useTenantStore`, `useBranchStore`), but that state is **not wired into the menu data-fetching path**. `menuService` functions (`src/services/menu.service.ts`) take no tenant/branch argument, and the endpoints they call (`src/services/endpoints.ts:17-27`) are flat, unparameterized URLs. Tenant id is read only to build a React Query cache key (`src/hooks/index.ts:612-667`); branch id is not used anywhere in the menu hooks. There is no `Menu` type in the frontend type system — `Category` and `MenuItem` are the only menu-domain types, and neither carries a tenant or branch field (`src/types/index.ts:69-111`). The codebase also carries two structurally different types both named `Branch` (`src/types/index.ts:374-396` vs `src/types/branch.ts:51-66`), plus a third ad-hoc branch shape read out of `Tenant.settings.marketplace.branches[]`. A concrete cache-key inconsistency exists between server-side prefetch (`src/app/menu/page.tsx:50,54` uses `['categories']` / `['menu-items', undefined]`) and the client hook (`src/hooks/index.ts:615,625` uses `['categories', tenantId]` / `['menu-items', tenantId, filters]`) — these keys never match, so server-prefetched data is silently discarded and refetched on the client.

# Current Frontend Architecture

- **Framework:** Next.js 15 App Router, TypeScript, Zustand (state), TanStack React Query (server-state cache), Axios (HTTP client).
- **Routing:** two parallel menu routes exist — a tenant-agnostic `src/app/menu/page.tsx` (server component, prefetches via React Query) and a context-aware `src/app/[tenantSlug]/[branchSlug]/menu/page.tsx` (client component wrapper). Both render the same `MenuContent` component.
- **Tenant resolution:** `src/middleware.ts` derives a tenant slug from the request's subdomain (prod) or `NEXT_PUBLIC_TENANT_SLUG` env var (dev) and injects an `x-tenant-slug` header on the **incoming Next.js request** only.
- **Branch resolution:** no middleware-level branch resolution exists. Branch comes from the `[branchSlug]` route segment (read by page components, not threaded to children) or from `useBranchStore`/`usePublicBranch`.

# Domain Model

All types are TypeScript interfaces in `src/types/`; there is no runtime validation layer (no Zod schemas found guarding these shapes in the menu path).

| Concept | File | Key fields | Tenant/Branch link |
|---|---|---|---|
| `Tenant` | `src/types/index.ts:316-348` | `id, slug, settings?: Record<string, unknown>` | n/a (is the tenant) |
| `Location` / `Branch` (legacy alias) | `src/types/index.ts:374-396` | `id, tenant_id? (optional), name, slug` | optional `tenant_id` |
| `Branch` (P7.3 admin) | `src/types/branch.ts:51-66` | `id, tenantId (required), name, slug, location` | required `tenantId` |
| `PublicBranchInfo` | `src/types/marketplace.ts` (embedded, read via `usePublicBranch`) | branch fields nested in `tenant.settings.marketplace.branches[]` | implicit — nested under the Tenant object |
| `Category` | `src/types/index.ts:69-78` | `id, name, slug, order` | **none** |
| `MenuItem` | `src/types/index.ts:87-111` | `id, category_id, name, price, extras?: Extra[]` | **none** — only `category_id` |
| `Extra` | `src/types/index.ts:80-85` | `id, name, price, available` | **none** — nested inline in `MenuItem.extras`, never fetched independently |
| `Menu` | — | does not exist | n/a |

**Observation:** `Category`/`MenuItem`/`Extra` form a self-contained, flat domain with one internal FK (`MenuItem.category_id → Category.id`). No type in this domain references `Tenant` or any `Branch` variant.

# Runtime Data Flow

Traced end to end, both menu routes converge on `MenuContent`:

```
Route (/menu  OR  /[tenantSlug]/[branchSlug]/menu)
  ↓
Middleware (src/middleware.ts)
  — resolves tenant slug from subdomain/env, sets x-tenant-slug on the
    Next.js request only (line 84-86). Runs on every non-static route
    (matcher at line 109-117). Does NOT resolve or attach branch.
  ↓
Layout / Page
  — src/app/menu/page.tsx: server component; prefetches
    ['categories'] and ['menu-items', undefined] (lines 49-56) — note:
    these prefetch keys omit tenantId entirely.
  — src/app/[tenantSlug]/[branchSlug]/menu/page.tsx: client component;
    reads no tenantSlug/branchSlug props itself and passes nothing to
    MenuContent (lines 19-27) — the comment at lines 3-6 asserts
    "Context ... is initialized by the parent layout," but MenuContent
    receives no props at all, so that context can only reach it via
    global store reads, not via this route tree.
  ↓
Providers
  — QueryClientProvider / HydrationBoundary wraps the tree (not
    inspected in depth here; relevant point is that hydration keys must
    match client keys, and per the note above they do not for /menu).
  ↓
Stores
  — useTenantStore (src/stores/index.ts:223-312): holds `tenant`,
    hydrated by `loadTenant(slug)` → tenantService.getTenant(slug).
  — useBranchStore (src/stores/index.ts:315-335): holds `activeBranch`
    (public) / `adminActiveBranch` (admin), set independently by
    BranchSelector/AdminBranchSwitcher components (not by the menu route).
  ↓
Hooks
  — MenuContent.tsx (lines 65-66) reads tenantName/branchName from both
    stores, but only to compose a page heading string (lines 144-148).
  — useCategories()/useMenuItems() (src/hooks/index.ts:612-629) each
    independently call `useTenantStore((s) => s.tenant?.id)` to build a
    React Query cache key; useBranchStore is never read inside these hooks.
  ↓
Services
  — menuService.getCategories()/getItems(filters) (src/services/menu.service.ts:22-73)
    accept no tenant/branch parameter and build no such param internally.
  ↓
Axios
  — src/services/axios.instance.ts:58-75 interceptor attaches only
    `Authorization: Bearer <token>` and, for unsafe methods, a CSRF
    header (CSRF_HEADER from a cookie). No tenant/branch header is
    attached here.
  ↓
API Request
  — GET /menu/categories/, GET /menu/items/?<MenuFilters> — carry no
    tenant or branch identifier of any kind (path, query, or header).
```

**Where tenant/branch context enters:** at the store layer (`loadTenant`, `BranchSelector`/`AdminBranchSwitcher` writes to `useBranchStore`) and, for tenant only, at the middleware layer (header on the page request).

**Where it disappears:** at the hook boundary. `useTenantStore`'s `tenant.id` survives only into the React Query **cache key**, not into the request. `useBranchStore`'s `activeBranch` never enters the menu hooks at all — it stops at `MenuContent`'s heading-text usage (`MenuContent.tsx:65-66,144-148`). Nothing from either store reaches `menuService`, `axios`, or the outgoing HTTP request.

# Store Architecture

- **`useTenantStore`** (`src/stores/index.ts:223-312`) — Zustand store with `persist` middleware (localStorage key `TENANT_KEY`, only `tenant` field persisted per `partialize` at line 309). Owns: `tenant`, `tenantState` (lifecycle: loading/ready/fallback), `rbacInitialized`, `featureFlagsInitialized`, `featureFlags`. This is the single owner of tenant state in the frontend.
- **`useBranchStore`** (`src/stores/index.ts:315-335`) — separate Zustand store, persisted (key `BRANCH_KEY`, entire state persisted — no `partialize`). Owns: `activeBranch: Branch | null` (public/customer-facing, uses the legacy `Location`-aliased `Branch` type) and `adminActiveBranch: AdminBranch | null` (admin console, a third, distinct type). This is the single owner of branch state, but it is split into two parallel fields using two different type shapes for what the comments describe as "public" vs "admin" branch context (`src/stores/index.ts:316-322`).
- **React Query** — not a source of truth for tenant/branch identity; it only consumes `tenant?.id` from `useTenantStore` as a cache-partitioning value (`src/hooks/index.ts:612-667`). Branch is not used in any query key in the menu hooks.
- **Context (React Context API):** not used for tenant/branch in the menu path — no `TenantContext`/`BranchContext` provider was found wrapping `MenuContent`; propagation is via Zustand global stores instead.
- **Route params:** `[tenantSlug]`/`[branchSlug]` are read by the page component (`src/app/[tenantSlug]/[branchSlug]/menu/page.tsx`) but not forwarded as props to `MenuContent` — confirmed by reading the full file (lines 1-27): the component renders `<MenuContent />` with zero props.

**Answers to the assignment's specific questions:**
- **Which object owns tenant state?** `useTenantStore` (`src/stores/index.ts:268-312`) — sole owner.
- **Which object owns branch state?** `useBranchStore` (`src/stores/index.ts:325-335`) — sole owner, split across two fields/types.
- **Does menu state depend on tenant?** Only for cache partitioning (`queryKey: ['categories', tenantId]`), not for the actual request. So: partially/cosmetically yes, functionally no.
- **Does menu state depend on branch?** No — verified no menu hook or service reads `useBranchStore` at all.

# Service Layer

`src/services/menu.service.ts` (full file inspected):

| Function | Tenant param? | Branch param? | Location param? | Menu id param? |
|---|---|---|---|---|
| `getCategories()` | No | No | No | No (no such concept) |
| `getItems(filters?: MenuFilters)` | No | No | No | No |
| `getItem(id)` | No | No | No | No |
| `getFeatured()` | No | No | No | No |
| `getPopular()` | No | No | No | No |
| `getRelated(id)` | No | No | No | No |
| `search(query)` | No | No | No | No |
| `createItem(payload)` | No | No | No | No |
| `updateItem(id, payload)` | No | No | No | No |
| `deleteItem(id)` | No | No | No | No |

`MenuFilters` (`src/services/menu.service.ts:9-19`) only supports `category, search, min_price, max_price, min_rating, available, sort, page, page_size` — no tenant/branch/location/menu field exists in the filter type either.

**Where context is lost:** the loss point is the **hook layer**, not the service. `useCategories`/`useMenuItems` (`src/hooks/index.ts:612-629`) do hold `tenantId` (read from `useTenantStore`) in scope, but they pass it only into `queryKey`, never into the `queryFn` call to `menuService`. The service was never designed to accept it in the first place (its function signatures have no such parameters), so even if a hook tried to pass it, there is no service-layer parameter to receive it.

# React Query Layer

All menu queries, from `src/hooks/index.ts`:

| Hook | queryKey | queryFn | Tenant-aware? | Branch-aware? |
|---|---|---|---|---|
| `useCategories()` (612-620) | `['categories', tenantId]` | `menuService.getCategories()` | Key only | No |
| `useMenuItems(filters)` (622-629) | `['menu-items', tenantId, filters]` | `menuService.getItems(filters)` | Key only | No |
| `useMenuItem(id)` (631-638) | `['menu-item', id]` | `menuService.getItem(id)` | No | No |
| `useFeaturedItems()` (640-647) | `['featured-items', tenantId]` | `menuService.getFeatured()` | Key only | No |
| `useRelatedItems(id)` (649-657) | `['related-items', tenantId, id]` | `menuService.getRelated(id)` | Key only | No |
| `useMenuSearch(query)` (659-667) | `['menu-search', tenantId, query]` | `menuService.search(query)` | Key only | No |
| `useCreateMenuItem()` (1565-1574) | mutation; invalidates `['menu-items']`, `['categories']` | `menuService.createItem` | No (partial-key invalidation) | No |
| `useUpdateMenuItem()` (1576-1600) | mutation; optimistic update over `['menu-items']`, invalidates `['menu-items']`, `['menu-item', id]` | `menuService.updateItem` | No | No |

**Cache isolation:** `tenantId` is appended to most read-query keys, so switching tenants (client-side) does partition the cache correctly for those hooks — but since `queryFn` never sends `tenantId` to the server, two different tenants' cache entries would only actually differ in content if the backend independently varies its response per session/auth, which this repo cannot confirm.

**Cache-key inconsistency (concrete bug, not speculation):** the server prefetch in `src/app/menu/page.tsx:49-56` uses:
```ts
queryClient.prefetchQuery({ queryKey: ['categories'], queryFn: () => menuService.getCategories() })
queryClient.prefetchQuery({ queryKey: ['menu-items', undefined], queryFn: () => menuService.getItems() })
```
while the client hooks use `['categories', tenantId]` and `['menu-items', tenantId, filters]`. Because `tenantId` is truthy whenever a real tenant is loaded, and `filters` is a populated object (not `undefined`) once `MenuContent` builds its filters (`MenuContent.tsx:80-90`), **these keys never match**. The `HydrationBoundary` dehydration/rehydration therefore does not serve the prefetched data to the client query — `useCategories`/`useMenuItems` will report a cache miss and refetch, defeating the stated purpose of the prefetch ("so `useCategories()` / `useMenuItems()` do not issue duplicate requests on first client render," per the file's own header comment at lines 7-9).

**Invalidation:** `useCreateMenuItem`'s `invalidateQueries({ queryKey: ['menu-items'] })` (line 1570) is a **prefix match** in React Query — it invalidates every `['menu-items', <any tenantId>, <any filters>]` entry currently cached, i.e. across all tenants whose data happens to be cached client-side, not just the active tenant's.

**Branch awareness:** zero — no query key or invalidation call in the menu domain references branch state.

# Component Tree

```
src/app/menu/page.tsx  (server)                    src/app/[tenantSlug]/[branchSlug]/menu/page.tsx (client)
        │                                                          │
        │  prefetch ['categories'], ['menu-items', undefined]      │  no props read/forwarded
        ▼                                                          ▼
   HydrationBoundary  ──────────────┐          ┌──── ErrorBoundary + Suspense
        │                           │          │
        └──────────────► MenuContent (src/components/menu/MenuContent.tsx) ◄──────┘
                                │
                ┌───────────────┼────────────────────────────┐
                │               │                             │
        useTenantStore   useBranchStore                 useCategories() / useMenuItems(filters)
        (name only)      (name only)                     (src/hooks/index.ts:612-629)
                                                                │
                                                          menuService.getCategories()/.getItems()
                                                          (src/services/menu.service.ts)
                                                                │
                                                          axios instance (src/services/axios.instance.ts)
                                                                │
                                                          GET /menu/categories/, /menu/items/
        │
        ├── TenantHeader, Footer, CartDrawer, FloatingCart (layout/cart, unrelated to menu scoping)
        ├── FoodCard × N (renders each MenuItem, reads item.extras inline)
        └── LazyFoodDetailModal (renders selected MenuItem detail, including extras)
```

Every component under `MenuContent` receives `MenuItem`/`Category` objects already resolved client-side; none of them re-derive or re-check tenant/branch — the entire tree trusts whatever the two hooks returned.

# Architecture Problems

- **Tight coupling:** `MenuContent.tsx` directly imports and calls both `useTenantStore` and `useBranchStore` (lines 16, 65-66) purely for a heading string, coupling a menu-display component to two unrelated global stores rather than receiving that data as props or through a narrower hook.
- **Missing abstraction:** there is no `useMenuContext()`/`useActiveMenuScope()` hook that unifies "which tenant/branch am I browsing" into one value the menu hooks or service could consume — each hook independently re-derives `tenantId` from the store (repeated in 5 separate hooks, `src/hooks/index.ts:612-667`).
- **Duplicate models:** two incompatible `Branch` interfaces (`src/types/index.ts:374-396` and `src/types/branch.ts:51-66`), plus a third representation (`PublicBranchInfo` nested in `Tenant.settings`). `branch.service.ts:8-9` documents the split itself, which is itself an admission of unresolved technical debt.
- **Circular/hidden dependencies:** none observed directly in the menu domain (no import cycles found), but there is a **hidden dependency**: `usePublicBranch` (`src/hooks/index.ts:1953-1965`) resolves "branch" data by fetching `Tenant` and reaching into its `settings` blob — a caller reading `branch.service.ts` alone would not discover this alternate branch-resolution path exists.
- **Leaky abstraction:** `menuService`'s `USE_MOCK` branches (`src/services/menu.service.ts:23-26,32-67,76-81,...`) embed mock-data filtering logic (category/search/price/rating filtering) directly in the service layer, duplicating what the (unseen) backend presumably also does — a leak of business logic into what should be a thin HTTP client.
- **Global state misuse:** `useBranchStore`'s `activeBranch`/`adminActiveBranch` are read by `MenuContent` even though the actual `useMenuItems`/`useCategories` calls do not use branch at all — the component silently implies branch-scoped data ("branch menu" heading, `MenuContent.tsx:144-148`) that isn't actually being fetched per-branch, which is misleading to a reader of the UI.
- **Multiple representations of the same entity:** `Branch` (×2 types) and, separately, the fact that "Menu" has no representation at all — it is implicitly "whatever `/menu/categories/` + `/menu/items/` return," which is itself an inconsistent, unnamed concept compared to how explicitly `Tenant`/`Branch` are modeled.
- **Cache inconsistencies:** the `/menu/page.tsx` prefetch-key vs. hook-key mismatch documented in the React Query section above is a concrete, provable defect — SSR prefetching silently does nothing useful for the client hydration path.
- **Missing ownership boundaries:** no field or hook anywhere establishes "this Category/MenuItem belongs to tenant X / branch Y" — ownership is simply unmodeled in the frontend's menu domain.
- **Violation of Single Responsibility:** `MenuContent.tsx` (500 lines) combines search/filter/sort UI state, category tab UI, dietary-tag filters, cart badge count, recently-viewed rendering, and the tenant/branch heading logic all in one client component with no sub-hook extraction (e.g., no `useMenuFilters()` hook) — mixing presentation state, business filtering, and cross-cutting tenant/branch display concerns in a single file.
- **Violation of Separation of Concerns:** `menuService` mixes real HTTP calls and full mock-data business logic (filtering/sorting) behind one `USE_MOCK` flag inside the same functions, rather than isolating mock behavior behind a separate implementation swapped at a higher level.

# Technical Debt

1. Two colliding `Branch` type definitions need consolidation (`src/types/index.ts:374-396` vs `src/types/branch.ts:51-66`), acknowledged in-code (`branch.service.ts:8-9`) but unresolved.
2. `src/app/menu/page.tsx` server prefetch keys do not match client query keys — the prefetch currently provides no benefit and should either drop the tenant/filters dimension consistently or be updated to compute matching keys.
3. `menuService`/`useMenuItems`/`useCategories` have no branch parameter or branch-aware cache key despite `useBranchStore` and branch-scoped routes (`[tenantSlug]/[branchSlug]/menu`) existing elsewhere in the app — the route implies per-branch menus are a design intent that the data layer does not fulfill.
4. `useCreateMenuItem`'s broad `invalidateQueries({ queryKey: ['menu-items'] })` invalidates all cached tenants' entries rather than just the active tenant's.
5. Mock-data filtering logic embedded inside `menuService` duplicates real backend logic assumptions and will drift as filters evolve, since it's hand-maintained in two places (mock branch vs. real branch) inside the same file.

# Recommendations

*(Recommendations — not implemented, offered as direction only.)*

- Introduce a single `useActiveMenuScope()` hook that reads `tenantId`/`branchId` once from the stores and returns a stable `{ tenantId, branchId }` object; have all menu hooks depend on that hook instead of independently reading `useTenantStore` five separate times.
- Extend `MenuFilters` (or add a companion `MenuScope` type) with explicit `branchId`, and thread it through `menuService` functions and their query keys, so branch, not just tenant, participates in cache partitioning and (if the backend supports it) in the actual request.
- Fix the `src/app/menu/page.tsx` prefetch keys to exactly mirror the client hook's key shape (including `tenantId` and the same `filters`/`undefined` convention) so SSR prefetching is not silently wasted.
- Consolidate the two `Branch` interfaces into one canonical type, or clearly rename them (e.g. `LegacyBranch` vs `AdminBranch`) so the shared name `Branch` stops implying interchangeability.
- Extract `MenuContent.tsx`'s filter/sort/search state into a dedicated `useMenuFilters()` hook to separate UI state management from data-fetching and presentation.
- Scope `invalidateQueries` calls in menu mutations to the specific `tenantId` (and, if introduced, `branchId`) rather than the bare `['menu-items']` prefix.
