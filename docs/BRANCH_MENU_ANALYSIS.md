# Branch ↔ Menu Independence Analysis (Phase 1 — Discovery)

Scope: frontend only (`/home/user/samoon_Q/src`). No backend assumptions are made; this document states only what the frontend code does.

## The question

> Does each Branch currently have its own independent Menu, or is there one shared Menu across all branches?

**Answer: there is one shared, global menu. No branch currently has an independent menu.**

## Evidence trace

- **Types have no branch field.** `Category` and `MenuItem` (`src/types/index.ts:69-111`) carry no `branch_id`/`branchId` field. Compare with `Order` in the same file (`src/types/index.ts:195`), which *does* have `branch_id: string` — proving the codebase already has a convention for branch-owned entities, and Menu simply never adopted it.
- **Service layer takes no branch parameter.** Every function in `src/services/menu.service.ts` (`getCategories`, `getItems`, `getItem`, `getFeatured`, `getPopular`, `getRelated`, `search`, `createItem`, `updateItem`, `deleteItem`) has a signature with no `branchId`/`branchSlug`/`locationId` argument.
- **Endpoints are flat and unparameterized.** `src/services/endpoints.ts:17-27` — `/menu/categories/`, `/menu/items/`, etc. — none is a function of branch (contrast with `BRANCHES.DETAIL = (id) => /branches/${id}/`, which *is* parameterized).
- **Hooks read tenant only for the cache key, never branch.** `useCategories`, `useMenuItems`, `useFeaturedItems`, `useRelatedItems`, `useMenuSearch` (`src/hooks/index.ts:612-667`) each call `useTenantStore((s) => s.tenant?.id)` and put it in `queryKey`, then call the corresponding `menuService` function with **no arguments** (or only search/filter arguments). None reads `useBranchStore` at all.
- **Every menu-consuming page/component calls these hooks with zero arguments:**
  - `src/app/menu/page.tsx:50,55` — server prefetch, no branch.
  - `src/app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx:644-645` — `useCategories()`, `useMenuItems()` — called with no arguments **despite `branchSlug` being available as a prop on the same component** (line 640).
  - `src/app/[tenantSlug]/TenantHomepageClient.tsx:804-805` — same pattern, tenant homepage.
  - `src/components/menu/MenuContent.tsx:78,90` — `useCategories()`, `useMenuItems(filters)` — `filters` (`MenuFilters`, `src/services/menu.service.ts:9-19`) has no branch field.
  - `src/app/console/menu/page.tsx:93-94` — admin console — same zero-arg calls.
  - `src/components/home/FeaturedSection.tsx:87` — `useFeaturedItems()`.
  - `src/components/menu/FoodDetailModal.tsx:41` — `useRelatedItems(item?.id || '')` — item id only, no branch.
  - `src/app/dashboard/favorites/page.tsx:21` — `useMenuItems()`.
- **Mock data has no branch dimension.** `src/lib/mock-data.ts:324-330` (`MOCK_CATEGORIES`) and `:333+` (`MOCK_MENU_ITEMS`) are single flat arrays with no `branch_id` field on any record — confirming the mock/dev data model matches the type-level absence of branch scoping.
- **The public "branch" concept used on the customer-facing route doesn't even carry a stable id.** `PublicBranchInfo` (`src/types/marketplace.ts:11-28`) — the type returned by `usePublicBranch(tenantSlug, branchSlug)` (`src/hooks/index.ts:1953-1965`), which is what actually renders on `/{tenantSlug}/{branchSlug}` — has `slug, name, address, city, phone_number, openNow, todayHours, image` but **no `id` field at all**. Even if a `branchId` were introduced, this specific branch representation has nothing but `slug` to serve as one.
- **QR ordering:** no QR-specific menu-fetching code path was found beyond the same `MenuContent`/`useMenuItems`/`useCategories` hooks — QR order flows (dine-in table context) reuse the identical unscoped hooks, so they inherit the same global-menu behavior.
- **Cart:** `CartItem` (`src/types/index.ts:133-141`) has no `branch_id` field, and `useCartStore` (`src/stores/index.ts:79-160`, addItem at 87-117) never reads or stamps any branch identifier onto a cart line. The cart is therefore also branch-unaware — it holds whatever `MenuItem` was added regardless of which branch context it came from.

## Answers

### 1. Can Branch A and Branch B currently have different menu items?

**NO.**

Every branch-scoped page (`BranchHomepageClient.tsx`, the `[tenantSlug]/[branchSlug]/menu` route via `MenuContent`) calls `useCategories()`/`useMenuItems()` with no branch argument. Both branches under the same tenant (and in fact all tenants, modulo `USE_MOCK`/backend branching not inspectable here) resolve to the exact same `menuService.getCategories()`/`getItems()` calls hitting the exact same unparameterized endpoints, returning the exact same `MOCK_CATEGORIES`/`MOCK_MENU_ITEMS` arrays (or, in real-API mode, the same unscoped `GET /menu/items/`). There is no code path by which two different branch route segments could produce two different item sets — the request being made is byte-for-byte identical regardless of which `branchSlug` is in the URL.

### 2. Can Branch A and Branch B currently have different Categories / Menu Items / Prices / Extras / Availability?

**NO — for all five.**

- **Categories:** same `MOCK_CATEGORIES` array / same `GET /menu/categories/` call for every branch (§ evidence above).
- **Menu Items:** same `MOCK_MENU_ITEMS` array / same `GET /menu/items/` call.
- **Prices:** `MenuItem.price` is a single value per item id (`src/types/index.ts:94`); since the same item records are returned everywhere, price cannot differ per branch — there is no per-branch price override field or table.
- **Extras:** `Extra[]` is nested directly inside each `MenuItem` (`src/types/index.ts:108`, `Extra` type at `:80-85`), with no branch field of its own; since the parent `MenuItem` is not branch-scoped, its embedded extras cannot be either.
- **Availability:** `MenuItem.available: boolean` (`:103`) is a single flag on the single shared item record — one boolean, not a per-branch map — so marking an item unavailable at one branch (via `useUpdateMenuItem`, `src/app/console/menu/page.tsx:135`) mutates the one global record used by every branch's queries.

### 3. Where in the frontend does this get prevented?

Every one of these is a place that currently forces a single shared menu; each must change for branch independence:

| # | File / Location | What it does that prevents per-branch menus |
|---|---|---|
| 1 | `src/types/index.ts:69-78` (`Category`) | No `branch_id` field — categories are not ownable by a branch. |
| 2 | `src/types/index.ts:87-111` (`MenuItem`) | No `branch_id` field — items, their price, availability, and featured/popular flags are single global values. |
| 3 | `src/types/index.ts:80-85` (`Extra`) | Nested under a non-branch-scoped `MenuItem`; inherits the same limitation. |
| 4 | `src/types/index.ts:133-141` (`CartItem`) | No `branch_id` — cart cannot distinguish which branch an item was added from. |
| 5 | `src/services/menu.service.ts` (all functions, 22-178) | No branch parameter in any function signature; nothing is sent to differentiate branches. |
| 6 | `src/services/endpoints.ts:17-27` (`MENU`) | Flat, non-parameterized URLs — no `${branchId}` anywhere, unlike `BRANCHES`/`ORDERS` in the same file. |
| 7 | `src/hooks/index.ts:612-667` (`useCategories`, `useMenuItems`, `useFeaturedItems`, `useRelatedItems`, `useMenuSearch`) | Read `tenantId` for the cache key only; never read `useBranchStore`; call `menuService` with no branch argument. |
| 8 | `src/hooks/index.ts:1565-1600, 1833+` (`useCreateMenuItem`, `useUpdateMenuItem`, `useDeleteMenuItem`) | Mutate/invalidate the single global `['menu-items']`/`['categories']` cache keys with no branch dimension — an admin edit at one branch invalidates (and, on the shared backend call, would modify) the same record every branch reads. |
| 9 | `src/components/menu/MenuContent.tsx:78,90` | Calls the above hooks with no branch id even though it is rendered from a branch-scoped route (`[tenantSlug]/[branchSlug]/menu`) that has a `branchSlug` available one level up. |
| 10 | `src/app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx:644-645` | Has `branchSlug` in scope (component prop, line 640) but does not pass it to `useCategories()`/`useMenuItems()`. |
| 11 | `src/app/[tenantSlug]/TenantHomepageClient.tsx:804-805` | Same pattern at the tenant-homepage level. |
| 12 | `src/app/console/menu/page.tsx:93-94` | Admin CRUD reads/writes the same unscoped global collections — no branch selector, no branch field in `formToPayload()` (`:59-73`). |
| 13 | `src/components/home/FeaturedSection.tsx:87`, `src/components/menu/FoodDetailModal.tsx:41`, `src/app/dashboard/favorites/page.tsx:21` | Same zero-argument hook calls, propagating the same shared-menu assumption into featured items, related items, and favorites. |
| 14 | `src/lib/mock-data.ts:324-330,333+` | Mock data itself has no branch dimension — even a hypothetical branch-aware frontend has nothing to filter by in dev/mock mode until this is fixed. |
| 15 | `src/types/marketplace.ts:11-28` (`PublicBranchInfo`) | The type used by the actual customer-facing branch route has no `id` field at all — only `slug` — so any future `branchId` plumbing on this path must standardize on `slug` as the identity key. |

## Conclusion of Phase 1

The frontend, as it exists today, implements **one global menu shared by every tenant/branch combination**. Nothing in the type system, service layer, hook layer, or component tree carries a branch discriminator into a menu request. This is confirmed end-to-end: from route (`[tenantSlug]/[branchSlug]/...`) through to the outgoing `menuService` call, the `branchSlug`/`branchId` value is dropped before it ever reaches `menuService`, `axios`, or the API. Phase 2 must introduce branch identity at every one of the 15 locations listed above, and the identity key adopted must be the branch **slug** (or an id that is always available alongside it), since the public-facing `PublicBranchInfo` type has no other identifier to offer.
