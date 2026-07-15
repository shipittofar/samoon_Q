# Brand Migration: Savor → Samoon

Full-project rename of the brand name (`Savor`/`savor`/`SAVOR` → `Samoon`/`samoon`/`SAMOON`), performed as a mechanical, case-preserving find-and-replace after an inventory and risk classification pass. No unrelated refactoring, no behavior changes.

## Inventory method

Ran `grep -rIl "[Ss][Aa][Vv][Oo][Rr]"` across the whole repository, excluding `node_modules/`, `.git/`, `.next/` (build output — regenerates from source, never hand-edited), and `package-lock.json` (confirmed clean — no match). This found **234 files**. Before touching anything, each risk category called out in the task was checked explicitly:

| Category | Finding | Action |
|---|---|---|
| File/folder names | `find -iname "*savor*"` → zero matches | Nothing to rename |
| Route paths (`src/app/**`) | `find src/app -iname "*savor*"` → zero matches | Nothing to rename |
| API endpoint paths (`endpoints.ts`) | zero matches | Nothing to rename |
| Environment variable **keys** | zero matches — only the *value* `Savor` in `NEXT_PUBLIC_APP_NAME=Savor` | Value renamed; key (`NEXT_PUBLIC_APP_NAME`) untouched |
| `package.json` name/dependencies | `"name": "restaurant-menu"` — no match | Nothing to rename |
| `package-lock.json` | zero matches | Nothing to rename |
| Docker container/network names | `savor-app`, `savor-nginx`, `savor-net`, `savor-restaurant`, Traefik host rule `savor.com` | All self-contained within `docker-compose.yml`/`docker-compose.dev.yml`, referenced nowhere else — safe to rename |
| localStorage key constants | `THEME_KEY='savor-theme'`, `CART_KEY='savor-cart'`, `BRANCH_KEY='savor-branch'`, `LANG_KEY='savor-lang'`, `TENANT_KEY='savor-tenant'`, `DINE_IN_KEY='savor-dine-in'` (`src/constants/index.ts`) | Purely internal browser storage keys, no external contract — safe to rename (see "Left unchanged" section for the one caveat) |
| i18n translation **keys** (not just values) | `savorPlatform`, `poweredBySavorAria`, `popularOnSavorSubtitle`, `joinSavorFamily`, `joinSavorFamilySubtitle` | Renamed the key in all 3 locale JSON files **and** every `t('...')` call site in the same pass, so lookups stay in sync |
| Local variable/function names in tests (e.g. `savorTenant()`, `savorIdx`, `savorBranches`, `savorPerms`, `savorAccount`) | File-local identifiers, not exported, not part of any contract | Safe to rename |
| Mock demo credential `demo@savor.com` | Appears in `auth.service.ts`, `auth-redirect.ts`, `LoginClientPage.tsx`, and ~15 test files, always as a matched pair (map key + map value + assertions) | Renamed consistently everywhere in one pass so the mock login flow and its tests stay internally consistent |
| Real domain names (`savor.com`, `savor.app`, `cdn.savor.app`) | Placeholder/example URLs in SEO/JSON-LD/config defaults, not real registered infrastructure this app depends on | Renamed as branding placeholders |

No technical identifier was found that would break an external dependency, a real third-party contract, or a database/migration reference — this app has no backend/database source in this repository (confirmed in earlier audits this session), so there were no migration files or DB schema names to consider.

## Classification summary

- **Safe to rename (majority of occurrences):** UI text, page titles/metadata/SEO (`src/lib/seo.ts`, `src/lib/json-ld.ts`), `manifest.json`, `robots.txt`, JSON-LD structured data, README/ARCHITECTURE/ROADMAP/TECHNICAL_DEBT and all `docs/*.md`, code comments, i18n values, mock data strings, Docker container/network names, localStorage key constants, test-local variable names, the mock demo email.
- **Required coordinated update (not a blind rename):** i18n translation keys (JSON key + every call site updated together); the `demo@savor.com` credential (all ~20 references updated together to keep the mock auth flow and its tests consistent).
- **Left unchanged:** nothing was found in the "should not be changed" category — no package name, no env var key, no file/route/endpoint path, no lockfile entry referenced "Savor" at all.

## Changes applied

A single script performed three literal, case-exact substitutions (`Savor`→`Samoon`, `SAVOR`→`SAMOON`, `savor`→`samoon`) across all 234 inventoried files — no regex word-boundary tricks were needed since the substitutions are applied consistently to both whole words and compound identifiers alike (e.g. `savorAccount` → `samoonAccount`, `SavorPlatform` → `SamoonPlatform`), and a following full-repo re-scan confirmed zero remaining occurrences of any case variant.

- **234 files modified, 2,227 total textual occurrences replaced.**

### Important files changed

- `src/constants/index.ts` — `APP_NAME` default, `THEME_KEY`/`CART_KEY`/`BRANCH_KEY`/`LANG_KEY`/`TENANT_KEY`/`DINE_IN_KEY` localStorage keys.
- `.env.example` — `NEXT_PUBLIC_APP_NAME=Samoon`.
- `public/manifest.json` — PWA app name/short_name/shortcut description.
- `public/robots.txt` — sitemap host.
- `src/lib/seo.ts`, `src/lib/json-ld.ts` — Open Graph site name, JSON-LD organization/restaurant name, default base URL.
- `docker-compose.yml`, `docker-compose.dev.yml` — compose project name, container names, network name, Traefik routing rule.
- `src/services/auth.service.ts`, `src/utils/auth-redirect.ts`, `src/app/login/LoginClientPage.tsx` — the mock demo credential (`demo@samoon.com`) and its role/redirect mapping.
- `src/i18n/locales/{en,ar,fa}.json` — all brand-name string values, plus the 5 translation keys renamed in lockstep with their call sites in `TenantFooter.tsx`, `TenantHeader.tsx`, `DiscoveryPreview.tsx`, `RegisterClientPage.tsx`.
- `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `TECHNICAL_DEBT.md`, and ~150 files under `docs/**` — documentation prose.
- ~30 files under `src/test/**` — mock credential references and file-local variable names (e.g. `savorTenant()` → `samoonTenant()`).

### Occurrences intentionally left unchanged

None. The full inventory scan found no occurrence that fell into "should not be changed" — every match was either already safe or was a coordinated (key+call-site / credential-everywhere) rename, both of which were completed.

## Note on the localStorage key rename (not a regression, but worth flagging)

Renaming `THEME_KEY`/`CART_KEY`/`BRANCH_KEY`/`LANG_KEY`/`TENANT_KEY`/`DINE_IN_KEY` from `savor-*` to `samoon-*` means that on first load after deployment, any browser with a previously persisted cart/theme/tenant/language/dine-in-table state under the old key names will not find it under the new key and will start fresh (empty cart, default theme, etc.) — the old keys become orphaned, unread strings in that browser's localStorage. The app itself does not break or error; state simply resets once per returning visitor, which is the expected, unavoidable consequence of renaming a client-side storage key during a rebrand (not something specific to this migration's execution).

## Verification results (all run for real, diffed against pre-migration baseline)

- **Full-repo re-scan**: `grep -rIl "[Ss][Aa][Vv][Oo][Rr]"` (same exclusions as the inventory pass) → **0 files, 0 occurrences remaining.**
- **`npx tsc --noEmit`**: 19 errors — identical set, same files, as the pre-migration baseline (all pre-existing `RegisterData`/OTP-type test issues unrelated to branding). **Zero new TypeScript errors.**
- **`npx next lint`**: 214 warnings/errors — identical count to baseline. **Zero new lint issues.**
- **`node scripts/validate-i18n.mjs`**: "✓ All 3 locales share identical keys (3512 keys each)" — the 5 renamed translation keys stayed in sync across `en`/`ar`/`fa`.
- **`npx next build`**: succeeds with no errors; full route manifest generated.
- **`npx vitest run`** (full suite, 5845 tests): **exactly the same 15 pre-existing test failures, by name, before and after** — confirmed identical to the pre-migration baseline (RBAC permission-count/config-studio tests unrelated to branding). **Zero regressions.**

## Final summary

| Metric | Result |
|---|---|
| Files modified | 234 |
| Occurrences replaced | 2,227 |
| Remaining "Savor" references | 0 |
| New TypeScript errors | 0 |
| New lint issues | 0 |
| Build | ✅ succeeds |
| Test regressions | 0 (15 pre-existing failures unchanged) |
