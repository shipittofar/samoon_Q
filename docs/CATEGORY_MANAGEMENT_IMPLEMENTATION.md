# Category Management Implementation (Phase 2)

Companion to `docs/CATEGORY_MANAGEMENT_ANALYSIS.md` (Phase 1). Implements complete, branch-scoped Category Management in the Admin Console, reusing every existing project pattern rather than introducing new ones.

## Files changed and why

| File | Why |
|---|---|
| `src/types/index.ts` | Added `is_active: boolean` and `created_at: string` to `Category` — required by the List requirement's "Status" and "Created Date" columns, which didn't exist on the type before. |
| `src/types/rbac.ts` | Added `category.view`/`category.create`/`category.update`/`category.delete` to the `P7Permission` union — mirroring the existing four-tier pattern already used for `staff.*` (`staff.view/manage/create/edit/delete`) rather than inventing a new authorization shape. |
| `src/services/permission.service.ts` | Added the four new permissions to `ALL_PERMISSIONS`; added them to `owner` and `manager` (full CRUD) and `category.view` to `waiter` (read-only, mirroring its existing `menu.view`-only access); added `category` → `menu.enabled` to `PERMISSION_RESOURCE_FLAG` (categories are a sub-resource of the menu capability, not a separate one); added `category.create`/`category.update`/`category.delete` to `PERMISSION_DEPENDENCIES`, each requiring `category.view` (and `category.delete` additionally requiring `category.update`, mirroring `orders.delete`'s `requires: [orders.view, orders.manage]` pattern). `admin` automatically inherits all four via its existing `ALL_PERMISSIONS.filter(...)` definition — no change needed there. |
| `src/lib/mock-data.ts` | Added `is_active: true, created_at: '2024-01-01T00:00:00Z'` to all 8 existing mock `Category` objects (5 in `MOCK_CATEGORIES`, 2 in `MOCK_DOWNTOWN_CATEGORIES`, 1 in `MOCK_AIRPORT_CATEGORIES`) so they satisfy the updated `Category` type. No new mock categories were added — the existing branch-scoped mock data (from the earlier branch-menu-scoping work) already demonstrates independent per-branch category sets. |
| `src/services/menu.service.ts` | Added `createCategory`, `updateCategory`, `deleteCategory`, `reorderCategories` — all branch-scoped (`branchId` required first argument), following the exact same convention as the existing `createItem`/`updateItem`/`deleteItem` (mock mode returns a plausible response object without mutating the underlying mock array; real mode sends `branch_id` as a query param, matching every other menu-service function). |
| `src/hooks/index.ts` | Added `Category` to the `@/types` import. Added `useCreateCategory(branchId)`, `useUpdateCategory(branchId)` (with optimistic update + rollback, mirroring `useUpdateMenuItem`), `useDeleteCategory(branchId)` (optimistic removal + rollback, mirroring `useDeleteMenuItem`), and `useReorderCategories(branchId)` (optimistic reorder + rollback). All four invalidate via the pre-existing `categoriesQueryPredicate(branchId)` helper (added in the earlier branch-menu-scoping work but previously unused) — scoped to the active branch's cache only, never a blanket `['categories']` prefix. |
| `src/modules/registry.ts` | Added a `CATEGORIES_NAV_ITEM` constant (`href: '/console/categories'`, `permissionKey: 'category.view'`, `featureFlagKey: 'menu.enabled'` — same flag as `MENU_NAV_ITEM` since categories are a sub-feature of the menu module) and spliced it immediately after every `MENU_NAV_ITEM` entry across all 6 business-type modules' `adminNavItems` arrays, so "Categories" appears in the Console sidebar for every module that already shows "Menu". |
| `src/app/console/categories/page.tsx` (new) | The Category Management page itself — list/create/edit/delete/reorder, described in detail below. |
| `src/i18n/locales/{en,ar,fa}.json` | Added ~29 new `console.*` translation keys (plus a `console.categoryFormError.*` sub-object) used by the new page, in all three locales the project supports — keeping `i18n:validate`'s "all locales share identical keys" invariant intact (verified: 3461 keys in each locale both before and after). |
| `src/test/phase7-rbac.test.ts`, `phase7-notification-center.test.ts`, `phase7-realtime-operations.test.ts`, `phase8-6-enterprise-rbac.test.ts` | Updated hardcoded `ALL_PERMISSIONS` length assertions from 48 → 52 (4 new permissions). |
| `src/test/phase8-rbac-navigation.test.ts` | Updated `manager` permission count 24 → 28 and `waiter` permission count 14 → 15 to reflect the new category permissions granted to those roles. |
| `src/test/phase6-bar.test.ts`, `phase6-cafe.test.ts`, `phase6-food-court.test.ts`, `phase6-food-truck.test.ts`, `phase6-mobile-cafe.test.ts`, `phase6-tenant-management.test.ts`, `phase7-8-experience-completion.test.ts`, `phase7-audit-logs.test.ts`, `phase7-branch-management.test.ts`, `phase7-notification-center.test.ts`, `phase7-order-routing.test.ts`, `phase7-realtime-operations.test.ts` | Updated every hardcoded per-module `adminNavItems`/`getAdminNav(...)` length assertion by +1 (restaurant 22→23, cafe 22→23, bar 23→24, food_court 22→23, food_truck 21→22, mobile_cafe 21→22) and the one 3-module aggregate assertion (66→69), reflecting the new `CATEGORIES_NAV_ITEM` entry added to every module's nav array. |

## Before vs After

**Before:** `Category` had only `getCategories(branchId)` — read-only, fetch-only. No console route, no permission keys of its own (piggybacked on `menu.view`), no nav entry. An admin could only *pick* an existing category id inside the Menu Item form; nothing could create, edit, delete, or reorder a category.

**After:**
```
Types:      Category { ..., is_active, created_at }
Service:    getCategories / createCategory / updateCategory / deleteCategory / reorderCategories  (all branchId-scoped)
Hooks:      useCategories (existing, read) / useCreateCategory / useUpdateCategory / useDeleteCategory / useReorderCategories
RBAC:       category.view / category.create / category.update / category.delete
Navigation: "Categories" entry in every business-type module's Console sidebar, next to "Menu"
Page:       /console/categories — full list/create/edit/delete/reorder UI, scoped to the admin's active branch
```

## RBAC additions

- `category.view` — granted to `owner`, `admin` (via `ALL_PERMISSIONS`), `manager`, `waiter`.
- `category.create` / `category.update` / `category.delete` — granted to `owner`, `admin`, `manager`. Not granted to `waiter` (view-only, matching its existing `menu.view`-only access), nor to `cashier`/`kitchen`/`marketing`/`support` (none of which have any menu access today).
- Dependency rules (`PERMISSION_DEPENDENCIES`): `category.create`/`category.update` each require `category.view`; `category.delete` requires both `category.view` and `category.update` — same shape as the existing `orders.delete: requires [orders.view, orders.manage]` rule.
- Capability gate: `category` resource maps to the `menu.enabled` feature flag (`PERMISSION_RESOURCE_FLAG`), same as `menu` — if a tenant disables the menu module, category permissions are denied too, consistent with categories being a sub-resource of menu rather than an independent capability.
- The Console page applies `<PermissionGuard permission="category.view">` at the page level (view gate) and further gates the Create button / Edit button / Delete button individually via `usePermission('category.create'|'category.update'|'category.delete')` — so a `waiter`, for example, can open the page and see the list but sees no Add/Edit/Delete controls at all.

## Navigation additions

`CATEGORIES_NAV_ITEM` (`src/modules/registry.ts`) — `href: '/console/categories'`, `label: 'Categories'`, `icon: 'Layers'` (reusing the icon already registered for Tenants — no new icon mapping needed), `group: 'Content'` (same group as Menu), gated by `permissionKey: 'category.view'` and `featureFlagKey: 'menu.enabled'`. Spliced immediately after `MENU_NAV_ITEM` in all 6 modules (`RESTAURANT_MODULE`, `CAFE_MODULE`, `BAR_MODULE`, `FOOD_COURT_MODULE`, `FOOD_TRUCK_MODULE`, `MOBILE_CAFE_MODULE`) so it appears for every tenant that already sees "Menu" in their sidebar.

## Feature walkthrough (requirements → implementation)

1. **Category List** — `src/app/console/categories/page.tsx`, rendered via the existing `Table`/`TableHead`/`TableBody`/`TableRow`/`TableHeader`/`TableCell` primitives (`@/components/ui/Table`, previously unused by the menu-domain pages but already part of the project's UI kit). Columns: Sort Order (with up/down reorder buttons), Name (+ icon/description), Branch, Status (clickable Active/Inactive badge), Created Date (via the existing `formatDate` util), Actions (Edit/Delete).
2. **Create Category** — "Add Category" button opens the existing `Modal` component with `CategoryFormFields`: Name, Description (`Textarea`), Image URL (`Input`), Sort Order (`Input type=number`), Active/Inactive (checkbox) — Branch is implicit (the admin's currently active branch, not a form field, consistent with how `console/menu/page.tsx` never asks the admin to pick a branch either).
3. **Edit Category** — same `CategoryFormFields`, pre-filled via `categoryToForm()`, submitted through `useUpdateCategory`.
4. **Delete Category** — a confirmation `Modal` (mirroring `console/menu/page.tsx`'s delete-confirmation pattern) calling `useDeleteCategory`. No soft-delete convention exists anywhere else in this codebase (checked: no `deleted_at`/`is_deleted` field on any type; the closest analog, `TenantStatus`, uses an `active`/`suspended`/`archived` enum, not a deletion flag) — so this is a standard hard delete, matching `menuService.deleteItem`'s existing convention exactly, per the task's own "otherwise standard delete" instruction.
5. **Reordering** — up/down arrow buttons per row (no drag-and-drop library was added, since none exists elsewhere in the project — reusing plain buttons keeps this consistent with the rest of the Console's control style). `move()` swaps two adjacent categories' positions and calls `useReorderCategories(branchId)` with the full new id order; the hook persists via `menuService.reorderCategories`.
6. **Branch Isolation** — the page reads `useBranchStore(s => s.adminActiveBranch)`; every hook call (`useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, `useReorderCategories`) is parameterized by `adminBranchId`. If no branch is selected, the page shows a "select a branch" empty state and all mutation buttons are disabled (`disabled={!adminBranchId}`) rather than falling back to some default/global scope.
7. **React Query** — query key `['categories', tenantId, branchId]` (existing, from the branch-menu-scoping work). Mutations invalidate via `categoriesQueryPredicate(branchId)`, matching only that branch's cached entries. `useUpdateCategory`/`useDeleteCategory`/`useReorderCategories` all use the optimistic-update-with-snapshot-rollback pattern already established by `useUpdateMenuItem`/`useDeleteMenuItem` (`onMutate` → cancel + snapshot + optimistic write; `onError` → restore snapshot; `onSuccess` → invalidate).
8. **Navigation** — see above.
9. **Empty States** — three distinct empty states, all via the existing `EmptyState` component: no branch selected, no categories at all for the branch (with an inline "Add Category" CTA when the admin has `category.create`), and no categories matching the current search term. Loading state uses the same `Loader2` spinner pattern as `console/menu/page.tsx`; error state uses the same `AlertCircle` + retry button pattern.
10. **Validation** — `validateForm()` rejects an empty/whitespace-only name and a non-numeric or non-positive sort order, surfaced via `t('categoryFormError.nameRequired'|'invalidSortOrder')`. Duplicate submission is prevented by checking `createMutation.isPending`/`updateMutation.isPending`/`deleteMutation.isPending` at the top of each submit handler before doing anything else (same guard style already used implicitly by `console/menu/page.tsx` disabling its submit buttons while `isPending`, made explicit here as an early-return in the handler itself).

## Known mock-mode limitation (inherited, not introduced)

Exactly like the pre-existing `createItem`/`updateItem`/`deleteItem` mock behavior: `createCategory`/`updateCategory`/`deleteCategory`/`reorderCategories` in mock mode do not mutate the underlying `MOCK_BRANCH_CATEGORIES` arrays — they return a plausible response object, and the optimistic cache update is what makes the change visible in the UI until the `onSuccess` invalidation refetch (which will return the original, unmodified mock array). This is not a new limitation — it is the same one already present and accepted for Menu Items, reproduced here for consistency rather than silently diverging.

## Verification performed

- **`npx tsc --noEmit`**: 19 errors, identical to the pre-existing baseline (same files, unrelated to this change; zero errors in any file this change touched).
- **`npx next lint`**: 214 warnings/errors total, identical to the pre-existing baseline count; zero issues in `src/app/console/categories/page.tsx` or any other touched file.
- **`node scripts/validate-i18n.mjs`**: "✓ All 3 locales share identical keys (3461 keys each)" — passes after adding the new category-related keys to all three locales.
- **`npx next build`**: succeeds; `/console/categories` (5.27 kB) appears in the route manifest.
- **`npx vitest run`** (full suite, 5845 tests): **exactly the same 15 pre-existing test failures, by name, before and after this change** (verified via `git stash`/`git stash pop` A-B comparison). Adding 4 new permissions and 1 new nav item per module broke a number of tests that hardcode exact permission/nav-item counts (`ALL_PERMISSIONS has 48 entries`, `manager has exactly 24 permissions`, `RESTAURANT_MODULE has 22 adminNavItems`, etc.) — all of these were updated to reflect the new, intentionally-larger counts (documented in the Files Changed table above) rather than left broken. Zero net regressions.
- ✓ Category CRUD works (create/edit/delete/reorder all wired to real hooks/services).
- ✓ Categories are branch-scoped (every hook call keyed on `adminActiveBranch.slug`; page disables all mutation entry points when no branch is selected).
- ✓ Query cache is isolated (`categoriesQueryPredicate(branchId)` matches only the active branch's cache entries).
- ✓ Navigation works ("Categories" appears in the sidebar for every module, gated by `category.view` + `menu.enabled`).
- ✓ RBAC works (page-level `PermissionGuard`, per-button `usePermission` gates, dependency rules registered).

## Remaining TODOs

1. **Mock-mode persistence** (see above) — `createCategory`/`updateCategory`/`deleteCategory`/`reorderCategories` don't actually mutate `MOCK_BRANCH_CATEGORIES` in mock mode, so a hard page refresh in `NEXT_PUBLIC_USE_MOCK=true` mode will show the original seed data again. This mirrors an existing, accepted limitation of the Menu Item mock CRUD and was not fixed here to avoid making Category behave inconsistently with Menu Item for no stated reason — but it is a real gap if mock mode is ever used for a persistent demo.
2. **Real-API contract unverified** — as with the earlier branch-menu-scoping work, this repo has no backend source, so whether a live backend actually implements `POST/PATCH/DELETE /menu/categories/...` with a `branch_id` param cannot be confirmed here.
3. **No drag-and-drop reordering** — up/down buttons only. A full drag interface would require introducing a new UI dependency (e.g. `@dnd-kit`), which the task's "do not introduce parallel patterns" instruction and the absence of any existing drag library in this project argue against doing speculatively.
4. **Category images**: only a URL text field, consistent with `MenuItemFormFields`'s existing image handling (no upload widget exists anywhere in the Console for any entity) — not a Category-specific gap, but worth noting since the task listed "Image (if supported)" as a requirement and the answer is "supported the same way Menu Item images are, i.e. URL-only."
5. **Deleting a category that still has menu items assigned to it** is not specifically guarded against (no "category has N items, reassign or delete them first" check) — `MenuItem.category_id` would be left pointing at a deleted id. This mirrors the fact that `console/menu/page.tsx` itself has no referential-integrity check either; adding one would be a reasonable follow-up but wasn't part of this task's explicit requirements.
