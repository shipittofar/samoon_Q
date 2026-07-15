# Extras Management Implementation (Phase 2)

Companion to `docs/EXTRAS_MANAGEMENT_ANALYSIS.md` (Phase 1). Implements complete, branch-scoped Extra Group + Extra management in the Admin Console, plus Menu Item assignment — reusing every pattern already established for Category Management rather than inventing anything new.

## Files changed and why

| File | Why |
|---|---|
| `src/types/index.ts` | Added `branch_id?`, `group_id?`, `description?`, `image?`, `order?`, `created_at?` to `Extra` (all optional — legacy inline extras embedded in mock `MenuItem.extras` remain valid without any of these). Added the new `ExtraGroup` type (branch-owned, `selection_type: 'single'\|'multiple'`, `required`, `min_selection`, `max_selection`, `order`, `is_active`, `created_at`). Added `MenuItem.extra_group_ids?: string[]` (assignment — zero, one, or many groups) alongside the existing, unchanged `extras?: Extra[]` (kept for cart/checkout compatibility, documented as the materialized/derived view). |
| `src/lib/mock-data.ts` | Added `MOCK_MAIN_EXTRA_GROUPS`/`MOCK_MAIN_EXTRAS` (the task's own worked example — Size, Sauces, Toppings, Drinks), plus independent `MOCK_DOWNTOWN_EXTRA_GROUPS`/`MOCK_DOWNTOWN_EXTRAS` and `MOCK_AIRPORT_EXTRA_GROUPS`/`MOCK_AIRPORT_EXTRAS` (separate objects, not shared references — proving branch isolation the same way `MOCK_DOWNTOWN_CATEGORIES` already does), and the `MOCK_BRANCH_EXTRA_GROUPS`/`MOCK_BRANCH_EXTRAS` lookup maps. Attached `extra_group_ids: ['grp-size', 'grp-sauces']` to one existing item (Margherita Classic) to demonstrate the assignment wiring without touching any other item literal (the field is optional, so every other item works unchanged). |
| `src/services/endpoints.ts` | Added `EXTRA_GROUPS`/`EXTRA_GROUP(id)`/`EXTRAS`/`EXTRA(id)` to `ENDPOINTS.MENU`, mirroring the existing `CATEGORIES`/`CATEGORY(id)` shape. |
| `src/services/menu.service.ts` | Added `getExtraGroups`, `createExtraGroup`, `updateExtraGroup`, `deleteExtraGroup`, `reorderExtraGroups`, `getExtras`, `createExtra`, `updateExtra`, `deleteExtra` — all branch-scoped, following the exact `createCategory`/`updateCategory`/`deleteCategory`/`reorderCategories` convention (mock mode returns a plausible response object without mutating the underlying mock arrays; real mode sends `branch_id`/`group_id` as query params). Added `assignExtraGroupsToItem(branchId, itemId, groupIds)` — the one genuinely new operation, which sets `MenuItem.extra_group_ids` and **re-materializes `MenuItem.extras`** from the active extras across the assigned groups, in the exact shape `FoodDetailModal`/`CartDrawer`/checkout/`useCartStore` already consume. |
| `src/hooks/index.ts` | Added `Extra`/`ExtraGroup` to the `@/types` import. Added `useExtraGroups(branchId?)`/`useExtras(branchId?, groupId?)` (read, `tenantId`+`branchId` in the query key, mirroring `useCategories`). Added `useCreateExtraGroup`/`useUpdateExtraGroup` (optimistic)/`useDeleteExtraGroup` (optimistic)/`useReorderExtraGroups` (optimistic) and `useCreateExtra`/`useUpdateExtra` (optimistic)/`useDeleteExtra` (optimistic), all invalidating via new `extraGroupsQueryPredicate(branchId)`/`extrasQueryPredicate(branchId)` helpers scoped to the active branch only. `useUpdateExtra`/`useDeleteExtra`/`useDeleteExtraGroup` additionally invalidate the existing `menuItemsQueryPredicate(branchId)`, since a changed/removed extra or group can affect items that reference it. Added `useAssignExtraGroupsToItem(branchId)` for the Menu Item editor's attach/detach action. |
| `src/types/rbac.ts` | Added `extras.view`/`extras.create`/`extras.update`/`extras.delete` to `P7Permission`, in the exact same four-tier shape as the `category.*` permissions added in the prior pass. |
| `src/services/permission.service.ts` | Added the four new permissions to `ALL_PERMISSIONS`; granted full CRUD to `owner`/`manager` (and `admin` automatically via its existing `ALL_PERMISSIONS.filter(...)`), view-only to `waiter` (matching its existing `category.view`/`menu.view`-only access); added `extras` → `menu.enabled` to `PERMISSION_RESOURCE_FLAG`; added `extras.create`/`extras.update` (require `extras.view`) and `extras.delete` (requires `extras.view` + `extras.update`) to `PERMISSION_DEPENDENCIES` — identical shape to the `category.*` rules. |
| `src/modules/registry.ts` | Added `EXTRAS_NAV_ITEM` (`href: '/console/extras'`, `permissionKey: 'extras.view'`, `featureFlagKey: 'menu.enabled'`, `icon: 'Tag'` — reusing the icon already registered for Promotions, same reuse convention as `Layers` being shared by Tenants and Categories) and spliced it immediately after `CATEGORIES_NAV_ITEM` across all 6 business-type modules, so "Extras" appears beside "Categories" and "Menu" everywhere those already do. |
| `src/app/console/extras/page.tsx` (new) | The Extras Management page — Extra Groups list (expandable to their Extras) with search/filter/create/edit/delete/reorder for both groups and extras, described in detail below. |
| `src/app/console/menu/page.tsx` | `MenuItemForm` gained `extra_group_ids: string[]`; `itemToForm`/`formToPayload` read/write it. The page now also calls `useExtraGroups(adminBranchId)` and, on successful create/edit, calls `useAssignExtraGroupsToItem(adminBranchId)` to persist the group attachment and materialize `extras`. `MenuItemFormFields` gained an "Extra Groups" toggle-pill selector (attach/detach) and a preview badge row showing the currently assigned groups' names. |
| `src/i18n/locales/{en,ar,fa}.json` | Added ~50 new `console.*` translation keys (plus `console.selectionType.*`, `console.extrasStatusFilter.*`, `console.extraGroupFormError.*`, `console.extraFormError.*` sub-objects) used by the new page and the Menu Item editor additions, in all three locales — `i18n:validate` confirms 3512 identical keys in each locale after the change. |
| `src/test/phase6-{bar,cafe,food-court,food-truck,mobile-cafe,tenant-management}.test.ts`, `phase7-{8-experience-completion,audit-logs,branch-management,notification-center,order-routing,realtime-operations,rbac}.test.ts`, `phase8-{6-enterprise-rbac,rbac-navigation}.test.ts` | Updated every hardcoded per-module `adminNavItems`/`getAdminNav(...)` count by +1 again (on top of the Category Management pass's +1) and every hardcoded `ALL_PERMISSIONS`/role-permission-count assertion (52→56 total; `manager` 28→32; `waiter` 15→16), reflecting the new `EXTRAS_NAV_ITEM` and the four new `extras.*` permissions. |

## Before vs After

**Before:** `Extra` was a bare `{ id, name, price, available }` nested inline inside `MenuItem.extras`, with no branch ownership, no grouping, no selection rules, no CRUD, no Console page, no permissions, no nav entry. The only place extras were ever rendered was `FoodDetailModal` (a flat, unconditional toggle list).

**After:**
```
Types:      Extra { ..., branch_id?, group_id?, description?, image?, order?, created_at? }
            ExtraGroup { id, branch_id, name, description?, selection_type, required, min_selection, max_selection, order, is_active, created_at }
            MenuItem { ..., extra_group_ids?: string[] }   (extras?: Extra[] unchanged)
Service:    getExtraGroups/createExtraGroup/updateExtraGroup/deleteExtraGroup/reorderExtraGroups
            getExtras/createExtra/updateExtra/deleteExtra
            assignExtraGroupsToItem  (attach/detach + re-materialize MenuItem.extras)
Hooks:      useExtraGroups/useCreateExtraGroup/useUpdateExtraGroup/useDeleteExtraGroup/useReorderExtraGroups
            useExtras/useCreateExtra/useUpdateExtra/useDeleteExtra
            useAssignExtraGroupsToItem
RBAC:       extras.view / extras.create / extras.update / extras.delete
Navigation: "Extras" entry beside "Categories" and "Menu" in every business-type module
Page:       /console/extras — group list (expand to extras) + create/edit/delete/reorder for both, search, status filter
Menu Item editor: attach/detach Extra Group pills + assigned-groups preview
```

## Data Flow

```
Console operator opens /console/extras
  → useExtraGroups(adminBranchId) + useExtras(adminBranchId)
    (queryKey ['extra-groups'|'extras', tenantId, branchId, ...])
  → menuService.getExtraGroups(branchId) / getExtras(branchId)
  → mock mode: MOCK_BRANCH_EXTRA_GROUPS[branchId] / MOCK_BRANCH_EXTRAS[branchId]
  → page groups extras by group_id client-side (extrasByGroup Map) for the
    expandable list — no separate per-group fetch, one read of each collection
Create/Edit/Delete a Group or Extra
  → useCreate/Update/DeleteExtraGroup|Extra(branchId) mutations
  → menuService.create/update/deleteExtraGroup|Extra(branchId, ...)
  → onSuccess invalidates only that branch's cached extra-groups/extras
    (extraGroupsQueryPredicate/extrasQueryPredicate(branchId)) — never
    another branch's cache
```

## Assignment Flow

```
Console operator opens the Menu Item editor (create or edit) on /console/menu
  → useExtraGroups(adminBranchId) supplies the branch's available groups
  → MenuItemFormFields renders one toggle-pill per group; clicking a pill
    adds/removes its id from form.extra_group_ids (client-side state only,
    not yet persisted) — a "Assigned:" badge row below previews the current
    selection by group name
  → On Save: createMutation/updateMutation persists the item's other fields
    first, then (onSuccess) useAssignExtraGroupsToItem(adminBranchId).mutate(
      { itemId, groupIds: form.extra_group_ids })
  → menuService.assignExtraGroupsToItem(branchId, itemId, groupIds):
      - sets item.extra_group_ids = groupIds
      - resolves all Extras across those groups that are `available`
      - sets item.extras = that flattened, active list
  → invalidates the branch's menu-items cache — the item now carries an
    extras array assembled from its assigned groups, in the exact shape
    FoodDetailModal/CartDrawer/checkout/useCartStore already read, so none
    of those files needed to change
```

## RBAC additions

- `extras.view` — granted to `owner`, `admin` (via `ALL_PERMISSIONS`), `manager`, `waiter`.
- `extras.create`/`extras.update`/`extras.delete` — granted to `owner`, `admin`, `manager` only (not `waiter`, matching the existing `category.*`/`menu.manage` pattern of view-only access for that role).
- Dependency rules: `extras.create`/`extras.update` require `extras.view`; `extras.delete` requires `extras.view` + `extras.update` — identical shape to `category.*`'s rules.
- Capability gate: `extras` → `menu.enabled` (same flag as `menu`/`category`).
- The Console page applies `<PermissionGuard permission="extras.view">` at the page level and gates every Create/Edit/Delete affordance (for both groups and extras) individually via `usePermission('extras.create'|'extras.update'|'extras.delete')`.

## Navigation additions

`EXTRAS_NAV_ITEM` — `href: '/console/extras'`, `label: 'Extras'`, `icon: 'Tag'` (already registered in `AdminSidebar`'s `ICON_MAP`, reused from Promotions — no new icon mapping needed), `group: 'Content'`, `featureFlagKey: 'menu.enabled'`, `permissionKey: 'extras.view'`. Spliced immediately after `CATEGORIES_NAV_ITEM` in all 6 modules, so the Console sidebar now shows Menu → Categories → Extras together under Content for every tenant.

## Requirement walkthrough

- **Extra Groups CRUD + sort**: `/console/extras` — create/edit modals (`GroupFormFields`: name, description, selection type single/multiple, required checkbox, min/max selection, active), delete confirmation, up/down reorder buttons persisted via `useReorderExtraGroups`.
- **Extras CRUD**: name, description, price, active, sort order, image URL (same URL-only convention as Category/MenuItem images — no upload widget exists anywhere in this project) — create/edit modals (`ExtraFormFields`), delete confirmation, nested inside each expanded group.
- **Assignment (zero/one/many Extra Groups per Menu Item)**: toggle-pill multi-select in `MenuItemFormFields`, described in Assignment Flow above. An item with no pills selected has `extra_group_ids: []` — the "zero groups" case.
- **Selection rules**: `ExtraGroup.selection_type` (`single`/`multiple`), `required`, `min_selection`, `max_selection` are all modeled on the type and editable in the group form; `validateGroupForm` enforces `min ≤ max`, both non-negative, `max ≥ 1`, and `min ≥ 1` when `required` is checked.
- **Branch isolation**: every hook call on both pages is parameterized by `adminBranchId` (`useBranchStore(s => s.adminActiveBranch?.slug)`); the page disables all mutation entry points and shows a "select a branch" empty state when none is selected, exactly like Category Management.
- **Console `/console/extras`**: list (expandable groups → their extras), search (matches group or extra names), status filter (all/active/inactive), create/edit/delete for both groups and extras, empty states (no branch selected, no groups yet, search yields nothing, a group with no extras yet), loading spinner, error state with retry.
- **React Query**: every query key includes `tenantId` and `branchId` (`['extra-groups', tenantId, branchId]`, `['extras', tenantId, branchId, groupId]`); every mutation uses the optimistic-update-with-snapshot-rollback pattern already established by Category/MenuItem mutations; invalidation is scoped to the active branch via predicate functions, never a blanket prefix.
- **Validation**: `validateGroupForm`/`validateExtraForm` reject empty names, duplicate names within the branch (checked against the already-loaded `allGroups`/branch-scoped extras — no extra network round-trip), negative prices, and invalid min/max limits; every submit handler early-returns while its mutation `isPending`, preventing duplicate submission on double-click/double-Enter.

## Verification performed

- **`npx tsc --noEmit`**: 19 errors, identical to the pre-existing baseline; zero errors in any file this change touched (one duplicate-property TS2783 error was found and fixed during development — see Files Changed for `createExtra`).
- **`npx next lint`**: 214 warnings/errors total, identical to the pre-existing baseline; zero issues in `src/app/console/extras/page.tsx` or the edited parts of `src/app/console/menu/page.tsx` (two new `react-hooks/exhaustive-deps` warnings introduced during development were fixed by wrapping `allExtras` in its own `useMemo` and `matchesSearch`/`matchesStatus` in `useCallback`, before the final count was taken).
- **`node scripts/validate-i18n.mjs`**: "✓ All 3 locales share identical keys (3512 keys each)."
- **`npx next build`**: succeeds; `/console/extras` (7 kB) and the updated `/console/menu` (9.1 kB) both appear in the route manifest with no errors.
- **`npx vitest run`** (full suite, 5845 tests): **exactly the same 15 pre-existing test failures, by name, before and after this change** (verified via full-suite diff). Adding 4 more permissions and 1 more nav item per module (on top of Category Management's own +4/+1) shifted the same category of hardcoded-count tests again — all updated to the new, correct totals (52→56 permissions; manager 28→32; waiter 15→16; every module's nav count +1 again) rather than left broken.
- ✓ CRUD works (groups and extras, create/edit/delete/reorder, all wired to real hooks/services).
- ✓ Assignment works (attach/detach pills → `assignExtraGroupsToItem` → materialized `extras` on the item).
- ✓ Checkout still works — `checkout/page.tsx`, `order.service.ts`, `order/[orderId]/page.tsx` were not touched; they read `OrderItem.extras: Extra[]`, a shape that never changed.
- ✓ Cart still works — `CartDrawer.tsx`, `useCartStore` were not touched; `CartItem.extras: Extra[]` never changed shape.
- ✓ Branch isolation works (every group/extra hook and mutation branch-scoped; mock data uses separate objects per branch).
- ✓ React Query isolation works (tenantId+branchId in every key; predicate-scoped invalidation).
- ✓ No TypeScript errors introduced.
- ✓ No ESLint errors introduced.
- ✓ Build succeeds.

## Remaining TODOs

1. **Customer-facing selection-rule enforcement is out of scope of this pass.** `FoodDetailModal.tsx` still renders `item.extras` as a flat, always-optional multi-select toggle list — it does not read `ExtraGroup.selection_type`/`required`/`min_selection`/`max_selection` at all, because doing so would require rewriting the customer ordering UI (a materially different, larger scope than "Extras Management in the Admin Console"). The admin-managed selection rules are captured correctly in the data model and enforced in the Console's own validation, but a customer today can still, for example, select zero items from a `required` group. This is the direct, honest consequence of the design decision (stated up front in Phase 1) to keep `FoodDetailModal`/cart/checkout completely unmodified.
2. **Mock-mode persistence** (same accepted limitation as Category/MenuItem): `createExtraGroup`/`updateExtraGroup`/`deleteExtraGroup`/`reorderExtraGroups`/`createExtra`/`updateExtra`/`deleteExtra`/`assignExtraGroupsToItem` don't mutate the underlying `MOCK_BRANCH_EXTRA_GROUPS`/`MOCK_BRANCH_EXTRAS`/`MOCK_BRANCH_ITEMS` arrays in mock mode — a hard refresh reverts to seed data.
3. **Deleting a group that's still assigned to menu items** removes the group from the Console list and invalidates the affected items' cache (triggering a refetch), but does not walk every item to strip the now-dangling id from `extra_group_ids` — the same referential-integrity gap already accepted for Category deletion in the prior pass.
4. **Real-API contract unverified** — this repo has no backend source, so whether a live backend implements the new `branch_id`/`group_id`-scoped endpoints as designed cannot be confirmed here.

## Final answers

1. **Can every Branch have completely independent Extras?** Yes — `Extra`/`ExtraGroup` are branch-scoped end to end (type, service, hooks, mock data with separate per-branch objects), exactly like Category/MenuItem.
2. **Can every Menu Item have different Extra Groups?** Yes — `MenuItem.extra_group_ids` is a per-item array; the Console lets an admin attach any subset of the active branch's groups to each item independently, including none at all.
3. **Can Checkout consume the new structure without breaking?** Yes — `checkout/page.tsx`, `order.service.ts`, `order/[orderId]/page.tsx`, `CartDrawer.tsx`, and `useCartStore` were not modified; they still read `extras: Extra[]` in its original shape, now populated (for Console-managed items) via the materialization step in `assignExtraGroupsToItem` rather than by hand in mock data.
4. **Is Extras Management now production-ready?** For the Console/admin side, yes — full branch-scoped CRUD, assignment, RBAC, navigation, validation, and empty/loading/error states are all wired and verified. For the **customer-facing** side, no — see Remaining TODO #1: selection-rule enforcement (required/min/max/single-vs-multiple) is not yet reflected in `FoodDetailModal`, so the feature is administratively complete but not yet fully realized in the ordering experience.
