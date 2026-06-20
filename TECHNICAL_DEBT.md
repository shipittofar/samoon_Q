# Technical Debt Audit — Savor Frontend

> A critical audit of the Savor frontend codebase. Every item below is supported by specific file and line evidence. This document is intended for use in sprint planning, risk assessment, and pre-production hardening.

---

## Summary

| Priority | Count |
|----------|-------|
| Critical | 6 |
| High | 13 |
| Medium | 9 |
| Low | 8 |
| **Total** | **36** |

---

## Critical Issues

### C-00 — No Tenant / Location / Module Abstraction

**Description:** The codebase has no concept of `Tenant`, `Location` (as distinct from `Branch`), or `Module`. Every model, route, service, and store assumes exactly one restaurant business. There is no frontend module registry, no tenant context store, and no mechanism to scope data or navigation to a tenant or business type.

**Evidence:** `src/types/index.ts` — no `Tenant`, `Location`, or `Module` type. `src/stores/index.ts` — no `useTenantStore`. `src/services/` — all service methods operate against a single implicit restaurant with no `tenantId` or `locationId` parameter. `src/app/` routing — no tenant-resolution middleware, no module-aware navigation.

**Impact:** Adding a second tenant or a second business type (cafe, bar, hotel) today requires forking the entire codebase rather than configuring a new tenant and registering a new module. Every subsequent phase of the roadmap (Admin Platform, Hospitality Modules, Hotel Operations, SaaS features) is blocked or will produce throw-away code without this layer.

**Recommendation:** Implement Phase 1A: define `Tenant`, `Location`, and `Module` TypeScript interfaces with backward-compatible defaults; introduce `useTenantStore` (Zustand); generalize `Branch` to `Location`; and register the existing restaurant feature set as the first module in a `src/modules/registry.ts`. Existing behavior must remain unchanged — this is a structural addition, not a rewrite. Follow with Phase 1B (RBAC, feature flags, tenant-aware routing, migration planning) before building on top of the new layer.

**Roadmap reference:** Phase 1A (P1A.1–P1A.4), Phase 1B (P1B.1–P1B.5) — all P0.

**Estimated Effort:** 15–23 days (Phase 1A) + 15–23 days (Phase 1B)

---

### C-01 — No Route Authentication Middleware

**Description:** There is no `src/middleware.ts` file. Next.js App Router route protection requires middleware to intercept requests before rendering. Without it, `/dashboard/*` and `/admin/*` are publicly accessible to any unauthenticated user.

**Evidence:** `find /tmp/frontend_source/src -name "middleware.ts"` returns nothing. Dashboard layout (`src/app/dashboard/layout.tsx`) and admin pages have no server-side auth check.

**Impact:** Any visitor can access order history, addresses, and the full admin interface without logging in.

**Recommendation:** Create `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl

  const protectedPrefixes = ['/dashboard', '/admin', '/checkout']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin-only
  if (pathname.startsWith('/admin')) {
    // Decode JWT and check role — requires JWT to be in a cookie
    // Alternative: check a separate admin cookie set by the backend
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/checkout/:path*'],
}
```

Note: This requires migrating JWT storage from `localStorage` to `httpOnly` cookies for middleware to read it.

**Estimated Effort:** 3–5 days (includes JWT strategy change)

---

### C-02 — Admin Panel Has No Real Backend Integration

**Description:** All five admin pages (`/admin/stats`, `/admin/orders`, `/admin/menu`, `/admin/customers`, `/admin/reservations`) use hardcoded local fixture data. They do not call any service. State mutations are local-only and lost on page refresh.

**Evidence:**
- `src/app/admin/stats/page.tsx`: `const STATS = [...]` (lines 12–17) — hardcoded
- `src/app/admin/orders/page.tsx`: `const MOCK_LIVE_ORDERS = [...]` — hardcoded
- `src/app/admin/customers/page.tsx`: `const MOCK_CUSTOMERS = [...]` — hardcoded
- `src/app/admin/menu/page.tsx`: `setItems(MOCK_MENU_ITEMS)` — initial state from mock, no persist
- Stats page is self-labeled with `<Badge variant="default">Preview UI</Badge>`

**Impact:** The admin panel is non-functional for actual restaurant operations. Order status changes, menu edits, and customer data exist only in the browser tab.

**Recommendation:** Implement API-backed admin services and wire them to the existing UI. Requires corresponding Django admin API endpoints.

**Estimated Effort:** 10–15 days

---

### C-03 — Admin Routes Have No Role Authorization

**Description:** Even if a user is authenticated, any role (customer, staff, admin) can access `/admin/*` because there is no role check in middleware or page-level guards.

**Evidence:** `User.role` type includes `'customer' | 'staff' | 'admin'` in `src/types/index.ts`. No component or middleware reads this field to gate admin access.

**Impact:** Authenticated customers can reach the admin interface.

**Recommendation:** In the middleware (C-01), decode the JWT and check `user.role === 'admin'`. Return 403 or redirect to `/` for non-admin users.

**Estimated Effort:** 1 day (after C-01 is resolved)

---

### C-04 — Mock Mode Enabled by Default in .env.example

**Description:** `NEXT_PUBLIC_USE_MOCK=true` is set in `.env.example`. If a developer copies this file to `.env.local` or `.env.production` without changing it, the production app will serve mock data to real users.

**Evidence:** `.env.example` line 10: `NEXT_PUBLIC_USE_MOCK=true`

**Impact:** Production deployment could silently serve simulated data instead of real backend data. Orders placed would not be persisted. Auth would always succeed with fake credentials.

**Recommendation:** Change the default to `NEXT_PUBLIC_USE_MOCK=false` in `.env.example`, add a CI guard that fails builds when `USE_MOCK=true` and `NODE_ENV=production`.

**Estimated Effort:** 1 hour

---

### C-05 — PWA Icons Missing from Repository

**Description:** `public/manifest.json` declares 8 icon sizes (`icon-72.png` through `icon-512.png`) in `public/icons/`. The `public/icons/` directory does not exist.

**Evidence:** `ls /tmp/frontend_source/public/icons/` → `No such file or directory`

**Impact:** PWA install prompt will fail. Browser console will show 404 errors. App cannot be added to home screen. The browser will not display the app icon in splash screens or task switchers.

**Recommendation:** Generate and commit icon files. Use a tool like `sharp` (already in dependencies) or an online icon generator. Also add `public/og-image.jpg` (1200×630) referenced in `layout.tsx` metadata.

**Estimated Effort:** 2–4 hours

---

## High Priority Issues

### H-01 — WebSocket Hooks Are Never Mounted

**Description:** `useOrderWebSocket` and `useNotificationWebSocket` are fully implemented in `src/hooks/client.ts` but are not mounted by any component. The `OrderTracker` uses mock simulation (`simulateOrderUpdates`) instead of the real hook.

**Evidence:**
- `src/components/order/OrderTracker.tsx` line ~40: `const cleanup = simulateOrderUpdates(orderId, ...)`
- `useOrderWebSocket` and `useNotificationWebSocket` exist in `src/hooks/client.ts` but `grep -r "useOrderWebSocket\|useNotificationWebSocket" src/` finds no usages outside `client.ts`

**Impact:** Real-time order status updates and push notifications will not work in production even when a Django Channels backend is available.

**Recommendation:**
1. In `OrderTracker.tsx`: replace `simulateOrderUpdates` with `useOrderWebSocket` when `!useMockSimulation`
2. In `Providers` or a layout component: mount `useNotificationWebSocket` for authenticated users

**Estimated Effort:** 2–3 days

---

### H-02 — Firebase Never Initialized

**Description:** The `firebase` package (^11.1.0) is installed. `notificationService.registerDevice()` calls the backend with a Firebase token. The `.env.example` has `NEXT_PUBLIC_FIREBASE_*` vars. But there is no Firebase initialization code anywhere in the codebase (`initializeApp`, `getMessaging`, `getToken` are not called).

**Evidence:** `grep -r "initializeApp\|getMessaging\|getToken" src/` returns nothing.

**Impact:** Push notifications will never fire. `registerDevice()` will never have a token to send.

**Recommendation:** Create `src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // ...other fields
}

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export async function requestNotificationToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const messaging = getMessaging(app)
  try {
    return await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
  } catch {
    return null
  }
}
```

Then call `requestNotificationToken()` after user login and pass the result to `notificationService.registerDevice()`.

**Estimated Effort:** 1–2 days

---

### H-03 — Incomplete Arabic Locale File

**Description:** `src/i18n/locales/ar.json` has only 14 lines — a nearly empty shell. The English and Persian files are fully populated with 187 lines each. The Arabic file will cause `useTranslations` to fall back to keys (raw key names) for all missing strings.

**Evidence:**
```
wc -l src/i18n/locales/ar.json  → 14
wc -l src/i18n/locales/en.json  → 187
wc -l src/i18n/locales/fa.json  → 187
```

**Impact:** Arabic UI will display raw translation keys as text (e.g., `menu.addToCart` instead of "أضف إلى السلة"). This makes the Arabic locale non-functional.

**Recommendation:** Translate all 187 keys from `en.json` to Arabic. RTL layout already works correctly — only translations are missing.

**Estimated Effort:** 2–3 days (with a professional translator or LLM-assisted + review)

---

### H-04 — No Payment Gateway Integration

**Description:** The checkout form collects payment method selection (card/cash/online/wallet) but no actual payment processing occurs. There is no Stripe, PayPal, or other gateway SDK in `package.json`.

**Evidence:** `src/app/checkout/page.tsx` — form submits to `orderService.createOrder()` which does not include payment intent creation or confirmation. Payment methods are UI-only selectors.

**Impact:** Card payment orders cannot be processed. Revenue collection requires manual offline handling.

**Recommendation:** Integrate a payment gateway (Stripe recommended). Add `@stripe/stripe-js` and `@stripe/react-stripe-js`. Create a payment intent on the backend before order creation. Handle 3DS flow.

**Estimated Effort:** 5–8 days

---

### H-05 — Mock Login Always Succeeds for Any Credentials

**Description:** In `authService.login()` mock mode, a code comment says "if credentials.email !== 'demo@savor.com' && credentials.password !== 'password'" but the condition block returns the same result regardless — login always succeeds.

**Evidence:** `src/services/auth.service.ts` lines 15–22:
```typescript
if (credentials.email !== 'demo@savor.com' && credentials.password !== 'password') {
  // This block runs for non-demo credentials...
  const tokens = { access: 'mock_access_token', refresh: 'mock_refresh_token' }
  setTokens(tokens.access, tokens.refresh)
  return { user: MOCK_USER, tokens }  // ← Returns success anyway
}
// ...then returns success again below
```

**Impact:** Misleading behavior in demo/development — any email/password works. Not a production risk if `USE_MOCK=false`, but confusing for testers and demo users.

**Recommendation:** Fix mock to only succeed for `demo@savor.com` / `password`:

```typescript
if (USE_MOCK) {
  await delay(MOCK_DELAY)
  if (credentials.email !== 'demo@savor.com' || credentials.password !== 'password') {
    throw new Error('Invalid credentials')
  }
  // ...return mock user
}
```

**Estimated Effort:** 30 minutes

---

### H-06 — JWT Stored in localStorage (XSS Risk)

**Description:** Access and refresh tokens are stored in `localStorage` via `setTokens()`. This makes them readable by any JavaScript, including XSS payloads.

**Evidence:** `src/services/axios.instance.ts` — `setTokens()` uses `localStorage.setItem()`. `getAccessToken()` uses `localStorage.getItem()`.

**Impact:** Successful XSS attack can steal tokens and impersonate users across sessions.

**Recommendation:** Move to `httpOnly` cookies managed by the backend. Requires Django backend changes. As a partial mitigation without backend changes, use `sessionStorage` instead of `localStorage` (limits exposure to the current tab/session).

**Estimated Effort:** 3–5 days (full solution) / 1 hour (sessionStorage partial)

---

### H-07 — No Error Boundary in Feature Components

**Description:** Only a top-level `src/app/error.tsx` exists. Feature sections (cart, notifications, menu) have no local error boundaries. A runtime error in `CartDrawer` will propagate to the root error boundary and crash the entire page.

**Evidence:** `grep -r "ErrorBoundary\|error.tsx" src/components/` returns nothing.

**Impact:** Any unexpected runtime error in a component (e.g., malformed API response) removes the entire page rather than just the affected section.

**Recommendation:** Add React Error Boundaries around key feature sections (`<Suspense>` is partially used, but `ErrorBoundary` is not).

**Estimated Effort:** 1 day

---

### H-08 — QR Table Ordering: Table Number Not Passed to Order

**Description:** `/table/[tableId]` correctly reads the table ID and displays a welcome banner. However, the table number is not automatically propagated to the checkout flow. The user must manually select "Dine In" and enter a table number.

**Evidence:** `src/app/table/[tableId]/page.tsx` — renders `Header`, `CartDrawer`, `FloatingCart`, and the menu but does not set the table number in the cart or branch store.

**Impact:** QR table ordering defeats its own purpose — staff must still verbally communicate the table number.

**Recommendation:** Store the table number from the QR scan in the branch store or a dedicated table store. Pre-populate the checkout form's `table_number` field when the user came from `/table/[tableId]`.

**Estimated Effort:** 1–2 days

---

### H-09 — `og-image.jpg` Missing from Repository

**Description:** `src/app/layout.tsx` metadata references `/og-image.jpg` for Open Graph and Twitter card previews. This file does not exist in `public/`.

**Evidence:** `src/app/layout.tsx` line 17: `images: [{ url: '/og-image.jpg', width: 1200, height: 630 }]`. `ls /tmp/frontend_source/public/` shows no `.jpg` files.

**Impact:** Social media link previews will show broken images. SEO score is reduced.

**Recommendation:** Create and commit `public/og-image.jpg` (1200×630px).

**Estimated Effort:** 2 hours

---

### H-10 — Reviews Feature Typed but Not Implemented

**Description:** The `Review` type is defined, `/reviews/` and `/menu/items/:id/reviews/` endpoints are declared, but there are no service methods, hooks, or UI components for reviews.

**Evidence:** `src/types/index.ts` lines ~210–220: `Review` interface exists. `src/services/endpoints.ts` `REVIEWS` object exists. No `reviewService` exists. No review UI found.

**Impact:** Users cannot rate or review items or orders. No social proof data is surfaced.

**Recommendation:** Implement `reviewService`, `useCreateReview` / `useItemReviews` hooks, and a review section in `FoodDetailModal` and the order history page.

**Estimated Effort:** 3–5 days

---

### H-11 — Notification WebSocket Never Connected

**Description:** `useNotificationWebSocket()` exists in `src/hooks/client.ts` and is fully implemented, but no component in the application tree mounts this hook.

**Evidence:** `grep -r "useNotificationWebSocket" src/` returns only the definition in `client.ts` — no call site.

**Impact:** Notification store will never receive live updates from the server. Only the polling fallback (60s interval in `useNotifications` React Query hook) delivers notifications, with up to 60s delay.

**Recommendation:** Mount `useNotificationWebSocket()` inside `AuthBootstrapper` in `src/providers/index.tsx` for all authenticated users.

**Estimated Effort:** 2 hours

---

### H-12 — No Design Token System or UI Platform Foundation

**Description:** The theming approach uses ad-hoc CSS custom properties defined directly in `globals.css` (`--bg`, `--fg`, `--card`, `--border`, etc.). There is no structured token set (semantic color tokens, type scale, spacing scale, radius, elevation), no tenant-overridable theming layer, and no formalized shared component library. Navigation is hardcoded to the restaurant feature set with no module-awareness or permission-awareness.

**Evidence:** `src/app/globals.css` — all CSS custom properties defined inline with no token taxonomy. `src/components/ui/` — primitives exist (Button, Input, Modal, Badge, Card) but are not driven by a documented token system. `components/layout/Header.tsx` and dashboard sidebar — navigation is hardcoded to the restaurant module; no mechanism for a second module to contribute nav items.

**Impact:** Every future module (Phase 6 Hospitality Modules, Phase 8 Hotel Operations) and every future tenant's branding must be hand-built per feature, multiplying UI cost. Phase 9 white-labeling cannot be layered on top of an ad-hoc styling approach without a large-scale refactor. The current `useThemeStore` light/dark switching is also not extensible to per-tenant brand colors.

**Recommendation:** Implement Phase 2: formalize the existing CSS variables into a structured, documented design token set; build a tenant-overridable theme engine on top; formalize `components/ui/` primitives as a token-driven shared library; and introduce a permission-aware, module-aware navigation shell. This phase is additive — existing screens are not required to change. See ROADMAP.md Phase 2 (P2.1–P2.4) for the full scope.

**Roadmap reference:** Phase 2 (P2.1–P2.4) — P0/P1, sequenced after Phase 1A/1B.

**Estimated Effort:** 18–28 days

---

### H-13 — No CI Pipeline

**Description:** There is no CI/CD pipeline. No automated lint, type-check, test, or build runs on pull requests or merges. The single test file (`src/test/index.test.ts`) is never executed automatically, making the Vitest setup effectively optional.

**Evidence:** `ROADMAP.md` — "Stand up CI quality gates (lint + type-check + test + build) gating merges to the main branch — none currently exists." `package.json` — `lint`, `type-check`, `test`, and `build` scripts all exist and work locally but are not wired to any automated gate.

**Impact:** Every roadmap item that follows — especially the foundation layer (Phase 1A/1B) and module work (Phase 6/8) — ships without automated regression detection. The surface area of the codebase is growing (multi-tenant models, module registry, RBAC) at exactly the moment that manual testing becomes insufficient to catch regressions across tenants and modules.

**Recommendation:** Stand up a CI pipeline (GitHub Actions or equivalent) running `lint → type-check → test → build` in sequence, gating all merges to the main branch. The commands already exist in `package.json`; this is a pipeline configuration task, not a code change. Pair with expanded Vitest coverage for the highest-risk logic (cart store, service mock/real switching, auth flow). See ROADMAP.md P3.10.

**Roadmap reference:** P3.10 — P0, recommended to run alongside Phase 1A/1B so new foundation code ships with tests from day one.

**Estimated Effort:** 4–6 days (pipeline + baseline coverage expansion)

---

## Medium Priority Issues

### M-01 — `combined.service.ts` Violates Single Responsibility

**Description:** `src/services/combined.service.ts` exports 4 unrelated services: `reservationService`, `branchService`, `notificationService`, and `userService`. This was likely a convenience shortcut that creates confusing imports.

**Impact:** Poor maintainability, confusing import paths, harder to tree-shake.

**Recommendation:** Split into `reservation.service.ts`, `branch.service.ts`, `notification.service.ts`, `user.service.ts`.

**Estimated Effort:** 2 hours (with updated imports)

---

### M-02 — `socket.io-client` Is an Unused Dependency

**Description:** `socket.io-client` (^4.8.1) is in `package.json` dependencies but is never imported anywhere in the codebase. All WebSocket code uses native `WebSocket`.

**Evidence:** `grep -r "socket.io\|io(" src/` returns nothing.

**Impact:** Adds ~300KB to the bundle unnecessarily.

**Recommendation:** Remove `socket.io-client` from dependencies.

**Estimated Effort:** 5 minutes

---

### M-03 — `next-pwa` Is Unused

**Description:** `next-pwa` (^5.6.0) is listed in dependencies but is not configured in `next.config.ts`. The service worker is hand-written. `next-pwa` adds installation overhead and is stale (last major update was 2022).

**Evidence:** `src/next.config.ts` — only `createNextIntlPlugin` wraps the config. No `withPWA` wrapper.

**Impact:** Dead dependency with potential supply chain risk; adds to install time.

**Recommendation:** Remove `next-pwa` from dependencies. The hand-written `sw.js` is a valid alternative.

**Estimated Effort:** 5 minutes

---

### M-04 — TAX_RATE and SERVICE_CHARGE_RATE Are Hardcoded

**Description:** Tax (9%) and service charge (5%) are hardcoded constants in `src/constants/index.ts`. Different branches or regions may require different rates, and these values cannot be configured without a code change.

**Evidence:** `src/constants/index.ts`:
```typescript
export const TAX_RATE = 0.09
export const SERVICE_CHARGE_RATE = 0.05
```

**Impact:** Incorrect charges for multi-region or multi-country deployment. Legal compliance risk.

**Recommendation:** Include tax and service charge rates in the `Branch` type and return them from the backend. Fall back to constants when unavailable.

**Estimated Effort:** 2–3 days (requires backend support)

---

### M-05 — Favorites Store and Server State Are Not Properly Synchronized

**Description:** `useFavoritesStore` maintains a `Set<string>` in localStorage. `useToggleFavorite` applies an optimistic update and rolls back on error. However, the rollback only re-toggles the local store — it does not re-fetch the server state. If the server and client get out of sync, the rollback could produce the wrong result.

**Evidence:** `src/hooks/index.ts` `useToggleFavorite`:
```typescript
onMutate: (itemId) => toggleFavorite(itemId), // optimistic
onError: (_err, itemId) => toggleFavorite(itemId), // rollback — toggles again
```

If the initial state was `favorited=true`, optimistic update sets `false`. On error, rollback sets back to `true`. This is correct. But if the toggle succeeded on the server and failed in response parsing, the rollback would be wrong.

**Recommendation:** Use the standard React Query optimistic update pattern with `onMutate` returning a context snapshot for proper rollback.

**Estimated Effort:** 2 hours

---

### M-06 — Admin Pages Import Mock Data Directly

**Description:** Admin pages bypass the service layer and import from `@/lib/mock-data` directly.

**Evidence:** `src/app/admin/reservations/page.tsx`: `import { MOCK_RESERVATIONS } from '@/lib/mock-data'`

**Impact:** Violates architectural layering. When real API is added, each admin page needs a different refactor approach.

**Recommendation:** Move admin-specific data fetching behind service methods and React Query hooks, even if they initially return mock data.

**Estimated Effort:** 3–4 days

---

### M-07 — Missing Sentry Initialization (Error Tracking)

**Description:** `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are documented in `.env.example` but `@sentry/nextjs` is not installed and no initialization code exists. Note: `NEXT_PUBLIC_GA_MEASUREMENT_ID` is also documented but Google Analytics is a lower-priority concern — product analytics are planned for Phase 9 (P9.5), whereas Sentry error tracking has been pulled up to Phase 3 (P3.11) as a pre-production requirement.

**Evidence:** `package.json` — no `@sentry/nextjs` package. `.env.example` — `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` vars present. No `sentry.client.config.ts` or `sentry.server.config.ts` found.

**Impact:** No error visibility in production. Client-side runtime errors, API failures, and unhandled rejections go undetected until a user reports them.

**Recommendation:** Install `@sentry/nextjs` and initialize it with `NEXT_PUBLIC_SENTRY_DSN`. Wire Core Web Vitals to Sentry Performance. Scope this to error tracking only — GA4 analytics remain a Phase 9 item. See ROADMAP.md P3.11.

**Roadmap reference:** P3.11 — P0, moved up from Phase 9 to be established before production launch.

**Estimated Effort:** 1–2 days

---

### M-08 — Price Range Filter Has No Maximum Cap Handling

**Description:** The price filter in the menu page treats `max_price >= 100` as "no maximum" (shows "100+" in UI), but the mock data has items costing up to $38.99. If real data has items above $100, the filter will incorrectly cap results.

**Evidence:** `src/app/menu/page.tsx`:
```typescript
max_price: priceRange[1] < 100 ? priceRange[1] : undefined,
```

**Impact:** Users cannot filter out expensive items above $100. Filter behavior is incorrect for high-end menus.

**Recommendation:** Derive the maximum price dynamically from the menu data, or make the upper bound configurable.

**Estimated Effort:** 2–3 hours

---

### M-09 — Only One Test File Exists

**Description:** `src/test/index.test.ts` contains utility and cart store tests. No tests exist for services, hooks, pages, or components. Test coverage is minimal.

**Evidence:** `find src/ -name "*.test.*" -o -name "*.spec.*"` returns only `src/test/index.test.ts`.

**Impact:** Regressions in services, components, or API integration will not be caught automatically.

**Recommendation:** Add tests for:
- Service methods (mock and real mode switching)
- Critical components (CartDrawer, FoodCard, OrderTracker)
- Auth flow integration tests
- Form validation edge cases

**Estimated Effort:** 5–10 days for meaningful coverage

---

## Low Priority Issues

### L-01 — Locale Switching Requires Page Reload

**Description:** `useLangStore.setLocale()` updates `document.lang` and `dir` immediately, but `next-intl` reads locale from the cookie server-side. The UI language only changes after a full page reload.

**Impact:** UX friction — locale appears to change but translated strings remain in the old language until reload.

**Recommendation:** Trigger a hard navigation (`router.refresh()`) or `window.location.reload()` after setting the locale cookie.

**Estimated Effort:** 2 hours

---

### L-02 — `critters` Dependency May Conflict with Tailwind v4

**Description:** `critters` is used for critical CSS inlining (`optimizeCss: true`). Tailwind CSS v4 generates CSS differently than v3. The `critters` library was designed for traditional CSS flows and may not handle Tailwind v4's new CSS layer approach correctly.

**Evidence:** `package.json`: `"critters": "^0.0.25"`. `next.config.ts`: `optimizeCss: true`.

**Impact:** CSS inlining may produce incorrect or duplicate styles. Build warnings may appear.

**Recommendation:** Test and verify the build output. If issues arise, disable `optimizeCss` until Tailwind v4 + Next.js CSS optimization is better supported.

**Estimated Effort:** 1–2 hours to verify

---

### L-03 — ReactQueryDevtools Shipped to Production

**Description:** `ReactQueryDevtools` is included unconditionally in `src/providers/index.tsx`. While Next.js will tree-shake it in production if `initialIsOpen={false}`, the component code is still bundled.

**Evidence:** `src/providers/index.tsx`: `<ReactQueryDevtools initialIsOpen={false} />`

**Recommendation:**

```typescript
{process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
```

**Estimated Effort:** 5 minutes

---

### L-04 — Inline Script in `layout.tsx` for Theme Detection

**Description:** A `dangerouslySetInnerHTML` inline script in `layout.tsx` reads `savor-theme` from localStorage to prevent flash of unstyled content. This is a common pattern but uses `dangerouslySetInnerHTML` which bypasses React's XSS protection.

**Evidence:** `src/app/layout.tsx` lines 28–30.

**Impact:** Low risk since the script content is static and not derived from user input. Minor code smell.

**Recommendation:** The pattern is acceptable. Document why it exists to prevent future removal.

**Estimated Effort:** 30 minutes (documentation only)

---

### L-05 — Home Page Featured Items Are Hardcoded

**Description:** The "Featured Dishes" section on the home page (`/`) uses a hardcoded `FEATURED` array rather than the `useFeaturedItems()` hook that exists and works.

**Evidence:** `src/app/page.tsx`:
```typescript
const FEATURED = [
  { name: 'Wagyu Smash Burger', ... },
  // ...
]
```

While `useFeaturedItems()` hook exists in `src/hooks/index.ts` and calls `menuService.getFeatured()`.

**Impact:** Home page featured items are static and won't reflect backend changes.

**Recommendation:** Convert the `HomePage` landing page to a client component (or use a server component RSC fetch) and use `useFeaturedItems()` for the featured section.

**Estimated Effort:** 2–3 hours

---

### L-06 — `formatCurrency` Locale Does Not Follow User's Selected Locale

**Description:** `formatCurrency` in `src/utils/index.ts` defaults to `locale = 'en-US'` and callers rarely pass the current locale. When a Persian or Arabic user is active, currency formatting will still use English locale conventions.

**Evidence:** `src/utils/index.ts`:
```typescript
export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
```

**Impact:** Minor UX inconsistency for RTL language users.

**Recommendation:** Pass the current locale from `useLangStore` through to format calls, or create a custom hook `useFormattedCurrency()`.

**Estimated Effort:** 2–3 hours

---

### L-07 — `src/app/reservation/confirm/` Directory Exists but Has No File

**Description:** The folder `src/app/reservation/confirm/` was created (visible in unzip output) but contains no `page.tsx`.

**Evidence:** Unzip output shows `creating: src/app/reservation/confirm/` but no file is extracted into it.

**Impact:** Potential routing dead-end. If a user navigates to `/reservation/confirm`, they will hit a 404.

**Recommendation:** Either add the confirmation page or remove the directory.

**Estimated Effort:** 2–4 hours (add page) / 5 minutes (remove directory)

---

### L-08 — Mock Order Data Has Incorrect `name` Field on OrderItems

**Description:** `MOCK_ORDERS` in `src/lib/mock-data.ts` sets `name: 'Bacon'` on every `OrderItem`, regardless of the actual menu item. This is clearly copy-paste error data.

**Evidence:** `src/lib/mock-data.ts` — every order item has `name: 'Bacon'` even for pizza and pasta items.

**Impact:** Mock order detail views will display "Bacon" as the item name. Breaks demo quality.

**Recommendation:** Set `name` to `menu_item.name` or remove the hardcoded value.

**Estimated Effort:** 15 minutes

---

## Dead Code / Unused Items

| Item | Location | Status |
|------|----------|--------|
| `socket.io-client` package | `package.json` | Never imported |
| `next-pwa` package | `package.json` | Not configured in `next.config.ts` |
| `src/app/cart/` directory | App Router | Empty directory (no `page.tsx`) |
| `src/features/` directory | Feature modules | Empty directories for auth, menu, cart, order, reservation, branch, notification — no files |
| `useOrderWebSocket` | `src/hooks/client.ts` | Defined, never called |
| `useNotificationWebSocket` | `src/hooks/client.ts` | Defined, never called |
| `ENDPOINTS.REVIEWS.*` | `src/services/endpoints.ts` | Declared, no service or hook uses them |
| `ENDPOINTS.TABLE.*` | `src/services/endpoints.ts` | Declared, `/table/[tableId]` page doesn't call them |
| Firebase env vars | `.env.example` | Documented but SDK never initialized |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `.env.example` | Documented but no analytics code |
| `SENTRY_DSN` | `.env.example` | Documented but no Sentry package |
| `src/app/checkout/success/` screenshots `public/screenshots/menu.png` | `manifest.json` | Referenced but file absent |
