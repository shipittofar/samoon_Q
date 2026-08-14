# Tenant Settings Contract Migration Audit (Phase Z.6.2)

> **SUPERSEDED (cuisines / amenities):** `settings.marketplace` no longer owns
> `cuisines` or `amenities`. Branch is the sole source of truth. See
> `docs/BACKEND_API_CONTRACT.md` §30.4.

**Status: complete.** `Tenant.settings` is fully typed
(`featureFlags`/`theme`/`marketplace`), every marketplace-display surface
reads exclusively from `tenant.settings.marketplace.*`, and every optional
sub-field is read defensively so a partially-populated (or entirely
missing) `settings.marketplace` degrades gracefully instead of crashing or
silently dropping the tenant.

---

## 1. Trace

```
Tenant.settings (backend contract: featureFlags / theme / marketplace)
  → src/types/index.ts (TenantSettings — now fully typed, was Record<string, unknown> + casts)
  → src/types/marketplace.ts (MarketplaceMeta — now every field optional; getMarketplaceMeta() no longer casts)
  → src/services/feature-flags.service.ts (already read settings.featureFlags — just de-cast)
  → src/app/discover/DiscoverClientPage.tsx (withMeta(), search/filter/sort/collections)
  → src/components/marketplace/BusinessCard.tsx, BranchPreview.tsx
  → src/components/layout/{Header,TenantHeader}.tsx, src/providers/index.tsx (theme)
  → src/app/[tenantSlug]/TenantHomepageClient.tsx, [branchSlug]/BranchHomepageClient.tsx
  → src/app/console/settings/page.tsx (branding tab — writes settings.theme)
  → src/app/restaurant/page.tsx (single-tenant marketing page)
```

## 2. Correction: `featureFlags`, not `features`

Phase Z.6 (the prior phase) added `TenantSettings.features?: Record<string,
boolean>` based on that task's own abbreviated example shape. This was
**wrong** — `feature-flags.service.ts` and `BusinessCard.tsx` have always
read `tenant.settings.featureFlags` (confirmed by re-reading both files, and
by `MOCK_TENANTS`' own mock data in `tenant.service.ts`, which has always
used `featureFlags`, never `features`). Phase Z.6.2's task explicitly
confirms `featureFlags` as the real field name. `features` had zero real
consumers — renamed, not duplicated.

## 3. What Was Already Correct (audited, not changed)

- `feature-flags.service.ts`'s `resolve()`/`listFlags()`/`updateFlag()`/
  `bulkUpdateFlags()` already read `tenant.settings.featureFlags` as
  Layer 3 (highest-priority per-tenant override) — exactly the target
  pattern from the task's "Before/After" example. Only the `as
  Record<string, boolean>` cast was removed (now typed directly).
- `types/marketplace.ts`'s `getMarketplaceMeta()`,
  `BusinessCard.tsx`, and `DiscoverClientPage.tsx` already sourced every
  display field (description, coverImage, cuisines, tags, rating,
  reviewCount, city, branchCount, openNow, primaryBranchSlug, amenities,
  gallery, branches, phone/email) from `tenant.settings.marketplace` — no
  hardcoded marketplace data existed in these files to remove.
- No code anywhere assumes `tenant.branches` (the field does not exist on
  `Tenant`; confirmed zero matches) — branch data always comes from
  `settings.marketplace.branches` or the dedicated branch service, per the
  task's requirement #6.

## 4. What Was Actually Broken

### 4.1 Untyped `settings.theme` / `settings.featureFlags` / `settings.marketplace`
Every reader used an ad-hoc inline cast (`tenant.settings?.theme as
{primaryColor?: string}`, `as TenantTheme`, `as Record<string, boolean>`,
`as {marketplace?: {...}}`) — seven call sites across
`BusinessCard.tsx`, `TenantHeader.tsx`, `TenantHomepageClient.tsx`,
`BranchHomepageClient.tsx`, `feature-flags.service.ts` (×4),
`console/settings/page.tsx` (×2), `providers/index.tsx`, `Header.tsx`.
Fixed by typing `TenantSettings.theme: TenantTheme` and
`TenantSettings.featureFlags: Record<string, boolean>` directly — every
cast removed, several now-unused `TenantTheme` imports removed alongside.

### 4.2 `withMeta()` silently dropped tenants without `settings.marketplace`
Flagged (not fixed) in Phase Z.6 §6 as a confirmed, deliberately-deferred
finding. Now fixed: `withMeta()` keeps every tenant, substituting `{}` for
a missing `marketplace` object. `BusinessCard.tsx` and the marketplace
helper functions were already (mostly) written to tolerate optional
fields — the type just didn't say so.

### 4.3 `MarketplaceMeta`'s "required" fields were a lie the type told
`description`, `coverImage`, `cuisines`, `tags`, `rating`, `reviewCount`,
`city`, `branchCount`, `openNow`, `primaryBranchSlug` were typed
non-optional, but nothing guaranteed a real (or now-partial, per §4.2)
marketplace object actually has them. Real crash risk:
`meta.rating.toFixed(1)`, `meta.reviewCount.toLocaleString()`,
`meta.cuisines.length`/`.map()`, `meta.tags.length`/`.map()`,
`normalize(meta.city)`/`normalize(meta.description)` (crashes on
`undefined.toLowerCase()`). All ten fields are now optional; every read
site (`BusinessCard.tsx`, `TenantHomepageClient.tsx`,
`types/marketplace.ts`'s `matchesSearch()`/`matchesFilters()`/
`sortItems()`) hardened with `??`/optional-chaining/conditional rendering
so missing data hides the relevant UI section instead of crashing.

### 4.4 Hardcoded fallback marketplace content in `restaurant/page.tsx`
`FALLBACK_GALLERY` (6 hardcoded Unsplash URLs), `FALLBACK_BRANCHES` (2
hardcoded Samoon branch records), `FALLBACK_STORY` (a hardcoded business
description), and a hardcoded hero-image URL were all substituted whenever
`tenant.settings.marketplace` lacked the corresponding field. Removed —
every one of these sections (hero background, "About" story/gallery,
"Our Locations", bottom gallery) now hides itself when the tenant hasn't
configured that content, instead of showing fabricated placeholder
content. This is the literal reading of requirement #7 ("hide optional
sections... use existing empty states") applied to the one file that
violated it.

## 5. Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | `TenantSettings.featureFlags` (renamed from `features`), `TenantSettings.theme: TenantTheme`, `TenantSettings.marketplace: MarketplaceMeta` — all fully typed, replacing the untyped index-signature-only shape. |
| `src/types/marketplace.ts` | All ten previously-required `MarketplaceMeta` fields made optional. `getMarketplaceMeta()` no longer casts. `matchesSearch()`, `matchesFilters()`, `sortItems()` hardened against absent fields. |
| `src/services/feature-flags.service.ts` | Removed 4 `as Record<string, boolean>` casts — now reads the typed field directly. |
| `src/components/marketplace/BusinessCard.tsx` | Removed theme/featureFlags casts; hardened rating/reviewCount/city/branchCount/cuisines/description/openNow reads against absence. |
| `src/app/discover/DiscoverClientPage.tsx` | `withMeta()` no longer drops tenants without marketplace data (exported for testability); hardened `availableCuisines`/`availableCities`/`topRated`/`familyFriendly` against absent fields; removed a featureFlags cast. |
| `src/app/[tenantSlug]/TenantHomepageClient.tsx` | Removed a theme cast; hardened `HeroSection`/`BusinessInfo`'s rating/reviewCount/city/branchCount/openNow/description/cuisines/tags reads; guarded `primaryBranchSlug` prop passes against `undefined`. |
| `src/components/layout/TenantHeader.tsx`, `src/components/layout/Header.tsx`, `src/app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx`, `src/providers/index.tsx`, `src/app/console/settings/page.tsx` | Removed theme/marketplace casts (now typed); removed unused `TenantTheme` imports where the cast was the only usage. |
| `src/app/restaurant/page.tsx` | Removed `FALLBACK_GALLERY`/`FALLBACK_BRANCHES`/`FALLBACK_STORY` and the hardcoded hero-image URL. Every section (hero background, About/story/gallery, Locations, bottom gallery) now hides itself gracefully instead of showing fabricated content when the tenant's `settings.marketplace` doesn't have it yet. |
| `src/test/phase-Z-6-tenant-list-contract.test.ts` | Updated `features` → `featureFlags` in the fixture and assertion (Phase Z.6's own field-naming correction). |
| `src/test/phase2-logo-theming.test.ts` | Updated 2 assertions that checked for the removed `TenantTheme` cast/import in `Header.tsx` — now checks for the direct typed read instead. |
| `src/test/marketplace.test.ts` | 1 assertion adjusted for `MarketplaceMeta.primaryBranchSlug` now being optional (non-null assertion, since the mock data under test genuinely always populates it). |
| `src/test/phase-Z-6-2-tenant-settings-contract.test.ts` (new) | Regression suite — see §7. |
| `docs/TENANT_SETTINGS_CONTRACT_MIGRATION_AUDIT.md` (new, this file) | Full audit trail. |

## 6. Old Settings References Removed

Every `as TenantTheme`, `as { primaryColor?: string }`, `as Record<string,
boolean>`, and `as { marketplace?: {...} }` cast on `tenant.settings.*`
found via a full-repo search is gone from production code (11 call sites
across 8 files). `TenantSettings.features` (this phase's own earlier,
incorrect field name) is gone, replaced by `featureFlags`. No hardcoded
marketplace content (descriptions, cover images, ratings, gallery images,
cuisines, tags, amenities, branch cards, city names, phone/email
placeholders) remains anywhere in the tenant UI — confirmed via the
`restaurant/page.tsx` fallback removal and a full-repo grep for
Unsplash-style hardcoded image URLs / stock rating numbers outside
`tenant.service.ts`'s own legitimate mock fixture data.

## 7. All Marketplace Data Now Comes From `Tenant.settings.marketplace`

Confirmed for every marketplace-display surface: `BusinessCard.tsx`,
`DiscoverClientPage.tsx` (search/filter/sort/featured/popular/newest/
top-rated/family-friendly/coffee-shop collections), `TenantHeader.tsx`,
`TenantHomepageClient.tsx`, `BranchHomepageClient.tsx`, `restaurant/page.tsx`.
None of these read from any other source (no separate marketplace API, no
hardcoded arrays, no `tenant.branches`). `withMeta()`'s fix means a tenant
with zero configured marketplace data still appears in every list (with
marketplace-only sections hidden), rather than disappearing.

## 8. Tests Added

`src/test/phase-Z-6-2-tenant-settings-contract.test.ts` (13 tests):
- `withMeta()` keeps a tenant with no settings, with settings but no
  marketplace key, and in a mixed list — never drops one.
- `matchesSearch()`/`matchesFilters()`/`sortItems()` don't throw against a
  completely empty `MarketplaceMeta`.
- `getMarketplaceMeta()` reads `settings.marketplace` directly (typed).
- `TenantSettings.featureFlags` round-trips under its corrected name.

## 9. Final Verification

- `npx tsc --noEmit -p .` — zero new errors (diffed against the established
  baseline; identical modulo the one pre-existing failure's line-number
  shift).
- `npx vitest run` — 5937/5956 pass; only the same 19 pre-existing
  `createdAt`/`updatedAt` baseline failures (unrelated to this phase). Two
  pre-existing `phase2-logo-theming.test.ts` assertions updated to match
  the intentional cast-removal (both now pass).
- `npm run build` — production build result recorded in the commit message.
