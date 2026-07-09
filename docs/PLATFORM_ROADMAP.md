# Platform Roadmap — Beyond P9.0

> How every future phase plugs into the P9.0 Platform Configuration
> Foundation. Nothing below requires new core architecture — each phase is
> Registry → Schema → Console UI → Backend → Tests, repeated, per
> `docs/PLATFORM_ARCHITECTURE_PRINCIPLES.md` §3. Modules already registered
> in P9.0 are marked ✅; everything else is future work.
>
> Last updated: 2026-07-04

---

## The repeating pattern

Every phase below follows the same five steps, because the foundation is
already built:

```
P9.x
  ↓
Module already registered in Configuration Registry (P9.0)? 
  → Yes: extend its schema if needed, otherwise skip to Console UI.
  → No: register it first (Registry → Schema → Validation), per the
    Developer Guide (docs/P9.0.1_DEVELOPER_GUIDE.md).
  ↓
Console UI            — generic settings renderer reads the module's schema;
                         no hand-built form (Rule 7)
  ↓
Backend                — implements docs/BACKEND_API_CONTRACT.md §36 for
                         this module's fields (generic contract, already written)
  ↓
Tests                  — resolver/validator/service coverage + Console E2E
```

## P9.1 — Authentication ✅ (registered)

- **Registry**: done — `authentication` module (`src/config/modules/authentication.ts`), OTP + lockout policy.
- **Console UI**: build the first generic settings page against this module — it's the natural pilot since it has no dependencies and a small, well-understood field set.
- **Backend**: implement §36 for `authentication.*` fields; wire `authentication.otp.length`/`ttl_seconds` into the real OTP service (replacing any inline constants that still exist there).
- **Tests**: extend `src/test/p9-platform-configuration.test.ts` coverage; add a Console E2E once the UI exists.

## P9.2 — Countries ✅ (registered)

- **Registry**: done — `countries` module, built on the existing `src/data/countries.ts` list.
- **Console UI**: multi-select country picker reusing the existing phone-input country UI components where possible.
- **Backend**: implement §36; the enabled/pinned country lists become tenant-configurable instead of a static export.
- **Tests**: verify `countries.enabled_codes` changes actually affect the signup/checkout country pickers once wired.

## P9.3 — Languages ✅ (registered)

- **Registry**: done — `languages` module.
- **Console UI**: locale toggle list + default-locale picker.
- **Backend**: implement §36; `next-intl` locale resolution reads the resolved `languages.default`/`languages.supported` instead of the static `SUPPORTED_LOCALES` constant.
- **Tests**: locale-switch regression tests already exist (`src/i18n`); extend them to cover a tenant-level override.

## P9.4 — Typography ✅ (registered)

- **Registry**: done — `typography` module.
- **Console UI**: font pickers with the `font-sample` preview kind already declared on these fields.
- **Backend**: implement §36; the Website Builder and Theme renderers consume the resolved font stack.
- **Tests**: preview rendering smoke test once UI exists.

## P9.5 — Billing / Subscriptions ✅ (registered)

- **Registry**: done — `subscriptions` module (plan catalog, trial length, grace period).
- **Console UI**: plan comparison table generated from `subscriptions.plans_catalog`; trial/grace-period fields as simple number inputs.
- **Backend**: implement §36; wire into the real billing provider once selected (Stripe Billing, Chargebee, etc.) — the plan catalog itself stays platform-configuration, the billing provider integration is a separate, larger effort tracked outside this roadmap.
- **Tests**: plan-selection and trial-expiry logic tests.

## P9.6 — Themes ✅ (registered)

- **Registry**: done — `themes` module (depends on `typography`).
- **Console UI**: color pickers with the `swatch` preview kind; live preview pane reading `ConfigurationDiff.diffModule('themes', scope)` to show inheritance visually (Phase F, already built).
- **Backend**: implement §36; retire the ad hoc `TenantTheme` shape in `src/types/index.ts` in favor of resolved `themes.*` fields (migration, not a breaking change — `TenantTheme` can stay as a read-only projection until every consumer is migrated).
- **Tests**: visual regression on theme override application.

## P9.7 — Feature Flags ✅ (registered)

- **Registry**: done — `feature_flags` module (platform-level rollout switches, distinct from the existing per-tenant capability flags in `src/modules/registry.ts` — see that module's header comment for the boundary).
- **Console UI**: toggle list with rollout percentage (future field addition, if needed) once a real gradual-rollout need exists — don't add it speculatively (Principles doc §17).
- **Backend**: implement §36; existing `featureFlagsService.resolve()` three-layer merge becomes layer 0 (module defaults) feeding into the Configuration Registry's own resolution rather than a parallel system — a P9.7-scoped migration, not a P9.0 change.
- **Tests**: flag-gating regression tests already exist; extend for platform-level flags specifically.

## P9.8 — Website Builder ✅ (registered)

- **Registry**: done — `website_builder` module (depends on `themes`).
- **Console UI**: block-library toggle list; max-sections numeric input; builds on the existing `src/services/website-builder.service.ts` page/section editor.
- **Backend**: implement §36; enforce `website_builder.max_sections`/`enabled_blocks` server-side, not just in the editor UI.
- **Tests**: builder section-limit enforcement tests.

## P9.9 — Payments ✅ (registered)

- **Registry**: done — `payments` module. Includes the first real `type: 'secret'` field (`payments.stripe_secret_key`) — this is the pilot for the Secret Management architecture in `docs/P9.0.1_ARCHITECTURE_HARDENING.md` §C.
- **Console UI**: provider toggle list; secret fields render as a "configured / not configured" indicator, never an editable plaintext box, once a real Secret Provider exists.
- **Backend**: implement §36 **and** the first real Secret Provider integration (§C) — this is the phase that turns the secret architecture from design into reality.
- **Tests**: provider-selection tests; secret-reference resolution tests (mocked provider).

## P9.10 — Monitoring ✅ (registered)

- **Registry**: done — `monitoring` module.
- **Console UI**: threshold sliders/inputs; alert-channel multi-select.
- **Backend**: implement §36; wire thresholds into the real Sentry/APM alerting configuration.
- **Tests**: threshold-boundary validation tests.

## P9.11 — Notifications ✅ (registered)

- **Registry**: done — `notifications` module.
- **Console UI**: provider selects; default-channel multi-select.
- **Backend**: implement §36; the existing `notification.service.ts`/`notification-preferences.service.ts` read platform-level defaults from here instead of any hardcoded fallback.
- **Tests**: channel-default resolution tests.

## P9.12 — RBAC ✅ (registered)

- **Registry**: done — `rbac` module (custom role limits, default invite role, MFA requirement — platform policy, distinct from the per-tenant role assignments already in `src/services/rbac.service.ts`).
- **Console UI**: numeric/select inputs; this is a small, low-risk second pilot for the Console alongside Authentication.
- **Backend**: implement §36; enforce `rbac.max_custom_roles_per_tenant` server-side when a tenant attempts to create a new custom role.
- **Tests**: role-limit enforcement tests.

## P9.13 — System ✅ (registered)

- **Registry**: done — `system` module (maintenance mode, rate limits, retention, default business type).
- **Console UI**: the highest-privilege settings page — maintenance mode toggle needs an extra confirmation step in the Console (a UI-layer concern, not an architecture one).
- **Backend**: implement §36; maintenance mode gates the real API, not just a frontend banner.
- **Tests**: maintenance-mode gating tests.

## P9.14 — API ✅ (registered)

- **Registry**: done — `api` module (versioning, CORS, webhook retry policy).
- **Console UI**: CORS origin list editor (array field type); webhook retry numeric input.
- **Backend**: implement §36; the real API gateway/CORS middleware reads `api.cors_allowed_origins` instead of a hardcoded allow-list.
- **Tests**: CORS enforcement tests.

---

## Future modules (not yet registered — each starts at "Registry")

Every module below starts from zero registration and follows the exact same
pattern as P9.1–P9.14 above. None require new core architecture — each is
Registry → Schema → Console UI → Backend → Tests, using
`docs/P9.0.1_DEVELOPER_GUIDE.md` §1–2 to register.

### P9.15 — AI

```
P9.15 → Register `ai` module (provider select, prompt/token limits, feature-flagged
        off by default via feature_flags.ai_assistant — already registered)
      → Configuration Registry (schema: provider, model defaults, rate limits)
      → Console UI (generic renderer + a "test prompt" preview action —
        the one case where a module might need a bespoke Console widget
        beyond the generic renderer, per Rule 11's carve-out for genuinely
        new capability, not a one-off workaround)
      → Backend (implement §36 + the actual AI provider integration)
      → Tests
```

### P9.16 — CRM

Extends the customer-relationship data already modeled in P8.9.7 (Customer
360°). Registry fields: default tag taxonomy, marketing-consent defaults,
timeline retention. No new inheritance pattern needed — tenant/branch scoped
throughout.

### P9.17 — Inventory

Registry fields: stock-tracking granularity (per-branch vs. per-tenant),
low-stock alert thresholds (composes with the Monitoring module's alert
channels — a `dependencies: [{ moduleId: 'monitoring', type: 'soft' }]`
entry), unit-of-measure defaults.

### P9.18 — POS

Registry fields: default tender types, receipt format, offline-mode
tolerance window. Depends on Payments (`type: 'hard'`) for tender-type
provider alignment.

### P9.19 — Accounting

Registry fields: default chart-of-accounts template, tax-jurisdiction
mapping (composes with the Countries module — `dependencies: [{ moduleId: 'countries', type: 'soft' }]`), export format defaults.

### P9.20 — Gift Cards

Registry fields: denomination presets, expiry policy, redemption channel
list. Depends on Payments (`type: 'hard'`).

### P9.21 — Franchise

Registry fields: franchise-fee structure, brand-standard enforcement level
(how strictly a franchisee's Branch-level theme/menu overrides are
constrained — a direct application of the existing `mode: 'locked'`
inheritance semantics at the branch level).

### P9.22 — Delivery

Registry fields: delivery radius defaults (already partially modeled on
`Location.delivery_radius` in `src/types/index.ts` — this phase promotes the
*default* to Platform Configuration while the per-location value stays on
the `Location` entity itself), courier provider select, delivery-fee
formula.

---

## What never changes across all of the above

- Every module registers through `platformConfigurationRegistry.register()` — never a second registry.
- Every field carries full Rule 5 metadata — no anonymous values.
- Every write goes through `ConfigurationService.updateField()` — validated, permission-checked, audited.
- Every Console page (once built) is generated from the schema — no hand-built form per module.
- Every backend endpoint follows the generic §36 contract unless the module genuinely needs a bespoke endpoint (rare — a payment webhook receiver, not a settings CRUD path).

If a future phase seems to need an exception to any of the above, that is a
signal to extend the schema system itself (a new `ConfigFieldType`, a new
`preview.kind`, a new manifest field per
`docs/P9.0.1_ARCHITECTURE_HARDENING.md` §H) as its own reviewed change —
never a one-off bypass for a single module.

---

## P10.x — Ownership & RBAC Track (parallel to the P9.x Configuration Registry track)

The P9.x sequence above governs *what settings exist and how they're
edited*. P10.x governs a different axis entirely: *who owns what, and who
may act on it.* The two tracks are independent — a P10.x phase changes
nothing about the Configuration Registry's schema/inheritance/versioning
model, and every P9.x module continues to resolve fields, register
metadata, and render Console UI exactly as documented above regardless of
which P10.x phase has landed.

### P10.0 — RBAC, Ownership & Access Model Audit (complete)

Read-only architecture audit of the current authorization/ownership/
visibility model. No code changed. See
`docs/P10.0_RBAC_OWNERSHIP_ACCESS_AUDIT.md`.

### P10.1 — Ownership & RBAC Architecture Rewrite (complete)

Design-level rewrite of the ownership/RBAC model: new `Owner` entity,
`Tenant.ownerId`, and `StaffAssignment` (multi-tenant, multi-branch,
partial-branch staff scoping). No implementation — architecture only. See
`docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md`,
`docs/PLATFORM_ARCHITECTURE_PRINCIPLES.md` §18, and
`docs/BACKEND_API_CONTRACT.md` §39.

### P10.2 — Data Model & Resolution Engine (recommended next)

Implement the additive, nullable `Tenant.ownerId`/`StaffMember.ownerId`
fields and the `StaffAssignment` store/mock data; extend
`branch-access.service.ts` to read `StaffAssignment.branchIds` as one of
its data sources alongside the existing `roleAssignments` path. No UI.

### P10.3 — Owner & Staff Management UI (recommended after P10.2)

Console/platform-admin surfaces for creating Owners, transferring tenant
ownership (§39.4), and granting/revoking/moving `StaffAssignment` rows
(§39.5). Depends on P10.2's data layer existing first.

### P10.4 — Legacy Retirement (recommended last)

Retire `rbac.service.ts` and the legacy `UserRole` enum's use as the
`/console` entry gate (§8.1/§8.2 of `docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md`),
once P10.2/P10.3 have shipped and the new model has been the system of
record for long enough to safely drop the compatibility shim.
