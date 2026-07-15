# Branch-Scoped Menu Implementation (Phase 2)

Frontend-only implementation making Categories/MenuItems/Extras/Featured/Popular/Search/Related-items independent per branch. Backend is out of scope and untouched — this repo has no backend source (see docs/BRANCH_MENU_ANALYSIS.md).

## Identity key used for "branch"

The public-facing branch type (`PublicBranchInfo`, `src/types/marketplace.ts`) has no `id` field — only `slug`. To keep one consistent identity across the three coexisting Branch representations (`Location`/`Branch` alias, P7.3 `Branch`, `PublicBranchInfo`), every layer below scopes on **branch `slug`**, passed around under the parameter name `branchId` for readability. This is a deliberate, documented choice — not an oversight.

## Files changed and why

| File | Why |
|---|---|
| `src/types/index.ts` | Added required `branch_id: string` to `Category` and `MenuItem` (matching the existing `Order.branch_id` convention already in this file), and to `CartItem` so cart isolation is provable at the type level. |
| `src/lib/mock-data.ts` | Tagged every existing mock `Category`/`MenuItem` with `branch_id: 'main'` (preserves current behavior for every tenant's default branch). Added `MOCK_DOWNTOWN_CATEGORIES/ITEMS` and `MOCK_AIRPORT_CATEGORIES/ITEMS` — genuinely independent objects (not shared references) for `tenant-samoon-01`'s other two branches — plus `MOCK_BRANCH_CATEGORIES`/`MOCK_BRANCH_ITEMS` lookup maps keyed by branch slug, defaulting unlisted branches to `main`'s data so every other single-branch tenant keeps working unchanged. |
| `src/services/menu.service.ts` | Every function (`getCategories`, `getItems`, `getItem`, `getFeatured`, `getPopular`, `getRelated`, `search`, `createItem`, `updateItem`, `deleteItem`) now takes `branchId` as its first argument. Mock mode resolves branch-specific arrays via the new lookup maps. Real-API mode sends `branch_id` as a query param (GET/DELETE) or payload field (POST/PATCH) — the same "extra param" convention already used for `filters`. |
| `src/hooks/index.ts` | Added `useActiveBranchId()` (reads `useBranchStore(s => s.activeBranch?.slug)`). Every menu-read hook (`useCategories`, `useMenuItems`, `useMenuItem`, `useFeaturedItems`, new `usePopularItems`, `useRelatedItems`, `useMenuSearch`) now takes an optional `branchId` param, falls back to `useActiveBranchId()`, includes it in the query key, and sets `enabled: !!scopedBranchId` — no hook fetches without a resolved branch. Mutations (`useCreateMenuItem`, `useUpdateMenuItem`, `useDeleteMenuItem`) now *require* `branchId` and invalidate via a `predicate` function (`menuItemsQueryPredicate`/`categoriesQueryPredicate`) that matches only that branch's cached entries — not a `['menu-items']` prefix that would touch every branch's cache. |
| `src/stores/index.ts` | `useCartStore.addItem` now stamps `branch_id: menuItem.branch_id` on every `CartItem`, and clears the cart first if the item being added belongs to a different branch than what's already in the cart. `useBranchStore.setActiveBranch` now clears the cart whenever the branch actually changes (`previous.slug !== activeBranch.slug`) — switching branches can never carry over another branch's cart. |
| `src/components/menu/MenuContent.tsx` | Accepts an optional `branchId` prop, passed through to `useCategories`/`useMenuItems`; falls back to the store when the caller (e.g. the branch-agnostic `/menu` route) has none. |
| `src/app/[tenantSlug]/[branchSlug]/menu/page.tsx` | Now reads `branchSlug` from route `params` (via `use(params)`, matching this repo's existing convention in `table/[code]/page.tsx`) and passes it to `<MenuContent branchId={branchSlug} />`. |
| `src/app/menu/page.tsx` | Removed the SSR `prefetchQuery`/`HydrationBoundary` scaffolding. This route has no branch segment, so the server cannot resolve a branch to scope a prefetch to; the old prefetch used unscoped keys (`['categories']`, `['menu-items', undefined]`) that never matched the client's keys anyway (a real bug documented in `docs/BRANCH_MENU_ANALYSIS.md`/the earlier frontend audit) — removing it fixes that mismatch rather than perpetuating it. `MenuContent` now resolves its own branch client-side from `useBranchStore`. |
| `src/app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx` | `useCategories()`/`useMenuItems()` → `useCategories(branchSlug)`/`useMenuItems(branchSlug)` — `branchSlug` was already an in-scope prop, just never passed through before. |
| `src/app/[tenantSlug]/TenantHomepageClient.tsx` | Resolves `meta.primaryBranchSlug` (already existed, used elsewhere for CTA links) before the categories/items hooks run, and passes it explicitly — the tenant homepage previews its **primary branch's** menu, not a tenant-wide menu (there is no such thing anymore). |
| `src/app/console/menu/page.tsx` | Reads `useBranchStore(s => s.adminActiveBranch?.slug)` and scopes every read hook and every mutation hook to it. Admins now manage one branch's menu at a time, matching how `AdminBranchSwitcher` already works elsewhere in the console. |
| `src/components/menu/FoodDetailModal.tsx` | `useRelatedItems(item?.id)` → `useRelatedItems(item?.branch_id, item?.id)` — related items are scoped to the *item's own* branch, not whatever branch happens to be active in the store (correct even if a user is somehow viewing a different branch's item). |
| `src/components/home/FeaturedSection.tsx` | Added an optional `branchId` prop threaded into `useFeaturedItems(branchId)`. (This component is currently commented out at its only call site, `src/app/page.tsx:230` — updated for correctness/consistency regardless.) |
| `src/app/dashboard/favorites/page.tsx` | No functional change; added a comment documenting a real, known limitation (see Remaining TODOs). |
| `src/test/phase4-e2e.test.ts`, `phase5-menu-management.test.ts`, `phase4-featured.test.ts`, `phase5-admin-service.test.ts` | Updated direct `menuService.*` calls to pass `'main'` as the branch id, keeping mock-mode test behavior identical. |
| `src/test/phase4-seo.test.ts` | Replaced the SSR-prefetch assertions (which asserted the now-removed `prefetchQuery`/`HydrationBoundary`/`Promise.allSettled` pattern) with an assertion that the route no longer does branch-agnostic prefetching. |
| `src/test/phase5-admin-service.test.ts`, `phase5-menu-management.test.ts` | Updated the mutation-invalidation source-text assertions to check for the new `menuItemsQueryPredicate(branchId)` scoped-invalidation pattern instead of the old blanket `'menu-items'` string match. |

## Architecture before

```
Tenant
Category ──category_id──> MenuItem ──extras[]──> Extra   (flat, global, unscoped)
```
Every branch under every tenant received byte-identical `menuService` responses. No type, service function, hook, or query key carried a branch discriminator.

## Architecture after

```
Tenant
 └── Branch (identified by slug)
       └── Category ──category_id──> MenuItem ──extras[]──> Extra
             (branch_id on Category and MenuItem; Extra inherits scope from its parent MenuItem)
```
Every menu-domain type, service call, hook, query key, and mutation now carries `branch_id`/`branchId`. Two branches under the same tenant can have entirely independent categories, items, prices, availability, featured/popular flags, and extras — proven concretely in mock data via `MOCK_DOWNTOWN_*`/`MOCK_AIRPORT_*`, which are separate objects from `MOCK_CATEGORIES`/`MOCK_MENU_ITEMS`.

## Data flow before

```
Route ([tenantSlug]/[branchSlug]/menu) → MenuContent → useCategories()/useMenuItems()
  → tenantId read for cache key only → menuService.getCategories()/getItems()
  → GET /menu/categories/, /menu/items/  (no branch anywhere)
```

## Data flow after

```
Route ([tenantSlug]/[branchSlug]/menu) → params.branchSlug
  → <MenuContent branchId={branchSlug}>
  → useCategories(branchId)/useMenuItems(branchId, filters)
    (falls back to useBranchStore(s => s.activeBranch?.slug) if branchId is omitted,
     e.g. on the branch-agnostic /menu route)
  → queryKey ['categories', tenantId, branchId] / ['menu-items', tenantId, branchId, filters]
  → menuService.getCategories(branchId)/getItems(branchId, filters)
  → GET /menu/categories/?branch_id=<branchId>, /menu/items/?branch_id=<branchId>&...
  → mock mode resolves MOCK_BRANCH_CATEGORIES[branchId] / MOCK_BRANCH_ITEMS[branchId]
```
Cart: `addItem` stamps `branch_id`; adding an item from a different branch than what's currently in the cart clears the cart first. `setActiveBranch` also clears the cart on an actual branch change. Admin console: scoped to `adminActiveBranch.slug`, with mutations invalidating only that branch's cached queries via a predicate.

## Validation performed

- **`npx tsc --noEmit`**: 19 errors before and after this change, in the exact same pre-existing files (`RegisterData`/OTP-related test files untouched by this work) — zero new TypeScript errors, and zero errors in any file this change touched.
- **`npx next lint`**: same pre-existing warnings (all `no-explicit-any`/`no-unused-vars` in files untouched by this work); no lint errors anywhere, none in touched files.
- **`npx vitest run`** (full suite): 15 failing tests before and after, identical test names in both runs (RBAC permission-count/config-studio tests unrelated to menu/tenant/branch) — confirmed via `git stash`/`git stash pop` A-B comparison. All menu/branch/cart-related tests pass, including tests updated in this change to reflect the new scoped-invalidation and no-SSR-prefetch behavior.
- **`npx next build`**: completes successfully; `/menu`, `/console/menu`, and the `[tenantSlug]/[branchSlug]/menu` route all build without error.
- ✓ Branches have independent menus — proven via `MOCK_DOWNTOWN_*`/`MOCK_AIRPORT_*` being separate data from `main`.
- ✓ No shared cache — every query key includes `branchId`; mutations invalidate via a branch-scoped predicate.
- ✓ No stale queries — `enabled: !!scopedBranchId` prevents fetching before a branch is resolved; cart is cleared on a real branch switch.
- ✓ No duplicated models — no new duplicate type introduced; the pre-existing `Branch` type duplication (documented in `docs/BRANCH_MENU_ANALYSIS.md` item 15) was **not** touched in this pass — see Remaining TODOs.
- ✓ No broken pages, no missing imports, no TypeScript errors, no ESLint errors, build passes — all confirmed above.

## Risks

- **`branch_id` == branch `slug`, not a separate opaque id.** If the backend later introduces a numeric/UUID branch id distinct from slug, every call site in this document must be revisited — slug was chosen because it's the only identifier `PublicBranchInfo` actually has today.
- **Real-API mode is unverified against a live backend.** `branch_id` is now sent as a query/payload param on every menu request, but since this repo has no backend source, whether the actual API honors that param cannot be confirmed here — only the mock-mode path (used by `npm run dev`'s `NEXT_PUBLIC_USE_MOCK=true`) is provably correct end-to-end.
- **`useBranchStore.setActiveBranch`'s cart-clearing runs synchronously inside `set()`**, calling `useCartStore.getState().clearCart()` from within another store's action. This is a common Zustand cross-store pattern but does mean `useBranchStore` now has a runtime dependency on `useCartStore`'s module being loaded — acceptable here since both are in the same `src/stores/index.ts` file, but worth flagging if either store is ever split into separate files.

## Remaining TODOs (explicitly out of scope for this pass)

1. **Favorites (`src/app/dashboard/favorites/page.tsx`) are not branch-aware.** `useFavoritesStore` stores bare item ids with no branch association. With menus now branch-scoped, a favorite saved at Branch A will not resolve/display while Branch B is active. Fixing this properly requires storing `{ branchId, itemId }` pairs in the favorites store — a real, separate piece of work not undertaken here.
2. **The two colliding `Branch` type definitions** (`src/types/index.ts:374-396` vs `src/types/branch.ts:51-66`) documented in Phase 1 were not consolidated — this pass only added `branch_id`/scoping to the menu domain, not a rewrite of the branch domain itself.
3. **QR ordering / dine-in flows** reuse the same `MenuContent`/hooks and therefore inherit branch scoping automatically wherever they pass a `branchId`, but no QR-specific route in this repo was found to pass one explicitly beyond what `[tenantSlug]/[branchSlug]/...` routes already provide — worth an explicit audit if a QR flow exists outside that route tree.
4. **The real (non-mock) backend contract for `branch_id`** is unverified, as noted under Risks.
