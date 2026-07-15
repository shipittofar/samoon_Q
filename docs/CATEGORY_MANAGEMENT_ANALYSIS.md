# Category Management — Pre-Implementation Analysis (Phase 1)

Scope: frontend only, read-only inspection before any code changes. This restates and extends the Category findings from `docs/CONSOLE_ARCHITECTURE_AUDIT.md` with the specific detail needed to implement Category Management correctly.

## 1. How Categories are currently loaded

`src/app/console/menu/page.tsx:100-101` calls `useCategories(adminBranchId)` (`adminBranchId = useBranchStore(s => s.adminActiveBranch?.slug)`), which resolves to `menuService.getCategories(branchId)` (`src/services/menu.service.ts:31-40`). In mock mode this returns `MOCK_BRANCH_CATEGORIES[branchId] ?? MOCK_BRANCH_CATEGORIES.main` (`src/lib/mock-data.ts`). On the customer side, `useCategories(branchId)` is also called from `MenuContent.tsx`, `BranchHomepageClient.tsx`, and `TenantHomepageClient.tsx` — all read-only.

## 2. Which APIs already exist

`src/services/menu.service.ts` has exactly one Category-related function: `getCategories(branchId: string): Promise<Category[]>` (line 31). There is no `createCategory`, `updateCategory`, `deleteCategory`, or any reorder function.

## 3. Which hooks already exist

`src/hooks/index.ts:628-637` has exactly one Category hook: `useCategories(branchId?)` (read). There is no `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, or reorder hook. However, two building blocks already exist that a Category mutation layer can reuse directly:
- `useActiveBranchId()` (`hooks/index.ts:619-621`) — resolves the customer-facing active branch slug.
- `categoriesQueryPredicate(branchId)` (`hooks/index.ts`, defined alongside `menuItemsQueryPredicate` for the Menu Item mutations) — already matches only `['categories', tenantId, branchId]`-shaped queries for a given branch, and is currently unused by anything (it was added when `useCreateMenuItem` was scoped, to also invalidate categories, but nothing invalidates it from a category-specific mutation since none exist yet).

## 4. Which types already exist

`src/types/index.ts:69-79`:
```ts
export interface Category {
  id: string
  branch_id: string
  name: string
  slug: string
  description?: string
  image?: string
  icon?: string
  order: number
  items_count?: number
}
```
`branch_id` (required) was added in the earlier branch-menu-scoping work. There is **no status/active field** and **no created-date field** — both are required by this task's List requirements ("Status", "Created Date") and don't exist yet.

## 5. Which pages consume categories

- `src/app/console/menu/page.tsx` — read-only: category filter pills (lines 200-211) and a `<select>` of `category_id` inside `MenuItemFormFields` (lines 417-427). No create/edit/delete/reorder UI.
- `src/components/menu/MenuContent.tsx`, `src/app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx`, `src/app/[tenantSlug]/TenantHomepageClient.tsx` — all read-only, customer-facing.
- No `src/app/console/categories/**` route exists.

## 6. How categories relate to Branches

`Category.branch_id: string` is a required field (added in the branch-menu-scoping pass). `menuService.getCategories(branchId)` and mock lookup `MOCK_BRANCH_CATEGORIES[branchId]` both key strictly by branch. There is no tenant-level or global category collection — every category array in mock data (`MOCK_CATEGORIES`/`MOCK_DOWNTOWN_CATEGORIES`/`MOCK_AIRPORT_CATEGORIES`) is its own independent array per branch.

## 7. Whether categories are already branch-scoped

**Yes, for reads.** `useCategories(branchId)` requires a resolved branch id (`enabled: !!scopedBranchId`) and its query key is `['categories', tenantId, branchId]`. There is no write path yet, so branch-scoping has never been exercised for mutations — this analysis and the implementation that follows must preserve that same scoping discipline for create/update/delete/reorder.

## 8. What functionality is missing

- No `createCategory`/`updateCategory`/`deleteCategory`/reorder functions in `menu.service.ts`.
- No corresponding hooks in `hooks/index.ts`.
- No dedicated Console page/route for Category management (list/create/edit/delete/reorder).
- No `Category.is_active` (status) or `Category.created_at` field.
- No `category.*` permission keys in `P7Permission` (`src/types/rbac.ts`) — Category currently piggybacks on `menu.view`.
- No "Categories" entry in Console navigation (`src/modules/registry.ts`) — only "Menu" exists, which doesn't lead to any category management surface.
- No validation (empty name, duplicate submission guard) exists anywhere for categories, since no create/edit form exists yet.

## Conventions this implementation must follow (confirmed from existing code, not invented)

- **RBAC pattern**: two-tier `resource.view`/`resource.manage` is the norm (`menu.view`/`menu.manage`, `branches.view`/`branches.manage`), but a four-tier `view/create/edit/delete` pattern already exists for `orders.*` and `staff.*` (`src/types/rbac.ts:29-34,68-72`) with a `PERMISSION_DEPENDENCIES` entry making each mutating permission `requires: [resource.view, ...]` (`src/services/permission.service.ts:695-736`). Since the task explicitly asks for `category.view/create/update/delete`, this four-tier pattern (mirroring `staff.*`) is the correct one to reuse — not a new pattern.
- **Mock CRUD persistence**: existing `menuService.createItem`/`updateItem`/`deleteItem` mock branches do **not** mutate the underlying `MOCK_MENU_ITEMS`/`MOCK_BRANCH_ITEMS` arrays — they return a plausible response object and rely on the caller's optimistic cache update for visible feedback, with the following `invalidateQueries` refetch reverting to the still-unmodified mock array. This is a pre-existing limitation of mock mode, not something introduced here; the Category service/hooks will follow the identical convention for consistency rather than silently fixing it (which would make Category behave differently from Menu Item for no stated reason).
- **UI pattern**: `console/menu/page.tsx` uses `Modal`/`Button`/`Input`/`Textarea`/`Badge` from `@/components/ui` and `PermissionGuard`/`AccessDenied` for guarding — the same components will be reused for Category management, no new modal/form library.
- **Navigation pattern**: `src/modules/registry.ts` defines one `const X_NAV_ITEM = { href, label, icon, group, featureFlagKey?, permissionKey }` per feature and splices it into each business-type's `adminNavItems` array — a `CATEGORIES_NAV_ITEM` will be added the same way, gated on the same `menu.enabled` feature flag as `MENU_NAV_ITEM` (categories are a sub-feature of the menu module, not a separate capability).
