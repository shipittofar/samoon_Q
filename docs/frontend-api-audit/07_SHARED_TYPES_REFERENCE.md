# 07 — Shared Types Reference (Cross-Cutting)

This document highlights types that are **shared across multiple domains/endpoints**, plus the re-export/duplication gaps in `src/types/index.ts`. For the full per-domain listing of all ~180 types, see `04_TYPESCRIPT_MODEL_REFERENCE.md`.

## Genuinely shared primitives

| Type | Definition | Used by |
|---|---|---|
| `PaginatedResponse<T>` | `{count, next: string\|null, previous: string\|null, results: T[]}` | Orders, Reservations, Notifications (legacy), Admin Orders/Reservations/Customers |
| `ApiError` | `{message, code?, errors?: Record<string,string[]>}` | Conceptual standard error shape (not consistently thrown as a typed object — most services propagate raw axios errors) |
| `Role` | `'owner'\|'admin'\|'manager'\|'cashier'\|'waiter'\|'kitchen'\|'marketing'\|'support'` | `StaffMember.roles`, `AuditActor.roles`, `NotificationActor.roles`, `UserTenantRole.roles`, RBAC everywhere |
| `User` | Core user record | Auth responses, `AdminCustomer extends User` |
| `Branch`/`BranchEntity` | **Two distinct shapes** — see below | Orders, Reservations, Staff, Website Builder, Operations |
| `OrderStatus` | `'pending'\|'accepted'\|'preparing'\|'ready'\|'delivered'\|'cancelled'` | `Order.status`, `AdminOrderFilters.status`, admin status-update payload |
| `AuditAction` | ~45-value union | `AuditLog.action`, `RbacAuditEvent`, `RichNotification.sourceAuditAction`, `OperationsEvent.sourceAuditAction` — the single cross-cutting "what happened" vocabulary tying audit/notification/RBAC/realtime systems together |
| `Role` / `P7Permission` | RBAC vocabulary | `permission.service.ts`, `NavItem.permissionKey`, every `PermissionGuard` |

## Deliberately duplicated/divergent types (not shared — flag for backend contract clarity)

1. **`Branch` (2 shapes)**:
   - `index.ts` — `type Branch = Location` (legacy, snake_case, flat: `id, tenant_id?, name, slug, address, city, phone_number, lat, lng, working_hours, is_active, ...`). Used by public `branchService` (`combined.service.ts`).
   - `branch.ts` — `Branch` (P7.3, camelCase, nested: `location: BranchLocation, contact: BranchContact, settings: BranchSettings, businessHours: BranchBusinessHours[]`). Used by admin `branchManagementService`. Re-exported from `index.ts` as `BranchEntity` to avoid a name clash.
   - **These do not share a wire format.** A backend implementer must pick one canonical `Branch` representation — the frontend currently expects two different shapes from what may be the same underlying resource (`/branches/{id}/`).

2. **`Notification` (2 shapes)**:
   - `index.ts`/`notification.ts` (duplicated verbatim in both files) — legacy flat shape `{id, type, title, message, data?, is_read, created_at}`. Served by `combined.service.ts`'s `notificationService` via `/notifications/*`.
   - `notification.ts` — `RichNotification` (P7.6), much richer: `{type: RichNotificationType, category, priority, status, actor?, scope, deepLink?, channels, ...}`. Served by `notification.service.ts`'s `notificationRichService` via `/notifications/rich/*` (hardcoded paths, not in `ENDPOINTS`).
   - No shared base type — a backend must decide whether these are the same resource with two client-side projections, or genuinely two systems.

3. **`BranchStatus` name collision** (not the same type):
   - `branch.ts` — `type BranchStatus = 'active'\|'inactive'\|'maintenance'` (a branch's lifecycle status).
   - `realtime-operations.ts` — `interface BranchStatus {branchId, branchName, health, isOpen, activeOrders, ...}` (a live operational status snapshot for the ops dashboard).
   - Both are legitimately named `BranchStatus` in the source and imported in different files — no re-export conflict today only because `index.ts` doesn't re-export the realtime one, but this is a latent foot-gun.

4. **`Order`-adjacent status unions**: `OrderStatus` (index.ts, canonical) vs. `OrderLiveStatus` (realtime-operations.ts, adds `'delivering'` distinct from `OrderStatus`'s absence of that value, and both otherwise overlap). A backend needs to reconcile whether the live operations feed and the REST order resource report status with the same vocabulary.

5. **Reviews (2 domains, not shared)**: item-level `Review` (index.ts, simple: `{id, user, menu_item_id?, order_id?, rating, comment?, created_at}`, `/menu/items/{id}/reviews/`) vs. business-level `BusinessReview` (business-review.ts, rich: `{tenantId, branchId?, ownerReply?, helpfulCount, verifiedVisit, status: ReviewStatus, ...}`, `/tenants/{id}/reviews/*`). Two genuinely separate review systems, not a duplication bug — but worth flagging that a backend needs two distinct review tables/resources.

6. **Branch-scoped analytics types have no dedicated endpoints**: `BranchRevenueAnalytics`, `BranchOrderAnalytics`, `BranchReservationAnalytics` (analytics.ts) are the response shape `branch-analytics.service.ts` expects, but that service **always throws outside mock mode** — these types describe a contract the backend has never been asked to implement over the wire.

## `index.ts` re-export coverage gaps

`src/types/index.ts` is the "main" import path (`@/types`) but does **not** re-export everything:
- From `rbac.ts`: re-exports `Role, P7Permission, UserTenantRole, TenantRoleAssignment, PermissionCheckOptions, AuditEvent, MockRbacUser` only. **Missing**: `UserPermissionOverride, EffectivePermissionResult, RoleTemplate, CustomRoleTemplate, PermissionDependency, RbacAuditEvent, SimulationResult, DependencyValidationResult`.
- From `branch.ts`: re-exports under alias `Branch as BranchEntity`.
- From `analytics.ts`: only the 3 branch-scoped analytics types. **Missing**: `TimeSeries, AnalyticsSummary, RevenueAnalytics, ReservationAnalytics, LoyaltyAnalytics, PromotionAnalytics, VendorAnalytics, MenuItemPerformance, MenuCategoryPerformance, MenuAnalytics`.
- **No re-export at all** from: `business-review.ts`, `marketplace.ts`, `notification.ts`, `ownership.ts`, `provisioning.ts`, `qr-experience.ts`, `realtime-operations.ts`, `staff.ts`, `website-builder.ts`. Any consumer of these must import directly from `@/types/<module>`.

## Types with no dedicated endpoint (client-side derivation only — informative, not a contract requirement)

`OrderRoutingContext`, `BranchFilter`, `BranchAccessContext`, `BranchIsolationResult<T>`, `BranchAssignmentRule`, `FeatureFlagEntry`, `QRExperience`, `OwnershipIdentity`, `AssignmentValidationResult`, `BackfillReport`/`BackfillResult`, `SimulationResult`, `DependencyValidationResult`, `MarketplaceMeta`/`FilterState` (discovery-page filter state, applied in-memory to `TENANTS.LIST` results). These describe frontend business logic, not backend contract requirements — do not implement endpoints for these.
