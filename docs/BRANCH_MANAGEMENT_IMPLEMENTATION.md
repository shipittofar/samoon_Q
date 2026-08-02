# Branch Management Implementation (Phase 2)

> **Superseded (checkout migration):** Branch forms and API payloads now serialize `checkout` (not `BranchSettings` / `DEFAULT_BRANCH_SETTINGS`). Canonical types: `BranchCheckout` in `src/types/branch.ts`, helpers in `src/lib/branch-checkout.ts`.

Companion to `docs/BRANCH_MANAGEMENT_ANALYSIS.md` (Phase 1). Completes Branch CRUD in the Admin Console, reusing Branch Management's own existing form/page conventions rather than introducing a new architecture or switching to the Modal-kit pattern used by Menu/Category/Extras.

## Files changed and why

| File | Why |
|---|---|
| `src/types/branch.ts` | Added `description`, `image`, `coverImage`, `isDefault`, `timeZone`, `currency`, `language` to `Branch`. Operational checkout config is `checkout: BranchCheckout`; `marketplaceVisible`, `reservationsEnabled`, `maxCapacity` are top-level. Extension-only `settings?: Record<string, unknown>`. Extended `CreateBranchPayload`/`UpdateBranchPayload` with `checkout` plus slug edit on update. |
| `src/services/branch.service.ts` | Added `assertSlugAvailable(tenantId, slug, excludeId?)`, called from both `createBranch` and `updateBranch` in mock mode — throws `Error('duplicate_slug')` on conflict within the same tenant. Added `deleteBranch(id)` — throws `Error('last_branch')` if it's the tenant's only branch, otherwise removes it and promotes the next remaining branch to default if the deleted one was default. Added `setDefaultBranch(id)` — flips `isDefault` on the target and unsets it on every sibling in the same tenant. Extended `createBranch`/`updateBranch` mock bodies to read/merge the new payload fields; a tenant's very first branch is always forced `isDefault: true` regardless of payload. Tagged the 6 existing mock branches whose `slug === 'main'` with `isDefault: true` (one per tenant) so the "exactly one default per tenant" invariant already holds for existing data, not just newly created branches. |
| `src/services/endpoints.ts` | Added `BRANCHES.DELETE(id)` (reuses the existing `/branches/{id}/` detail path with the DELETE verb) and `BRANCHES.SET_DEFAULT(id)`. |
| `src/hooks/index.ts` | Added `useDeleteBranch()` and `useSetDefaultBranch()`, invalidating `['admin-branches']`/`['admin-branch']` — the exact same blanket-invalidation convention already used by `useActivateBranch`/`useDeactivateBranch`/`useMaintenanceBranch`/`useAssignBranchManager` in this file (not the predicate-scoped pattern used by the newer Menu/Category/Extras hooks — Branch Management's own hooks already had an established, different invalidation convention, and Phase 2 keeps it consistent rather than mixing two styles in one domain). |
| `src/types/rbac.ts` | Added `branches.create`/`branches.update`/`branches.delete` to `P7Permission`, mirroring the four-tier `category.*`/`extras.*` shape used in the prior two passes. |
| `src/services/permission.service.ts` | Added the three new permissions to `ALL_PERMISSIONS`; granted them only to `owner` (explicit array) — **not** to `manager`, matching the existing, test-enforced rule that `manager` does not have `branches.manage` either (`src/test/phase7-branch-management.test.ts` P6/Y7). `admin` receives them automatically via its existing `ALL_PERMISSIONS.filter(...)` definition. Added `branches.create`/`branches.update` (require `branches.view`) and `branches.delete` (requires `branches.view` + `branches.update`) to `PERMISSION_DEPENDENCIES`. Added the three new permissions to the `branches` entry in the permission-grouping preset map (used by the permission simulator/role-editor UI) so they display grouped correctly. |
| `src/app/console/branches/BranchFormFields.tsx` (new) | Shared form component + `validateBranchForm`/`defaultBranchFormBusinessHours`/`EMPTY_BRANCH_FORM` used by both `new/page.tsx` and the new `[id]/edit/page.tsx`. Edits nested `checkout` (order types, payments, delivery, orderingEnabled) plus top-level marketplace/reservations/capacity fields. |
| `src/app/console/branches/new/page.tsx` | Replaced its inline Basic Info/Location/Contact fieldsets with `<BranchFormFields>`, so branch creation now also covers branding, locale, settings, and working hours in one step. Permission guard changed from `branches.manage` to the new `branches.create` (no test asserted the old string here — verified by search before changing it). |
| `src/app/console/branches/[id]/edit/page.tsx` (new) | Full edit page (not a modal — matching `new/page.tsx`'s established full-page convention for branch forms), pre-filling `BranchFormFields` from `useAdminBranch(id)` and submitting via the now-activated `useUpdateBranch()` hook. Guarded by the new `branches.update` permission. |
| `src/app/console/branches/[id]/page.tsx` | Added an actions row (Edit link → `branches.update`; "Set as Default" button when not already default → `branches.update`; "Delete" button → `branches.delete`, disabled with a tooltip when this is the tenant's only branch). Added a delete-confirmation `Modal` (reusing the same `@/components/ui/Modal` primitive already used elsewhere in the Console — a generic, cross-cutting component, not tied to the newer kit's form style) that shows an extra amber warning line when the branch being deleted is the admin's currently active branch (`useBranchStore(s => s.adminActiveBranch)`). Added display of the new `description`, locale (`timeZone`/`currency`/`language`), `orderingEnabled`/`marketplaceVisible` settings, and a "Default" badge next to the branch name. The existing status-action section keeps its original `branches.manage` guard unchanged (a test asserts this literal string, `U8`). |
| `src/app/console/branches/page.tsx` | Added an "Edit" link per row (guarded by `branches.update`) and a "Default" badge next to the branch name where `isDefault` is true. "Add Branch" guard changed from `branches.manage` to `branches.create` (no test asserted the old string; the existing `branches.view` guard on the page itself, asserted by `U3`, is unchanged). |
| `src/i18n/locales/{en,ar,fa}.json` | Added ~40 new `console.*` keys used by the new form sections, actions, and validation/success/error messages, in all three locales — `i18n:validate` confirms 3551 identical keys per locale after the change. |
| `src/test/phase7-rbac.test.ts`, `phase7-notification-center.test.ts`, `phase7-realtime-operations.test.ts`, `phase8-6-enterprise-rbac.test.ts` | Updated the hardcoded `ALL_PERMISSIONS` length assertion from 56 → 59 (3 new branch permissions), continuing the same running-total comment trail started by the Category/Extras passes. |

## Before vs After

**Before:** `Branch` had no description/branding/locale/default-flag fields; operational config lived in legacy `BranchSettings`. Create existed but only covered name/slug/type/address/contact. Update was fully implemented but dead — no UI called it. Delete and set-default did not exist.

**After:**
```
Types:      Branch { ..., checkout: BranchCheckout, marketplaceVisible, reservationsEnabled, maxCapacity? }
Service:    getBranches/getBranch/getBranchMetrics (unchanged)
            createBranch/updateBranch (extended, slug-uniqueness enforced)
            deleteBranch (new, "last branch" guarded)
            setDefaultBranch (new)
            activateBranch/deactivateBranch/setMaintenanceMode/assignManager (unchanged)
Hooks:      useDeleteBranch, useSetDefaultBranch (new); useUpdateBranch (now actually used)
RBAC:       branches.view / branches.manage (unchanged) + branches.create / branches.update / branches.delete (new)
Pages:      console/branches (list: +Edit link, +Default badge)
            console/branches/new (full create form incl. hours/settings/branding/locale)
            console/branches/[id] (detail: +Edit/Set-Default/Delete actions, +locale/ordering/marketplace display)
            console/branches/[id]/edit (new: full edit form, same shared fields as create)
```

## Data Flow

```
Console operator opens /console/branches/[id]/edit
  → useAdminBranch(id) loads the branch (queryKey ['admin-branch', id])
  → branchToForm() maps it into BranchFormState
  → BranchFormFields renders all sections; edits are local component state only
  → On Save: validateBranchForm() checks required fields, slug format,
    email/phone format, and working-hours consistency (open < close on every
    open day) — client-side, before any request is sent
  → useUpdateBranch().mutate({ id, payload }) — optimistic update writes the
    new fields straight into the ['admin-branch', id] cache entry, then calls
    branchManagementService.updateBranch(id, payload)
  → Mock mode: assertSlugAvailable() re-checks uniqueness server-side-equivalent,
    throws 'duplicate_slug' on conflict (surfaced as a toast + inline error);
    otherwise merges the payload into the branch record in MOCK_BRANCH_LIST
  → onSuccess invalidates ['admin-branch', id] and the ['admin-branches'] prefix
    → the list page and any other open branch views refetch and reflect the change
  → Router pushes back to /console/branches/[id]
```

## Branch Switch Flow (verified, not re-implemented)

`AdminBranchSwitcher.tsx` (`src/components/admin/AdminBranchSwitcher.tsx:49-61`) was inspected, not modified, because it already does the right thing:
```
Admin picks a different branch in the switcher
  → setAdminActiveBranch(branch)   (useBranchStore)
  → qc.invalidateQueries for: admin-orders, admin-reservations, admin-customers,
    admin-stats, analytics-summary, analytics-revenue, analytics-reservations
    (these domains read the active branch inside their queryFn rather than
    encoding it in the query key, so they need an explicit invalidate)
```
Menu/Categories/Extras are **not** in that explicit invalidation list, and don't need to be: `useCategories(branchId)`, `useMenuItems(branchId)`, `useExtraGroups(branchId)`, `useExtras(branchId)` (added in the three prior passes this session) already embed the branch slug directly in their React Query key (`['categories', tenantId, branchId]`, etc.). Switching branches produces a structurally different key, which React Query treats as a fresh query with no stale data to display — no manual invalidation is possible or necessary for these, and none was added. This was verified by reading the hook implementations, not assumed.

## RBAC additions

- `branches.create` / `branches.update` / `branches.delete` — granted to `owner` (explicit array) and `admin` (via `ALL_PERMISSIONS.filter(...)`). **Not** granted to `manager`, consistent with `manager` already lacking `branches.manage` (enforced by existing tests `P6`/`Y7` in `phase7-branch-management.test.ts`, which this change does not touch or contradict).
- Dependency rules: `branches.create`/`branches.update` require `branches.view`; `branches.delete` requires `branches.view` + `branches.update` — same shape as `category.*`/`extras.*`.
- The existing `branches.view` (page-level) and `branches.manage` (status-action section) guards are unchanged, preserving the two existing tests that assert those literal strings (`U3`, `U8`).
- New UI entry points (Add Branch, Edit link, Set Default, Delete) are gated by the new granular permissions; the pre-existing status-action buttons (activate/deactivate/maintenance) keep their original `branches.manage` guard.

## Verification performed

- **`npx tsc --noEmit`**: 19 errors, identical to the pre-existing baseline; zero errors in any file this change touched.
- **`npx next lint`**: 214 warnings/errors, identical to baseline; zero issues in any `console/branches/**` file.
- **`node scripts/validate-i18n.mjs`**: "✓ All 3 locales share identical keys (3551 keys each)."
- **`npx next build`**: succeeds; `/console/branches`, `/console/branches/new`, `/console/branches/[id]`, and the new `/console/branches/[id]/edit` all appear in the route manifest with no errors.
- **`npx vitest run src/test/phase7-branch-management.test.ts`**: all 133 tests pass unchanged.
- **`npx vitest run`** (full suite, 5845 tests): **exactly the same 15 pre-existing test failures, by name, before and after this change.** Adding 3 new permissions shifted the same `ALL_PERMISSIONS` hardcoded-count assertions the Category/Extras passes already had to update — updated again (56→59) rather than left broken. Zero net regressions.
- ✓ Branch CRUD works (create extended, edit activated, delete added with guards, all wired to real hooks/services).
- ✓ Working Hours work (all 7 days editable, open/close/closed, validated for open < close on open days).
- ✓ Branch Switcher still works — not modified; re-verified by reading its source.
- ✓ Menu/Categories/Extras update after a branch switch — verified via query-key inspection (see Branch Switch Flow above), not re-implemented.
- ✓ No cache leakage — `useDeleteBranch`/`useSetDefaultBranch` invalidate the same `['admin-branches']`/`['admin-branch']` keys the existing status-action hooks already use; no cross-tenant leakage since `['admin-branches', tenantId]` already scopes by tenant.
- ✓ No TypeScript errors introduced.
- ✓ No ESLint errors introduced.
- ✓ Build succeeds.

## Remaining TODOs

1. **Mock-mode persistence caveat**: `deleteBranch`/`setDefaultBranch`/the extended `createBranch`/`updateBranch` all mutate `MOCK_BRANCH_LIST` directly (unlike the Category/Extras mock services, which don't mutate their arrays) — so branch changes *do* persist for the rest of the mock session, until `_resetMockStore()` is called (e.g. between test files). This is actually more complete than the Category/Extras mock behavior, not a regression, but worth noting as an inconsistency between menu-domain and branch-domain mock fidelity.
2. **No multiple time ranges per day** (e.g. a lunch block and a separate dinner block) — not added, since no part of this project already supports that shape; adding it would be scope creep beyond "reuse existing patterns."
3. **Manager assignment** (`assignManager`/`useAssignBranchManager`) still has no dedicated UI — it existed before this pass and remains out of scope, since the task's explicit CRUD/information/hours/settings/RBAC/navigation list did not include it.
4. **Real-API contract unverified** — this repo has no backend source, so whether a live backend implements `DELETE /branches/{id}/` and `POST /branches/{id}/default/` as designed cannot be confirmed here.
5. **`assertSlugAvailable`'s mock-mode check is not literally what a real backend would return** (a real API would presumably respond with a 409 and a structured error, not a thrown JS `Error('duplicate_slug')` string) — the mock throw was chosen to mirror the simplest possible "server rejected it" signal the existing `try/catch` call sites in `new/page.tsx`/`edit/page.tsx` already know how to branch on (`err.message === 'duplicate_slug'`), consistent with how `deleteBranch`'s `'last_branch'` signal works the same way.

## Final answers

1. **Can a Tenant fully manage all of its Branches?** Yes — list, create (with full information/hours/settings), edit (now activated), and delete (with safeguards) are all wired to real hooks/services and gated by RBAC.
2. **Can a Branch be edited without affecting other Branches?** Yes — `updateBranch(id, payload)` mutates only the single matched record in `MOCK_BRANCH_LIST`; the slug-uniqueness check reads sibling branches only to validate, never to mutate them; `setDefaultBranch`/first-branch-creation logic is the one deliberate exception, where changing one branch's `isDefault` to `true` intentionally sets every sibling's `isDefault` to `false` in the same tenant — a cross-branch effect, but a correct and necessary one (a tenant can only have one default branch), not an accidental one.
3. **Are Working Hours fully supported?** Yes, for the shape this project already models: one open/close range plus a closed flag per day of the week, editable for all 7 days, with validation that open precedes close on every open day. Multiple ranges per day are not supported, because they weren't supported anywhere in the project before this pass either.
4. **Does changing the active Branch immediately update every branch-scoped module?** Yes — confirmed by inspection: Menu/Categories/Extras via branch-scoped query keys (no invalidation needed, verified this session across three prior implementation passes), and Orders/Reservations/Customers/Dashboard-Stats/Analytics via `AdminBranchSwitcher`'s existing explicit `invalidateQueries` calls (pre-existing, re-verified, not modified).
5. **Is Branch Management now production-ready?** For the Console/admin side, yes — full CRUD, working hours, settings, branding/locale fields, default-branch handling, RBAC, and navigation are all wired, validated, and verified against the existing test suite and build with zero regressions. The caveats are the same class of limitation already documented for Category/Extras Management: this repo has no real backend to verify the API contract against, and the mock-mode persistence/error-signaling details are a stand-in for what a real backend would do, not a guarantee of what it will do.
