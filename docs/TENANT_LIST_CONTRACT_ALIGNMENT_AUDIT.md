# Frontend Tenant List Contract Alignment Audit (Phase Z.6)

> **SUPERSEDED (cuisines / amenities):** Discover/search cuisine & amenity facets
> read from **Branch** payloads only — not `meta.cuisines` / `meta.amenities`.
> See `docs/BACKEND_API_CONTRACT.md` §30.4.

**Status: root cause found and fixed for the core Tenant contract. One
downstream discover-page issue found and documented as a tracked,
deliberately-deferred follow-up (explained in §6 — fixing it would require
either a backend change or a UI redesign, both explicitly out of scope for
this phase).**

**Update (Phase Z.6.1):** the `type?: string` field this phase added to
`Tenant` was removed in a follow-up phase — it had zero consumers (added
speculatively to mirror the backend response shape, never wired into any
component/service). Every mention of `type` below is a historical record of
what this phase originally did, not the current state of `Tenant`. See
`docs/TENANT_TYPE_FIELD_REMOVAL_AUDIT.md`.

---

## 1. Trace

```
GET /api/tenants/  (real backend)
  → src/services/tenant.service.ts (getTenants() / getTenant() / getCurrentTenant()
    / activateTenant() / suspendTenant() / archiveTenant() / transferOwnership()
    / updateTenantSettings())
  → src/hooks/index.ts (useTenants() / useMyTenants() / usePlatformTenants() /
    usePublicTenants())
  → src/types/index.ts (Tenant interface)
  → src/stores/index.ts (useTenantStore — single active tenant only; not
    involved in list rendering)
  → src/app/discover/DiscoverClientPage.tsx, src/app/console/tenants/page.tsx,
    src/components/admin/AdminTenantSwitcher.tsx, src/components/marketplace/BusinessCard.tsx
```

## 2. Root Cause

The backend's `/api/tenants/` response uses `business_types` (snake_case,
matching every other Tenant field's naming convention — `created_at`,
`tax_percentage`, etc.). The frontend's `Tenant` interface
(`src/types/index.ts`) has always declared this field as `businessTypes`
(camelCase) — a legacy naming artifact predating the snake_case convention,
carrying **module-key semantics** (which UI module/nav to render — see the
field's own doc comment, distinct from a raw business classification).

`tenantService.getTenants()`/`getTenant()` never transform the response —
confirmed by reading the code: `return data.results` (list) / `return
tenant` (detail), a raw pass-through with no mapper. That is correct
behavior in isolation (no filtering, nothing dropped) — but it also means
the case mismatch was never reconciled: against a real backend, every
`Tenant` object arrives with `business_types` populated and `businessTypes`
**completely absent** (`undefined`), because JavaScript does not
case-fold object keys.

**~20 call sites across the app read `tenant.businessTypes` unconditionally**
(module routing, feature-flag resolution, tenant cards, the discover page's
category filter/search, the console tenant list, `AdminTenantSwitcher`).
Every one of them would see `undefined` and either:
- render nothing (optional-chained reads like `tenant?.businessTypes?.[0]`), or
- **throw** (`tenant.businessTypes.forEach is not a function` /
  `.some is not a function`) in the several places that call array methods
  directly on it without a null-guard — most notably
  `DiscoverClientPage.tsx`'s category-filter logic (lines 243, 251, 281, 286,
  317) and `BusinessCard.tsx` (lines 46, 60).

This is the root cause of "the frontend still does not display the tenant
list correctly": in mock mode, `MOCK_TENANTS` has always hand-authored
`businessTypes` directly (matching the OLD, pre-backend-contract shape), so
this bug was invisible in mock-only testing — it only manifests the moment
`NEXT_PUBLIC_USE_MOCK=false` points at a real backend implementing the
described contract.

## 3. Every Place the Tenant Contract Was Incomplete

| Area | Finding |
|---|---|
| `src/types/index.ts` `Tenant` interface | Missing entirely: `image`, `business_types` (raw), `type`, `tax_percentage`, `updated_at`. `settings` was `Record<string, unknown>` — not wrong, but untyped, so `settings.features`/`settings.ordering` had no declared shape. `businessTypes` (camelCase) was present but never populated from the backend's actual field name. |
| `src/services/tenant.service.ts` | No transform existed (confirmed not a "dropping" bug) — but also no reconciliation between `business_types` (wire) and `businessTypes` (frontend-internal name), which is what actually caused the field to disappear. |
| `src/hooks/index.ts` (`useTenants`, `useMyTenants`, `usePlatformTenants`, `usePublicTenants`) | No `select()` drops any property. `usePublicTenants()`'s `select` filters the *array* (removes ineligible tenants by status/slug), never touches individual tenant *fields* — confirmed not a bug. |
| `src/app/discover/DiscoverClientPage.tsx` | Reads `tenant.businessTypes` directly in 5 places, including 3 unguarded `.forEach()`/`.some()` calls — would throw against a real backend pre-fix. **Separately** (see §6): `withMeta()` silently drops any tenant lacking `settings.marketplace` — a mock-only, backend-contract field not described anywhere in the Phase Z.6 task's response shape. |
| `src/app/console/tenants/page.tsx`, `src/components/admin/AdminTenantSwitcher.tsx` | Read `tenant.businessTypes`/`t.businessTypes` directly — same undefined-field exposure, without the unguarded-throw risk (both use optional chaining / `Array.prototype` on a value they assumed was always an array). |
| `src/components/marketplace/BusinessCard.tsx` | Two unguarded `tenant.businessTypes.map()`/`.every()` calls — would throw. |

## 4. Fix

### 4.1 `src/types/index.ts`
- Added `image?`, `business_types?`, `type?`, `tax_percentage?`, `updated_at?` to `Tenant`.
- Added a new `TenantSettings` interface (`currency?`, `language?`, `timezone?`, `features?: Record<string, boolean>`, `ordering?: Record<string, unknown>`, plus an index signature so the existing mock-only `featureFlags`/`theme`/`marketplace` settings keys — never part of the real backend contract, but already read via casts across the app — keep type-checking without a forced rewrite of everything that reads them).
- `businessTypes` (camelCase) is **kept, not renamed** — ~20 existing call sites depend on this exact name for module-routing/feature-flag decisions, and its doc comment's own invariant (must match a `Module.key`, not an arbitrary business-type string) means blindly overwriting it with the raw `business_types` value could be wrong if the backend's category values ever diverge from module keys. Documented this decision explicitly in the interface.

### 4.2 `src/services/tenant.service.ts`
Added `normalizeTenant()` — spreads the raw response first (drops nothing),
then fills `businessTypes` from `business_types` **only when `businessTypes`
itself is absent** (mock data, which already sends the correct camelCase
key, passes through untouched). Applied to every real-mode call that
returns a `Tenant`/`Tenant[]`: `getTenant()`, `getCurrentTenant()`,
`getTenants()`, `activateTenant()`, `suspendTenant()`, `archiveTenant()`,
`transferOwnership()`, `updateTenantSettings()`.

## 5. Before / After Data Flow

**Before**, against a real backend:
```
GET /api/tenants/ → { business_types: ['restaurant'], ... }  (no `businessTypes` key)
  → tenantService.getTenants() → [{ business_types: [...], ... }]  (raw pass-through)
  → DiscoverClientPage: tenant.businessTypes.forEach(...) → TypeError, page crashes
  → AdminTenantSwitcher: t.businessTypes.join(', ') → TypeError
  → console/tenants: tenant.businessTypes?.[0] → undefined, shows "—"/blank
```

**After**:
```
GET /api/tenants/ → { business_types: ['restaurant'], ... }
  → tenantService.getTenants() → normalizeTenant() →
    [{ business_types: [...], businessTypes: ['restaurant'], ... }]  (both present, nothing dropped)
  → DiscoverClientPage: tenant.businessTypes.forEach(...) → works
  → AdminTenantSwitcher: t.businessTypes.join(', ') → 'restaurant'
  → console/tenants: tenant.businessTypes?.[0] → 'restaurant'
```

## 6. Confirmed, Out-of-Scope Finding (documented, not fixed)

`DiscoverClientPage.tsx`'s `withMeta()`:

```ts
function withMeta(tenants: Tenant[]): TenantWithMeta[] {
  return tenants.flatMap((t) => {
    const meta = getMarketplaceMeta(t.settings)   // settings?.marketplace as MarketplaceMeta
    return meta ? [{ tenant: t, meta }] : []       // <-- silently DROPS the tenant if absent
  })
}
```

`getMarketplaceMeta()` reads `settings.marketplace` — a rich, mock-only
object (`rating`, `reviewCount`, `cuisines`, `coverImage`, `description`,
`branches`, etc.) that does **not** appear anywhere in the Phase Z.6 task's
described backend response shape (`currency`/`language`/`timezone`/
`features`/`ordering` only). Against a real backend, **every** tenant would
have `meta === undefined`, and `withMeta()` would filter out the entire
list — the discover page would render zero results even though the backend
correctly returned N tenants.

**Not fixed in this phase** because a real fix requires a product decision
this task's constraints explicitly forbid guessing: either (a) the backend
adds marketplace-display fields (a backend change — out of scope, "Do not
change backend"), or (b) `BusinessCard`'s ~15 field reads (`meta.rating`,
`meta.cuisines`, `meta.description`, `meta.coverImage`, etc., several
unconditional) are reworked to gracefully degrade with the *base* Tenant
fields, which is a genuine UI redesign of the marketplace card, not a
contract-alignment fix ("Do not redesign"). Flagged here as the next
concrete, well-diagnosed piece of work.

## 7. Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | Widened `Tenant` (added `image`, `business_types`, `type`, `tax_percentage`, `updated_at`); added `TenantSettings` interface; typed `settings` with it. |
| `src/services/tenant.service.ts` | Added `normalizeTenant()`; applied to all 8 real-mode calls returning a `Tenant`/`Tenant[]`. |
| `src/test/phase-Z-6-tenant-list-contract.test.ts` (new) | Regression suite — see §8. |
| `src/test/phase-5-tenant-service-error-handling.test.ts` | Updated one pre-existing assertion that expected a raw, unnormalized tenant object — now expects `businessTypes: []` to be present, matching the intentional new behavior. |

No component/page needed a source change — every existing `tenant.businessTypes`
read site now receives a correctly-populated array without modification,
which is the entire point of fixing this at the service boundary rather
than at each of ~20 call sites.

## 8. Tests Added

`src/test/phase-Z-6-tenant-list-contract.test.ts` (7 tests):
- `businessTypes` filled from `business_types` on a raw real-backend-shaped response.
- No field is dropped — every raw field (`image`, `business_types`, `type`, `tax_percentage`, `created_at`, `updated_at`) survives.
- `settings.features`/`settings.ordering`/`settings.currency`/`settings.language`/`settings.timezone` survive untouched.
- A response that already has `businessTypes` (mock-shaped) is not overwritten.
- A response with neither field defaults to `[]`, not `undefined` — proven not to throw on `.forEach()`.
- `getTenant(slug)` (single-tenant fetch) gets the same normalization.
- Mock mode is unaffected (7th test, separate describe block).

## 9. Final Verification

- `npx tsc --noEmit -p .` — zero new errors (diffed against the established
  pre-existing baseline; identical modulo one pre-existing failure's
  line-number shift).
- `npx vitest run` — full suite, only the same pre-existing baseline
  failures present before this phase (unrelated `createdAt`/`updatedAt`
  mock-fixture mismatches); one pre-existing test
  (`phase-5-tenant-service-error-handling.test.ts`) updated to match the
  intentional new normalization behavior.
- `npm run build` — production build result recorded below.
