# Product Roadmap — Savor Platform

> Strategic roadmap derived from the current state of the codebase. All items are grounded in the actual source code audit. Priorities reflect production readiness, business impact, and technical dependency ordering.
>
> **Revision note (this version):** The previous revision introduced a single, large "Phase 1 — Foundation Architecture Migration" covering everything from the Tenant model to subscription gating to migration planning. That phase has grown to mix three distinct concerns — **core platform abstractions**, **governance/enablement**, and **commercial/billing concerns** — which makes it hard to sequence and hard to reason about independently. This revision splits Phase 1 into **Phase 1A (SaaS Foundation Core)** and **Phase 1B (Platform Governance & Enablement)**, pulls the Subscription Model out of the foundation entirely and relocates it to **Phase 7 — SaaS & Enterprise Features** as a commercialization concern, inserts a new **Phase 2 — Platform UI Foundation**, and separates the former "Hospitality Modules" phase into **business-type modules** (Phase 6) and **Multi-Location Operations** (Phase 7 in the prior revision, now its own phase). Hotel Operations is preserved in full and repositioned narratively as a later vertical specialization rather than a core hospitality module, for reasons explained in that phase's introduction. **No existing roadmap item, completed work, feature, effort estimate, dependency, rationale, migration note, risk, benefit, or backward-compatibility guarantee has been removed or reduced in scope** — everything is preserved below, renumbered and reorganized into its new phase. See the [Roadmap Migration Summary](#roadmap-migration-summary) at the end for a full diff of what changed and why, covering both this revision and the prior one.

---

## Executive Summary

### Current Maturity Level

**Beta — Not Production Ready, Single-Tenant Only**

The Savor frontend has a well-architected foundation with polished UI, working mock mode, and comprehensive feature breadth for a restaurant use case. Three categories of gaps now exist:

1. **Production gaps** (unchanged from prior audits): no route auth guards, non-functional admin panel, inactive WebSocket infrastructure, missing PWA assets, incomplete Arabic localization, no payment gateway.
2. **Architectural gap:** the codebase has no concept of `Tenant`, `Location` (as distinct from `Branch`), `Module`, or `RBAC`. Every model, route, and service assumes exactly one restaurant business. This must be addressed *before* further feature work compounds the single-tenant assumption.
3. **UI platform gap (newly identified in this revision):** there is no shared design-token system, no white-label theming foundation, and no module-aware/permission-aware navigation shell. Every future module (cafe, bar, hotel) and every future tenant's branding would otherwise be hand-built per feature, multiplying UI cost across Phases 5–8.

### Production Readiness Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | 7/10 | Clean separation, good patterns, but WebSocket not wired, and no multi-tenant/multi-business-type abstraction yet |
| Security | 3/10 | No route guards, no admin authz, JWT in localStorage |
| Scalability | 6/10 | React Query caching is solid; admin not scalable; data model not yet tenant-aware |
| Maintainability | 7/10 | TypeScript strict, good types, but combined.service.ts and dead code |
| Developer Experience | 8/10 | Mock mode, good tooling, Turbopack, Vitest |
| Testing | 2/10 | One test file, no component or integration tests |
| Documentation | 9/10 | Now comprehensive (this document set) |
| Platform Extensibility | 2/10 | No tenant/module/RBAC model; adding a new business type today means forking, not configuring |
| UI Platform Maturity | 3/10 *(new dimension)* | Components exist but are not tokenized, not theme-aware, and navigation is hardcoded to the restaurant feature set |
| **Overall** | **6/10** | |

### Estimated Completion Percentage

| Layer | Completion |
|-------|-----------|
| Foundation architecture — core (Tenant/Location/Module) | **~0% (new layer)** |
| Foundation architecture — governance (RBAC/Flags/Routing/Migration planning) | **~0% (new layer)** |
| Platform UI Foundation (design tokens, theme engine, shared components, nav shell) | **~0% (new layer)** |
| Customer ordering flow (menu → cart → checkout → confirmation) | ~90% |
| User authentication (email/password) | ~85% |
| User dashboard | ~80% |
| Reservations | ~85% |
| Notifications | ~60% |
| Real-time order tracking | ~40% (infrastructure done, not wired) |
| Admin panel | ~15% (UI shell only) |
| Push notifications (Firebase) | ~10% (SDK not initialized) |
| PWA completeness | ~70% (sw.js done, icons missing) |
| Localization (all 3 locales) | ~75% (Arabic incomplete) |
| Hospitality modules (cafe/bar/food truck/etc.) | 0% (not started — gated on foundation + UI platform layers) |
| Multi-location operations | 0% (not started — carried over from prior "Multi-Branch" scope) |
| Hotel operations | 0% (not started — distinct domain, gated on foundation layer only, not on other hospitality modules) |
| Subscription & billing platform | 0% (not started — relocated to Phase 7, commercial concern) |
| **Overall (restaurant scope)** | **~65%** |
| **Overall (platform scope, incl. foundation + UI platform + hospitality modules)** | **~33%** *(adjusted from the prior revision's ~38% to reflect the newly identified UI Platform Foundation layer)* |

### Required Before Production Launch

> Unchanged from prior audits — these remain valid for the existing restaurant tenant and are unaffected by the architecture migration, since the migration is designed to be non-breaking.

1. Implement route authentication middleware
2. Set `NEXT_PUBLIC_USE_MOCK=false` in production
3. Add PWA icon files (all 8 sizes)
4. Add `public/og-image.jpg`
5. Wire WebSocket hooks into the UI
6. Complete Arabic translations
7. Integrate a real payment gateway
8. Add role-based admin authorization
9. Fix mock login logic (H-05)
10. Test full ordering flow against real Django backend

### Required Before Onboarding a Second Tenant / Business Type

*(Updated this revision — now split across Phase 1A, 1B, and Phase 2 to reflect the new structure.)*

1. **Phase 1A:** Tenant, Location, and Module models exist and are wired through the API and frontend; existing restaurant data is migrated into "Restaurant" as the first tenant/module without behavior change
2. **Phase 1B:** RBAC foundation, feature flag system, tenant-aware routing, and a migration plan are in place
3. **Phase 2:** A shared, tokenized, theme-aware component library and module-aware navigation shell exist, so a second tenant or business type doesn't require hand-building UI from scratch
4. Subscription/billing gating is **not** a hard requirement to onboard a second tenant manually (e.g., via admin-configured module activation) — full self-service commercialization is a Phase 7 concern. See [Subscription Model Change](#subscription-model-change-rationale) below.

---

## Phase 1A — SaaS Foundation Core (Sprint 1–2)

> **Goal:** Create the minimum platform abstraction layer required for all future work, while keeping existing restaurant functionality completely unchanged. This phase is intentionally narrow — it contains only the four building blocks that every other phase, with no exception, depends on: **Tenant, Location, Module, and the backward-compatibility guarantee that makes adopting them safe.**
>
> **Why this phase is now split from governance/commercial concerns:** The original combined "Foundation Architecture Migration" phase bundled core data-model abstractions together with RBAC, feature flags, routing, migration planning, and even the Subscription model. In practice, these are different kinds of work with different stakeholders and different urgency: Tenant/Location/Module are *structural* — nothing else can be built without them. RBAC/flags/routing/migration-planning are *governance and enablement* — they make the structural layer safe and operable, but can be sequenced immediately after, not necessarily simultaneously. Subscription is a *commercial* concern that depends on the structural layer existing but has no bearing on whether the structural layer itself is correct. Splitting them clarifies sequencing and lets Phase 1A ship and stabilize before governance and commercial concerns are layered on.
>
> **Non-negotiable constraint (unchanged from prior revision):** This phase must not require rewriting existing restaurant functionality. The migration is incremental — the existing Savor restaurant becomes the first tenant and the first module ("Restaurant") running on the new foundation, with identical behavior to today.

### P1A.1 — Tenant Model & Tenant Resolution Strategy (Critical / High Effort)

**Priority:** P0
**Complexity:** High
**Dependencies:** Backend `Tenant` model and API (coordinated effort with Django team)
**Estimated Effort:** 5–8 days

Introduce a `Tenant` entity representing a single hospitality business (e.g., "Savor Downtown", "Java Truck Co."). Define:
- `Tenant { id, name, slug, businessTypes: Module[], status, createdAt }` *(note: the `subscriptionTier` field originally proposed here has been removed from the core `Tenant` shape and relocated to a separate `Subscription` entity owned by Phase 7 — see [Subscription Model Change](#subscription-model-change-rationale). The `Tenant` model itself does not need to know about billing to function.)*
- Tenant resolution strategy for the frontend: subdomain-based (`{tenant}.savor.app`) vs. path-based (`/t/{tenant}/...`) vs. header-based for API calls. **Recommendation:** subdomain for production multi-tenant routing, with a path-based fallback for local/dev/mock mode to avoid DNS overhead during development. *(The full implementation of this strategy, as routing/middleware code, is Phase 1B's responsibility — P1A.1 defines the model and the decision; P1B.3 implements the routing.)*
- A `useTenantStore` (Zustand, hydrated server-side via middleware/headers) holding the active tenant context for the session.
- Backward-compatible default: when no tenant is resolvable (e.g., today's single-deployment setup), the frontend falls back to a single implicit "default" tenant so existing behavior is unchanged.

---

### P1A.2 — Location Model (Generalizing `Branch`) (Critical / Medium Effort)

**Priority:** P0
**Complexity:** Medium
**Dependencies:** P1A.1
**Estimated Effort:** 3–5 days

Generalize the existing `Branch` concept (already present in `useBranchStore` and `branchService`) into a tenant-scoped `Location` entity that works for a restaurant branch, a cafe counter, a bar, a hotel property, a food court stall, or a mobile truck's current/scheduled position:

- `Location { id, tenantId, name, type: 'restaurant_branch' | 'cafe' | 'bar' | 'hotel_property' | 'food_court_stall' | 'mobile_truck', address | route, workingHours, geo, isMobile }`
- `Branch` becomes a thin alias/type-narrowing of `Location` where `type` is restaurant-related — **no rename of existing `useBranchStore` or `branchService` is required in this phase**; they continue to work against the `Location` API under the hood.
- Mobile-specific fields (`currentGeo`, `scheduledStops`) are additive and optional, unused by static locations.

---

### P1A.3 — Module Registry (Critical / High Effort)

**Priority:** P0
**Complexity:** High
**Dependencies:** P1A.1
**Estimated Effort:** 5–7 days

A `Module` is a self-contained business-type capability (Restaurant, Cafe, Bar, Hotel, Food Court, Mobile Truck). Build:
- `Module { key, name, routes: string[], navItems, defaultFeatureFlags }` *(note: the `requiredSubscriptionTier` field originally proposed here is removed from the core `Module` shape in this revision — module *registration* is a foundation concern; module *gating by paid tier* is a Phase 7 commercial concern, applied on top. A tenant's `activeModules` list, in the absence of Phase 7, is simply admin-configured directly.)*
- A frontend **module registry** (`src/modules/registry.ts`) that the app shell reads to determine which routes, nav items, and dashboard widgets are active for the current tenant.
- The existing restaurant feature set (menu, cart, checkout, reservations, order tracking) is registered as the **first module: `restaurant`**, with zero behavior change — it is simply declared as a module rather than assumed as the only possible application.
- Module boundaries are designed so Phase 6 (Hospitality Modules) and Phase 8 (Hotel Operations) can register new modules without modifying core routing or shared components.

---

### P1A.4 — Backward Compatibility Strategy (Critical / Low Effort, High Importance)

**Priority:** P0
**Complexity:** Low (process, not code-heavy)
**Dependencies:** P1A.1, P1A.2, P1A.3
**Estimated Effort:** 2–3 days (documentation + guardrails) + ongoing review discipline

- Document and enforce: every new foundation model has a **default value** that reproduces today's single-restaurant behavior (default tenant, `restaurant` module, default location = existing branch list).
- Add a CI/lint check or PR checklist item: "Does this change require a tenant/module/location to be set, and does it degrade gracefully when one isn't?"
- No existing component is required to change in this phase. Existing services (`menuService`, `orderService`, etc.) keep their current signatures; tenant/location context is threaded through implicitly via the new `useTenantStore` rather than requiring every call site to be rewritten.
- *(Role-based behavior is explicitly out of scope for this item — the default `customer/staff/admin` role set continues to work unchanged until Phase 1B introduces the RBAC foundation; this item only guarantees Tenant/Location/Module defaults.)*

---

**Phase 1A exit criteria:** Tenant, Location, and Module models exist in the frontend type system and are wired to (at minimum mocked, ideally real) backend endpoints; the existing restaurant application runs unchanged on top of them as the `restaurant` module under a default tenant; CI guardrails for backward compatibility are in place. **Subscription, RBAC, feature flags, and full tenant-aware routing are explicitly not required to exit this phase** — they are addressed in Phase 1B and Phase 7.

---

## Phase 1B — Platform Governance & Enablement (Sprint 3–4)

> **Goal:** Enable governance, permissions, rollout control, and migration readiness — **after** the core platform abstractions from Phase 1A exist. This phase remains foundational (nothing in Phases 2–6 should be built without it), but it is explicitly the *second* step: it operates on top of Tenant/Location/Module rather than alongside them, which is why it is sequenced as 1B rather than folded into 1A.
>
> No new customer-facing features ship in this phase, consistent with Phase 1A.

### P1B.1 — RBAC Foundation (Critical / High Effort)

**Priority:** P0
**Complexity:** High
**Dependencies:** P1A.1 (Tenant model must exist for tenant-scoped roles); requires backend role/permission claims in JWT
**Estimated Effort:** 5–8 days

- Generalize the existing `customer | staff | admin` role enum into a **tenant-scoped, permission-based** model: `Role { key, tenantId | null (global), permissions: Permission[] }`, with `Permission` strings like `menu.edit`, `order.manage`, `branch.manage`, `room.manage` (future), `tenant.manage` (platform-level).
- This is the **foundation** consumed by Phase 5 (Admin Platform) for admin authorization and by Phase 7 (SaaS & Enterprise) for Advanced RBAC — it is not duplicated work, it is built once here and extended later.
- Existing `customer/staff/admin` values continue to work unchanged as a default role set for the `restaurant` module; no existing authorization behavior changes in this phase.

---

### P1B.2 — Feature Flag System (High / Medium Effort)

**Priority:** P0
**Complexity:** Medium
**Dependencies:** P1A.1, P1A.3
**Estimated Effort:** 3–4 days

- Lightweight feature flag service (`src/lib/feature-flags.ts`) resolving flags by `tenantId + flag key`.
- **Important — updated this revision:** because the Subscription model has been relocated to Phase 7, feature flags **must function fully without a subscription system**. In this phase, flags resolve from three sources only: (1) static tenant configuration, (2) the tenant's `activeModules` list (from P1A.3, admin-configured in the absence of billing), and (3) simple per-tenant overrides. There is no dependency on `Subscription.activeModules` as previously drafted.
- Designed so that Phase 7's Subscription & Plan Management can later become a **fourth** resolution source (plan-tier-based flag defaults) without changing the flag service's public API or any existing call site (`useFeatureFlag('module:bar')` continues to work identically once Phase 7 ships).
- Used to progressively roll out Phase 6/8 modules per tenant without code branching in components.

---

### P1B.3 — Tenant-Aware Routing Strategy (High / Medium Effort)

**Priority:** P1
**Complexity:** Medium
**Dependencies:** P1A.1, P1A.3
**Estimated Effort:** 2–3 days

- Implement the routing decision from P1A.1 in `next.config.ts` / `src/middleware.ts` (the same middleware file already planned in Phase 3 Production Hardening — see P3.1 — is extended, not duplicated, to also resolve tenant context).
- Define how `src/app/admin/*` and module-specific routes (e.g., future `/hotel/*`, `/bar/*`) nest under tenant resolution.
- Existing routes (`/menu`, `/checkout`, `/dashboard`, etc.) continue to resolve identically for the default/implicit tenant — **no URL changes for the current single-tenant deployment.**

---

### P1B.4 — Database & API Migration Planning (Critical / Planning Effort)

**Priority:** P0
**Complexity:** Planning-only in this phase (execution spans Phase 1B–5)
**Dependencies:** P1A.1, P1A.2; coordinated with the Django backend team
**Estimated Effort:** 3–5 days planning, execution effort tracked per backend sprint

- Produce a migration plan (not migration code, which is backend-owned) covering: adding `tenant_id`/`location_id` foreign keys to existing restaurant tables without downtime, backfilling a single default tenant/location for all existing rows, and an API versioning strategy (`/api/v1/` unchanged, `/api/v2/` or header-based tenant context for new endpoints) so existing frontend API calls do not break mid-migration.
- Explicitly call out which existing endpoints (menu, orders, reservations, branches) need additive (not breaking) changes to accept an optional tenant/location context.
- *(No longer references subscription/billing tables — that planning work is scoped within Phase 7 alongside the Subscription & Plan Management item itself.)*

---

**Phase 1B exit criteria:** RBAC permission model, feature flag service, tenant-aware routing/middleware, and a reviewed migration plan are all in place, operating on top of the Phase 1A abstractions. Existing restaurant authorization and routing behavior remain unchanged for the default tenant.

---

## Phase 2 — Platform UI Foundation (Sprint 5–6)

> **Goal:** Create a reusable UI platform — design tokens, a white-label theme engine foundation, a shared component library, and permission-aware navigation — that supports multi-tenant branding, future white-labeling, module-based navigation, and admin extensibility. *(New phase, inserted this revision between the foundation phases and Production Hardening.)*
>
> **Why this phase exists and why it's positioned here:** Every phase from here forward touches UI: Production Hardening polishes existing screens, Feature Completion adds new ones, Admin Platform builds an entire new surface, Hospitality Modules and Hotel Operations each need their own screens, and Phase 7's white-label work needs tenant branding to already be themeable. Building all of that UI against ad-hoc, hardcoded styling — as the current codebase does (see `TECHNICAL_DEBT.md` on `globals.css` CSS-variable theming with no tenant awareness) — means every later phase pays a styling/theming tax individually. Building the token system, theme engine foundation, and shared component library once, immediately after the data-model foundation exists, means every later phase consumes it instead of re-deriving it. This is explicitly a **force multiplier**: its cost is paid once, and it reduces implementation cost in Phases 3–8.
>
> This phase is additive: it does not require rewriting any existing screen. Existing components continue to render exactly as they do today; new and refactored screens from Phase 3 onward are expected to adopt the token system and shared library going forward.

### P2.1 — Design Tokens (High / Medium Effort)

**Priority:** P0
**Complexity:** Medium
**Dependencies:** None (can begin immediately; benefits from P1A.1 existing for tenant-scoping but does not block on it)
**Estimated Effort:** 3–5 days

- Formalize the existing ad-hoc CSS custom properties (`--bg`, `--fg`, `--card`, `--border`, etc., currently defined directly in `globals.css` per `ARCHITECTURE.md`'s "CSS Custom Properties for Theming" decision) into a structured, documented token set:
  - **Colors:** semantic color tokens (primary, secondary, surface, success/warning/danger/info) layered over the existing light/dark CSS variable pairs
  - **Typography:** type scale tokens building on the existing Playfair Display / DM Sans / Vazirmatn font strategy
  - **Spacing:** a consistent spacing scale to replace ad-hoc Tailwind spacing values scattered across components
  - **Radius:** a small set of border-radius tokens for consistent corner treatment
  - **Elevation:** shadow/elevation tokens for consistent depth (cards, modals, dropdowns)
- Tokens are exposed as CSS custom properties (consistent with the existing theming approach — no new runtime dependency) so the existing dark/light/system theme switching (`useThemeStore`) continues to work unchanged.

---

### P2.2 — White-Label Theme Engine Foundation (High / High Effort)

**Priority:** P1
**Complexity:** High
**Dependencies:** P2.1, P1A.1 (tenant context needed to resolve per-tenant branding)
**Estimated Effort:** 5–8 days

- Extend the token system from P2.1 so token *values* (not just token *names*) can be overridden per tenant: tenant brand colors, logo, and font configuration.
- This is explicitly a **foundation** for white-labeling, not the full white-label feature — full custom-domain white-labeling remains in Phase 7 (P7.1), which now consumes this engine rather than building theming from scratch.
- Default behavior: with no tenant-specific overrides set, every tenant (including today's single default tenant) renders with the existing Savor brand tokens — **zero visual change** to the current application.

---

### P2.3 — Shared Component Library (High / High Effort)

**Priority:** P1
**Complexity:** High
**Dependencies:** P2.1
**Estimated Effort:** 6–9 days

- Formalize the existing `components/ui/` primitives (Button, Input, Modal, Badge, Card, Avatar, Skeleton, Divider — already built on Radix UI per `ARCHITECTURE.md`) into a documented, token-driven shared library:
  - **Button, Input, Form primitives** — consolidate existing variants/sizes, wire to design tokens instead of hardcoded Tailwind classes
  - **Card, Modal** — already exist; formalize as the canonical primitives all future feature/admin UI must use
  - **Table** *(new primitive)* — a reusable data table component, since `TECHNICAL_DEBT.md` notes the admin panel has no pagination or consistent list UI; this primitive is what Phase 5 (Admin Platform) and Phase 6/8 modules will build on instead of hand-rolling tables per screen
  - **Data display patterns** *(new)* — stat cards, empty states, loading skeletons, and error states standardized once, reused everywhere
- No existing usage of `components/ui/*` is broken; this is a refactor-in-place plus additive new primitives (Table, standardized data display patterns).

---

### P2.4 — Permission-Aware Navigation Foundation (High / Medium Effort)

**Priority:** P1
**Complexity:** Medium
**Dependencies:** P1A.3 (Module Registry), P1B.1 (RBAC Foundation)
**Estimated Effort:** 4–6 days

- **Sidebar architecture:** a reusable sidebar shell that renders sections based on the active tenant's `activeModules` (P1A.3) and the current user's permissions (P1B.1), replacing the current hardcoded restaurant-only navigation.
- **Topbar architecture:** a reusable topbar shell (branch/location selector, notification center, user menu) generalized from the existing `Header.tsx` to be tenant/module-aware.
- **Module-aware navigation:** navigation items are contributed by each registered module (`Module.navItems` from P1A.3) rather than hardcoded per page.
- **Permission-aware navigation:** navigation items are filtered by the current user's permissions (P1B.1) before rendering, so a `staff` or future `front_desk` role only sees relevant sections.
- This is the shell that Phase 5's P5.7 ("Admin Shell Becomes Module-Aware") directly builds on — P5.7 is now scoped as *applying* this foundation to the admin panel specifically, rather than building module-aware navigation from scratch.

---

**Phase 2 exit criteria:** A documented token set, a tenant-overridable theming layer, a formalized and extended shared component library, and a reusable permission-aware navigation shell all exist and are consumed by at least one real screen (the existing restaurant application, re-pointed at the new primitives with no visual regression). All of Phases 3–8 are expected to build on this layer rather than introducing new one-off styling.

---

## Phase 3 — Production Hardening (Sprint 7–8)

> **Goal:** Make the existing features production-safe and deployable. No new features. *(Content identical to the prior revision's Phase 2 — renumbered only, to make room for the new Phase 2 — Platform UI Foundation.)*

### P3.1 — Authentication Middleware (Critical / High Effort)

**Priority:** P0
**Complexity:** Medium
**Dependencies:** Requires decision on JWT storage strategy. *(Updated dependency, unchanged from prior revision: this middleware is the same file extended by P1B.3 for tenant resolution — implement together for efficiency, but auth gating itself is unchanged.)*
**Estimated Effort:** 3–5 days

Create `src/middleware.ts` to protect `/dashboard/*`, `/checkout/*`, and `/admin/*`. Decide between:
- Option A: Keep JWT in localStorage, check auth client-side with redirect on mount (quick, but race condition)
- Option B: Move JWT to `httpOnly` cookie managed by Django → middleware reads cookie (secure, correct)

Recommendation: Option B for production.

---

### P3.2 — Admin Role Authorization (Critical / Low Effort)

**Priority:** P0
**Complexity:** Low (depends on P3.1)
**Dependencies:** P3.1 (middleware), backend must include role in JWT claims. *(Note, unchanged from prior revision: once Phase 1B's RBAC foundation (P1B.1) lands, this task's implementation target shifts from a hardcoded role check to a permission check — see Phase 5 for the updated version. This Phase 3 version remains valid as an interim hardening step if Phase 5 has not yet shipped.)*
**Estimated Effort:** 1 day

Add role check in middleware for `/admin/*` routes. Redirect non-admin users to home.

---

### P3.3 — Fix Mock Mode Default (Critical / Trivial)

**Priority:** P0
**Complexity:** Trivial
**Dependencies:** None
**Estimated Effort:** 30 minutes

Change `.env.example` default to `NEXT_PUBLIC_USE_MOCK=false`. Add CI step to reject builds with `USE_MOCK=true` + `NODE_ENV=production`.

---

### P3.4 — PWA Assets (Critical / Low Effort)

**Priority:** P0
**Complexity:** Low
**Dependencies:** None
**Estimated Effort:** 4 hours

Generate icon files for all 8 sizes declared in `manifest.json`. Create `public/og-image.jpg`. Create `public/screenshots/menu.png` (referenced in manifest). Verify PWA install flow end-to-end.

---

### P3.5 — Fix Mock Login Logic (High / Trivial)

**Priority:** P1
**Complexity:** Trivial
**Dependencies:** None
**Estimated Effort:** 30 minutes

Fix the credential check in `authService.login()` mock mode so invalid credentials throw an error.

---

### P3.6 — Wire WebSocket Hooks to UI (High / Medium Effort)

**Priority:** P1
**Complexity:** Medium
**Dependencies:** Requires working Django Channels backend
**Estimated Effort:** 2–3 days

1. In `OrderTracker.tsx`: When `useMockSimulation=false`, use `useOrderWebSocket(orderId)` for status updates
2. In `Providers`: Mount `useNotificationWebSocket()` for authenticated users
3. Pass `useMockSimulation={process.env.NEXT_PUBLIC_USE_MOCK === 'true'}` from order/success pages

---

### P3.7 — Complete Arabic Translations (High / Medium Effort)

**Priority:** P1
**Complexity:** Low (translation, not engineering)
**Dependencies:** None
**Estimated Effort:** 2–3 days

Fill all 187 keys in `src/i18n/locales/ar.json`. Consider using the Persian file as a structural reference. Add a CI check that verifies all locale files have the same key count.

---

### P3.8 — ReactQueryDevtools Production Guard (Low / Trivial)

**Priority:** P2
**Complexity:** Trivial
**Dependencies:** None
**Estimated Effort:** 5 minutes

Wrap `<ReactQueryDevtools>` in `process.env.NODE_ENV === 'development'` check.

---

### P3.9 — Remove Dead Dependencies (Low / Trivial)

**Priority:** P2
**Complexity:** Trivial
**Dependencies:** None
**Estimated Effort:** 15 minutes

Remove `socket.io-client` and `next-pwa` from `package.json`. These are installed but unused and add bundle weight.

---

## Phase 4 — Feature Completion (Sprint 9–11)

> **Goal:** Complete partially-implemented features and fill in missing integrations. *(Content identical to the prior revision's Phase 3 — renumbered only.)*

### P4.1 — Payment Gateway Integration (High / High Effort)

**Priority:** P1
**Complexity:** High
**Dependencies:** Backend payment intent API, Stripe account
**Estimated Effort:** 5–8 days

Integrate Stripe Elements for card payment. Flow:
1. Checkout form → backend creates Stripe PaymentIntent → returns `client_secret`
2. Frontend uses `@stripe/react-stripe-js` to confirm payment
3. On success → backend creates order → redirect to `/checkout/success`
4. On failure → redirect to `/checkout/failure`

Cash and dine-in orders can bypass the gateway.

*(Note: this is order-payment processing, distinct from the recurring billing/plan-payment work in Phase 7's Subscription & Plan Management — the two share the Stripe vendor relationship but are functionally separate integrations.)*

---

### P4.2 — Firebase Push Notifications (High / Medium Effort)

**Priority:** P1
**Complexity:** Medium
**Dependencies:** Firebase project, VAPID key, backend FCM integration
**Estimated Effort:** 2–3 days

1. Create `src/lib/firebase.ts` with `initializeApp()` + `getToken()`
2. After user login in `AuthBootstrapper`, call `requestNotificationToken()`
3. Pass token to `notificationService.registerDevice(token, 'web')`
4. Test push notification delivery via Django Channels / FCM

---

### P4.3 — Reviews Feature (Medium / Medium Effort)

**Priority:** P2
**Complexity:** Medium
**Dependencies:** Backend review API (endpoints already defined)
**Estimated Effort:** 3–5 days

1. Create `reviewService` with `create()`, `getItemReviews()` methods
2. Create `useCreateReview`, `useItemReviews` hooks
3. Add star rating UI to `FoodDetailModal`
4. Add "Write a Review" to completed orders in `dashboard/orders/page.tsx`
5. Display average ratings and review count in `FoodCard`

---

### P4.4 — QR Table Ordering Completion (Medium / Low Effort)

**Priority:** P2
**Complexity:** Low
**Dependencies:** Backend table API (endpoints defined)
**Estimated Effort:** 1–2 days

1. When `/table/[tableId]` loads, fetch table info from `ENDPOINTS.TABLE.INFO(tableId)`
2. Store table number in a dedicated store or branch store
3. Pre-populate checkout form with `order_type: 'dine_in'` and `table_number`
4. Show confirmation that the user is ordering for Table N

---

### P4.5 — Home Page Dynamic Featured Items (Low / Low Effort)

**Priority:** P3
**Complexity:** Low
**Dependencies:** None
**Estimated Effort:** 2–3 hours

Replace hardcoded `FEATURED` array in `src/app/page.tsx` with `useFeaturedItems()` hook. Convert to Client Component or use React Query with server hydration.

---

### P4.6 — Reservation Confirmation Page (Low / Low Effort)

**Priority:** P3
**Complexity:** Low
**Dependencies:** None
**Estimated Effort:** 2–4 hours

Create `src/app/reservation/confirm/page.tsx`. Show confirmation code, date, time, guests, branch, and a calendar add link (`.ics` download).

---

### P4.7 — Image Upload for User Avatar (Medium / Medium Effort)

**Priority:** P3
**Complexity:** Medium
**Dependencies:** Backend file upload API
**Estimated Effort:** 2–3 days

Add file input to `dashboard/settings/page.tsx` profile section. Upload via multipart form to backend. Display via `next/image` with Cloudinary/S3 URL (both are in `next.config.ts` image domains).

---

### P4.8 — Locale Switching Without Page Reload (Low / Low Effort)

**Priority:** P3
**Complexity:** Low
**Dependencies:** None
**Estimated Effort:** 2 hours

After `useLangStore.setLocale()` sets the `NEXT_LOCALE` cookie, call `router.refresh()` to trigger a server-side re-render with the new locale.

---

## Phase 5 — Admin Platform (Sprint 12–16)

> **Goal:** Build a functional admin backend to support real hospitality operations. *(Content preserved from the prior revision's Phase 4 — renumbered, and one item (P5.7) updated to explicitly consume the new Phase 2 navigation foundation instead of building module-aware navigation from scratch.)*

### P5.1 — Admin API Services, Tenant- and Location-Scoped (High / High Effort)

**Priority:** P0
**Complexity:** High
**Dependencies:** Django admin API endpoints, **P1A.1 Tenant model, P1A.2 Location model**
**Estimated Effort:** 6–9 days *(unchanged from prior revision; +1 day versus the original single-tenant estimate to thread tenant/location scoping through every method — see migration analysis)*

Create `admin.service.ts` with methods for:
- `getStats(tenantId, locationId?, period)` — revenue, orders, customers, reservations, **scoped to the current tenant and optionally a single location**
- `getLiveOrders(tenantId, locationId?)` — real-time order board
- `updateOrderStatus(id, status)` — advance order through lifecycle
- `getMenuItems(tenantId)`, `createMenuItem()`, `updateMenuItem()`, `deleteMenuItem()`
- `getCustomers(tenantId, filters)` — paginated customer list
- `getReservations(tenantId, locationId?, date, status)` — reservation management

All methods accept tenant/location context from the new `useTenantStore` (P1A.1) rather than assuming a single global restaurant.

---

### P5.2 — Admin Stats with Real Data (High / Medium Effort)

**Priority:** P1
**Complexity:** Medium (after P5.1)
**Dependencies:** P5.1
**Estimated Effort:** 3–4 days

Replace hardcoded stats in `admin/stats/page.tsx` with React Query hooks backed by `admin.service`. Add date range picker for period selection. Add a **location filter** alongside the date range picker (no-op/hidden for single-location tenants, useful immediately for multi-branch and, later, multi-property tenants).

---

### P5.3 — Admin Order Board with WebSocket (High / Medium Effort)

**Priority:** P1
**Complexity:** Medium
**Dependencies:** P5.1, P3.6
**Estimated Effort:** 3–4 days

Replace local state in `admin/orders/page.tsx` with real-time WebSocket updates from Django Channels. Status advancement should call backend API. Sound/visual alert on new orders.

---

### P5.4 — Admin Menu Management with CMS (Medium / High Effort)

**Priority:** P2
**Complexity:** High
**Dependencies:** P5.1, image upload API
**Estimated Effort:** 5–7 days

Extend `admin/menu/page.tsx` to:
- Create/edit menu items via API (with image upload)
- Manage categories and their ordering
- Set featured/popular/new flags
- Manage extras per item
- Preview nutritional info

---

### P5.5 — Admin Reservations with Live Calendar (Medium / Medium Effort)

**Priority:** P2
**Complexity:** Medium
**Dependencies:** P5.1
**Estimated Effort:** 3–4 days

Replace local state with API data. Add calendar grid view showing reservations by time slot. Implement approve/reject/seat actions backed by API.

---

### P5.6 — Admin Role Authorization via RBAC Foundation (Critical / Low Effort)

**Priority:** P0
**Complexity:** Low
**Dependencies:** **P1B.1 RBAC Foundation**
**Estimated Effort:** 1–2 days

Supersedes the interim hardcoded role check from P3.2 once Phase 1B has shipped: middleware and admin pages check `hasPermission(user, 'admin.access')` and finer-grained permissions (`menu.edit`, `reservation.manage`, etc.) rather than a single `role === 'admin'` flag. This is what makes a future `staff` role (Phase 7's Multi-Location Operations) or hotel `front_desk` role (Phase 8) possible without another authorization rewrite.

---

### P5.7 — Admin Shell Becomes Module-Aware (Medium / Medium Effort)

**Priority:** P1
**Complexity:** Medium
**Dependencies:** P1A.3 Module Registry, **P2.4 Permission-Aware Navigation Foundation** *(updated dependency this revision)*
**Estimated Effort:** 1–2 days *(reduced from the prior revision's 2–3 days, since the underlying sidebar/topbar/module-aware/permission-aware navigation architecture is now built once in Phase 2 — this item is reduced to *applying* that shell to the admin panel specifically, rather than building the navigation architecture from scratch.)*

Wire the admin sidebar/navigation to the Phase 2 navigation foundation: render sections based on the tenant's `activeModules` (P1A.3) and the current user's permissions (P1B.1/P5.6), replacing the hardcoded restaurant-only menu (Stats/Orders/Menu/Customers/Reservations). This is what allows Phase 6 and Phase 8 to plug in "Bar Inventory," "Room Management," etc. as additional admin sections without modifying the admin shell itself.

---

## Phase 6 — Hospitality Modules (Sprint 17–21)

> **Goal:** Implement additional hospitality **business-type** modules — cafe, bar, smoke/lounge, event, venue, and mobile food/coffee truck — as modules on top of the Phase 1A/1B foundation and the Phase 2 UI platform. *(This phase is narrowed this revision: it now contains only business-type modules. The operational-scaling items that were previously bundled into this phase — location-aware ordering, maps integration, staff roles, location management, order search/export — have been split out into their own **Phase 7 — Multi-Location Operations**, per this revision's restructuring request, since those are operational-scaling concerns orthogonal to *which* business type a tenant runs.)*

### P6.1 — Cafe Module

**Effort:** 5–8 days

- Register `cafe` module: lighter-weight menu structure optimized for quick-serve (no table service, simplified extras, size/temperature modifiers for drinks)
- Reuse existing menu/cart/checkout components from the `restaurant` module — only category taxonomy and item modifiers differ
- Quick-reorder UI for frequent drink orders
- Built on the Phase 2 shared component library and design tokens, so module-specific screens inherit tenant branding automatically

### P6.2 — Bar Module

**Effort:** 5–8 days

- Register `bar` module: tab management (open tab, add items, close/pay tab), age-verification flag on checkout, happy-hour pricing windows
- Builds on the Feature Flag system (P1B.2) for time-windowed pricing rules

### P6.3 — Smoke/Lounge Module

**Effort:** 4–6 days

- Register `smoke` module: age-gated product catalog, compliance disclaimers, regional sale-restriction rules surfaced at checkout
- Reuses cart/checkout infrastructure with module-specific compliance middleware

### P6.4 — Event Module

**Effort:** 6–10 days

- Register `event` module: ticketed/RSVP-based ordering for a scheduled event at a `Location`, capacity limits, pre-order windows that close before the event starts

### P6.5 — Venue Module

**Effort:** 6–10 days

- Register `venue` module: multi-vendor food court support — a single `Location` of type `food_court_stall` aggregates multiple tenant menus under one checkout/delivery experience (depends on P1A.1 Tenant and P1A.2 Location supporting parent/child relationships)

### P6.6 — Mobile Food Truck / Mobile Coffee Truck Support

**Effort:** 5–8 days

- Extend `Location` (P1A.2) usage for `isMobile = true` locations: live position updates, scheduled stop calendar shown to customers, "currently open near you" discovery on the home page
- Order pickup windows tied to the truck's current/scheduled stop rather than a fixed address
- *(Note: live position updates and the "near you" discovery surface depend on the Maps integration delivered in Phase 7 — P7.2 — these two items should be sequenced together or P7.2 pulled forward if mobile truck support is prioritized early.)*

---

## Phase 7 — Multi-Location Operations (Sprint 22–24)

> **Goal:** Operational scaling concerns that apply *across* business types — a restaurant chain, a cafe chain, or a tenant running both, all need location-aware ordering, delivery mapping, staff roles, location management, and order search/export. *(New, standalone phase this revision — split out of the former combined "Hospitality Modules" phase per the restructuring request, since these are operational-scaling concerns independent of which business-type module(s) a tenant has active. Content is otherwise identical in scope to the "Multi-Location & Operations Scale" section of the prior revision, which itself carried over the original roadmap's "Multi-Branch & Operations Scale" phase unchanged in scope.)*

### P7.1 — Location-Aware Ordering *(was: Branch-Aware Ordering)*

**Effort:** 5–8 days

- Require location selection before adding to cart
- Validate that selected items are available at the active location
- Show location-specific working hours and delivery radius on menu page
- Support location-specific pricing (type-level support exists, service support needed)

### P7.2 — Delivery Address with Map Integration

**Effort:** 5–8 days

- Integrate Google Maps or Mapbox for address autocomplete
- Show delivery radius boundary on map
- Validate delivery address is within range of selected location
- *(This item also unblocks the live-position/discovery features noted in P6.6 for mobile trucks — consider sequencing P7.2 before or alongside P6.6 if mobile truck support is a near-term priority.)*

### P7.3 — Staff Role Support

**Effort:** 3–5 days *(unchanged — implemented via the RBAC foundation from P1B.1/P5.6 instead of a one-off middleware branch, which simplifies implementation but the estimate is left unchanged to absorb integration testing)*

- Add `staff` role handling in middleware (access to `/admin/orders` only)
- Staff dashboard: simplified view of incoming orders for their location
- Table management view for front-of-house staff

### P7.4 — Location Management Admin Page *(was: Branch Management Admin Page)*

**Effort:** 3–5 days

- New `/admin/locations` page (was `/admin/branches`)
- Create/edit location details, working hours, delivery radius, and — new — `type` (restaurant branch, cafe, bar, mobile truck, etc.)
- Activate/deactivate locations
- Built on the Phase 2 Table primitive (P2.3) and Admin Shell (P5.7) rather than a one-off list UI

### P7.5 — Order History Search & Export

**Effort:** 3–5 days

- Full-text search across orders (backend support needed)
- Filter by date range, status, location, payment method
- CSV export for accounting

---

## Phase 8 — Hotel Operations (Sprint 25–31)

> **Goal:** Implement hotel-specific hospitality operations as a **distinct vertical specialization**, given the substantially different domain model required: inventory is rooms, not menu items; bookings span multiple nights, not a single session; check-in/check-out are stateful, multi-step workflows; and room assignment has no analogue in the catalog-and-cart model that powers every other module.
>
> **Repositioning note (this revision):** In the prior revision, Hotel Operations was framed as parallel to the Hospitality Modules phase — a sibling "module" alongside cafe and bar. This revision clarifies the relationship: **Restaurant, Cafe, Bar, Smoke/Lounge, Event, Venue, and Mobile Food/Coffee Truck (Phase 6) all share a common ordering/catalog/payment architecture** — a menu of items, a cart, a checkout flow, and order tracking, with module-specific variations layered on top (tabs for bars, age-gating for smoke/lounge, RSVP windows for events). **Hotel does not fit this shared architecture** — its core entities (`Room`, `Booking`, date-range availability, folio/check-in state) are fundamentally different from `MenuItem`/`Cart`/`Order`. For that reason, Hotel Operations is intentionally positioned as a **later, separate vertical specialization** rather than a sibling business-type module squeezed into the Phase 6 catalog model. It depends only on the Phase 1A/1B foundation (Tenant, Location, RBAC) and the Phase 2 UI platform — it does **not** depend on Phase 6 or Phase 7 shipping first, and could in principle be resequenced earlier if hotel demand outpaces hospitality-module demand, since its only hard dependency is the foundation layer.
>
> All hotel features and effort estimates below are preserved unchanged from the prior revision.

### P8.1 — Hotel Module Registration & Room Inventory

**Effort:** 6–10 days

- Register `hotel` module on a `Location` of type `hotel_property`
- `Room { id, locationId, type, capacity, baseRate, amenities, status }`
- Room availability calendar, distinct from the existing menu/item availability model

### P8.2 — Hotel Bookings

**Effort:** 8–12 days

- Multi-night booking flow distinct from the existing single-session checkout: date range picker, room type selection, rate calculation across nights, deposit/cancellation policy
- Reuses the existing `Cart`/`Checkout` payment infrastructure (P4.1 Stripe integration) for deposit and balance payment — this is the one point of architectural overlap with the catalog-based modules, since payment capture itself is generic

### P8.3 — Check-in / Check-out

**Effort:** 5–8 days

- Digital check-in flow (ID capture placeholder, room assignment confirmation, digital key/access code placeholder)
- Check-out flow with folio review (room charge + room-service charges + incidentals) and final payment capture

### P8.4 — Room Service

**Effort:** 4–6 days

- Reuses the existing `restaurant` module's menu/cart/order infrastructure, scoped to a guest's room number instead of a table number — directly parallels the QR Table Ordering pattern (P4.4) and benefits from the same Location-aware ordering work in P7.1

### P8.5 — Hotel-Specific Reservations (Spa, Dining, Amenities)

**Effort:** 4–6 days

- Generalizes the existing `reservationService` (time-slot booking, already used for table reservations) to additional bookable resources within a hotel property: spa treatments, in-house restaurant dining, amenity bookings

---

## Phase 9 — SaaS & Enterprise Features (Sprint 32+)

> **Goal:** White-label, advanced governance, commercialization, and enterprise-grade operational tooling for the platform. *(This phase replaces the prior revision's Phase 7 — SaaS & Enterprise Features. All original items are preserved. This revision adds one new item — **Subscription & Plan Management** — relocated here from the foundation phase per the restructuring request below.)*

### Subscription Model Change Rationale

> The Subscription model was previously introduced in the foundation phase (originally P1.4, "Subscription Model"), gating module access and feature flags from day one. This revision relocates it here, to Phase 9, as a **SaaS commercialization concern** rather than a structural one. Rationale:
>
> - **Tenant, Location, and Module remain core foundation concepts** (Phase 1A) — a tenant can exist, have locations, and have active modules without any billing relationship existing yet. This matches how the platform will actually be operated early on: tenants onboarded and configured directly (e.g., by an admin/sales process), not necessarily self-service from day one.
> - **Subscription is what tenants buy**, not what makes the platform structurally function. Coupling it into the foundation phase meant Phase 1 couldn't exit without also deciding billing cycles, tiers, and seat models — decisions that are commercial/product decisions, not architectural prerequisites.
> - **No subscription-related functionality has been removed.** Every field and behavior originally specified for the Subscription model — `tenantId`, `tier`, `activeModules`, `seats`, `billingCycle`, `status`, and tier-based module/feature gating — is preserved below in P9.6, unchanged in scope, just relocated and given a clearer name.
> - **Feature flags do not depend on Subscription.** As clarified in P1B.2, flags resolve from tenant configuration, module activation, and simple overrides in Phase 1B; Phase 9's Subscription model becomes an *additional* flag-resolution source once it ships, without changing the flag service's API.

### P9.1 — White-Label & Custom Domains

**Effort:** 8–12 days *(unchanged from the prior revision; reduced from the original "Multi-Tenancy Architecture" line item's 15–25 days, since core tenant data isolation and routing already exist from Phase 1A/1B, and the visual theming substrate now exists from Phase 2 — see migration analysis)*

- Per-tenant theming (primary color, logo, fonts) — **now consumes the Phase 2 White-Label Theme Engine Foundation (P2.2) directly**, rather than building tenant theming from scratch as implied in the prior revision. This further de-risks this item versus the original estimate, though the estimate is held constant to absorb custom-domain-specific work below.
- Custom domain mapping (CNAME → tenant resolution) building on the routing strategy from P1B.3
- White-label deploy pipeline for fully bespoke client domains

### P9.2 — Advanced RBAC (Fine-Grained Permissions) *(was: Role-Based Access Control (RBAC))*

**Effort:** 3–5 days *(unchanged from the prior revision; reduced from the original 5–8 days, since the permission model and `Role`/`Permission` primitives already exist from P1B.1 — this phase only adds the additional fine-grained roles, not the underlying system)*

Fine-grained permissions beyond `customer/staff/admin`, layered on the Phase 1B RBAC foundation:
- `menu_editor` — can edit menu items
- `order_manager` — can manage orders
- `branch_manager` / `location_manager` — scoped to specific locations
- `analytics_viewer` — read-only stats access
- `front_desk` *(hotel)* — check-in/check-out and room status only

### P9.3 — Audit Log

**Effort:** 5–8 days

Track all admin mutations (who changed what, when). Display in admin UI. Requires backend audit model. Naturally tenant-scoped since every admin mutation already carries tenant/location context from Phase 5.

### P9.4 — Advanced Analytics Dashboard

**Effort:** 8–12 days

- Revenue trends with chart visualizations (Recharts or Victory)
- Cohort retention analysis
- Menu item performance trends
- Heatmap of popular order times
- Export to PDF
- Cross-module and cross-location rollups (e.g., a tenant running both a restaurant and a hotel can see combined revenue), enabled by the Phase 1A Tenant/Location model

### P9.5 — Observability & Monitoring

**Effort:** 3–5 days

- Sentry for frontend error tracking (`@sentry/nextjs`)
- Core Web Vitals reporting to Sentry Performance
- Google Analytics 4 via `@next/third-parties/google`
- API latency tracking in React Query onError callbacks

### P9.6 — Subscription & Plan Management *(new this revision; relocated from the foundation phase, originally "Subscription Model")*

**Priority:** P1
**Complexity:** Medium
**Dependencies:** P1A.1 (Tenant), P1A.3 (Module Registry), P1B.2 (Feature Flag System, as the integration point)
**Estimated Effort:** 3–4 days *(unchanged from the original Subscription Model estimate — only its position in the roadmap and its framing have changed, not its scope or effort)*

- `Subscription { tenantId, tier: 'starter' | 'growth' | 'enterprise', activeModules: Module[], seats, billingCycle, status }` — **identical shape to the original specification**, with `activeModules` now layered on top of the Phase 1A Module Registry rather than defined alongside it.
- Frontend reads the active subscription to gate module access and feature flags (e.g., a `starter` tenant might only have the `restaurant` module active; an `enterprise` tenant might have `restaurant + bar + hotel`) — this gating behavior is unchanged from the original specification.
- Integrates with the Phase 1B Feature Flag System (P1B.2) as an additional resolution source, per the [Subscription Model Change Rationale](#subscription-model-change-rationale) above — flags continue to work without it, but a shipped Subscription system upgrades flag resolution to be plan-aware.
- No billing/payment integration was in scope for the original item either — that remains a candidate for a future "Billing Platform" follow-up item if/when real payment collection for subscriptions (distinct from order payments in P4.1) is prioritized. This item only establishes the **data model and gating logic**, exactly as originally scoped.

### P9.7 — Loyalty & Points System

**Effort:** 8–12 days

- Points earned per order
- Points balance in user dashboard
- Redeem points at checkout as discount
- Loyalty tier display (Bronze/Silver/Gold)
- Points can be scoped per-tenant or shared across a multi-property tenant (e.g., a hotel group with an in-house restaurant), decision deferred to product but the data model from Phase 1A supports either.

---

## AI & Automation Opportunities

> Unchanged from prior revisions. Several of these become more valuable, not less, once the platform spans multiple business types (e.g., AI Menu Search becomes AI Catalog Search across restaurant/cafe/bar; Predictive Wait Times generalizes to predictive room turnover for hotels).

| Opportunity | Description | Effort |
|-------------|-------------|--------|
| Smart Reorder Suggestions | "Order again?" prompt based on order history frequency | 3–5 days |
| AI Menu Search | Natural language search ("something spicy and under $20") | 5–8 days |
| Dynamic Pricing | Time-of-day or demand-based pricing rules | 8–12 days |
| Predictive Wait Times | ML model for preparation time estimation | 10–15 days |
| Personalized Homepage | Show featured items based on order history | 5–8 days |
| AI Review Summarization | Summarize item reviews with sentiment | 3–5 days |
| Chatbot Order Assistant | Conversational ordering via embedded chat | 10–15 days |

---

## Recommended Next Sprint

The highest-impact engineering tasks for immediate action. *(Updated this revision: foundation items are now split across Phase 1A/1B, and a Phase 2 UI-foundation item is included since it can begin in parallel once design tokens don't block on the data model.)*

| # | Task | Phase | Effort | Impact |
|---|------|-------|--------|--------|
| 1 | Fix `.env.example` mock default → `false` | P3.3 | 30 min | Critical safety |
| 2 | Generate and commit PWA icon files | P3.4 | 4 hrs | PWA install |
| 3 | Create `public/og-image.jpg` | P3.4 | 2 hrs | SEO / social |
| 4 | Fix mock login credential check | P3.5 | 30 min | Demo quality |
| 5 | Implement `src/middleware.ts` (client-side auth redirect + tenant resolution stub) | P3.1 / P1B.3 | 1–2 days | Security + foundation |
| 6 | Define `Tenant`, `Location`, `Module` TypeScript interfaces and default/fallback values | P1A.1–P1A.3 | 2–3 days | Unblocks all later phases |
| 7 | Draft initial design token set (colors, type scale, spacing) from existing `globals.css` variables | P2.1 | 1–2 days | Unblocks Phase 2 without waiting on full foundation |
| 8 | Mount `useNotificationWebSocket` in Providers | P3.6 | 2 hrs | Live notifications |
| 9 | Wire `useOrderWebSocket` to `OrderTracker` | P3.6 | 1 day | Real-time tracking |
| 10 | Complete `src/i18n/locales/ar.json` | P3.7 | 2 days | Arabic market |
| 11 | Draft database/API migration plan for `tenant_id`/`location_id` backfill | P1B.4 | 3–5 days (planning) | De-risks all future migration work |
| 12 | Remove `socket.io-client` and `next-pwa` from deps | P3.9 | 15 min | Bundle size |
| 13 | Guard `<ReactQueryDevtools>` behind dev check | P3.8 | 5 min | Bundle size |

**Total estimated effort for next sprint: ~11–16 days** *(adjusted from the prior revision's ~10–14 days to include the new design-token kickoff item, which can run in parallel with both the production-hardening and foundation-core workstreams without blocking either.)*

---

## Roadmap Migration Summary

> This summary covers changes made **in this revision** (the Phase 1A/1B split, Platform UI Foundation insertion, Subscription relocation, Hotel repositioning, and Multi-Location split). For the prior revision's changes (the original pivot from a single-tenant restaurant roadmap to a Hospitality SaaS Platform roadmap), see the historical summary preserved at the very end of this section.

### What changed (this revision)

- **Phase 1 split into Phase 1A and Phase 1B.** The prior single "Foundation Architecture Migration" phase is now two phases: **Phase 1A — SaaS Foundation Core** (Tenant, Location, Module, Backward Compatibility Strategy) and **Phase 1B — Platform Governance & Enablement** (RBAC, Feature Flags, Tenant-Aware Routing, Migration Planning). All eight original items are preserved with their original scope and (except where noted below) original effort estimates — only their phase grouping and numbering changed (old P1.1–P1.3, P1.8 → new P1A.1–P1A.4; old P1.5–P1.7, P1.9 → new P1B.1–P1B.4).
- **Subscription Model relocated out of the foundation entirely.** The item originally specified as P1.4 ("Subscription Model") is removed from Phase 1A/1B and now lives in **Phase 9 (P9.6, "Subscription & Plan Management")** as a SaaS commercialization concern. Its full original scope — the `Subscription` shape, tier-based module gating, and feature-flag integration — is preserved verbatim in P9.6; only its position and framing changed. See the dedicated [Subscription Model Change Rationale](#subscription-model-change-rationale) section for the full explanation. Downstream references updated: `Tenant.subscriptionTier` and `Module.requiredSubscriptionTier` (both originally part of P1.1/P1.3) are explicitly removed from the core model shapes and noted as relocated; the Feature Flag System (P1B.2) is explicitly redefined to resolve from tenant config/module activation/overrides only, with Subscription as a later, optional fourth source.
- **New Phase 2 — Platform UI Foundation inserted.** Contains four new items: Design Tokens (P2.1), White-Label Theme Engine Foundation (P2.2), Shared Component Library (P2.3), and Permission-Aware Navigation Foundation (P2.4). This phase did not exist in any prior revision. All subsequent phases (formerly Phase 2–7, now Phase 3–9) are renumbered up by one to accommodate it.
- **Hospitality Modules phase narrowed; Multi-Location Operations split out as its own phase.** The former combined phase (prior revision's Phase 5) mixed business-type modules (Cafe, Bar, Smoke, Event, Venue, Mobile Truck) with operational-scaling concerns (location-aware ordering, maps, staff roles, location management, order search/export). These are now **Phase 6 — Hospitality Modules** (business-type modules only) and **Phase 7 — Multi-Location Operations** (scaling concerns only), in that order. All eleven original items (six modules + five operational items) are preserved with identical scope and effort estimates; only their phase grouping changed.
- **Hotel Operations repositioned narratively, not functionally.** Hotel Operations remains a full phase (now **Phase 8**, was Phase 6) with all five original items (P8.1–P8.5, was P6.1–P6.5) preserved verbatim, including effort estimates. The phase introduction is rewritten to explicitly position Hotel as a **later vertical specialization** with a fundamentally different domain model (room/booking/availability vs. catalog/cart/order), rather than as a sibling "module" to Cafe/Bar/Venue in the same sense. No hotel feature, scope, or estimate was reduced.
- **Cross-references updated throughout.** Every dependency line that referenced old phase/item numbers (e.g., "P1.5 RBAC Foundation," "P1.4 Subscription," "old Phase 5 Hospitality Modules") has been updated to the new numbering (P1B.1, P9.6, Phase 6/7 respectively). The "Recommended Next Sprint" table, Executive Summary, and "Required Before Onboarding a Second Tenant" checklist are all updated to reflect the new phase structure.

### What stayed the same (this revision)

- **Every item from the prior revision is preserved** — nothing was deleted. The only items that moved phases are the four now in Phase 1A, the four now in Phase 1B, the Subscription item now in Phase 9, and the eleven items split between the new Phase 6 and Phase 7. Every other phase (Production Hardening, Feature Completion, Admin Platform's five core items, Hotel Operations' five items, the remainder of SaaS & Enterprise) is unchanged in content.
- **All effort estimates are unchanged** except: P9.1 (White-Label & Custom Domains, already reduced in the prior revision, now further de-risked in narrative by Phase 2's theme engine but estimate held constant), P5.7 (Admin Shell Becomes Module-Aware, reduced from 2–3 days to 1–2 days since it now consumes Phase 2's navigation foundation instead of building it), and the "Recommended Next Sprint" total (increased to absorb the new design-token kickoff task).
- **No breaking changes to existing routes, components, services, or stores.** `useBranchStore`, `branchService`, the `customer/staff/admin` role enum, all current API call signatures, and all current `components/ui/*` usage continue to work exactly as documented in `ARCHITECTURE.md` and `TECHNICAL_DEBT.md`. The new Phase 2 component library is additive/refactor-in-place, not a breaking rewrite.
- **The AI & Automation Opportunities table and "Required Before Production Launch" checklist** are unchanged from the prior revision.

### Risks

- **Increased phase count raises sequencing-discipline risk.** Splitting Phase 1 into 1A/1B and inserting Phase 2 means there are now more handoff points where a future revision could be tempted to skip ahead (e.g., starting Phase 6 module work before Phase 2's shared component library exists). The phase dependency notes throughout this document are the mitigation, but they require active enforcement, not just documentation.
- **Subscription relocation introduces a "free until Phase 9" risk.** Because module activation is admin-configured (not subscription-gated) until Phase 9 ships, there is a window where the platform has no enforced commercial gating. This is an explicit, accepted tradeoff for this revision (structural correctness before commercial gating), but it means Phase 9 should not be indefinitely deprioritized if monetization is a near-term business goal.
- **Phase 2 is a new, unaudited estimate, like Phase 1A/1B were in the prior revision.** Design Tokens, Theme Engine, Shared Component Library, and Navigation Foundation are new work with no prior implementation to audit (the current `components/ui/*` exists but isn't tokenized or tenant-aware), so these estimates (3–9 days per item) carry the same higher uncertainty flagged for Phase 1 in the prior revision.
- **Hotel's "could be resequenced earlier" framing is a double-edged risk.** Explicitly noting that Hotel Operations only depends on Phase 1A/1B/2 (not Phase 6/7) makes it tempting to fast-track if hotel demand emerges early — which is fine architecturally, but stakeholders should be aware this roadmap's phase *numbering* (8) does not imply Hotel must wait for Phases 3–7 to complete; it implies only that Phases 1A/1B/2 are real prerequisites.
- **All risks identified in the prior revision remain valid** (backend coordination risk for Phase 1A/1B, scope-creep risk in foundation phases, "foundation that's never used" risk if Phase 6/7/8 are deprioritized after Phase 1A/1B/2 ship) — see the historical summary below.

### Benefits

- **Clearer sequencing reduces foundation-phase risk.** Splitting structural (1A), governance (1B), commercial (Phase 9), and UI-platform (Phase 2) concerns into distinct phases means each can be reviewed, staffed, and exited independently, rather than requiring agreement across data modeling, permissions, billing, and design systems simultaneously before anything can ship.
- **Phase 2 compounds savings across every later phase.** Design tokens, a theme engine, a shared component library, and a permission-aware navigation shell built once are reused by Production Hardening polish, every Feature Completion screen, the entire Admin Platform, every Hospitality Module, Multi-Location Operations admin screens, and Hotel Operations — and directly reduce the cost of Phase 9's White-Label & Custom Domains item, which now consumes rather than rebuilds tenant theming.
- **Decoupling Subscription from the foundation unblocks earlier multi-tenant validation.** Tenants can be onboarded and modules activated (manually, via admin) as soon as Phase 1A/1B ship, without waiting on billing-tier decisions — useful for early pilot tenants (e.g., a second restaurant or a first cafe) well before a self-service commercial product exists.
- **Splitting Hospitality Modules from Multi-Location Operations clarifies parallel-team work.** A team building the Bar module (Phase 6) and a team building maps/delivery infrastructure (Phase 7) are now working on clearly separated phases with their own dependency chains, rather than a single phase that implicitly required sequencing module-specific and operational-scaling work together.
- **Hotel's repositioning sets correct expectations.** Framing Hotel as a distinct vertical (not a catalog-model sibling) up front avoids a likely future mistake: attempting to force room/booking entities into the `MenuItem`/`Cart` shape that Phase 6 modules share, which would have produced an awkward data model for both.

### Estimated impact on future development (this revision)

- **Near-term (Phase 1A/1B + Phase 2):** Total timeline to "platform foundation + UI platform ready" grows modestly versus the prior revision's single Phase 1 (roughly +6–9 days for the new Phase 2 work), but this is explicitly an investment phase — the prior revision already accepted a comparable tradeoff for Phase 1, and this revision extends the same logic to UI.
- **Medium-term (Phase 3–5):** No estimate change versus the prior revision, except P5.7's reduction (−1 day), since these phases' content is otherwise untouched.
- **Long-term (Phase 6–9):** Net effort reduction versus what the prior revision's combined Hospitality Modules phase would have cost if built without Phase 2 — every module's UI work (branding, navigation, shared components) is now inherited rather than hand-built, and Phase 9's White-Label item is more clearly scoped (and already reflected at a reduced estimate) because it builds on Phase 2 rather than starting from zero. The Subscription relocation has a neutral net effort impact (3–4 days, same as originally estimated) but removes it from the critical path of every other phase, which is a scheduling benefit even though the total work is unchanged.

---

### Historical Migration Summary (prior revision — restaurant-to-platform pivot)

> Preserved in full from the prior revision for continuity. This describes the original pivot from a single-tenant restaurant roadmap to a Hospitality SaaS Platform roadmap, before this revision's Phase 1A/1B split, Phase 2 insertion, Subscription relocation, Hotel repositioning, and Multi-Location split were applied on top of it.

**What changed:**

- **Phase ordering.** Multi-tenancy was no longer a Phase 5 capstone; it became the (then-single) Phase 1 — Foundation Architecture Migration, executed before further restaurant feature work compounded single-tenant assumptions.
- **New phase: Hotel Operations.** Hotel-specific domain complexity (rooms, multi-night bookings, check-in/check-out, room service, hotel reservations) did not exist in the original roadmap and became a dedicated phase, distinct from the generic "Hospitality Modules" phase because its data model (room inventory, date-range bookings) is meaningfully different from a menu/order model.
- **New phase content: Hospitality Modules.** Cafe, Bar, Smoke/Lounge, Event, and Venue modules were new additions, built explicitly on a (then-proposed) Module Registry.
- **Original "Multi-Branch & Operations Scale" phase folded into Hospitality Modules.** Branch-aware ordering, delivery address/map integration, staff roles, branch management admin page, and order history search/export were preserved verbatim in scope but renamed from "Branch" to the more general "Location" terminology.
- **Original "Multi-Tenancy Architecture" item retired and absorbed into the foundation phase.** Its scope — tenant routing, per-tenant theming, tenant-scoped data isolation — was delivered incrementally as the first phase rather than the last. Only the narrower "white-label / custom domains" slice remained in SaaS & Enterprise, at a reduced estimate.
- **Original "Role-Based Access Control (RBAC)" item split.** The foundational permission model moved to the foundation phase because the Admin Platform and hospitality modules needed it immediately, not at the end. What remained in SaaS & Enterprise was the advanced/fine-grained layer on top, at a reduced estimate.
- **Admin Platform requirements updated.** Admin services, stats, and the admin shell itself became explicitly tenant- and location-aware and module-driven, rather than hardcoded to a single restaurant.
- **Numbering.** Every task ID was renumbered to its new phase.

**What stayed the same:** every existing roadmap item was preserved, with its original scope, evidence, and (unless explicitly noted) its original effort estimate; all Production Hardening, Feature Completion, and Admin Panel items retained their original scope and UI targets; the AI & Automation Opportunities table and "Required Before Production Launch" checklist were unchanged; no breaking changes to existing routes, components, services, or stores.

**Risks identified:** coordination risk with the Django backend; scope-creep risk in the foundation phase; effort estimation uncertainty for new foundation work; risk of building foundation infrastructure that goes unused if hospitality-module/hotel phases were deprioritized after the foundation shipped (mitigated by the backward-compatibility constraint).

**Benefits identified:** no second rewrite of Production Hardening/Feature Completion/Admin Platform against a later-arriving foundation; admin platform reusability across future modules; RBAC built once and extended, not rebuilt; faster hospitality-module delivery once the foundation existed; a clear backward-compatibility guarantee with no forced migration deadline for the existing tenant.

**Estimated impact:** near-term timeline to a production-ready single restaurant tenant was effectively unchanged; medium-term Admin Platform effort increased modestly (~5–10%) to add tenant/location awareness; long-term effort was estimated to net *decrease* versus the original roadmap's implied cost of bolting on multi-tenancy at the end, since building it first avoided rework across every already-built restaurant-only feature.

---

*Last updated: Phase 1A/1B split, Platform UI Foundation insertion, Subscription relocation, Hotel repositioning, and Multi-Location Operations split, applied on top of the architecture-first Hospitality SaaS Platform reorganization, based on the original source code audit of commit at project initialization.*
*See also: [README.md](./README.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md)*
