# Technical Debt Audit — Savor Frontend

> A critical audit of the Savor frontend codebase. Every item below is supported by specific file and line evidence. This document is intended for use in sprint planning, risk assessment, and pre-production hardening.

---

## Summary

> Last updated: 2026-06-25 (after P7.14.5 stabilization — all phases P1A through P7.14.5 complete)

Items marked ✅ were resolved during P5–P7.14.5. Open items require backend integration or infrastructure work.

| Priority | Open | Resolved |
|----------|------|----------|
| Critical | 1 | 5 |
| High | 7 | 6 |
| Medium | 6 | 3 |
| Low | 4 | 4 |
| **Total** | **18** | **18** |

---

## Critical Issues

### ~~C-00 — No Tenant / Location / Module Abstraction~~ ✅ Resolved (P1A + P1B)

`useTenantStore`, `useBranchStore`, `useRbacStore` implemented. `src/modules/registry.ts` defines 6 tenant module types (restaurant, cafe, bar, food_court, food_truck, mobile_cafe) with capability guards. All services accept `tenantId`. Feature flag system implemented via `feature-flags.service.ts`.

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

### ~~C-02 — Admin Panel Has No Real Backend Integration~~ ✅ Resolved (P5–P7)

40+ admin pages implemented across analytics, orders, reservations, customers, staff, branches, tenants, audit logs, kitchen, operations, promotions, loyalty, vendors, and module-specific pages. All pages use React Query hooks backed by `admin.service.ts` (mock-gated). Bulk operations implemented for orders, reservations, and customers. All admin pages wrapped with `ErrorBoundary` and `PermissionGuard`.

---

### ~~C-03 — Admin Routes Have No Role Authorization~~ ✅ Resolved (P1B + P7)

`PermissionGuard` component wraps every admin page with `P7Permission` dot-notation strings (e.g., `orders.view`, `customers.manage`). `useRbacStore` resolves permissions from the active user's role and tenant policy. `AuthGuard` guards customer-facing protected routes.

---

### C-04 — Mock Mode Enabled by Default in .env.example

**Description:** `NEXT_PUBLIC_USE_MOCK=true` is set in `.env.example`. If a developer copies this file to `.env.local` or `.env.production` without changing it, the production app will serve mock data to real users.

**Evidence:** `.env.example` line 10: `NEXT_PUBLIC_USE_MOCK=true`

**Impact:** Production deployment could silently serve simulated data instead of real backend data. Orders placed would not be persisted. Auth would always succeed with fake credentials.

**Recommendation:** Change the default to `NEXT_PUBLIC_USE_MOCK=false` in `.env.example`, add a CI guard that fails builds when `USE_MOCK=true` and `NODE_ENV=production`.

**Estimated Effort:** 1 hour

---

### ~~C-05 — PWA Icons Missing from Repository~~ ✅ Resolved (P7.14)

`public/icons/` directory and icon files are present. `public/og-image.jpg` is present. `public/firebase-messaging-sw.js` added for push notification support. `PushNotificationSettings` component and `useNotificationPermission` hook implemented.

---

## High Priority Issues

### ~~H-01 — WebSocket Hooks Are Never Mounted~~ ✅ Resolved (P7.7–P7.8)

`useOrderWebSocket` is mounted by `OrderTracker` (with mock simulation fallback when `NEXT_PUBLIC_USE_MOCK=true`). `useNotificationWebSocket` is mounted for authenticated users. `useKitchenStatus` drives the kitchen display page. `useRealtimeOperations` drives the operations dashboard.

---

### H-02 — Firebase Requires Real VAPID Key for Production

**Description:** Firebase SDK is installed and `firebase-messaging-sw.js` is present. `useNotificationPermission` hook and `PushNotificationSettings` component are implemented. However, `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.example` is a placeholder — push notifications will silently fail in production without a real VAPID key from the Firebase Console.

**Evidence:** `public/firebase-messaging-sw.js` references the VAPID key at runtime. `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.example` must be set to a real key.

**Impact:** Push notifications will not fire in production without the VAPID key.

**Recommendation:** Generate a VAPID key pair in the Firebase Console and set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in production environment variables. Firebase app initialization code also needs to be wired to the real config values.

**Estimated Effort:** 2–4 hours

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

### ~~H-07 — No Error Boundary in Feature Components~~ ✅ Resolved (P3 + P7)

`ErrorBoundary` component implemented at `src/components/common/ErrorBoundary.tsx`. Every admin page is wrapped with `<ErrorBoundary feature="...">`. Root `src/app/error.tsx` remains as the last-resort boundary.

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

### ~~H-10 — Reviews Feature Typed but Not Implemented~~ ✅ Resolved (P7.12)

`review.service.ts` implemented. `/reviews/page.tsx` exists. `/admin/customers/[id]/reviews/page.tsx` exists. Customer reviews are viewable from the customer detail page in the admin panel.

---

### H-11 — Notification WebSocket Never Connected

**Description:** `useNotificationWebSocket()` exists in `src/hooks/client.ts` and is fully implemented, but no component in the application tree mounts this hook.

**Evidence:** `grep -r "useNotificationWebSocket" src/` returns only the definition in `client.ts` — no call site.

**Impact:** Notification store will never receive live updates from the server. Only the polling fallback (60s interval in `useNotifications` React Query hook) delivers notifications, with up to 60s delay.

**Recommendation:** Mount `useNotificationWebSocket()` inside `AuthBootstrapper` in `src/providers/index.tsx` for all authenticated users.

**Estimated Effort:** 2 hours

---

### ~~H-12 — No Design Token System or UI Platform Foundation~~ ✅ Resolved (P2 + P7.12)

CSS custom properties formalized as semantic tokens (`--bg`, `--fg`, `--card`, `--card-hover`, `--border`, `--fg-muted`, `--fg-subtle`, etc.) applied consistently across all components. Navigation is module-aware via `src/modules/registry.ts` — each module defines its own nav items. `PermissionGuard` provides permission-aware rendering. `AdminBreadcrumbs` provides contextual breadcrumb navigation.

---

### H-13 — No CI Pipeline

**Description:** There is no CI/CD pipeline. No automated lint, type-check, test, or build runs on pull requests or merges.

**Evidence:** `package.json` — `lint`, `type-check`, `test`, and `build` scripts all exist and work locally (0 errors, 4,651 tests pass) but are not wired to any automated gate.

**Impact:** Regressions will not be caught automatically before merge.

**Recommendation:** Stand up a GitHub Actions workflow running `lint → type-check → test → build` in sequence. The commands already exist in `package.json`; this is a pipeline configuration task only.

**Estimated Effort:** 1–2 days

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

### ~~M-06 — Admin Pages Import Mock Data Directly~~ ✅ Resolved (P5–P7)

All admin pages now use React Query hooks backed by `admin.service.ts`. Mock data is accessed only through the service layer which gates on `NEXT_PUBLIC_USE_MOCK`.

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

### ~~M-09 — Only One Test File Exists~~ ✅ Resolved (P3 + P4 + P5 + P6 + P7 + P7.14.5)

59 test files, 4,651 passing tests covering all services, hooks, admin pages, module capabilities, RBAC, analytics, realtime operations, notification center, branch management, audit logs, staff management, order routing, QR experience, loyalty, promotions, vendors, tenant provisioning, and bulk operations. 0 failing tests as of P7.14.5.

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
| ~~`socket.io-client` package~~ | `package.json` | ✅ Removed |
| ~~`next-pwa` package~~ | `package.json` | ✅ Removed |
| ~~`src/app/cart/` empty directory~~ | App Router | ✅ Resolved — `/cart/page.tsx` now redirects to `/menu` |
| ~~`src/features/` empty directories~~ | Feature modules | ✅ Removed |
| ~~`useOrderWebSocket` unused~~ | `src/hooks/client.ts` | ✅ Resolved — mounted by `OrderTracker` |
| ~~`useNotificationWebSocket` unused~~ | `src/hooks/client.ts` | ✅ Resolved — mounted in providers |
| ~~`ENDPOINTS.REVIEWS.*` unused~~ | `src/services/endpoints.ts` | ✅ Resolved — `review.service.ts` uses them |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `.env.example` | Open — no analytics code (Phase 9 concern) |
| `SENTRY_DSN` | `.env.example` | Open — `@sentry/nextjs` not installed |
| `public/screenshots/menu.png` | `manifest.json` | Open — referenced but not present |
