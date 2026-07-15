# Extras Management — Pre-Implementation Analysis (Phase 1)

Scope: frontend only, read-only inspection before any code changes.

## 1. Where Extras currently exist

`Extra` (`src/types/index.ts:85-90`):
```ts
export interface Extra {
  id: string
  name: string
  price: number
  available: boolean
}
```
Nested inline under `MenuItem.extras?: Extra[]` (`src/types/index.ts`, near line 108) — there is **no standalone `ExtraGroup` concept anywhere in the codebase**. Extras are just a flat array property of a menu item.

Consumers, confirmed by direct inspection:
- `src/components/menu/FoodDetailModal.tsx:15,35,50-51,55-65,198-208` — reads `item.extras: Extra[]`, renders a flat toggle list, accumulates `selectedExtras: Extra[]`, passes them to `addItem(item, quantity, selectedExtras, notes)`.
- `src/components/cart/CartDrawer.tsx:36-38` — reads `item.extras.map(e => e.name)` for a cart-line summary string.
- `src/stores/index.ts` (`useCartStore.addItem`) — stores `extras: Extra[]` directly on `CartItem`, computing `extraTotal = extras.reduce((sum, e) => sum + e.price, 0)`.
- `src/services/order.service.ts`, `src/app/checkout/page.tsx`, `src/app/order/[orderId]/page.tsx` — all read `OrderItem.extras: Extra[]` the same flat way.
- `src/lib/mock-data.ts` — every `MOCK_MENU_ITEMS` entry with extras embeds them inline, e.g. `extras: [{ id: 'e1', name: 'Extra Cheese', price: 2.50, available: true }]`.

## 2. How Extras are loaded

They are **not loaded independently at all** — there is no `getExtras`/`useExtras` anywhere. Extras only ever arrive as a side effect of fetching a `MenuItem` (`menuService.getItems`/`getItem`), embedded in that item's `extras` field.

## 3. How Extras are attached to Menu Items

Directly and only via the inline `extras: Extra[]` array on the `MenuItem` object itself — there is no join table, no `group_id`, no many-to-many relationship of any kind. An extra "belongs" to exactly the one menu item whose literal array it's written into; the same conceptual extra (e.g. "Extra Cheese") is duplicated by hand across multiple items in mock data (`e1` appears verbatim in several `MOCK_MENU_ITEMS` entries) rather than referenced from a shared collection.

## 4. Whether Extras are branch-scoped

**No.** `Extra` has no `branch_id` field. Since extras only exist nested inside `MenuItem.extras`, and `MenuItem` itself only became branch-scoped in the earlier branch-menu-scoping pass (`MenuItem.branch_id`), an extra's branch is only implicit — through whichever branch-scoped item happens to embed it — never a first-class, independently queryable property.

## 5. Which APIs already exist

None. `src/services/menu.service.ts` has no `getExtras`, `createExtra`, `updateExtra`, `deleteExtra`, or any group-level function. The only place "extras" appears in the service is a pass-through default inside `createItem`'s mock branch (`extras: payload.extras ?? []`, consumer-supplied, never independently fetched).

## 6. Which types already exist

Only `Extra` (§1). No `ExtraGroup`, no selection-rule type (required/optional, single/multi-choice, min/max), no assignment type linking a menu item to a set of groups.

## 7. Which UI already exists

None in the Console. `FoodDetailModal.tsx` (customer-facing) is the only UI that renders extras at all, and it is a flat, unconditional multi-select toggle list — no grouping, no required/optional distinction, no min/max enforcement of any kind. `src/app/console/menu/page.tsx`'s `MenuItemFormFields` has no extras field whatsoever (confirmed in the earlier Console audit).

## 8. What's missing

Everything needed for real Extras Management:
- An `ExtraGroup` type carrying branch ownership, selection rules (required/optional, single/multiple choice, min/max selection), sort order, and active/inactive status.
- Branch ownership on `Extra` itself, plus a `group_id` linking it to its owning group.
- A full CRUD service layer for both groups and extras, branch-scoped like every other menu-domain service function.
- Branch-scoped, `tenantId`+`branchId`-keyed React Query hooks with optimistic updates, mirroring the Category Management hooks added in the prior pass.
- RBAC permissions (`extras.view/create/update/delete`) — currently nonexistent; extras have no permission key at all today, unlike Category which at least piggybacked on `menu.view`.
- A Console navigation entry and a dedicated `/console/extras` page (list/search/filter/create/edit/delete/assignment UI/empty/loading/error states).
- A way for the Menu Item editor to attach/detach Extra Groups and preview what's assigned.
- A resolution path from "admin assigns Groups X and Y to Item Z" to "customer sees Item Z's flattened, active extras in `FoodDetailModal`" — without changing the shape `FoodDetailModal`/`CartDrawer`/checkout/`useCartStore` already consume (`MenuItem.extras: Extra[]`, `CartItem.extras: Extra[]`), so none of those files need to change and Checkout/Cart continue to work unmodified.

## Design decision carried into Phase 2 (stated up front, not invented mid-implementation)

To avoid introducing a duplicate/parallel model and to keep Checkout/Cart working without modification:
- `Extra.group_id` and `Extra.branch_id` are added as **optional** fields, not required. Existing inline extras embedded in mock `MenuItem.extras` arrays (e.g. `e1`–`e9`) remain valid `Extra` objects with no group — they are legacy/materialized data, exactly as they are today. Only extras created through the new Extra Groups admin flow will have both fields populated.
- `MenuItem.extra_group_ids?: string[]` is added as an **optional** assignment field — "zero, one, or many" groups per item is naturally expressed by an empty/short/long array, and omitting it entirely (as every existing mock item does today) means "zero groups," which is valid per the requirements.
- When an admin attaches/detaches groups on the Menu Item editor, the mutation additionally re-materializes that item's flat `extras: Extra[]` field from the active extras across all currently-assigned groups — the same value shape `FoodDetailModal`/cart/checkout already read. This is the same "service computes what the client already expects" pattern already used elsewhere (e.g. `PaginatedResponse` wrapping), not a new architecture.
