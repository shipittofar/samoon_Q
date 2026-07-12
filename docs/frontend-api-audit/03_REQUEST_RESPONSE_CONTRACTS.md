# 03 — Request / Response Contracts

Per-endpoint request/response shapes for every REAL endpoint (see `02_API_ENDPOINT_INVENTORY.md`). Types are TypeScript-as-documented in the frontend; full field definitions (including nullable/optional markers and nested types) are in `04_TYPESCRIPT_MODEL_REFERENCE.md`.

## Auth
| Endpoint | Request | Response |
|---|---|---|
| `POST /auth/login/` | `LoginCredentials {email, password}` | `{user: User, tokens: AuthTokens, p7Roles?: Role[]} & AuthSessionRbacPayload` |
| `POST /auth/register/` | `RegisterData {phone_number?, country_code?, password?, confirm_password?, first_name, last_name}` | same shape as login |
| `POST /auth/logout/` | none | — (204/empty expected) |
| `POST /auth/token/refresh/` | `{refresh: string}` | `{access: string, refresh?: string}` |
| `GET /auth/me/` | — | `User & AuthSessionRbacPayload & {tenantRoles?: Role[]}` |
| `POST /auth/forgot-password/` | `{email}` | `{message: string}` |
| `POST /auth/reset-password/` | `{token, password}` | `{message: string}` |
| `POST /auth/send-otp/` | `{country_code, phone_number}` (phone stripped of dial code) | `{message: string}` |
| `POST /auth/verify-otp/` | `{country_code, phone_number, code}` | `VerifyOTPResult` = `{is_new_user:true}` \| `{is_new_user:false, user, tokens, p7Roles?} & AuthSessionRbacPayload` (discriminated union) |
| `POST /auth/change-password/` | `{old_password, new_password}` | void |

## Menu
| Endpoint | Request | Response |
|---|---|---|
| `GET /menu/categories/` | — | `Category[]` |
| `GET /menu/items/` | query: `category?, search?, min_price?, max_price?, min_rating?, available?, sort? ('price_asc'\|'price_desc'\|'rating'\|'newest'\|'popular'), page?, page_size?` | `PaginatedResponse<MenuItem>` |
| `GET /menu/items/{id}/` | — | `MenuItem` |
| `GET /menu/items/featured/` | — | `MenuItem[]` |
| `GET /menu/items/popular/` | — | `MenuItem[]` |
| `GET /menu/items/{id}/related/` | — | `MenuItem[]` |
| `GET /menu/items/search/` | query `{q}` | `MenuItem[]` |
| `POST /menu/items/` | `Partial<MenuItem>` | `MenuItem` |
| `PATCH /menu/items/{id}/` | `Partial<MenuItem>` | `MenuItem` |
| `DELETE /menu/items/{id}/` | — | void |

## Orders
| Endpoint | Request | Response |
|---|---|---|
| `POST /orders/` | `CreateOrderPayload {branch_id, items:[{menu_item_id, quantity, notes?, extras:string[]}], order_type, payment_method, delivery_address?, table_number?, discount_code?, notes?}` | `Order` |
| `GET /orders/` | query `{page}` (also admin variant with `admin:true` + `AdminOrderFilters`) | `PaginatedResponse<Order>` |
| `GET /orders/{id}/` | — | `Order` |
| `POST /orders/{id}/cancel/` | — | `Order` |
| `POST /orders/validate-discount/` | `{code, subtotal}` | `{valid, discount_type:'percent'\|'fixed', discount_value, discount_amount, message?}` |
| `PATCH /orders/{id}/status/` | `{status: OrderStatus}` | `Order` |

## Payments
| Endpoint | Request | Response |
|---|---|---|
| `POST /payments/create-intent/` | `CreatePaymentIntentPayload {amount, currency?, order_description?, branch_id}` | `PaymentIntentResult {client_secret, payment_intent_id, amount, currency}` |
| Confirmation | not sent to backend — `stripe.confirmPayment()` (Stripe.js) client-side only | `ConfirmPaymentResult {status, payment_intent_id, error?}` |

## Reservations
| Endpoint | Request | Response |
|---|---|---|
| `POST /reservations/` | `CreateReservationPayload {branch_id, date, time, guests, name, phone_number, email?, notes?}` | `Reservation` |
| `GET /reservations/` | — (admin variant: `AdminReservationFilters {status?, branch_id?, date?, search?, page?, page_size?}`) | `PaginatedResponse<Reservation>` |
| `GET /reservations/{id}/` | — | `Reservation` |
| `POST /reservations/{id}/cancel/` | — | `Reservation` |
| `POST /reservations/{id}/confirm/` | — | `Reservation` |
| `GET /reservations/available-slots/` | query `{date, branch_id}` | `string[]` |

## Branches
| Endpoint | Request | Response |
|---|---|---|
| `GET /branches/` | query `{tenant_id?}` (legacy) — no query (P7.3 admin) | `Location[]` (legacy) / `Branch[]` (P7.3) |
| `GET /branches/{id}/` | — | `Location` / `Branch` |
| `GET /branches/{id}/metrics/` | — | `BranchMetrics` |
| `POST /branches/` | `CreateBranchPayload {name, slug, type, location, contact?, managerId?, businessHours?, settings?}` | `Branch` |
| `PATCH /branches/{id}/` | `UpdateBranchPayload` (all optional) | `Branch` |
| `POST /branches/{id}/activate\|deactivate\|maintenance/` | — | `Branch` (status field updated) |
| `PATCH /branches/{id}/manager/` | `{managerId}` | `Branch` |

## Notifications (all three systems — see `01_FRONTEND_ARCHITECTURE.md`)
| Endpoint | Request | Response |
|---|---|---|
| `GET /notifications/` (legacy) | — | `PaginatedResponse<Notification>` |
| `POST /notifications/{id}/read/` | — | void |
| `POST /notifications/read-all/` | — | void |
| `POST /notifications/register-device/` | `{token, platform: 'web'\|'ios'\|'android'}` | void |
| `GET /notifications/rich/` (P7.6) | query = `NotificationFilter {tenantId?, branchId?, category?, priority?, status?, type?, search?, dateFrom?, dateTo?, sortBy?, sortOrder?, page?, pageSize?}` | `PaginatedNotifications {results, count, page, pageSize, totalPages, unreadCount}` |
| `GET /notifications/{id}/` | — | `RichNotification` |
| `POST /notifications/{id}/archive/` | — | `RichNotification` |
| `GET /notifications/statistics/` | query = filter | `NotificationStatistics` |
| `GET /notifications/unread-count/` | query = filter | `number` (unwrapped from `{count}`) |
| `POST /notifications/` (rich create) | `{auditAction, actor, targetName, targetId, scope, data?}` | `RichNotification` |
| `GET /notifications/summary/` | query `{scope?}` | `NotificationSummary {unreadCount, urgentCount, latestNotification?, categories}` |
| `GET /notifications/preferences/` | query `{userId, tenantId, branchId?}` | `NotificationPreference[]` |
| `PATCH /notifications/preferences/{category}/` | `{userId, tenantId, branchId?, enabled?, channels?, minPriority?}` | `NotificationPreference` |
| `POST /notifications/preferences/` | `CreatePreferenceParams` | `NotificationPreference` |
| `POST /notifications/preferences/reset/` | `{userId, tenantId}` | `NotificationPreference[]` |

## Users
| Endpoint | Request | Response |
|---|---|---|
| `PATCH /users/profile/` | `Partial<User>` | `User` |
| `GET /users/addresses/` | — | `Address[]` |
| `POST /users/addresses/` | `Omit<Address,'id'>` | `Address` |
| `DELETE /users/addresses/{id}/` | — | void |
| `GET /users/favorites/` | — | `string[]` (item IDs) |
| `POST /users/favorites/{itemId}/` | — | `{favorited: boolean}` |
| `POST /users/avatar/` | `FormData{avatar: File}`, multipart | `{avatar_url: string}` — client throws if `avatar_url` falsy |

## Tenants
| Endpoint | Request | Response |
|---|---|---|
| `GET /tenants/{slug}/` | — | `Tenant` (falls back to `DEFAULT_TENANT` on error, no throw) |
| `GET /tenants/current/` | — | `Tenant` (same fallback) |
| `GET /tenants/` | — | `Tenant[]` (falls back to `[]`) |
| `POST /tenants/{id}/activate\|suspend\|archive/` | — | `Tenant` |
| `POST /tenants/{id}/transfer-ownership/` | `{newOwnerId}` | `Tenant` |
| `PATCH /tenants/{slug}/settings/` | `Record<string,unknown>` (arbitrary patch) | `Tenant` |
| `POST /tenants/provision/` | `{name, slug, businessTypes:[businessType], settings:{featureFlags, theme}}` from `TenantProvisionRequest` | `TenantProvisionResult {success, tenantId?, slug?, tenant?, errors?, warnings?}` |
| `POST /tenants/clone/` | `{source_tenant_id, slug, name}` (snake_case) | `TenantProvisionResult` |

## Reviews (item + business level)
| Endpoint | Request | Response |
|---|---|---|
| `GET /menu/items/{itemId}/reviews/` | — | `ReviewsResponse {results:Review[], count, average_rating}` |
| `POST /reviews/` | `CreateReviewPayload {rating, comment?, order_id?}` | `Review` |
| `GET /tenants/{tenantId}/reviews/` | query via URLSearchParams: `sort, verified, with_photos, branch_id, language, rating` (`BusinessReviewFilters`) | `BusinessReviewsResponse {reviews, total, breakdown}` |
| `GET /tenants/{tenantId}/reviews/rating/` or `.../branches/{branchId}/reviews/rating/` | — | `RatingBreakdownData {average, total, distribution, recentAverage?, weightedAverage?}` |
| `POST /tenants/{tenantId}/reviews/` | `CreateBusinessReviewPayload {tenantId, branchId?, rating, title?, comment, images?, visitDate?, visitType?, language?}` | `BusinessReview` |
| `POST/PATCH/DELETE /tenants/{tenantId}/reviews/{reviewId}/reply/` | `{text}` (POST/PATCH) | `BusinessReview` |
| `POST /tenants/{tenantId}/reviews/{reviewId}/helpful/` | — | `{helpfulCount}` |
| `PATCH /tenants/{tenantId}/reviews/{reviewId}/moderate/` | `{status: ReviewStatus}` | `BusinessReview` |
| `GET /tenants/{tenantId}/reviews/analytics/` | — | `ReviewAnalytics` |

## Loyalty
| Endpoint | Request | Response |
|---|---|---|
| `GET /loyalty/account/` | — | `LoyaltyAccount` |
| `GET /loyalty/transactions/` | — | `LoyaltyTransaction[]` |
| `GET /loyalty/rewards/` | — | `LoyaltyReward[]` |
| `POST /loyalty/rewards/{id}/redeem/` | — | `RedeemRewardResponse {transaction, account}` |
| `POST /loyalty/earn/` | `{order_id, amount}` | `EarnPointsResponse {transaction, account, pointsEarned}` |
| `GET/POST /admin/loyalty/rewards/` | POST: `Omit<LoyaltyReward,'id'\|'createdAt'>` | `LoyaltyReward` / `LoyaltyReward[]` |
| `PATCH /admin/loyalty/rewards/{id}/` | `Partial<...>` | `LoyaltyReward` |

## Vendors
| Endpoint | Request | Response |
|---|---|---|
| `GET /vendors/` | — | `Vendor[]` |
| `GET /vendors/{id}/` | — | `Vendor` |
| `GET /vendors/{id}/stats/` | — | `VendorStats` |
| `GET /vendors/{id}/settlements/` | — | `VendorSettlement[]` |
| `POST /admin/vendors/` | `Omit<Vendor,'id'\|'createdAt'\|'updatedAt'>` | `Vendor` |
| `PATCH /admin/vendors/{id}/` | `Partial<...>` | `Vendor` |
| `POST /admin/settlements/` | `{vendorId, grossRevenue, settlementDate?, payoutReference?}` | `VendorSettlement` |

## Promotions
| Endpoint | Request | Response |
|---|---|---|
| `GET /promotions/` | — | `PromotionRule[]` |
| `GET /promotions/active/` | — | `PromotionRule[]` |
| `POST /promotions/` | `Omit<PromotionRule,'id'\|'createdAt'\|'updatedAt'>` | `PromotionRule` |
| `PATCH /promotions/{id}/` | `Partial<...>` | `PromotionRule` (activate/disable via `{active}`) |

## Staff / Invites
| Endpoint | Request | Response |
|---|---|---|
| `GET /tenants/{tenantId}/staff/` | — | `StaffMember[]` |
| `GET /staff/{id}/` | — | `StaffMember` |
| `GET /tenants/{tenantId}/invites/` | — | `StaffInvite[]` |
| `POST /tenants/{tenantId}/staff/invite/` | `InviteStaffPayload {email, roles}` | `StaffInvite` |
| `POST /invites/{id}/cancel\|resend/` | — | `StaffInvite` |
| `POST /invites/{id}/accept/` | — | `StaffMember` |
| `PATCH /staff/{id}/roles/` | `UpdateStaffRolesPayload {roles}` | `StaffMember` |
| `POST /staff/{id}/activate\|suspend/` | — | `StaffMember` |
| `POST /staff/{id}/remove/` | — | void |
| `POST /tenants/{tenantId}/transfer-ownership/` | `{currentOwnerId, targetMemberId}` | `{owner: StaffMember, prevOwner: StaffMember}` |

## Analytics (admin) — all GET, no body
| Endpoint | Query | Response |
|---|---|---|
| `/admin/analytics/summary/` | `dateFrom?, dateTo?` | `AnalyticsSummary` |
| `/admin/analytics/revenue/` | — | `RevenueAnalytics` |
| `/admin/analytics/reservations/` | — | `ReservationAnalytics` |
| `/admin/analytics/loyalty/` | — | `LoyaltyAnalytics` |
| `/admin/analytics/promotions/` | — | `PromotionAnalytics` |
| `/admin/analytics/vendors/` | — | `VendorAnalytics` |
| `/admin/analytics/menu/` | — | `MenuAnalytics` |

## Website Builder
| Endpoint | Request | Response |
|---|---|---|
| `GET/PUT /tenants/{tenantSlug}/website/layout/` | PUT: `HomepageLayout` | `HomepageLayout` |
| `POST /tenants/{tenantSlug}/website/publish/` | `HomepageLayout` | `HomepageLayout` |
| `POST /tenants/{tenantSlug}/website/versions/{versionId}/restore/` | — | `HomepageLayout` |
| `GET/PUT /tenants/{tenantSlug}/branches/{branchSlug}/website/overrides/` | PUT: `BranchContentOverrides` | `BranchContentOverrides` |

## Tables
| `GET /tables/{tableId}/` | — | `TableInfo` |

## Audit Log (literal paths, P7.5)
| Endpoint | Request | Response |
|---|---|---|
| `GET /audit-logs/` | query = `AuditFilter` | `PaginatedAuditLogs` |
| `GET /audit-logs/{id}/` | — | `AuditLog \| null` |
| `POST /audit-logs/` | `{action, actor, target, scope, changeset, metadata}` | `AuditLog` |
| `GET /audit-logs/timeline/` | query = `AuditFilter` | `AuditTimelineItem[]` |
| `POST /audit-logs/export/` | `AuditExportRequest {filter, includeChangeset}` | `string` (CSV) |
| `GET /audit-logs/statistics/` | query = `AuditFilter` | `AuditStatistics` |

## Realtime Operations (literal paths, REST polling, P7.7)
| Endpoint | Query | Response |
|---|---|---|
| `/operations/snapshot/` | `Partial<OperationsScope>` | `OperationsDashboard` |
| `/operations/branches/{id}/status/` | — | `BranchStatus \| null` |
| `/operations/branches/status/` | scope | `BranchStatus[]` |
| `/operations/branches/{id}/kitchen/` | — | `KitchenStatus \| null` |
| `/operations/orders/live/` | scope | `LiveOrder[]` |
| `/operations/reservations/live/` | scope | `LiveReservation[]` |
| `/operations/staff/presence/` | scope | `StaffPresence[]` |
| `/operations/sla-alerts/` | scope | `SLAAlert[]` |
| `/operations/statistics/` | scope | `RealtimeStatistics` |
| `POST /operations/events/` | `Omit<OperationsEvent,'id'\|'processedAt'>` | `OperationsEvent` |

## Owner / Staff Assignment (⚠️ undeployed per code comments — literal paths)
| Endpoint | Request | Response |
|---|---|---|
| `GET /admin/platform/owners/` | — | `Owner[]` |
| `GET/PATCH /admin/platform/owners/{ownerId}/` | PATCH `{status: OwnerStatus}` | `Owner` |
| `GET /admin/staff/{staffId}/assignments/` | — | `StaffAssignment[]` |
| `GET /admin/staff/assignments/` | `{tenantId}` | `StaffAssignment[]` |
| `POST /admin/staff/{staffId}/assignments/` | `GrantStaffAssignmentPayload` | `StaffAssignment` |
| `DELETE /admin/staff/{staffId}/assignments/{assignmentId}/` | `RevokeStaffAssignmentPayload {revokedBy, reason?}` | `StaffAssignment` |

## Admin Customer 360 (⚠️ mostly undeployed — literal paths for the non-`/admin/customers/*` subset)
See `02_API_ENDPOINT_INVENTORY.md` for the full path list; response types: `AdminCustomer`, `AdminCustomerStats`, `BusinessCustomer`, `BranchCustomer[]`, `CustomerTimelineEvent[]`, `CustomerNote[]/CustomerNote`, `CustomerTagAssignment`, `CustomerTag[]`, `CustomerAnalytics`, `CustomerMarketing`, `CustomerCoupon[]`, `CustomerPayment[]`, `PaginatedResponse<Order>`, `PaginatedResponse<Reservation>`.

## Pagination convention

Standard DRF-style envelope used across all list endpoints:
```ts
interface PaginatedResponse<T> { count: number; next: string | null; previous: string | null; results: T[] }
```
Some P7.x-era endpoints use a slightly different shape instead: `{results, count, page, pageSize, totalPages}` (e.g. `PaginatedNotifications`, `PaginatedAuditLogs`) — **not unified with `PaginatedResponse<T>`**, flagged as an inconsistency.

## Standard error shape

```ts
interface ApiError { message: string; code?: string; errors?: Record<string, string[]> }
```
Used by `axios.instance.ts` interceptor logic conceptually; individual services mostly let axios errors propagate unmodified (see `08_ERROR_HANDLING_REFERENCE.md`).
