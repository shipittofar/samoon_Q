# 01 — Frontend Architecture (Real Execution Path Only)

Scope note: this whole document set describes **only the real (non-mock) execution path**. Every service in `src/services/*.service.ts` is written as:

```ts
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
async someMethod() {
  if (USE_MOCK) { /* in-memory fixture, ignored in this audit */ }
  const { data } = await api.get(ENDPOINTS.X.Y)   // <- documented branch
  return data
}
```
Only the `else`/real branch is documented anywhere in this doc set. Files/methods with **no real branch at all** are explicitly called out as MOCK-ONLY and excluded from the contract inventory (see `10_FRONTEND_CONTRACT_SUMMARY.md`).

## Stack

- Next.js (App Router), React, TypeScript
- Data fetching: TanStack React Query (`@tanstack/react-query`) — no `useInfiniteQuery` used anywhere
- HTTP client: single shared `axios` instance (`src/services/axios.instance.ts`)
- Realtime: native `WebSocket` wrapper (`src/services/websocket.service.ts`), not Socket.IO
- State: Zustand (`src/stores/index.ts`, `src/platform-admin/store.ts`), several `persist`-backed
- Payments: Stripe.js (Elements + `confirmPayment`), client-side confirmation
- i18n: `src/i18n/locales`

## Layers

```
Page (src/app/**/page.tsx)
  → Hook (src/hooks/index.ts — single 3049-line central file, ~87 useQuery + ~63 useMutation)
    → Service (src/services/*.service.ts — one per domain)
      → ENDPOINTS (src/services/endpoints.ts — URL template registry)
        → axios instance (src/services/axios.instance.ts) → Django REST backend
      → OR native WebSocket (src/services/websocket.service.ts) → Django Channels backend
```

Almost all React Query hooks live in one file, `src/hooks/index.ts`. A few pages/components call `useQueryClient()` directly and invalidate inline (`AdminBranchSwitcher.tsx`, `dashboard/addresses/page.tsx`).

## HTTP infrastructure (`src/services/axios.instance.ts`)

- `baseURL`: `API_BASE_URL` = `NEXT_PUBLIC_API_BASE_URL` env var, default `http://localhost:8000/api`
- `timeout`: 15000ms
- `withCredentials: true` (cookies sent)
- Default headers: `Content-Type: application/json`, `Accept: application/json`
- **Request interceptor**: attaches `Authorization: Bearer <access_token>` (from `localStorage['access_token']`) on every request if a token exists; attaches `X-CSRFToken` (from `csrftoken` cookie) on all non-GET/HEAD/OPTIONS/TRACE requests.
- **Response interceptor**: on `401` (not already retried), performs silent token refresh — `POST {API_BASE_URL}/auth/token/refresh/` with `{ refresh }` (raw axios, bypassing interceptors) — queues concurrent 401s and replays them with the new token. On refresh failure: clears tokens and dispatches a `window` `CustomEvent('auth:logout')`.
- Access token is also mirrored into a **non-HttpOnly cookie** (`access_token=...; SameSite=Strict`) so Next.js Edge middleware can read it for route protection; cookie `max-age` is driven by a platform-configuration field (`authentication.jwt_refresh_ttl_days`), default 7 days.

WebSocket base: `WS_BASE_URL` = `NEXT_PUBLIC_WS_BASE_URL`, default `ws://localhost:8000/ws`. Auth is a JWT passed as a **URL query param** (`?token=...`), since browsers cannot set custom WS headers.

## Auth model

There is **no client-side call-blocking based on role/permission** at the axios layer. Every real HTTP call simply gets whatever bearer token is currently in `localStorage`, if any; "protected vs public" is inferred from semantics (backend enforces it), except:
- `auth.service.ts` gates several methods behind platform-configuration feature flags (`authentication.enabled`, `.email_login_enabled`, `.registration_enabled`, `.otp.enabled`, `.phone_login_enabled`) — these throw a plain `Error` client-side *before* any HTTP call if disabled.
- All RBAC/authorization UI gating (`PermissionGuard`, `AccessDenied`, `usePermission`) is **100% client-side and mock/local** — see `08_ERROR_HANDLING_REFERENCE.md` and `10_FRONTEND_CONTRACT_SUMMARY.md`. It never calls a backend permission-check endpoint.

## Route structure

- Public marketplace: `/`, `/discover`, `/[tenantSlug]`, `/[tenantSlug]/[branchSlug]`, `/menu`, `/[tenantSlug]/[branchSlug]/menu`, `/promotions`, `/vendors`, `/reservation`, `/table/[tableId]`
- Auth: `/login`, `/register`, `/forgot-password`, `/verify`, `/verify-otp`, `/complete-profile`
- Customer account (guarded by `src/app/dashboard/layout.tsx`, a client-side Zustand check — no separate `<ProtectedRoute>` component): `/dashboard`, `/dashboard/orders`, `/dashboard/reservations`, `/dashboard/favorites`, `/dashboard/addresses`, `/dashboard/settings`
- Checkout: `/cart` (redirects to `/menu`), `/checkout`, `/checkout/success`, `/checkout/failure`
- Order tracking: `/order` (redirects), `/order/[orderId]`, `/order/[orderId]/track` (WebSocket + polling)
- Admin console (tenant-scoped, ~50 pages): `/console/**` — see `05_PAGE_TO_API_MAPPING.md`
- Platform admin (**entirely mock/local — no live backend calls anywhere in this tree**): `/platform-admin`, `/platform-admin/[moduleId]`

## Notable architectural inconsistencies (carried through every doc in this set)

1. **Two parallel notification systems**: legacy `notificationService` (`combined.service.ts`, hits `/notifications/*` via `ENDPOINTS.NOTIFICATIONS`) vs. rich `notificationRichService` (`notification.service.ts`, hits hardcoded `/notifications/rich/`, `/notifications/statistics/`, etc., bypassing `ENDPOINTS` entirely).
2. **Two parallel branch services**: legacy `branchService` (`combined.service.ts`, simple list/detail) vs. `branchManagementService` (`branch.service.ts`, full P7.3 CRUD + status transitions).
3. Many admin/RBAC-adjacent services (`permission.service.ts`, `rbac-audit.service.ts`, `ownership.service.ts`, `ownership-resolution.service.ts`, `ownership-migration.service.ts`, `branch-access.service.ts`, `order-routing.service.ts`, `notification-event-registry.ts`, `audit-event-registry.ts`, `realtime-event-registry.ts`) have **zero network calls under any configuration** — pure client-side logic/static registries.
4. `branch-analytics.service.ts` explicitly `throw`s if not in mock mode — there is no working real-mode path.
5. Several service files bypass `ENDPOINTS` and hardcode raw path strings (`audit-log.service.ts`, `realtime-operations.service.ts`, `owner.service.ts`, `staff-assignment.service.ts`, `admin.service.ts`'s customer-360 methods, `notification.service.ts`, `notification-preferences.service.ts`).
6. Two services have real-mode URL-construction bugs where a tenant/staff ID is sourced from the **mock** in-memory fixture array even when `USE_MOCK=false` (`staff-assignment.service.ts revoke()`, `staff.service.ts transferOwnership()`).
