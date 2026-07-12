# 05 — Page → API Mapping

Only real (non-mock) calls are listed. Format: Page → Hooks/Components → Service → Endpoint → Notes.

## Part A — Customer-facing pages

### Marketplace / Tenant
| Page | Hooks | Service → Endpoint | Notes |
|---|---|---|---|
| `/` | none | — | Pure marketing page; renders `CartDrawer`/`FloatingCart` (zustand cart state only) |
| `/[tenantSlug]` | `usePublicTenant, useCategories, useMenuItems, useActivePromotions, useHomepageLayout` | `tenantService.getTenant` → `GET /tenants/{slug}/`; `menuService.getCategories/getItems` → `/menu/categories/`, `/menu/items/`; `promotionService.getActive` → `/promotions/active/`; `websiteBuilderService.getLayout` → `/tenants/{slug}/website/layout/` | Server component prefetches tenant, client component does the rest |
| `/[tenantSlug]/[branchSlug]` | `usePublicTenant, usePublicBranch, useCategories, useMenuItems, useActivePromotions, useHomepageLayout` | same as above | `usePublicBranch` does NOT call a branch endpoint — derives branch info client-side from `tenant.settings.marketplace.branches` |
| `/[tenantSlug]/[branchSlug]/menu` | `useCategories, useMenuItems` | `/menu/categories/`, `/menu/items/` | |
| `/discover` | `usePublicTenants` | `tenantService.getTenants` → `GET /tenants/` | Filtered client-side to active/trial, excludes `default` slug |
| `/restaurant` | direct call | `tenantService.getTenant('savor')` → `GET /tenants/{slug}/` | Falls back to hardcoded content on error |
| `/location`, `/events`, `/reviews` (top-level) | none | — | Static "coming soon" behind `CapabilityGuard` |

### Menu / Cart / Checkout
| Page | Hooks | Service → Endpoint | Notes |
|---|---|---|---|
| `/menu` | `useCategories, useMenuItems` | `/menu/categories/`, `/menu/items/` | Server-prefetched + hydrated |
| `/cart` | none | — | Redirects to `/menu`; `CartDrawer` calls `orderService.validateDiscount` → `POST /orders/validate-discount/` only when a code is applied |
| `/checkout` | `useCreateOrder, useCreatePaymentIntent` | `POST /orders/`, `POST /payments/create-intent/` | Guest checkout supported (no auth guard) |
| `/checkout/success` | none (embeds `OrderTracker`) | see Order Tracking below | |
| `/checkout/failure` | none | — | Static |

### Auth
| Page | Hooks | Service → Endpoint |
|---|---|---|
| `/login` | `useLogin, useSendOTP` | `POST /auth/login/`, `POST /auth/send-otp/` |
| `/register` | `useRegister` | `POST /auth/register/` |
| `/forgot-password` | direct call | `POST /auth/forgot-password/` |
| `/verify` | `useVerifyOTP, useSendOTP` | `POST /auth/verify-otp/`, `POST /auth/send-otp/` |
| `/verify-otp` | direct call | `POST /auth/verify-otp/` |
| `/complete-profile` | `useRegister` | `POST /auth/register/` |

### Dashboard / Account (guarded client-side by `src/app/dashboard/layout.tsx` via `useAuthStore`)
| Page | Hooks | Service → Endpoint |
|---|---|---|
| `/dashboard` | `useOrders, useReservations` | `GET /orders/`, `GET /reservations/` |
| `/dashboard/addresses` | `useAddresses` + direct `userService` calls | `GET /users/addresses/`, `POST /users/addresses/`, `DELETE /users/addresses/{id}/` |
| `/dashboard/favorites` | `useMenuItems`, `useToggleFavorite` | `GET /menu/items/`, `POST/DELETE /users/favorites/{itemId}/` |
| `/dashboard/orders` | `useOrders, useCreateReview` | `GET /orders/`, `POST /reviews/` |
| `/dashboard/reservations` | `useReservations` | `GET /reservations/` |
| `/dashboard/settings` | direct `userService` calls | `PATCH /users/profile/`, `POST /users/avatar/`, `POST /auth/change-password/` |

### Order & Reservation
| Page | Hooks | Service → Endpoint | Notes |
|---|---|---|---|
| `/order` | none | — | Redirects to `/dashboard/orders` |
| `/order/[orderId]` | `useOrder` | `GET /orders/{id}/` | Polls every 30s |
| `/order/[orderId]/track` | `useOrder` + `OrderTracker` | `GET /orders/{id}/` + WebSocket `/orders/{id}/` | **Realtime**: WS push + 30s poll fallback |
| `/reservation` | `useCreateReservation, useAvailableSlots, useBranches` | `POST /reservations/`, `GET /reservations/available-slots/`, `GET /branches/` | No auth required |
| `/reservation/confirm` | none | — | Renders query-param data only |

### Loyalty / Promotions / Vendors
| Page | Hooks | Service → Endpoint |
|---|---|---|
| `/loyalty` | `useLoyaltyAccount, useLoyaltyTransactions, useLoyaltyRewards, useRedeemReward` | `GET /loyalty/account\|transactions\|rewards/`, `POST /loyalty/rewards/{id}/redeem/` |
| `/promotions` | `usePromotions, useActivePromotions` | `GET /promotions/`, `GET /promotions/active/` |
| `/vendors` | `useVendors, useVendorStats, useVendorSettlements` | `GET /vendors/`, `GET /vendors/{id}/stats/`, `GET /vendors/{id}/settlements/` |

### Table / QR
| Page | Hooks | Service → Endpoint |
|---|---|---|
| `/table` | none | — redirects to `/menu` |
| `/table/[tableId]` | `useTableInfo`, `useQRExperience` | `GET /tables/{tableId}/` (QR experience is a local lookup, no network) |
| `/[tenantSlug]/[branchSlug]/table/[code]` | none | — client redirect to `/table/{code}` |

### Realtime / polling summary
- `useOrderWebSocket` (WebSocket to `/orders/{id}/`) used by `OrderTracker`, embedded in `checkout/success`, `order/[orderId]`, `order/[orderId]/track`.
- `useOrder` polls every 30s as a fallback alongside the socket.
- No customer page found using `useNotificationWebSocket` directly.

---

## Part B — Admin console / platform-admin pages

Legend: ● REAL (every call has a live `await api.*` branch) / ○ MOCK-ONLY (zero network calls, or explicitly throws/returns undefined outside mock mode) / MIXED.

**Every** `/console/*` page's RBAC gate (`AccessDenied`/`PermissionGuard`/`usePermission`) is ○ MOCK-ONLY — client-side only, backed by `permission.service.ts` + `ownership-resolution.service.ts`, neither of which ever calls a backend.

| Page | Service(s) | Status | Endpoint(s) |
|---|---|---|---|
| `console/page.tsx` | permission.service (local) | ○ | dashboard shell, no fetch |
| `console/analytics` | analytics.service | ● | `/admin/analytics/*` (all 7) |
| `console/audit-logs`, `console/audit-logs/[id]` | audit-log.service | ● | `/audit-logs/*` |
| `console/bar/events`, `console/bar/happy-hour`, `console/cafe/happy-hour`, `console/food-court/seating`, `console/food-truck/routes`, `console/food-truck/stops`, `console/mobile-cafe/routes` | none | ○ | static demo content, no service import |
| `console/branches`, `console/branches/new`, `console/branches/[id]` | branch.service | ● | `/branches/*` full CRUD |
| `console/branches/analytics`, `console/branches/[id]/analytics` | branch-analytics.service | ○ (analytics half) / ● (branch metadata half) | `branch-analytics.service.ts` **throws** `'Network mode not available'` outside mock — no working real path |
| `console/cafe/loyalty`, `console/mobile-cafe/loyalty` | loyalty.service (if wired) | ● (if wired) | `/admin/loyalty/rewards/` |
| `console/customers`, `console/customers/[id]`, `console/customers/[id]/reviews` | admin.service (full CRM surface) | ● (⚠️ backend largely undeployed per comments) | `/admin/customers/*` and ~15 literal `/admin/*` CRM paths |
| `console/food-court/vendors` | vendor.service | ● | `/vendors/*`, `/admin/vendors/*`, `/admin/settlements/` |
| `console/kitchen` | realtime-operations.service via `KitchenDisplay` | ● | `/operations/branches/{id}/kitchen/` |
| `console/loyalty` | loyalty.service | ● | `/admin/loyalty/rewards/*` |
| `console/menu` | menu.service | ● | `/menu/categories/`, `/menu/items/*` |
| `console/notifications`, `console/notifications/[id]` | notification.service | ● | `/notifications/rich/*` family |
| `console/operations` | realtime-operations.service (via `LiveOrderQueue`, `LiveReservationQueue`, `KitchenDisplay`, `StaffPresenceBoard`, `BranchStatusGrid`, `SLAMonitor`, `ActivityFeed`) | ● | full `/operations/*` set; also layers `websocket.service.ts` (always attempts a real connection, not USE_MOCK-gated) |
| `console/orders`, `console/orders/[id]` | admin.service, order.service, branch.service | ● | `/admin/orders/` (⚠️ falls back to `/orders/`), `/orders/{id}/status/`, `/orders/{id}/`, `/branches/` |
| `console/permissions`, `console/permissions/[userId]`, `console/permissions/simulator` | permission.service | ○ | zero `await api.*` calls anywhere in file — static role/permission map |
| `console/promotions`, `console/promotions/[id]` | promotion.service | ● | `/promotions/*` |
| `console/reservations`, `console/reservations/[id]` | admin.service, combined.service, branch.service | ● | `/admin/reservations/` (⚠️ falls back to `/reservations/`), `/reservations/{id}/confirm\|cancel/`, `/branches/` |
| `console/reviews` | business-review.service | ● | `/tenants/{id}/reviews/*` |
| `console/roles`, `console/roles/new` | permission.service | ○ | static role templates |
| `console/settings` | tenant.service (real) + feature-flags.service (local) | MIXED | `PATCH /tenants/{slug}/settings/` is ● real; flag *resolution* itself is always ○ client-computed |
| `console/settings/feature-flags` | feature-flags.service + tenant.service | MIXED | flag toggle persists via tenant-settings PATCH (●); resolution is ○ |
| `console/settings/configuration`, `console/settings/configuration/[moduleId]` | `configurationService` (local config registry) | ○ | no HTTP involved |
| `console/staff`, `console/staff/[id]` | staff.service, permission.service, branch.service | ● (staff record) / ○ (role→permission display) | `/tenants/{id}/staff/*`, `/staff/{id}/*`, `/invites/*` |
| `console/tenants`, `console/tenants/[slug]`, `console/tenants/new` | tenant.service, tenant-provisioning.service | ● | `/tenants/*`, `/tenants/provision/`, `/tenants/clone/` |
| `console/users`, `console/users/[id]` | uncertain — likely reuses admin.service customer methods; `ROLE_TEMPLATES` portion confirmed ○ | needs spot-check | no dedicated `USERS.LIST`/platform-user endpoint found in `ENDPOINTS` |
| `console/vendors`, `console/vendors/[id]` | vendor.service | ● | `/vendors/*` |
| `console/website` | website-builder.service | ● | `/tenants/{slug}/website/*` |
| `platform-admin`, `platform-admin/[moduleId]` | `platformDashboardRegistry`/`widgets.ts`, `configurationService` | ○ | **entire tree is 100% hardcoded/local** — stat tiles explicitly commented "illustrative... not live production metrics" |

### Shared admin components with real API calls
| Component | Service | Endpoint |
|---|---|---|
| `KitchenDisplay.tsx` | realtime-operations.service | `/operations/branches/{id}/kitchen/` |
| `LiveOrderQueue.tsx` | realtime-operations.service | `/operations/orders/live/` |
| `LiveReservationQueue.tsx` | realtime-operations.service | `/operations/reservations/live/` |
| `StaffPresenceBoard.tsx` | realtime-operations.service | `/operations/staff/presence/` |
| `BranchStatusGrid.tsx` | realtime-operations.service | `/operations/branches/status/` |
| `SLAMonitor.tsx` | realtime-operations.service | `/operations/sla-alerts/` |
| `ActivityFeed.tsx`, `AuditTimeline.tsx` | audit-log.service | `/audit-logs/timeline/` |
| `AdminBranchSwitcher.tsx` | branch.service (via `useAdminBranches`) | `/branches/` (also invalidates 7 query keys on switch) |
| `AdminTenantSwitcher.tsx` | tenant.service (via `useTenants`) | `/tenants/` |
| `PushNotificationSettings.tsx` | notification-preferences.service | `/notifications/preferences/*` |

### Headline findings for admin pages
1. Fully MOCK-ONLY regardless of env: `console/permissions/*`, `console/roles/*`, `console/branches/analytics` (+ analytics half of `console/branches/[id]/analytics`), `console/settings/configuration/*`, entire `platform-admin/*` tree, and several thin vertical-specific pages with no service imports at all.
2. Fully REAL: customers 360, orders, reservations, branches, tenants, staff (except sync lookup helpers), menu, promotions, loyalty admin rewards, vendors, website builder, business reviews, notifications, audit logs, analytics, and the whole `operations`/`kitchen` realtime suite.
3. Silent-degrade risk: `owner.service.ts` and `staff-assignment.service.ts` methods gated `if (!USE_MOCK) return undefined`, used by `useHasDashboardAccess()` in `src/hooks/index.ts` — documented in that file as a real login-lockout bug class against a real backend without those endpoints deployed.
