# 02 — API Endpoint Inventory (Real Endpoints Only)

Legend: ● = endpoint has a genuine `await api.*` call in the real (non-mock) branch (the backend may or may not actually be deployed — see notes). ⚠️ = code comment explicitly states the backend endpoint is undeployed/will 404. ○ = excluded, MOCK-ONLY, no listing here (see `10_FRONTEND_CONTRACT_SUMMARY.md` for the full exclusion list).

All paths are relative to `API_BASE_URL` (default `http://localhost:8000/api`). All defined via `ENDPOINTS` in `src/services/endpoints.ts` unless marked **(literal)** — a raw string not registered in `ENDPOINTS`.

## Auth (`auth.service.ts`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login/` | public | gated by `authentication.email_login_enabled` flag |
| POST | `/auth/register/` | public | gated by `authentication.registration_enabled` |
| POST | `/auth/logout/` | protected | always clears local tokens regardless of response |
| GET | `/auth/token/refresh/` → actually POST | public | called from response interceptor, not a service method |
| GET | `/auth/me/` | protected | |
| POST | `/auth/forgot-password/` | public | |
| POST | `/auth/reset-password/` | public | |
| POST | `/auth/verify-otp/` | public | gated by `authentication.otp.enabled` + `phone_login_enabled` |
| POST | `/auth/send-otp/` | public | same gating |
| POST | `/auth/change-password/` | protected | |

## Menu (`menu.service.ts`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/menu/categories/` | public | |
| GET | `/menu/items/` | public | filters/pagination/sort — see `03_REQUEST_RESPONSE_CONTRACTS.md` |
| GET | `/menu/items/{id}/` | public | |
| GET | `/menu/items/featured/` | public | |
| GET | `/menu/items/popular/` | public | |
| GET | `/menu/items/{id}/related/` | public | |
| GET | `/menu/items/search/` | public | query `?q=` |
| POST | `/menu/items/` | admin | create |
| PATCH | `/menu/items/{id}/` | admin | update |
| DELETE | `/menu/items/{id}/` | admin | delete |

Unused-but-registered: `ENDPOINTS.MENU.ITEM_BY_SLUG`, `ENDPOINTS.MENU.CATEGORY(id)`.

## Orders (`order.service.ts`, plus admin overlay)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/orders/` | protected (guest checkout allowed client-side) | create |
| GET | `/orders/` | protected | list, `?page=` |
| GET | `/orders/{id}/` | protected | detail; polled every 30s by `useOrder` |
| POST | `/orders/{id}/cancel/` | protected | |
| POST | `/orders/validate-discount/` | protected | `{code, subtotal}` |
| GET | `/orders/` (admin) | admin | `admin.service.getAdminOrders` reuses same list URL with `admin: true` + filters query, ⚠️ comment says intended target is `/admin/orders/` (undeployed) |
| PATCH | `/orders/{id}/status/` | admin | ⚠️ per comment, backend not deployed |

Unused-but-registered: `ORDERS.REORDER`, `ORDERS.TRACK`, `ORDERS.STATUS` (customer-facing; admin uses `STATUS`).

## Payments (`payment.service.ts`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/create-intent/` | protected | Stripe PaymentIntent |
| — | — | — | **Confirmation is never sent to the backend** — done client-side via Stripe.js `stripe.confirmPayment()`. `ENDPOINTS.PAYMENTS.CONFIRM` (`/payments/confirm/`) is registered but unused by any audited service method (flag for follow-up: `StripePaymentForm.tsx` was not fully traced and may call it directly). |

## Reservations (`combined.service.ts` reservationService + admin overlay)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/reservations/` | public | |
| GET | `/reservations/` | protected | customer list |
| POST | `/reservations/{id}/cancel/` | protected | |
| GET | `/reservations/available-slots/` | public | `?date=&branch_id=` |
| GET | `/reservations/` (admin) | admin | `admin.service.getAdminReservations`, ⚠️ intended `/admin/reservations/` |
| GET | `/reservations/{id}/` | admin | `admin.service.getAdminReservation` |
| POST | `/reservations/{id}/confirm/` | admin | ⚠️ per comment, undeployed |

Unused: `RESERVATIONS.CONFIRM` (customer-facing alias, admin uses same path).

## Branches
Two parallel services — see `01_FRONTEND_ARCHITECTURE.md` note.

`combined.service.ts branchService` (legacy, public):
| GET | `/branches/` | public | `?tenant_id=` |
| GET | `/branches/{id}/` | public | |

`branch.service.ts branchManagementService` (P7.3, admin):
| GET | `/branches/` | admin | |
| GET | `/branches/{id}/` | admin | |
| GET | `/branches/{id}/metrics/` | admin | |
| POST | `/branches/` | admin | create |
| PATCH | `/branches/{id}/` | admin | update |
| POST | `/branches/{id}/activate/` | admin | |
| POST | `/branches/{id}/deactivate/` | admin | |
| POST | `/branches/{id}/maintenance/` | admin | |
| PATCH | `/branches/{id}/manager/` | admin | assign manager |

Unused: `BRANCHES.NEARBY`.

## Notifications
Three coexisting real integrations — see architecture doc note 1.

`combined.service.ts notificationService` (legacy):
| GET | `/notifications/` | protected | |
| POST | `/notifications/{id}/read/` | protected | |
| POST | `/notifications/read-all/` | protected | |
| POST | `/notifications/register-device/` | protected | `{token, platform}` |

`notification.service.ts notificationRichService` (P7.6, literal paths, not in `ENDPOINTS`):
| GET | `/notifications/rich/` | protected | filterable/paginated |
| GET | `/notifications/{id}/` | protected | |
| POST | `/notifications/{id}/read/` | protected | |
| POST | `/notifications/read-all/` | protected | |
| DELETE | `/notifications/{id}/` | protected | |
| POST | `/notifications/{id}/archive/` | protected | |
| GET | `/notifications/statistics/` | protected | |
| GET | `/notifications/unread-count/` | protected | polled 30s |
| POST | `/notifications/` | protected | create |
| GET | `/notifications/summary/` | protected | polled 30s |

`notification-preferences.service.ts` (literal paths):
| GET | `/notifications/preferences/` | protected | `?userId=&tenantId=&branchId=` |
| PATCH | `/notifications/preferences/{category}/` | protected | |
| POST | `/notifications/preferences/` | protected | |
| POST | `/notifications/preferences/reset/` | protected | |

## Users (`combined.service.ts userService`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| PATCH | `/users/profile/` | protected | |
| GET | `/users/addresses/` | protected | |
| POST | `/users/addresses/` | protected | |
| DELETE | `/users/addresses/{id}/` | protected | |
| GET | `/users/favorites/` | protected | |
| POST | `/users/favorites/{itemId}/` | protected | toggle |
| POST | `/users/avatar/` | protected | multipart upload, client validates type/size first |

## Tenants (`tenant.service.ts`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/tenants/{slug}/` | public | reads silently fall back to `DEFAULT_TENANT` on any error |
| GET | `/tenants/current/` | public | same fallback behavior |
| GET | `/tenants/` | public | same fallback behavior; used both for admin list and public discovery (`usePublicTenants`) |
| POST | `/tenants/{id}/activate/` | admin | |
| POST | `/tenants/{id}/suspend/` | admin | |
| POST | `/tenants/{id}/archive/` | admin | |
| POST | `/tenants/{id}/transfer-ownership/` | admin | `{newOwnerId}` |
| PATCH | `/tenants/{slug}/settings/` | admin | arbitrary patch object |
| POST | `/tenants/provision/` | admin/owner | `tenant-provisioning.service.ts`, client pre-validates before sending |
| POST | `/tenants/clone/` | admin/owner | snake_case body (inconsistent with rest of file) |

## Reviews
Two levels — item-level (`review.service.ts`) and business/tenant-level (`business-review.service.ts`).

Item-level:
| GET | `/menu/items/{itemId}/reviews/` | public | |
| POST | `/reviews/` | protected | |

Business-level (P8.8.5):
| GET | `/tenants/{tenantId}/reviews/` | public | query via `URLSearchParams`: `sort, verified, with_photos, branch_id, language, rating` |
| GET | `/tenants/{tenantId}/reviews/rating/` | public | overall rating breakdown |
| GET | `/tenants/{tenantId}/branches/{branchId}/reviews/rating/` | public | branch-scoped rating |
| POST | `/tenants/{tenantId}/reviews/` | protected | create |
| POST | `/tenants/{tenantId}/reviews/{reviewId}/reply/` | admin | |
| PATCH | `/tenants/{tenantId}/reviews/{reviewId}/reply/` | admin | edit reply |
| DELETE | `/tenants/{tenantId}/reviews/{reviewId}/reply/` | admin | delete reply |
| POST | `/tenants/{tenantId}/reviews/{reviewId}/helpful/` | protected | |
| PATCH | `/tenants/{tenantId}/reviews/{reviewId}/moderate/` | admin | `{status}` |
| GET | `/tenants/{tenantId}/reviews/analytics/` | admin | |

## Loyalty (`loyalty.service.ts`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/loyalty/account/` | protected | no params sent — backend derives user/tenant from auth context |
| GET | `/loyalty/transactions/` | protected | |
| GET | `/loyalty/rewards/` | public/protected | |
| POST | `/loyalty/rewards/{id}/redeem/` | protected | |
| POST | `/loyalty/earn/` | protected | `{order_id, amount}` |
| GET | `/admin/loyalty/rewards/` | admin | |
| POST | `/admin/loyalty/rewards/` | admin | create |
| PATCH | `/admin/loyalty/rewards/{id}/` | admin | update / disable (via `active:false`) |

## Vendors (`vendor.service.ts`, food_court only)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/vendors/` | public | |
| GET | `/vendors/{id}/` | public | |
| GET | `/vendors/{id}/stats/` | admin | |
| GET | `/vendors/{id}/settlements/` | admin | |
| POST | `/admin/vendors/` | admin | create |
| PATCH | `/admin/vendors/{id}/` | admin | update / disable |
| POST | `/admin/settlements/` | admin | `{vendorId, grossRevenue, settlementDate?, payoutReference?}` |

## Promotions (`promotion.service.ts`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/promotions/` | public | |
| GET | `/promotions/active/` | public | polled 60s on customer pages |
| POST | `/promotions/` | admin | create |
| PATCH | `/promotions/{id}/` | admin | update / activate / disable (all via generic PATCH; `PROMOTIONS.ACTIVATE` endpoint registered but unused) |

## Admin dashboard / Customer 360 (`admin.service.ts`) — ⚠️ mostly undeployed per code comments
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats/` | ⚠️ |
| GET | `/orders/` (with `admin:true` query) | live, reuses public orders list |
| PATCH | `/orders/{id}/status/` | ⚠️ |
| GET | `/reservations/{id}/` | live |
| GET | `/reservations/` (with `admin:true`) | live |
| POST | `/reservations/{id}/confirm/` | ⚠️ |
| GET | `/admin/customers/` | ⚠️ |
| GET | `/admin/customers/{id}/` | ⚠️ |
| GET | `/admin/customers/{id}/stats/` | ⚠️ |
| GET | `/console/customers/{id}/reviews/` **(literal)** | ⚠️ inconsistent `/console/` prefix |
| GET | `/admin/business-customers/` **(literal)** | ⚠️ |
| GET | `/admin/business-customers/{userId}/branches/` **(literal)** | ⚠️ |
| GET | `/admin/customers/{userId}/timeline/` **(literal)** | ⚠️ |
| GET/POST/PATCH/DELETE | `/admin/customers/{userId}/notes/`, `/admin/notes/{noteId}/` **(literal)** | ⚠️ |
| GET/PATCH | `/admin/customers/{userId}/tags/` **(literal)** | ⚠️ |
| GET | `/admin/tenants/{tenantId}/tags/` **(literal)** | ⚠️ |
| GET | `/admin/customers/{userId}/analytics\|marketing\|coupons\|payments\|orders\|reservations/` **(literal)** | ⚠️ |

## Analytics (`analytics.service.ts`)
| GET | `/admin/analytics/summary/` | admin | `?dateFrom&dateTo` |
| GET | `/admin/analytics/revenue/` | admin | |
| GET | `/admin/analytics/reservations/` | admin | |
| GET | `/admin/analytics/loyalty/` | admin | |
| GET | `/admin/analytics/promotions/` | admin | |
| GET | `/admin/analytics/vendors/` | admin | |
| GET | `/admin/analytics/menu/` | admin | |

## Staff (`staff.service.ts`, P7.2)
| GET | `/tenants/{tenantId}/staff/` | admin | |
| GET | `/staff/{id}/` | admin | |
| GET | `/tenants/{tenantId}/invites/` | admin | |
| POST | `/tenants/{tenantId}/staff/invite/` | admin | |
| POST | `/invites/{id}/cancel/` | admin | |
| POST | `/invites/{id}/resend/` | admin | |
| POST | `/invites/{id}/accept/` | protected | |
| PATCH | `/staff/{id}/roles/` | admin | |
| POST | `/staff/{id}/activate/` | admin | |
| POST | `/staff/{id}/suspend/` | admin | |
| POST | `/staff/{id}/remove/` | admin | |
| POST | `/tenants/{tenantId}/transfer-ownership/` | admin | ⚠️ real-mode bug: `tenantId` sourced from mock fixture array (see architecture doc) |

## Staff Assignments (`staff-assignment.service.ts`, P10.2.1) — ⚠️ undeployed per comment
| GET | `/admin/staff/{staffId}/assignments/` **(literal)** |
| GET | `/admin/staff/assignments/` **(literal)** |
| POST | `/admin/staff/{staffId}/assignments/` **(literal)** |
| DELETE | `/admin/staff/{staffId}/assignments/{assignmentId}/` **(literal)** | ⚠️ real-mode bug: `staffId` sourced from mock store |

## Owners (`owner.service.ts`, P10.2.1) — ⚠️ undeployed per comment, platform-admin scope
| GET | `/admin/platform/owners/` **(literal)** |
| GET | `/admin/platform/owners/{ownerId}/` **(literal)** |
| PATCH | `/admin/platform/owners/{ownerId}/` **(literal)** |

## Audit Log (`audit-log.service.ts`, P7.5, all literal, not in `ENDPOINTS`)
| GET | `/audit-logs/` |
| GET | `/audit-logs/{id}/` |
| POST | `/audit-logs/` |
| GET | `/audit-logs/timeline/` |
| POST | `/audit-logs/export/` (returns CSV string) |
| GET | `/audit-logs/statistics/` |

## Realtime Operations (`realtime-operations.service.ts`, P7.7, all literal, REST polling — not WebSocket)
| GET | `/operations/snapshot/` |
| GET | `/operations/branches/{id}/status/` |
| GET | `/operations/branches/status/` |
| GET | `/operations/branches/{id}/kitchen/` |
| GET | `/operations/orders/live/` |
| GET | `/operations/reservations/live/` |
| GET | `/operations/staff/presence/` |
| GET | `/operations/sla-alerts/` |
| GET | `/operations/statistics/` |
| POST | `/operations/events/` |

## Website Builder (`website-builder.service.ts`, P8.8.6)
| GET | `/tenants/{tenantSlug}/website/layout/` |
| PUT | `/tenants/{tenantSlug}/website/layout/` |
| POST | `/tenants/{tenantSlug}/website/publish/` |
| POST | `/tenants/{tenantSlug}/website/versions/{versionId}/restore/` |
| GET | `/tenants/{tenantSlug}/branches/{branchSlug}/website/overrides/` |
| PUT | `/tenants/{tenantSlug}/branches/{branchSlug}/website/overrides/` |

Registered but unused by any service method: `WEBSITE_BUILDER.VERSIONS` (list versions), `WEBSITE_BUILDER.MEDIA_UPLOAD`.

## Tables (`combined.service.ts tableService`)
| GET | `/tables/{tableId}/` | public |

Unused: `TABLE.ORDER`.

## WebSocket channels (`websocket.service.ts`) — not USE_MOCK-gated, always attempts a real connection
| Singleton | Channel name | Purpose |
|---|---|---|
| `orderWebSocket` | `savor-orders` | order status push, connects to `/orders/{id}/`-style path per caller |
| `notificationWebSocket` | `savor-notifications` | notification push |
| `adminOperationsSocket` | `admin.operations` | via `OperationsChannelManager` |
| `branchOperationsSocket` | `branch.operations` | |
| `ordersBroadcastSocket` | `orders.broadcast` | |
| `reservationsBroadcastSocket` | `reservations.broadcast` | |
| `staffBroadcastSocket` | `staff.broadcast` | |
| `notificationsBroadcastSocket` | `notifications.broadcast` | |
| `auditBroadcastSocket` | `audit.broadcast` | |

Auth: JWT via `?token=` query param. Heartbeat: `ping`/`pong` every 30s (10s timeout). Reconnect: exponential backoff + jitter, capped 30s, max 10 attempts, paused when tab hidden/offline.

## Endpoints referenced as raw string literals (not in the `ENDPOINTS` registry)

`/notifications/rich/`, `/notifications/preferences/*`, `/audit-logs/*`, `/console/customers/{id}/reviews/`, `/admin/business-customers/*`, `/admin/customers/{userId}/{timeline,notes,tags,analytics,marketing,coupons,payments,orders,reservations}/`, `/admin/notes/{noteId}/`, `/admin/tenants/{tenantId}/tags/`, `/admin/platform/owners/*`, `/admin/staff/*assignments*`, `/operations/*`.
