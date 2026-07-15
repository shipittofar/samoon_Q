# Admin Console Architecture Audit

Scope: frontend only (`/home/user/samoon_Q/src`), read-only inspection — no code was modified to produce this report. All findings are cited to exact files/lines.

# Executive Summary

The Console is complete and well-wired for **Tenants** (create/list/status/detail) and mostly complete for **Branches** (create/list/status/detail), but it has **no dedicated management surface for Categories or Extras at all**, and **Branch edit/delete are unimplemented in the UI** despite the update hook/service existing as dead code. The platform's stated hierarchy — Tenant → Branch → Category → Menu Item → Extras — is only fully manageable down to Menu Item; Category can only be *selected* (not created/edited/deleted/reordered) from inside the Menu Item form, and Extra has zero admin tooling anywhere in the codebase — it is a read/consume-only object on the customer ordering side. RBAC coverage is broad (48/50 console pages guarded) but Category/Extra have no permission keys of their own, and the Menu page uses a single `menu.view` guard for both viewing and mutating, with the more restrictive `menu.manage` permission defined but never actually applied to any page.

# Console Structure

Full route tree (`src/app/console/**/page.tsx`), 51 pages total. Grouped by domain:

- **Platform**: `tenants/`, `tenants/new/`, `tenants/[slug]/`, `branches/`, `branches/new/`, `branches/[id]/`, `branches/[id]/analytics/`, `branches/analytics/`, `audit-logs/`, `audit-logs/[id]/`
- **People**: `staff/`, `staff/[id]/`, `permissions/`, `permissions/[userId]/`, `permissions/simulator/`, `roles/`, `roles/new/`, `users/`, `users/[id]/`
- **Content**: `menu/`, `reviews/`, `website/`, `loyalty/`, `promotions/`, `promotions/[id]/`
- **Operations**: `orders/`, `orders/[id]/`, `kitchen/`, `reservations/`, `reservations/[id]/`, `operations/`
- **Customers**: `customers/`, `customers/[id]/`, `customers/[id]/reviews/`
- **Analytics**: `analytics/`
- **System**: `settings/`, `settings/configuration/`, `settings/configuration/[moduleId]/`, `settings/feature-flags/`, `notifications/`, `notifications/[id]/`
- **Business-type modules**: `bar/events/`, `bar/happy-hour/`, `cafe/happy-hour/`, `cafe/loyalty/`, `food-court/seating/`, `food-court/vendors/`, `food-truck/routes/`, `food-truck/stops/`, `mobile-cafe/loyalty/`, `mobile-cafe/routes/`
- **Dead/duplicate**: `vendors/`, `vendors/[id]/` (see Technical Debt)
- **Home**: `page.tsx` (console dashboard)

No `categories/` or `extras/` route exists anywhere under `src/app/console`.

# Tenant Management

| Capability | Status | Evidence |
|---|---|---|
| Create | ✅ | `src/app/console/tenants/new/page.tsx` — full 6-step wizard (business type → capabilities → branding → feature flags → review → provision), calling `useProvisionTenant()` → `tenantProvisioningService` (`getTemplate`, `getCapabilityPreset`, `generateFeatureFlags`, `validateTenantConfiguration`). Guarded by `permission="tenant.manage"`. |
| List | ✅ | `src/app/console/tenants/page.tsx:134-194`, `useTenants()`, guarded `permission="tenant.view"`. |
| Delete | 🔴 | No hard-delete anywhere — only archive (see Status). |
| Status | ✅ | `TenantRow` (`tenants/page.tsx:65-132`) wires `useActivateTenant()`, `useSuspendTenant()`, `useArchiveTenant()` to buttons. |
| Edit / Settings | 🔴 | `src/app/console/tenants/[slug]/page.tsx` (`TenantDetailContent:214-259`) is **read-only** — profile, business type, branding, capabilities are displayed but there is no edit form; those fields are only set once, at provisioning time, in the New Tenant wizard. |

**Status: 🟡 Partially Implemented** — create/list/status are solid; there is no post-creation edit path and no true delete, only archive.

# Branch Management

| Capability | Status | Evidence |
|---|---|---|
| Create | ✅ | `src/app/console/branches/new/page.tsx` — name, slug, type, address/city/country/postal, phone/email → `useCreateBranch(tenantId)`. Guarded `permission="branches.manage"`. |
| List | ✅ | `src/app/console/branches/page.tsx` (`BranchManagementContent:109-133`) — `useAdminBranches(tenantId)` + `branchManagementService.computeAnalytics`. Guarded `permission="branches.view"`; Add-Branch link separately guarded `permission="branches.manage"`. |
| Edit | 🔴 | `useUpdateBranch()` (`src/hooks/index.ts:837-842`) and `branchManagementService.updateBranch` (`src/services/branch.service.ts:437`) exist and are fully implemented, but have **zero callers anywhere in `src/app` — only referenced from `src/test/phase7-branch-management.test.ts`.** There is no branch-edit page or form in the Console UI. |
| Delete | 🔴 | No `deleteBranch` function in `branch.service.ts`, no `useDeleteBranch` hook, no delete button anywhere in `src/app/console/branches/**`. |
| Status | ✅ | `src/app/console/branches/[id]/page.tsx` wires `useActivateBranch()`, `useDeactivateBranch()`, `useMaintenanceBranch()` to buttons, guarded `permission="branches.manage"`. |
| Address | 🟡 | Set once at creation (`branches/new/page.tsx`); displayed read-only on the detail page (`branches/[id]/page.tsx:51-95`); no edit form. |
| Working hours | 🔴 | Displayed read-only on the detail page; **no field for it even exists in the creation form**, and no edit form exists anywhere — working hours can be set neither at creation nor afterward from the Console. |

**Status: 🟡 Partially Implemented** — create/list/status-toggle work; edit and delete are entirely missing from the UI (edit's service/hook layer exists as dead code); working hours have no create-time or edit-time UI at all.

# Category Management

**Status: 🔴 Missing** (as an independently manageable entity).

- `src/services/menu.service.ts` has only `getCategories(branchId)` (line 31) — there is no `createCategory`, `updateCategory`, `deleteCategory`, or reorder function anywhere in the service.
- `src/hooks/index.ts` has only `useCategories` (read, line 623) — no `useCreateCategory`/`useUpdateCategory`/`useDeleteCategory`/reorder hook exists.
- `src/app/console/menu/page.tsx` uses `useCategories(adminBranchId)` in exactly two ways: (a) rendering read-only category-filter pills (lines 200-211), and (b) populating a `<select>` of `category_id` inside `MenuItemFormFields` (lines 417-427) so an admin can *assign* a menu item to an existing category id.
- There is no create/edit/delete/reorder button, form, or modal for `Category` objects anywhere in the Console, and — critically — **there is no way to originate a new Category record at all**, since no service function exists to create one. An admin can only pick from whatever categories the mock/backend already returned.

# Menu Item Management

| Capability | Status | Evidence |
|---|---|---|
| Create | ✅ | `src/app/console/menu/page.tsx` — `MenuItemFormFields` + `useCreateMenuItem(adminBranchId)`, scoped to the admin's active branch. |
| Edit | ✅ | Same page, `useUpdateMenuItem(adminBranchId)`. |
| Delete | ✅ | Same page, `useDeleteMenuItem(adminBranchId)`. |
| Category assignment | ✅ | `category_id` select in `MenuItemFormFields` (lines 417-427). |
| Branch ownership | ✅ | Scoped to `useBranchStore(s => s.adminActiveBranch?.slug)` (per the branch-menu implementation work earlier this session) — all reads/mutations on this page are branch-scoped. |
| Availability | ✅ | `available` checkbox in the form, plus a dedicated toggle button on each item card (`toggleAvailable`). |
| Price | ✅ | `price`/`discount` fields in the form. |
| Images | 🟡 | A single `image` URL text field only (`Input label="Image URL"`) — no upload widget, no multi-image support (the `MenuItem.images?: string[]` type field is never exposed in this form). |

**Status: ✅ Fully Implemented** for the core CRUD (create/edit/delete/assign/availability/price), 🟡 for images (URL-only, no upload, no gallery).

# Extras Management

**Status: 🔴 Missing entirely — confirmed with zero exceptions.**

- `MenuItemForm` (the admin form's state shape, `menu/page.tsx:24-36`) has no `extras`/`extra_ids` field at all; `itemToForm`/`formToPayload` never reference `extras`; `MenuItemFormFields` renders name/category/price/discount/calories/prep-time/description/image/available/featured/popular — **no extras selector of any kind**.
- No `extras` string appears anywhere under `src/app/console`.
- `src/hooks/index.ts` has no `useExtras`/`useCreateExtra`/`useUpdateExtra`/`useDeleteExtra`.
- `src/services/menu.service.ts` has no `getExtras`/`createExtra`/`updateExtra`/`deleteExtra` — the only "extras" reference is a pass-through default (`extras: payload.extras ?? []`) inside mock item creation.
- `Extra` (`src/types/index.ts:82`) is consumed exclusively on the **customer-facing** side: `MenuItem.extras` is read and added to cart in `FoodDetailModal.tsx`, `CartDrawer.tsx`, `checkout/page.tsx`, `order/[orderId]/page.tsx`, `order.service.ts`, and `useCartStore` (`stores/index.ts`) — never authored anywhere.

There is currently no way, anywhere in this codebase, for an admin to create, edit, price, or even browse a list of `Extra` records. Extras that appear to customers must originate from data an admin cannot touch through any UI (e.g. mock data or a backend the frontend has no console for).

# RBAC Audit

- Guard mechanism: `src/components/auth/PermissionGuard.tsx` (127 lines), checked against the `P7Permission` union in `src/types/rbac.ts:27-98`.
- **48 of 50 `page.tsx` files under `src/app/console` use `<PermissionGuard>`.** The two that don't:
  - `src/app/console/page.tsx` (console dashboard/home) — no guard at all; an access-control gap relative to every other console page.
  - `src/app/console/vendors/page.tsx` — no guard of its own, but it's a 1-line re-export of `food-court/vendors/page.tsx`, which is itself guarded (see Technical Debt).
- **No `category.*` or `extras.*` permission exists in `P7Permission` at all.** Category and Extra piggyback entirely on `menu.view`/`menu.manage`.
- `menu.manage` is defined and used in role presets (`src/services/permission.service.ts:36,127,193,642,713`) but **is never used as a `permission="..."` guard anywhere in `src/app/console`** — `menu/page.tsx:161` only checks `menu.view`, meaning create/edit/delete mutations on the Menu page are gated by the *same, weaker* permission as merely viewing it. There is no separate manage-level gate distinguishing "can view the menu" from "can create/edit/delete items."
- Permission strings actually applied in console pages (deduped): `analytics.view, audit.view, branches.manage, branches.view, customers.view, loyalty.view, menu.view, notifications.view, operations.view, orders.view, promotions.view, reservations.view, reviews.view, settings.manage, settings.view, staff.manage, staff.view, tenant.manage, tenant.view, vendors.view`.

# Navigation Audit

Nav source: `src/modules/registry.ts` (~22 base items plus business-type-specific module items), rendered by `AdminSidebar.tsx` via `useAdminModuleNav()`.

- Nav includes `Tenants`, `Staff`, `Branches`, `Branch Analytics`, `Audit Logs`, `Notifications`, `Live Operations`, `Settings`, `Platform Configuration`, `Permissions`, `Roles`, `Users`, `Reviews`, `Website Builder`, `Orders`, `Menu`, `Loyalty`, `Kitchen Display`, `Customers`, `Reservations`, `Analytics`, `Promotions`, plus business-type modules (vendors, seating, happy hour, routes, stops, events).
- **No "Categories" nav item and no "Extras" nav item exist anywhere in the registry** — `Menu` is the single nav entry meant to cover items, categories, and extras collectively, of which only items are actually manageable.
- `QUICK_ACTIONS` (`AdminSidebar.tsx:86-91`) lists: New Menu Item, New Promotion, New Reservation, Invite Staff — no category/extras quick action.
- Dead/duplicate route: `/console/vendors` is a pure re-export of `/console/food-court/vendors` (see Technical Debt) — not a broken link, but a redundant one with no guard of its own.
- No dead links or missing pages were found for any *registered* nav item — every `href` in the registry corresponds to a real `page.tsx`.

# Architecture Consistency

| Entity | Types | Service | Hooks | Store | Pages | Navigation | Permissions | Status |
|---|---|---|---|---|---|---|---|---|
| Tenant | ✅ `Tenant` | ✅ `tenant.service.ts`, `tenant-provisioning.service.ts` | ✅ `useTenants`, `useProvisionTenant`, `useActivateTenant`, etc. | ✅ `useTenantStore` | ✅ list/new/detail | ✅ "Tenants" | ✅ `tenant.view`/`tenant.manage` | 🟡 |
| Branch | ✅ `Branch` (×2 conflicting, per prior audit) | ✅ `branch.service.ts` | ✅ read/create/status; 🔴 update/delete unused or absent | ✅ `useBranchStore` | 🟡 list/new/detail (no edit) | ✅ "Branches" | ✅ `branches.view`/`branches.manage` | 🟡 |
| Category | ✅ `Category` (branch-scoped) | 🔴 read-only (`getCategories` only) | 🔴 read-only (`useCategories` only) | — (no dedicated store; scoped via `useBranchStore`) | 🔴 no dedicated page | 🔴 none | 🔴 none (piggybacks `menu.*`) | 🔴 |
| Menu Item | ✅ `MenuItem` (branch-scoped) | ✅ full CRUD | ✅ full CRUD | — (scoped via `useBranchStore`) | ✅ `console/menu` | 🟡 "Menu" (shared with Category/Extras) | 🟡 `menu.view` only (no `menu.manage` gate applied) | 🟡 |
| Extra | ✅ `Extra` | 🔴 none | 🔴 none | 🔴 none | 🔴 none | 🔴 none | 🔴 none | 🔴 |

# Flow Consistency

> Tenant → Create Branch → Open Branch → Create Category → Create Menu Item → Assign Extras → Visible in Marketplace

**This flow is NOT fully possible using the existing Console.** Step-by-step:

1. **Tenant** — ✅ possible (`tenants/new`).
2. **Create Branch** — ✅ possible (`branches/new`), though without working hours.
3. **Open Branch** — ✅ possible (`branches/[id]`).
4. **Create Category** — 🔴 **not possible** — no UI or service function exists to create a `Category`; an admin is limited to whatever categories already exist in the data source.
5. **Create Menu Item** — ✅ possible (`console/menu`), but its category dropdown can only select a pre-existing category from step 4, which itself cannot be created.
6. **Assign Extras** — 🔴 **not possible** — no extras selector exists in the Menu Item form, and no way exists to create an Extra to assign in the first place.
7. **Visible in Marketplace** — the customer-facing side (`MenuContent.tsx`, `BranchHomepageClient.tsx`) will render whatever category/menu-item/extra data exists, but steps 4 and 6 cannot be produced by an admin through this Console — only steps that consume pre-seeded data work end-to-end.

**Conclusion: the flow breaks at "Create Category" and again at "Assign Extras."** Only Tenant → Branch → Menu Item (against a pre-existing category) is achievable through the Console today.

# Branch Consistency

- **Categories belong to Branches**: ✅ at the type level (`Category.branch_id`, added in the earlier branch-menu-scoping work) and ✅ at the fetch level (`useCategories(adminBranchId)` in `console/menu/page.tsx`) — but since Categories can't be created/edited from the Console at all, this consistency is only provable for reads, not writes.
- **Menu Items belong to Branches**: ✅ — `useMenuItems(adminBranchId)`, `useCreateMenuItem(adminBranchId)`, `useUpdateMenuItem(adminBranchId)`, `useDeleteMenuItem(adminBranchId)` are all scoped to `adminActiveBranch.slug`, with mutation invalidation scoped via a predicate (per the prior branch-menu implementation).
- **Extras belong to the correct Branch**: 🔴 **not verifiable/not applicable** — since Extras have no CRUD surface, there is no admin action to check for branch leakage; the `Extra` type itself carries no `branch_id` at all (only `Category`/`MenuItem` do), so even if an extras UI were added today, the underlying type doesn't yet support branch ownership.
- **Editing Branch A never affects Branch B**: ✅ for Menu Items (scoped predicate invalidation, per prior work); ✅ trivially true for Categories/Extras since no editing exists at all to leak across branches.
- **Console always edits the active Branch**: ✅ for the Menu page (`adminActiveBranch.slug`, `console/menu/page.tsx`); 🟡 for the Branch pages themselves — `branches/[id]/page.tsx` operates on the branch identified by the `[id]` route param directly (not necessarily "the active branch" from the store), which is architecturally correct for a branch-detail page but means "active branch" and "branch being edited" are two different concepts in this part of the Console — worth noting, not a bug.

# Missing Features

Comparing public-facing features to their Console equivalent:

| Public Feature | Console Equivalent | Status |
|---|---|---|
| Marketplace / tenant discovery | Tenants list/detail | ✅ |
| Branch homepage | Branches list/detail | ✅ (detail is read-only beyond status, per Branch Management) |
| Menu (categories + items browsing) | `console/menu` | 🟡 items ✅, categories 🔴 |
| Extras on menu items (cart/checkout) | none | 🔴 |
| Orders | `console/orders` | ✅ |
| Customers | `console/customers` | ✅ |
| Reservations | `console/reservations` | ✅ |
| Reviews | `console/reviews` | ✅ |
| Loyalty | `console/loyalty` | ✅ |
| Promotions | `console/promotions` | ✅ |
| Website/homepage builder | `console/website` | ✅ |

The only public feature with no manageable counterpart at all is **Extras**; **Categories** are consumable-but-not-creatable, a narrower gap than Extras but still a real one.

# Technical Debt

- **`src/app/console/vendors/page.tsx`** — a 1-line dead/duplicate route (`export { default } from '@/app/console/food-court/vendors/page'`), with no `PermissionGuard`/`ErrorBoundary` of its own (relies entirely on the re-exported page's guards).
- **`useUpdateBranch()`** (`src/hooks/index.ts:837-842`) and **`branchManagementService.updateBranch`** (`src/services/branch.service.ts:437`) are fully implemented but have zero callers outside `src/test/phase7-branch-management.test.ts` — a complete update pathway with no UI ever invoking it.
- **No TODO/FIXME/deprecated markers** were found anywhere in `src/app/console/**` — the missing Category/Extras functionality is not flagged in-code as planned/incomplete; it simply doesn't exist.
- **`menu.manage` permission is defined but never applied** anywhere in the Console (`menu/page.tsx` only checks `menu.view` for both viewing and mutating) — a latent RBAC granularity gap.
- **`src/app/console/page.tsx`** has no `PermissionGuard`, inconsistent with all other console pages.
- The two conflicting `Branch` type definitions (documented in earlier frontend audits this session, `src/types/index.ts` vs `src/types/branch.ts`) remain unresolved and affect the Console's branch pages, which use the P7.3 `src/types/branch.ts` version.

# Recommendations

*(Recommendations only — not implemented.)*

- Add a dedicated Category CRUD surface: `createCategory`/`updateCategory`/`deleteCategory`/reorder functions in `menu.service.ts`, corresponding hooks, and either a standalone `console/categories` page or an inline category manager within `console/menu`.
- Add an Extras domain end-to-end: an `Extra.branch_id` (or `Extra.menu_item_id`) field, `menu.service.ts` CRUD functions, hooks, and a UI — either a standalone extras manager or an inline "Extras" section inside the Menu Item form.
- Introduce `category.manage`/`extras.manage` permission keys (or apply the existing `menu.manage` as a distinct guard) so viewing and mutating are no longer gated identically.
- Build a Branch edit form using the already-implemented `useUpdateBranch`/`updateBranch`, and add working-hours editing (currently absent from both create and any hypothetical edit flow).
- Decide on and implement (or explicitly document the absence of) branch delete/archive semantics, mirroring the Tenant archive pattern.
- Add `permission="dashboard:access"` (or equivalent) guarding to `console/page.tsx` for consistency with the rest of the Console.
- Remove or properly guard the dead `console/vendors/page.tsx` re-export.

# Final Answers

1. **Can a new Tenant be fully created from the Console?** Yes — the full provisioning wizard (`tenants/new`) works end-to-end and is properly permission-guarded. Post-creation editing of profile/branding is not possible, only status changes (activate/suspend/archive).
2. **Can a new Branch be fully created and managed?** Created, yes. "Fully managed" — no: there is no edit UI (despite the service/hook existing), no delete, and no working-hours field anywhere.
3. **Can each Branch have its own Categories?** Architecturally yes at the type/fetch level (`Category.branch_id`, `useCategories(branchId)`), but Categories cannot be *created* from the Console at all — an admin can only assign existing category ids to menu items.
4. **Can each Branch have its own Menu Items?** Yes — fully implemented and branch-scoped (create/edit/delete/assign/availability/price), the most complete part of the menu domain.
5. **Can each Branch have its own Extras?** No — Extras have zero admin tooling and the `Extra` type doesn't even carry a `branch_id` field yet.
6. **Is the Console fully aligned with the current frontend architecture?** No. It correctly reflects the architecture down through Menu Items, but breaks at Category (read-only) and Extras (entirely absent), leaving the Tenant → Branch → Category → Menu Item → Extras chain incomplete at both ends of the menu sub-hierarchy.
7. **What is still missing before the Console can be considered production-ready?** A Category CRUD surface, an Extras domain (type field + service + hooks + UI) from scratch, a Branch edit form (wiring the already-built `useUpdateBranch`), Branch working-hours editing, a Branch delete/archive decision, and RBAC granularity (`menu.manage`/`category.manage`/`extras.manage`) distinguishing view from mutate permissions.
