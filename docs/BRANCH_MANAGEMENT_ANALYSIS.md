# Branch Management — Pre-Implementation Analysis (Phase 1)

> **Superseded (checkout migration):** Operational branch checkout configuration now lives in `branch.checkout` (`BranchCheckout` in `src/types/branch.ts`), not `BranchSettings` / `branch.settings`. See `src/lib/branch-checkout.ts`. `branch.settings` is extension-only. The analysis below reflects the pre-migration state at the time of writing.

Scope: frontend only, read-only inspection before any code changes. Builds on `docs/CONSOLE_ARCHITECTURE_AUDIT.md` (which first found the Branch edit/delete gap) with the exact detail needed to complete it.

## 1. How Branches are currently represented

Two coexisting representations (a pre-existing duplication, not introduced here):
- **P7.3 domain model**, `src/types/branch.ts` — `Branch { id, tenantId, name, slug, status, type, location, contact, managerId?, businessHours[], checkout, marketplaceVisible, reservationsEnabled, maxCapacity?, created_at, updated_at, metadata? }`. This is the model the Console actually uses (`branch.service.ts`, `console/branches/**`).
- **Legacy `Location`/`Branch` alias**, `src/types/index.ts` — used by the customer-facing/public side and `combined.service.ts`. Now also carries optional `checkout` for storefront flows.

`BranchCheckout` models operational configuration: `orderingEnabled`, `orderTypes` (delivery/pickup/dineIn/default), `payments` (cash/cashOnDelivery/card/online/wallet/default), and `delivery` (radius/minimumOrder/sameDay/scheduled/contactless). `BranchBusinessHours` models one open/close range + `isClosed` per day (`Monday`–`Sunday`).

**Top-level branch fields** (not nested under checkout): `currency`, `businessHours`, `marketplaceVisible`, `reservationsEnabled`, `maxCapacity`. Extension-only `settings?: Record<string, unknown>` must never hold operational checkout config.

## 2. Which CRUD operations already exist

| Operation | Service | Hook | Console UI |
|---|---|---|---|
| List | `getBranches(tenantId)` ✅ | `useAdminBranches(tenantId)` ✅ | `console/branches/page.tsx` ✅ |
| Read (detail) | `getBranch(id)` ✅ | `useAdminBranch(id)` ✅ | `console/branches/[id]/page.tsx` ✅ (read-only + status actions) |
| Create | `createBranch(tenantId, payload)` ✅ | `useCreateBranch(tenantId)` ✅ | `console/branches/new/page.tsx` ✅ (name/slug/type/address/contact only — no working hours, no settings, no branding/locale fields) |
| Update | `updateBranch(id, payload)` ✅ (fully implemented, optimistic) | `useUpdateBranch()` ✅ (fully implemented, optimistic) | 🔴 **No edit page/form anywhere** — confirmed zero UI callers of this hook outside `src/test/phase7-branch-management.test.ts` |
| Delete | 🔴 **Does not exist** — no service function, no hook, no UI | | |
| Status (activate/deactivate/maintenance) | `activateBranch`/`deactivateBranch`/`setMaintenanceMode` ✅ | `useActivateBranch`/`useDeactivateBranch`/`useMaintenanceBranch` ✅ | `console/branches/[id]/page.tsx` ✅ |
| Set default branch | 🔴 Does not exist at any layer | | |
| Assign manager | `assignManager` ✅ | (hook exists per `hooks/index.ts:963` onward) | Not surfaced in any page UI (out of scope for this pass) |

## 3. Service functions already existing (`src/services/branch.service.ts`)

`getBranches`, `getBranch`, `getBranchMetrics`, `createBranch`, `updateBranch`, `activateBranch`, `deactivateBranch`, `setMaintenanceMode`, `assignManager`, `computeAnalytics`, `_resetMockStore` (test helper). No slug-uniqueness check exists in `createBranch`/`updateBranch`. No `deleteBranch`. No `setDefaultBranch`.

## 4. Which hooks already exist (`src/hooks/index.ts`)

`useAdminBranches(tenantId)`, `useAdminBranch(id)`, `useAdminBranchMetrics(id)`, `useCreateBranch(tenantId)`, `useUpdateBranch()` (optimistic, fully wired but unused by any page), `useActivateBranch()`, `useDeactivateBranch()`, `useMaintenanceBranch()` (all three optimistic). No `useDeleteBranch`, no `useSetDefaultBranch`.

## 5. Which UI already exists

- `console/branches/page.tsx` — list grouped by status (active/maintenance/inactive) with a small analytics summary row; "Add Branch" link; each row links to detail. Uses the section's own established house style: raw `<table>`/`<input>`/`<button>` with Tailwind classes, **not** the `@/components/ui` kit (`Modal`/`Input`/`Button`/`Table`) that Category/Extras/Menu Management use — this is a real, pre-existing style split between "older" console sections (Branches, Tenants) and "newer" ones (Menu, Categories, Extras). Phase 2 must respect this: the task says reuse *existing* patterns, and Branch Management's own existing pattern is the raw-Tailwind fieldset/table style, so that is what gets extended, not the newer kit.
- `console/branches/new/page.tsx` — a full page (not a modal) with fieldset-grouped native inputs: Basic Info (name, slug, type), Location (address/city/country/postal), Contact (phone/email). No working hours, no settings toggles, no branding, no locale, no default-branch flag.
- `console/branches/[id]/page.tsx` — read-only detail: location, contact, checkout config (order types/payments/delivery), top-level marketplace/reservations/capacity, business hours, metrics, and status-action buttons (activate/deactivate/maintenance) guarded by `branches.manage`. No edit entry point, no delete entry point.
- `console/branches/analytics/page.tsx` / `console/branches/[id]/analytics/page.tsx` — tenant-wide and per-branch analytics (confirmed in the earlier Console audit as legitimately distinct, not duplicates).

## 6. Dead code

- **`useUpdateBranch()` and `branchManagementService.updateBranch`** — fully implemented (including optimistic update/rollback) but have zero callers anywhere in `src/app` — only referenced from `src/test/phase7-branch-management.test.ts`. This is the single largest piece of dead code in the branch domain, and Phase 2 activates it rather than replacing it.
- No dead pages, no duplicate routes found in `src/app/console/branches/**` (re-confirmed; `analytics` at both tenant and branch scope are legitimately different views, not duplicates).

## 7. Relationship to Tenant, Menu, Categories, Menu Items, Extras

- **Tenant**: `Branch.tenantId` is a required field; `getBranches(tenantId)` filters strictly by it; mock data (`INITIAL_MOCK_BRANCHES`) spans 6 different tenants, each branch tagged to exactly one. Confirmed: no branch appears under more than one `tenantId`.
- **Menu / Categories / Menu Items / Extras**: as established in the prior three implementation passes this session (`docs/BRANCH_MENU_IMPLEMENTATION.md`, `docs/CATEGORY_MANAGEMENT_IMPLEMENTATION.md`, `docs/EXTRAS_MANAGEMENT_IMPLEMENTATION.md`), every one of these domains is already branch-scoped end to end via `useBranchStore(s => s.adminActiveBranch?.slug)` → `adminBranchId` → branch-aware React Query keys → `menuService`/branch-scoped mock lookups. **This relationship already works correctly today** and Phase 2 does not need to (and must not) touch it — Phase 2's job is Branch CRUD itself, and to verify (not re-implement) that switching the active branch already cascades correctly, which the Verification section below confirms by inspection rather than by re-deriving it from scratch.

## What Phase 2 must add

1. `deleteBranch` (service+hook+UI), with "last branch" and "active branch" guards.
2. `setDefaultBranch` (service+hook+UI).
3. An edit page (`console/branches/[id]/edit/page.tsx`, matching the existing full-page — not modal — convention `new/page.tsx` already established) using a **shared** `BranchFormFields` component with `new/page.tsx`, extended to cover: description, image, cover image, timezone, currency, language, working hours (all 7 days), checkout configuration (order types/payments/delivery/orderingEnabled), top-level marketplace/reservations/capacity, and a default-branch checkbox.
4. Slug-uniqueness, email/phone format, and working-hours validation in the shared form (client-side) and in `branchManagementService` (mock-mode server-equivalent check).
5. `branches.create`/`branches.update`/`branches.delete` permissions, granted to the same roles that already hold `branches.manage` (owner, admin) — not `manager` (which explicitly does **not** have `branches.manage` today, confirmed by `src/test/phase7-branch-management.test.ts` P6/Y7, so it must not gain the new granular permissions either).
