# Product Roadmap — Savor Frontend

> Strategic roadmap derived from the current state of the codebase. All items are grounded in the actual source code audit. Priorities reflect production readiness, business impact, and technical dependency ordering.

---

## Executive Summary

### Current Maturity Level

**Beta — Not Production Ready**

The Savor frontend has a well-architected foundation with polished UI, working mock mode, and comprehensive feature breadth. However, several critical gaps prevent production deployment:

1. No route authentication guards
2. Admin panel is entirely non-functional (UI preview only)
3. Real-time WebSocket infrastructure built but never activated
4. PWA assets missing
5. Arabic localization incomplete
6. No payment gateway integration

### Production Readiness Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | 7/10 | Clean separation, good patterns, but WebSocket not wired |
| Security | 3/10 | No route guards, no admin authz, JWT in localStorage |
| Scalability | 6/10 | React Query caching is solid; admin not scalable |
| Maintainability | 7/10 | TypeScript strict, good types, but combined.service.ts and dead code |
| Developer Experience | 8/10 | Mock mode, good tooling, Turbopack, Vitest |
| Testing | 2/10 | One test file, no component or integration tests |
| Documentation | 9/10 | Now comprehensive (this document set) |
| **Overall** | **6/10** | |

### Estimated Completion Percentage

| Layer | Completion |
|-------|-----------|
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
| **Overall** | **~65%** |

### Required Before Production Launch

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

---

## Phase 1 — Production Hardening (Sprint 1–2)

> **Goal:** Make the existing features production-safe and deployable. No new features.

### P1.1 — Authentication Middleware (Critical / High Effort)

**Priority:** P0  
**Complexity:** Medium  
**Dependencies:** Requires decision on JWT storage strategy  
**Estimated Effort:** 3–5 days

Create `src/middleware.ts` to protect `/dashboard/*`, `/checkout/*`, and `/admin/*`. Decide between:
- Option A: Keep JWT in localStorage, check auth client-side with redirect on mount (quick, but race condition)
- Option B: Move JWT to `httpOnly` cookie managed by Django → middleware reads cookie (secure, correct)

Recommendation: Option B for production.

---

### P1.2 — Admin Role Authorization (Critical / Low Effort)

**Priority:** P0  
**Complexity:** Low (depends on P1.1)  
**Dependencies:** P1.1 (middleware), backend must include role in JWT claims  
**Estimated Effort:** 1 day

Add role check in middleware for `/admin/*` routes. Redirect non-admin users to home.

---

### P1.3 — Fix Mock Mode Default (Critical / Trivial)

**Priority:** P0  
**Complexity:** Trivial  
**Dependencies:** None  
**Estimated Effort:** 30 minutes

Change `.env.example` default to `NEXT_PUBLIC_USE_MOCK=false`. Add CI step to reject builds with `USE_MOCK=true` + `NODE_ENV=production`.

---

### P1.4 — PWA Assets (Critical / Low Effort)

**Priority:** P0  
**Complexity:** Low  
**Dependencies:** None  
**Estimated Effort:** 4 hours

Generate icon files for all 8 sizes declared in `manifest.json`. Create `public/og-image.jpg`. Create `public/screenshots/menu.png` (referenced in manifest). Verify PWA install flow end-to-end.

---

### P1.5 — Fix Mock Login Logic (High / Trivial)

**Priority:** P1  
**Complexity:** Trivial  
**Dependencies:** None  
**Estimated Effort:** 30 minutes

Fix the credential check in `authService.login()` mock mode so invalid credentials throw an error.

---

### P1.6 — Wire WebSocket Hooks to UI (High / Medium Effort)

**Priority:** P1  
**Complexity:** Medium  
**Dependencies:** Requires working Django Channels backend  
**Estimated Effort:** 2–3 days

1. In `OrderTracker.tsx`: When `useMockSimulation=false`, use `useOrderWebSocket(orderId)` for status updates
2. In `Providers`: Mount `useNotificationWebSocket()` for authenticated users
3. Pass `useMockSimulation={process.env.NEXT_PUBLIC_USE_MOCK === 'true'}` from order/success pages

---

### P1.7 — Complete Arabic Translations (High / Medium Effort)

**Priority:** P1  
**Complexity:** Low (translation, not engineering)  
**Dependencies:** None  
**Estimated Effort:** 2–3 days

Fill all 187 keys in `src/i18n/locales/ar.json`. Consider using the Persian file as a structural reference. Add a CI check that verifies all locale files have the same key count.

---

### P1.8 — ReactQueryDevtools Production Guard (Low / Trivial)

**Priority:** P2  
**Complexity:** Trivial  
**Dependencies:** None  
**Estimated Effort:** 5 minutes

Wrap `<ReactQueryDevtools>` in `process.env.NODE_ENV === 'development'` check.

---

### P1.9 — Remove Dead Dependencies (Low / Trivial)

**Priority:** P2  
**Complexity:** Trivial  
**Dependencies:** None  
**Estimated Effort:** 15 minutes

Remove `socket.io-client` and `next-pwa` from `package.json`. These are installed but unused and add bundle weight.

---

## Phase 2 — Feature Completion (Sprint 3–5)

> **Goal:** Complete partially-implemented features and fill in missing integrations.

### P2.1 — Payment Gateway Integration (High / High Effort)

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

---

### P2.2 — Firebase Push Notifications (High / Medium Effort)

**Priority:** P1  
**Complexity:** Medium  
**Dependencies:** Firebase project, VAPID key, backend FCM integration  
**Estimated Effort:** 2–3 days

1. Create `src/lib/firebase.ts` with `initializeApp()` + `getToken()`
2. After user login in `AuthBootstrapper`, call `requestNotificationToken()`
3. Pass token to `notificationService.registerDevice(token, 'web')`
4. Test push notification delivery via Django Channels / FCM

---

### P2.3 — Reviews Feature (Medium / Medium Effort)

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

### P2.4 — QR Table Ordering Completion (Medium / Low Effort)

**Priority:** P2  
**Complexity:** Low  
**Dependencies:** Backend table API (endpoints defined)  
**Estimated Effort:** 1–2 days

1. When `/table/[tableId]` loads, fetch table info from `ENDPOINTS.TABLE.INFO(tableId)`
2. Store table number in a dedicated store or branch store
3. Pre-populate checkout form with `order_type: 'dine_in'` and `table_number`
4. Show confirmation that the user is ordering for Table N

---

### P2.5 — Home Page Dynamic Featured Items (Low / Low Effort)

**Priority:** P3  
**Complexity:** Low  
**Dependencies:** None  
**Estimated Effort:** 2–3 hours

Replace hardcoded `FEATURED` array in `src/app/page.tsx` with `useFeaturedItems()` hook. Convert to Client Component or use React Query with server hydration.

---

### P2.6 — Reservation Confirmation Page (Low / Low Effort)

**Priority:** P3  
**Complexity:** Low  
**Dependencies:** None  
**Estimated Effort:** 2–4 hours

Create `src/app/reservation/confirm/page.tsx`. Show confirmation code, date, time, guests, branch, and a calendar add link (`.ics` download).

---

### P2.7 — Image Upload for User Avatar (Medium / Medium Effort)

**Priority:** P3  
**Complexity:** Medium  
**Dependencies:** Backend file upload API  
**Estimated Effort:** 2–3 days

Add file input to `dashboard/settings/page.tsx` profile section. Upload via multipart form to backend. Display via `next/image` with Cloudinary/S3 URL (both are in `next.config.ts` image domains).

---

### P2.8 — Locale Switching Without Page Reload (Low / Low Effort)

**Priority:** P3  
**Complexity:** Low  
**Dependencies:** None  
**Estimated Effort:** 2 hours

After `useLangStore.setLocale()` sets the `NEXT_LOCALE` cookie, call `router.refresh()` to trigger a server-side re-render with the new locale.

---

## Phase 3 — Admin Panel (Sprint 6–9)

> **Goal:** Build a functional admin backend to support real restaurant operations.

### P3.1 — Admin API Services (High / High Effort)

**Priority:** P1  
**Complexity:** High  
**Dependencies:** Django admin API endpoints  
**Estimated Effort:** 5–8 days

Create `admin.service.ts` with methods for:
- `getStats(period)` — revenue, orders, customers, reservations
- `getLiveOrders()` — real-time order board
- `updateOrderStatus(id, status)` — advance order through lifecycle
- `getMenuItems()`, `createMenuItem()`, `updateMenuItem()`, `deleteMenuItem()`
- `getCustomers(filters)` — paginated customer list
- `getReservations(date, status)` — reservation management

---

### P3.2 — Admin Stats with Real Data (High / Medium Effort)

**Priority:** P1  
**Complexity:** Medium (after P3.1)  
**Dependencies:** P3.1  
**Estimated Effort:** 3–4 days

Replace hardcoded stats in `admin/stats/page.tsx` with React Query hooks backed by `admin.service`. Add date range picker for period selection.

---

### P3.3 — Admin Order Board with WebSocket (High / Medium Effort)

**Priority:** P1  
**Complexity:** Medium  
**Dependencies:** P3.1, P1.6  
**Estimated Effort:** 3–4 days

Replace local state in `admin/orders/page.tsx` with real-time WebSocket updates from Django Channels. Status advancement should call backend API. Sound/visual alert on new orders.

---

### P3.4 — Admin Menu Management with CMS (Medium / High Effort)

**Priority:** P2  
**Complexity:** High  
**Dependencies:** P3.1, image upload API  
**Estimated Effort:** 5–7 days

Extend `admin/menu/page.tsx` to:
- Create/edit menu items via API (with image upload)
- Manage categories and their ordering
- Set featured/popular/new flags
- Manage extras per item
- Preview nutritional info

---

### P3.5 — Admin Reservations with Live Calendar (Medium / Medium Effort)

**Priority:** P2  
**Complexity:** Medium  
**Dependencies:** P3.1  
**Estimated Effort:** 3–4 days

Replace local state with API data. Add calendar grid view showing reservations by time slot. Implement approve/reject/seat actions backed by API.

---

## Phase 4 — Multi-Branch & Operations Scale (Sprint 10–14)

> **Goal:** Support a growing restaurant chain with operational tooling.

### P4.1 — Branch-Aware Ordering

**Effort:** 5–8 days

- Require branch selection before adding to cart
- Validate that selected items are available at the active branch
- Show branch-specific working hours and delivery radius on menu page
- Support branch-specific pricing (type-level support exists, service support needed)

### P4.2 — Delivery Address with Map Integration

**Effort:** 5–8 days

- Integrate Google Maps or Mapbox for address autocomplete
- Show delivery radius boundary on map
- Validate delivery address is within range of selected branch

### P4.3 — Staff Role Support

**Effort:** 3–5 days

- Add `staff` role handling in middleware (access to `/admin/orders` only)
- Staff dashboard: simplified view of incoming orders for their branch
- Table management view for front-of-house staff

### P4.4 — Branch Management Admin Page

**Effort:** 3–5 days

- New `/admin/branches` page
- Create/edit branch details, working hours, delivery radius
- Activate/deactivate branches

### P4.5 — Order History Search & Export

**Effort:** 3–5 days

- Full-text search across orders (backend support needed)
- Filter by date range, status, branch, payment method
- CSV export for accounting

---

## Phase 5 — SaaS & Enterprise Features (Sprint 15+)

> **Goal:** Prepare for white-label, multi-tenant, or franchise deployment.

### P5.1 — Multi-Tenancy Architecture

**Effort:** 15–25 days

- Tenant-based routing (subdomain or path prefix)
- Per-tenant theming (primary color, logo, fonts)
- Tenant-scoped data isolation
- Requires significant backend changes

### P5.2 — Role-Based Access Control (RBAC)

**Effort:** 5–8 days

Fine-grained permissions beyond `customer/staff/admin`:
- `menu_editor` — can edit menu items
- `order_manager` — can manage orders
- `branch_manager` — scoped to specific branches
- `analytics_viewer` — read-only stats access

### P5.3 — Audit Log

**Effort:** 5–8 days

Track all admin mutations (who changed what, when). Display in admin UI. Requires backend audit model.

### P5.4 — Advanced Analytics Dashboard

**Effort:** 8–12 days

- Revenue trends with chart visualizations (Recharts or Victory)
- Cohort retention analysis
- Menu item performance trends
- Heatmap of popular order times
- Export to PDF

### P5.5 — Observability & Monitoring

**Effort:** 3–5 days

- Sentry for frontend error tracking (`@sentry/nextjs`)
- Core Web Vitals reporting to Sentry Performance
- Google Analytics 4 via `@next/third-parties/google`
- API latency tracking in React Query onError callbacks

### P5.6 — Loyalty & Points System

**Effort:** 8–12 days

- Points earned per order
- Points balance in user dashboard
- Redeem points at checkout as discount
- Loyalty tier display (Bronze/Silver/Gold)

---

## AI & Automation Opportunities

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

The highest-impact engineering tasks for immediate action:

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Fix `.env.example` mock default → `false` | 30 min | Critical safety |
| 2 | Generate and commit PWA icon files | 4 hrs | PWA install |
| 3 | Create `public/og-image.jpg` | 2 hrs | SEO / social |
| 4 | Fix mock login credential check | 30 min | Demo quality |
| 5 | Implement `src/middleware.ts` (client-side auth redirect) | 1 day | Security |
| 6 | Mount `useNotificationWebSocket` in Providers | 2 hrs | Live notifications |
| 7 | Wire `useOrderWebSocket` to `OrderTracker` | 1 day | Real-time tracking |
| 8 | Complete `src/i18n/locales/ar.json` | 2 days | Arabic market |
| 9 | Remove `socket.io-client` and `next-pwa` from deps | 15 min | Bundle size |
| 10 | Guard `<ReactQueryDevtools>` behind dev check | 5 min | Bundle size |

**Total estimated effort for next sprint: ~5–7 days**

---

*Last updated: Based on source code audit of commit at project initialization.*  
*See also: [README.md](./README.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md)*
