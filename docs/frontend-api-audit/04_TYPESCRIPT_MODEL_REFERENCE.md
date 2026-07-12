# 04 — TypeScript Model Reference (Full DTO/Type Listing)

Scope: `src/types/*.ts` (all 14 files), `src/types/index.ts` re-exports, `src/services/endpoints.ts` (ENDPOINTS map), and inline `interface`/`type` DTOs declared in `src/services/*.service.ts`.

All 35 files in `src/services/` use the **USE_MOCK pattern**: `const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'`, with a real `axios` (`api`) call in the `else` branch. This means every service file that imports `./axios.instance` is a **real** service (mock data is just the dev/demo fallback branch), so none of the `*.service.ts` files are excluded as "mock-only."

Files with **no axios import** were checked individually:
- `branch-access.service.ts`, `feature-flags.service.ts`, `order-routing.service.ts`, `ownership-resolution.service.ts`, `ownership.service.ts`, `rbac-audit.service.ts` — these are pure client-side derivation/business-logic services (permission resolution, branch filtering, ownership validation) that operate on data already fetched by other real services. They are not mock-data services; they contain no network calls at all (neither mock nor real) because they're computed from in-memory state. Their inline types (e.g. `OwnershipIdentity`, `AssignmentValidationResult`, `BackfillReport`, `OrderRoutingContext`, `FeatureFlagEntry`) are documented below as "not endpoint-bound — client-side derivation type."
- No service file in this codebase was found to be purely mock-shaping with zero real-call path; all are included.

---

## Auth

### `UserRole` (index.ts)
```
type UserRole = 'customer' | 'staff' | 'owner' | 'admin'
```
Used on: `User.role`.

### `User` (index.ts)
```
interface User {
  id: string
  email: string
  phone_number?: string
  first_name: string
  last_name: string
  avatar?: string
  role: UserRole
  is_verified: boolean
  created_at: string
}
```
Used by: `AUTH.ME` (response), `AUTH.LOGIN`/register flows (response), `USERS.PROFILE`/`UPDATE_PROFILE` (`user.service.ts` via `combined.service.ts`), `AdminCustomer` extends this.

### `SendOTPRequest` (index.ts)
```
type SendOTPRequest = { phone_number: string; dialCode: string }
```
Used for: `AUTH.SEND_OTP` request body (`auth.service.ts`).

### `VerifyOTPRequest` (index.ts)
```
interface VerifyOTPRequest { phone_number: string; dialCode: string; otp: string }
```
Used for: `AUTH.VERIFY_OTP` request body.

### `AuthTokens` (index.ts)
```
interface AuthTokens { access: string; refresh: string }
```
Used for: `AUTH.LOGIN`/`AUTH.REFRESH`/`AUTH.VERIFY_OTP` response bodies.

### `LoginCredentials` (index.ts)
```
interface LoginCredentials { email: string; password: string }
```
Used for: `AUTH.LOGIN` request body.

### `RegisterData` (index.ts)
```
interface RegisterData {
  phone_number?: string
  country_code?: string
  password?: string
  confirm_password?: string
  first_name: string
  last_name: string
}
```
Used for: `AUTH.REGISTER` request body.

### `OTPVerifyData` (index.ts)
```
interface OTPVerifyData { phone_number: string; otp: string }
```
Used for: OTP verification flow (alternate/legacy shape alongside `VerifyOTPRequest`).

### `VerifyOTPResult` (auth.service.ts, inline)
```
type VerifyOTPResult =
  | { is_new_user: true }
  | ({ is_new_user: false; user: User; tokens: AuthTokens; p7Roles?: Role[] } & AuthSessionRbacPayload)
```
Used for: `authService.verifyOTP()` response — wraps `AUTH.VERIFY_OTP`, discriminated union on `is_new_user`, includes optional RBAC hydration fields (`ownership?`, `staffAssignments?` from `AuthSessionRbacPayload`).

### `AuthSessionRbacPayload` (ownership.ts)
```
interface AuthSessionRbacPayload {
  ownership?: Owner[]
  staffAssignments?: StaffAssignment[]
}
```
Used for: optional RBAC facts carried on `AUTH.LOGIN` / `AUTH.VERIFY_OTP` / `AUTH.ME` responses.

### `MOCK_CREDENTIALS` type shape (auth.service.ts, inline `Record`)
```
Record<string, { user: User; p7Roles: Role[] }>
```
Mock-only demo credential map — not a request/response DTO, used only inside the mock branch.

---

## Menu

### `Category` (index.ts)
```
interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  icon?: string
  order: number
  items_count?: number
}
```
Used for: `MENU.CATEGORIES` / `MENU.CATEGORY(id)` response (list + detail), `menu.service.ts`.

### `Extra` (index.ts)
```
interface Extra { id: string; name: string; price: number; available: boolean }
```
Used inside `MenuItem.extras`, `CartItem.extras`, `OrderItem.extras`.

### `MenuItem` (index.ts)
```
interface MenuItem {
  id: string
  category_id: string
  category?: Category
  name: string
  slug: string
  description: string
  price: number
  discount?: number
  discounted_price?: number
  image: string
  images?: string[]
  calories?: number
  preparation_time: number
  rating: number
  rating_count: number
  available: boolean
  is_featured?: boolean
  is_new?: boolean
  is_popular?: boolean
  tags?: string[]
  extras?: Extra[]
  allergens?: string[]
  nutritional_info?: NutritionalInfo
}
```
Used for: `MENU.ITEMS`, `MENU.ITEM(id)`, `MENU.ITEM_BY_SLUG`, `MENU.FEATURED`, `MENU.POPULAR`, `MENU.SEARCH`, `MENU.RELATED(id)` responses.

### `NutritionalInfo` (index.ts)
```
interface NutritionalInfo { calories: number; protein: number; carbs: number; fat: number; fiber?: number }
```
Nested field of `MenuItem`.

### `TableInfo` (index.ts)
```
interface TableInfo {
  id: string
  number: number
  capacity?: number
  section?: string
  server_name?: string
  status?: 'available' | 'occupied' | 'reserved'
}
```
Used for: `TABLE.INFO(tableId)` response (`combined.service.ts` imports it, though not directly re-exported there — used by table QR flows).

### `MenuFilters` (menu.service.ts, inline)
```
interface MenuFilters {
  category?: string
  search?: string
  min_price?: number
  max_price?: number
  min_rating?: number
  available?: boolean
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'popular'
  page?: number
  page_size?: number
}
```
Used for: `MENU.SEARCH` / `MENU.ITEMS` query params (`menuService.getMenuItems()`).

### `MenuItemPerformance`, `MenuCategoryPerformance`, `MenuAnalytics` (analytics.ts)
```
interface MenuItemPerformance {
  itemId: string; name: string; category: string
  orderCount: number; revenue: number; trendPct: number; avgOrderValue: number
}
interface MenuCategoryPerformance {
  category: string; orderCount: number; revenue: number; itemCount: number
}
interface MenuAnalytics {
  topSellers: MenuItemPerformance[]
  slowMovers: MenuItemPerformance[]
  categoryPerformance: MenuCategoryPerformance[]
  totalItemsSold: number
  totalMenuRevenue: number
}
```
Used for: `ANALYTICS.MENU` response (`analytics.service.ts`).

---

## Order

### `OrderStatus`, `OrderType`, `PaymentMethod`, `PaymentStatus` (index.ts)
```
type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
type OrderType = 'delivery' | 'pickup' | 'dine_in'
type PaymentMethod = 'card' | 'cash' | 'online' | 'wallet'
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
```
Used throughout `Order`, `AdminOrderFilters`, order-routing types.

### `OrderItem` (index.ts)
```
interface OrderItem {
  id: string
  menu_item: MenuItem
  quantity: number
  unit_price: number
  total_price: number
  notes?: string
  extras: Extra[]
  image: string
  name: string
}
```
Nested in `Order.items`.

### `DeliveryAddress` (index.ts)
```
interface DeliveryAddress { street: string; city: string; state?: string; zip?: string; lat?: number; lng?: number }
```
Nested in `Order.delivery_address`, mirrored inline in `CreateOrderPayload.delivery_address`.

### `Order` (index.ts)
```
interface Order {
  id: string
  order_number: string
  user?: User
  branch_id: string
  branch?: Branch
  items: OrderItem[]
  order_type: OrderType
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  delivery_address?: DeliveryAddress
  table_number?: number
  subtotal: number
  discount_amount: number
  tax: number
  service_charge: number
  total: number
  discount_code?: string
  notes?: string
  estimated_time?: number
  created_at: string
  updated_at: string
  status_history: OrderStatusHistory[]
}
```
Used for: `ORDERS.LIST`, `ORDERS.CREATE`, `ORDERS.DETAIL(id)`, `ORDERS.CANCEL(id)`, `ORDERS.REORDER(id)`, `ORDERS.TRACK(id)`, `ORDERS.STATUS(id)` — all response bodies in `order.service.ts`.

### `OrderStatusHistory` (index.ts)
```
interface OrderStatusHistory { status: OrderStatus; timestamp: string; note?: string }
```
Nested in `Order.status_history`.

### `CreateOrderPayload` (order.service.ts, inline)
```
interface CreateOrderPayload {
  branch_id: string
  items: { menu_item_id: string; quantity: number; notes?: string; extras: string[] }[]
  order_type: OrderType
  payment_method: PaymentMethod
  delivery_address?: { street: string; city: string; state?: string; zip?: string; lat?: number; lng?: number }
  table_number?: number
  discount_code?: string
  notes?: string
}
```
Used for: `ORDERS.CREATE` request body.

### `Cart`, `CartItem` (index.ts)
```
interface CartItem {
  id: string
  menu_item: MenuItem
  quantity: number
  notes?: string
  extras: Extra[]
  unit_price: number
  total_price: number
}
interface Cart {
  items: CartItem[]
  subtotal: number
  discount_amount: number
  tax: number
  service_charge: number
  total: number
  discount_code?: string
}
```
Client-side cart state; `CartItem` also imported by `order.service.ts` (not directly sent over the wire — mapped into `CreateOrderPayload.items`).

### `RevenueAnalytics`, `TimeSeries` (analytics.ts)
```
interface TimeSeries { date: string; value: number }
interface RevenueAnalytics {
  totalRevenue: number; revenueChangePct: number; averageOrderValue: number; totalOrders: number
  dailyRevenue: TimeSeries[]
  topItems: Array<{ name: string; revenue: number; orderCount: number; trendPct: number }>
}
```
Used for: `ANALYTICS.REVENUE` response.

### `BranchOrderAnalytics` (analytics.ts)
```
interface BranchOrderAnalytics {
  branchId: string
  totalOrders: number
  ordersByStatus: Record<string, number>
  averageOrderValue: number
  period: string
}
```
Used for: branch-scoped order analytics (`branch-analytics.service.ts`).

### `OrderRoutingContext` (order-routing.service.ts, inline)
```
interface OrderRoutingContext {
  orderType: OrderType
  tableNumber?: number
  customerChosenBranchId?: string
  latitude?: number
  longitude?: number
}
```
Not endpoint-bound — client-side derivation type used to pick a branch via `ORDER_ROUTING_RULES` (`BranchAssignmentRule[]`, from `branch-routing.ts`) before an order is submitted.

### `LiveOrder`, `OrderLiveStatus` (realtime-operations.ts)
```
type OrderLiveStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'
interface LiveOrder {
  id: string; orderNumber: string; status: OrderLiveStatus
  tableNumber?: string
  items: Array<{ name: string; quantity: number; notes?: string }>
  customerId?: string; customerName?: string
  totalAmount: number; currency: string; estimatedPrepMinutes: number
  acceptedAt?: string; preparingAt?: string; readyAt?: string
  createdAt: string; updatedAt: string
  scope: OperationsScope
  isDelayed: boolean; slaBreached: boolean
}
```
Used for: realtime WebSocket order stream payloads (`realtime-operations.service.ts`, `websocket.service.ts` channel `orders.broadcast`).

---

## Payment

### `PaymentMethod`, `PaymentStatus` — see Order section.

### `CreatePaymentIntentPayload` (payment.service.ts, inline)
```
interface CreatePaymentIntentPayload {
  amount: number
  currency?: string
  order_description?: string
  branch_id: string
}
```
Used for: `PAYMENTS.CREATE_INTENT` request body.

### `PaymentIntentResult` (payment.service.ts, inline)
```
interface PaymentIntentResult {
  client_secret: string
  payment_intent_id: string
  amount: number
  currency: string
}
```
Used for: `PAYMENTS.CREATE_INTENT` response body.

### `ConfirmPaymentResult` (payment.service.ts, inline)
```
interface ConfirmPaymentResult {
  status: 'succeeded' | 'requires_action' | 'canceled' | 'failed'
  payment_intent_id: string
  error?: string
}
```
Used for: `PAYMENTS.CONFIRM` response body.

### `CustomerPayment` (index.ts)
```
interface CustomerPayment {
  id: string; userId: string; tenantId: string; orderId?: string
  amount: number; currency: string
  method: 'card' | 'cash' | 'wallet' | 'gift_card'
  status: 'completed' | 'refunded' | 'partial_refund' | 'failed'
  refundAmount?: number
  processedAt: string
}
```
Used for: Customer 360 payment history (admin CRM views), no dedicated ENDPOINTS entry found (likely served via `ADMIN.CUSTOMER_DETAIL`/CRM aggregation).

---

## Branch

### `BranchStatus`, `BranchType` (branch.ts)
```
type BranchStatus = 'active' | 'inactive' | 'maintenance'
type BranchType = 'physical' | 'mobile'
```

### `BranchLocation`, `BranchBusinessHours`, `BranchContact`, `BranchSettings`, `BranchMetrics`, `Branch` (branch.ts — the P7.3 rich Branch entity, distinct from index.ts's `Location`/`Branch` alias)
```
interface BranchLocation { address: string; city: string; country: string; postalCode?: string; latitude?: number; longitude?: number }
interface BranchBusinessHours { day: 'Monday'|'Tuesday'|'Wednesday'|'Thursday'|'Friday'|'Saturday'|'Sunday'; open: string; close: string; isClosed: boolean }
interface BranchContact { phone_number?: string; email?: string; website?: string }
interface BranchSettings {
  deliveryEnabled: boolean; deliveryRadius?: number; pickupEnabled: boolean
  tableOrderingEnabled: boolean; reservationsEnabled: boolean; maxCapacity?: number
}
interface BranchMetrics {
  branchId: string; totalOrders: number; totalRevenue: number; totalReservations: number
  totalCustomers: number; staffCount: number; averageOrderValue: number
  period: 'day' | 'week' | 'month' | 'all'
}
interface Branch {
  id: string; tenantId: string; name: string; slug: string
  status: BranchStatus; type: BranchType
  location: BranchLocation; contact: BranchContact
  managerId?: string
  businessHours: BranchBusinessHours[]
  settings: BranchSettings
  createdAt: string; updatedAt: string
  metadata?: Record<string, unknown>
}
```
Used for: `BRANCHES.GET(id)`, `BRANCHES.CREATE`, `BRANCHES.UPDATE(id)`, `BRANCHES.ACTIVATE/DEACTIVATE/MAINTENANCE(id)`, `BRANCHES.ASSIGN_MANAGER(id)`, `BRANCHES.METRICS(id)` — `branch.service.ts`. Re-exported from index.ts as `BranchEntity`.

### `BranchAnalyticsSummary` (branch.ts)
```
interface BranchAnalyticsSummary {
  totalBranches: number; activeBranches: number; maintenanceBranches: number; inactiveBranches: number
  totalStaffAssigned: number
  byType: Record<BranchType, number>
}
```
Used for: branch dashboard aggregate (`branch.service.ts`).

### `CreateBranchPayload`, `UpdateBranchPayload`, `AssignManagerPayload` (branch.ts)
```
interface CreateBranchPayload {
  name: string; slug: string; type: BranchType
  location: BranchLocation; contact?: BranchContact
  managerId?: string; businessHours?: BranchBusinessHours[]
  settings?: Partial<BranchSettings>
}
interface UpdateBranchPayload {
  name?: string; location?: Partial<BranchLocation>; contact?: Partial<BranchContact>
  managerId?: string; businessHours?: BranchBusinessHours[]; settings?: Partial<BranchSettings>
}
interface AssignManagerPayload { managerId: string }
```
Used for: `BRANCHES.CREATE` (request), `BRANCHES.UPDATE(id)` (request), `BRANCHES.ASSIGN_MANAGER(id)` (request).

### `Location` / `Branch` alias (index.ts)
```
type LocationType = 'restaurant_branch' | 'cafe' | 'bar' | 'hotel_property' | 'food_court_stall' | 'mobile_truck' | 'mobile_cafe'
interface Location {
  id: string; tenant_id?: string; name: string; slug: string; type?: LocationType
  address: string; city: string; phone_number: string; email?: string
  lat: number; lng: number
  working_hours: WorkingHours[]
  is_active: boolean
  delivery_radius?: number
  images?: string[]
  is_mobile?: boolean
  mobile_schedule?: string
}
type Branch = Location  // backward-compat alias
```
Used for: `BRANCHES.LIST`, `BRANCHES.DETAIL(id)`, `BRANCHES.NEARBY` responses (`combined.service.ts`'s `branchService`, lightweight variant used by customer-facing pages, distinct from the richer P7.3 `Branch` in branch.ts).

### `WorkingHours` (index.ts)
```
interface WorkingHours { day: string; open: string; close: string; is_closed: boolean }
```
Nested in `Location.working_hours`.

### `BranchRevenueAnalytics`, `BranchOrderAnalytics`, `BranchReservationAnalytics` (analytics.ts)
```
interface BranchRevenueAnalytics { branchId: string; totalRevenue: number; revenueChangePct: number; averageOrderValue: number; totalOrders: number; period: string }
interface BranchOrderAnalytics { branchId: string; totalOrders: number; ordersByStatus: Record<string, number>; averageOrderValue: number; period: string }
interface BranchReservationAnalytics { branchId: string; totalReservations: number; upcomingReservations: number; cancelledReservations: number; occupancyRate: number; period: string }
```
Used for: `branch-analytics.service.ts` (no dedicated ENDPOINTS entries — computed client-side from `ANALYTICS.*` + branch filtering, per comments in `branch-analytics.service.ts`).

---

## Branch Routing

### `BranchScope` (branch-routing.ts)
```
type BranchScope = 'all' | 'assigned' | 'none'
```

### `BranchFilter` (branch-routing.ts)
```
interface BranchFilter { tenantId: string; branchIds?: string[]; scope: BranchScope }
```
Not endpoint-bound — client-side query criteria consumed by `branch-access.service.ts`.

### `BranchAccessContext` (branch-routing.ts)
```
interface BranchAccessContext { tenantId: string; staffId: string; roles: Role[]; branchIds: string[] }
```
Not endpoint-bound — derived from session/RBAC state, passed into `branch-access.service.ts` and `order-routing.service.ts`.

### `BranchIsolationResult<T>` (branch-routing.ts)
```
interface BranchIsolationResult<T> { records: T[]; scope: BranchScope; accessibleBranchIds: string[] }
```
Not endpoint-bound — generic result wrapper for branch-filtered record sets, produced by `branch-access.service.ts`.

### `BranchAssignmentRule` (branch-routing.ts)
```
interface BranchAssignmentRule {
  orderType: 'dine_in' | 'delivery' | 'pickup'
  branchSelectionStrategy: 'table' | 'customer_choice' | 'nearest' | 'current_route'
  requiresActiveBranch: boolean
}
```
Used by: `order-routing.service.ts`'s `ORDER_ROUTING_RULES` constant — client-side, not endpoint-bound.

---

## Tenant

### `BusinessType`, `TenantStatus`, `TenantLifecycle` (index.ts)
```
type BusinessType = 'restaurant' | 'cafe' | 'bar' | 'food_court' | 'food_truck' | 'mobile_cafe' | 'hotel' | 'other'
type TenantStatus = 'active' | 'trial' | 'suspended' | 'churned' | 'archived'
type TenantLifecycle = 'loading' | 'ready' | 'fallback'
```

### `SystemReadiness` (index.ts)
```
interface SystemReadiness { isLoading: boolean; isReady: boolean; isFallback: boolean; canExecute: boolean }
```
Client-only runtime gate — not endpoint-bound.

### `Tenant` (index.ts)
```
interface Tenant {
  id: string
  name: string
  slug: string
  businessTypes: string[]
  status: TenantStatus
  createdAt: string
  settings?: Record<string, unknown>
  ownerId?: string
}
```
Used for: `TENANTS.DETAIL(slug)`, `TENANTS.CURRENT`, `TENANTS.LIST`, `TENANTS.PROVISION`, `TENANTS.CLONE`, `TENANTS.ACTIVATE/SUSPEND/ARCHIVE`, `TENANTS.SETTINGS(slug)` (`tenant.service.ts`, `tenant-provisioning.service.ts`).

### `TenantTheme` (index.ts)
```
interface TenantTheme { primaryColor?: string; accentHoverColor?: string; logoUrl?: string; fontBody?: string }
```
Nested inside `Tenant.settings.theme`; also referenced by `provisioning.ts`'s `TenantBrandingConfig` fields.

### `ProvisionableBusinessType`, `TenantBrandingConfig`, `TenantProvisionRequest`, `TenantProvisionResult`, `TenantTemplate`, `TenantCapabilityPreset` (provisioning.ts)
```
type ProvisionableBusinessType = 'restaurant' | 'cafe' | 'bar' | 'food_court' | 'food_truck' | 'mobile_cafe'

interface TenantBrandingConfig { primaryColor?: string; accentHoverColor?: string; logoUrl?: string; fontBody?: string }

interface TenantProvisionRequest {
  name: string
  slug: string
  businessType: ProvisionableBusinessType
  capabilityOverrides?: Record<string, boolean>
  branding?: TenantBrandingConfig
  featureFlagOverrides?: Record<string, boolean>
}

interface TenantProvisionResult {
  success: boolean
  tenantId?: string
  slug?: string
  errors?: string[]
  warnings?: string[]
  tenant?: Tenant
}

interface TenantTemplate {
  businessType: ProvisionableBusinessType
  name: string
  description: string
  enabledCapabilities: string[]
  defaultFeatureFlags: Record<string, boolean>
  brandingDefaults: TenantBrandingConfig
}

interface TenantCapabilityPreset {
  businessType: ProvisionableBusinessType
  required: string[]
  optional: Record<string, boolean>
}
```
`TenantProvisionRequest` → `TENANTS.PROVISION` request body; `TenantProvisionResult` → `TENANTS.PROVISION`/`TENANTS.CLONE` response body (`tenant-provisioning.service.ts`). `TenantTemplate`/`TenantCapabilityPreset` are client-side catalog data, not directly endpoint-bound.

### `Module`, `ModuleCapabilitySet`, `Capability`, `NavItem` (index.ts)
```
type Capability = 'menu' | 'ordering' | 'qr_table' | 'reservations' | 'reviews' | 'loyalty' | 'notifications'

interface ModuleCapabilitySet {
  readonly required: readonly Capability[]
  readonly optional: readonly Capability[]
  readonly defaultEnabled: readonly Capability[]
}

interface NavItem {
  href: string; label: string; icon?: string; exact?: boolean
  featureFlagKey?: string
  permissionKey?: P7Permission
  group?: string
}

interface Module {
  key: string; name: string
  businessTypes: BusinessType[]
  routes: string[]
  navItems: NavItem[]
  defaultFeatureFlags: Record<string, boolean>
  enabled: boolean
  capabilities?: ModuleCapabilitySet
  adminNavItems?: NavItem[]
  qrExperienceType?: 'restaurant' | 'cafe' | 'bar' | 'food_court' | 'food_truck' | 'mobile_cafe'
}
```
Client-side module registry types (`src/modules/registry.ts`), consumed by `feature-flags.service.ts`; not directly endpoint-bound.

### `CafeSettings`, `BarSettings`, `FoodCourtSettings`, `FoodTruckSettings`, `MobileCafeSettings` (index.ts)
```
interface CafeSettings { happyHourEnabled: boolean; happyHourStart?: string; happyHourEnd?: string; loyaltyEnabled: boolean; featuredCoffeeEnabled: boolean }
interface BarSettings { happyHourEnabled: boolean; happyHourStart?: string; happyHourEnd?: string; eventsEnabled: boolean; reservationsRequiredForEvents: boolean; featuredCocktailsEnabled: boolean }
interface FoodCourtSettings { multiVendorEnabled: boolean; vendorManagementEnabled: boolean; sharedSeatingEnabled: boolean; crossVendorOrderingEnabled: boolean; featuredVendorEnabled: boolean }
interface FoodTruckSettings { routeTrackingEnabled: boolean; liveLocationEnabled: boolean; scheduledStopsEnabled: boolean; preOrderEnabled: boolean; featuredRouteEnabled: boolean }
interface MobileCafeSettings { routeTrackingEnabled: boolean; liveLocationEnabled: boolean; loyaltyEnabled: boolean; featuredCoffeeEnabled: boolean; dailySpecialsEnabled: boolean }
```
Stored inside `Tenant.settings.*Settings`; read/written via `TENANTS.SETTINGS(slug)`.

### `FeatureFlagEntry` (feature-flags.service.ts, inline)
```
interface FeatureFlagEntry { key: string; value: boolean; source: 'module_default' | 'capability' | 'tenant_override'; description?: string }
```
Not endpoint-bound — pure client-side merge result of module defaults + tenant overrides (`featureFlagsService.resolveFlags()`).

---

## Reviews

*(Business-level reviews — tenant/branch scoped, `business-review.ts` — distinct from menu-item `Review` in index.ts)*

### `ReviewStatus` (business-review.ts)
```
type ReviewStatus = 'published' | 'pending' | 'hidden' | 'spam' | 'deleted' | 'rejected'
```

### `OwnerReply` (business-review.ts)
```
interface OwnerReply { id: string; text: string; authorName: string; createdAt: string; updatedAt?: string }
```
Used for: `BUSINESS_REVIEWS.REPLY(tenantId, reviewId)` response, nested in `BusinessReview.ownerReply`.

### `BusinessReview` (business-review.ts)
```
interface BusinessReview {
  id: string; tenantId: string; branchId?: string; customerId?: string; customerName: string
  avatar?: string; rating: number; title?: string; comment: string
  images?: string[]; visitDate?: string
  visitType?: 'dine_in' | 'takeaway' | 'delivery'
  createdAt: string; updatedAt: string
  ownerReply?: OwnerReply
  helpfulCount: number; verifiedVisit: boolean
  status: ReviewStatus; language?: string; pinned?: boolean
}
```
Used for: `BUSINESS_REVIEWS.LIST(tenantId)`, `BUSINESS_REVIEWS.CREATE(tenantId)`, `BUSINESS_REVIEWS.DETAIL(tenantId, reviewId)`, `BUSINESS_REVIEWS.MODERATE(tenantId, reviewId)`, `BUSINESS_REVIEWS.HELPFUL(tenantId, reviewId)` — `business-review.service.ts`.

### `RatingDistribution`, `RatingBreakdownData` (business-review.ts)
```
interface RatingDistribution { star: number; count: number; percentage: number }
interface RatingBreakdownData { average: number; total: number; distribution: RatingDistribution[]; recentAverage?: number; weightedAverage?: number }
```
Used for: `BUSINESS_REVIEWS.RATING(tenantId)` / `BUSINESS_REVIEWS.BRANCH_RATING(tenantId, branchId)` response.

### `BusinessReviewFilters` + `DEFAULT_REVIEW_FILTERS` const (business-review.ts)
```
interface BusinessReviewFilters {
  sort: 'newest' | 'highest' | 'lowest' | 'most_helpful'
  verified: boolean; withPhotos: boolean
  branchId?: string; language?: string; rating?: number
}
```
Used for: `BUSINESS_REVIEWS.LIST(tenantId)` query params.

### `BusinessReviewsResponse` (business-review.ts)
```
interface BusinessReviewsResponse { reviews: BusinessReview[]; total: number; breakdown: RatingBreakdownData }
```
Used for: `BUSINESS_REVIEWS.LIST(tenantId)` full response wrapper.

### `CreateBusinessReviewPayload` (business-review.ts)
```
interface CreateBusinessReviewPayload {
  tenantId: string; branchId?: string; rating: number; title?: string; comment: string
  images?: string[]; visitDate?: string
  visitType?: BusinessReview['visitType']; language?: string
}
```
Used for: `BUSINESS_REVIEWS.CREATE(tenantId)` request body.

### `ReviewAnalytics` (business-review.ts)
```
interface ReviewAnalytics {
  averageRating: number; totalReviews: number; reviewsThisMonth: number
  trend: 'up' | 'down' | 'stable'; trendDelta: number
  replyRate: number; avgReplyTimeHours: number
  breakdown: RatingDistribution[]
  topKeywords: { word: string; count: number }[]
  monthlyAverages: { month: string; average: number; count: number }[]
}
```
Used for: `BUSINESS_REVIEWS.ANALYTICS(tenantId)` response.

### `Review` (index.ts — menu-item level, distinct domain)
```
interface Review { id: string; user: User; menu_item_id?: string; order_id?: string; rating: number; comment?: string; created_at: string }
```
Used for: `REVIEWS.CREATE`, `REVIEWS.LIST`, `REVIEWS.ITEM_REVIEWS(itemId)` — `review.service.ts`.

### `CreateReviewPayload` (review.service.ts, inline)
```
interface CreateReviewPayload { rating: number; comment?: string; order_id?: string }
```
Used for: `REVIEWS.CREATE` request body.

### `ReviewsResponse` (review.service.ts, inline)
```
interface ReviewsResponse { results: Review[]; count: number; average_rating: number }
```
Used for: `REVIEWS.LIST` / `REVIEWS.ITEM_REVIEWS(itemId)` response.

---

## Loyalty

### `LoyaltyTier` (index.ts)
```
type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'
```

### `LoyaltyAccount` (index.ts)
```
interface LoyaltyAccount {
  id: string; userId: string; tenantId: string
  points: number; lifetimePoints: number; tier: LoyaltyTier
  tierExpiresAt?: string; createdAt: string; updatedAt: string
}
```
Used for: `LOYALTY.ACCOUNT` response.

### `LoyaltyTransactionType`, `LoyaltyTransaction` (index.ts)
```
type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'adjustment'
interface LoyaltyTransaction {
  id: string; accountId: string; tenantId: string; type: LoyaltyTransactionType
  points: number; description: string; createdAt: string; referenceId?: string
}
```
Used for: `LOYALTY.TRANSACTIONS` response.

### `LoyaltyReward` (index.ts)
```
interface LoyaltyReward {
  id: string; name: string; description: string; pointsCost: number
  active: boolean; minimumTier?: LoyaltyTier; expiresAt?: string; createdAt: string
}
```
Used for: `LOYALTY.REWARDS`, `LOYALTY.REDEEM(rewardId)`, `LOYALTY.ADMIN_REWARDS`, `LOYALTY.ADMIN_REWARD(id)` responses.

### `EarnPointsPayload` (loyalty.service.ts, inline)
```
interface EarnPointsPayload { orderId: string; amount: number }
```
Used for: `LOYALTY.EARN` request body.

### `RedeemRewardResponse` (loyalty.service.ts, inline)
```
interface RedeemRewardResponse { transaction: LoyaltyTransaction; account: LoyaltyAccount }
```
Used for: `LOYALTY.REDEEM(rewardId)` response.

### `EarnPointsResponse` (loyalty.service.ts, inline)
```
interface EarnPointsResponse { transaction: LoyaltyTransaction; account: LoyaltyAccount; pointsEarned: number }
```
Used for: `LOYALTY.EARN` response.

### `LoyaltyAnalytics` (analytics.ts)
```
interface LoyaltyAnalytics {
  totalMembers: number; activeMembersThisMonth: number
  pointsIssued: number; pointsRedeemed: number; redemptionRate: number
  tierDistribution: { bronze: number; silver: number; gold: number; platinum: number }
  topRewards: Array<{ name: string; redemptions: number }>
}
```
Used for: `ANALYTICS.LOYALTY` response.

### `LOYALTY_TIER_THRESHOLDS` const (index.ts)
```
Record<LoyaltyTier, number>  // bronze:0, silver:1000, gold:5000, platinum:15000
```
Client-side threshold table, not a DTO.

---

## Vendor

### `VendorStatus`, `VendorCategory` (index.ts)
```
type VendorStatus = 'active' | 'inactive' | 'pending' | 'suspended'
type VendorCategory = 'asian' | 'western' | 'mediterranean' | 'mexican' | 'indian' | 'desserts' | 'beverages' | 'fast_food' | 'healthy' | 'other'
```

### `Vendor` (index.ts)
```
interface Vendor {
  id: string; name: string; description: string
  branchIds?: string[]; category: VendorCategory; status: VendorStatus
  rating: number; ratingCount: number; featured: boolean; logoUrl?: string
  stallNumber?: string; commissionRate: number
  contactEmail: string; contactPhone?: string
  createdAt: string; updatedAt: string
}
```
Used for: `VENDORS.LIST`, `VENDORS.DETAIL(id)`, `VENDORS.ADMIN_LIST`, `VENDORS.ADMIN_DETAIL(id)`.

### `VendorStats` (index.ts)
```
interface VendorStats { vendorId: string; ordersCount: number; revenue: number; commissionPaid: number; avgRating: number; activeProducts: number; period: string }
```
Used for: `VENDORS.STATS(id)` response.

### `SettlementStatus`, `VendorCommission`, `VendorSettlement` (index.ts)
```
type SettlementStatus = 'pending' | 'paid' | 'failed'
interface VendorCommission { vendorId: string; grossRevenue: number; commissionRate: number; commissionAmount: number; netPayout: number }
interface VendorSettlement {
  id: string; vendorId: string; amount: number; status: SettlementStatus
  settlementDate: string; payoutReference?: string
  commission: VendorCommission
  createdAt: string; updatedAt: string
}
```
Used for: `VENDORS.SETTLEMENTS(id)`, `VENDORS.ADMIN_SETTLEMENTS` responses.

### `CreateVendorPayload`, `UpdateVendorPayload`, `CreateSettlementPayload` (vendor.service.ts, inline)
```
type CreateVendorPayload = Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>
type UpdateVendorPayload = Partial<Omit<Vendor, 'id' | 'createdAt'>>
type CreateSettlementPayload = { vendorId: string; grossRevenue: number; settlementDate?: string; payoutReference?: string }
```
Used for: `VENDORS.ADMIN_LIST` (POST create), `VENDORS.ADMIN_DETAIL(id)` (PATCH update), `VENDORS.ADMIN_SETTLEMENTS` (POST create settlement) request bodies.

### `VendorAnalytics` (analytics.ts)
```
interface VendorAnalytics {
  totalVendors: number; activeVendors: number; totalRevenue: number; totalCommission: number; avgRating: number
  vendors: Array<{ vendorId: string; name: string; revenue: number; commissionPaid: number; ordersCount: number; avgRating: number }>
}
```
Used for: `ANALYTICS.VENDORS` response.

---

## Promotion

### `PromotionType`, `Weekday` (index.ts)
```
type PromotionType = 'percentage_discount' | 'fixed_discount' | 'buy_one_get_one' | 'happy_hour'
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
```

### `PromotionSchedule` (index.ts)
```
interface PromotionSchedule {
  startAt: string; endAt?: string; weekdays?: Weekday[]
  timeWindowStart?: string; timeWindowEnd?: string
}
```
Nested in `PromotionRule.schedule` and `HappyHourRule.schedule`.

### `HappyHourRule` (index.ts)
```
interface HappyHourRule {
  id: string; name: string; discountPercent: number
  applicableItemIds: string[]; schedule: PromotionSchedule; active: boolean; createdAt: string
}
```
Client-side promotion sub-type; consumed alongside `PromotionRule` by `promotion.service.ts` helpers (`isPromotionActive`, `validateSchedule`).

### `PromotionRule` (index.ts)
```
interface PromotionRule {
  id: string; name: string; description: string; type: PromotionType
  discountPercent?: number; discountAmount?: number
  applicableItemIds: string[]; schedule: PromotionSchedule
  active: boolean; createdAt: string; updatedAt: string
}
```
Used for: `PROMOTIONS.LIST`, `PROMOTIONS.ACTIVE`, `PROMOTIONS.DETAIL(id)`, `PROMOTIONS.ACTIVATE(id)` responses.

### `CreatePromotionPayload`, `UpdatePromotionPayload` (promotion.service.ts, inline)
```
type CreatePromotionPayload = Omit<PromotionRule, 'id' | 'createdAt' | 'updatedAt'>
type UpdatePromotionPayload = Partial<Omit<PromotionRule, 'id' | 'createdAt'>>
```
Used for: `PROMOTIONS.LIST` (POST create), `PROMOTIONS.DETAIL(id)` (PATCH update) request bodies.

### `PromotionAnalytics` (analytics.ts)
```
interface PromotionAnalytics {
  totalPromotions: number; activePromotions: number; totalDiscountGiven: number; discountChangePct: number
  usageByType: { percentage_discount: number; fixed_discount: number; buy_one_get_one: number; happy_hour: number }
  topPromotions: Array<{ name: string; usageCount: number; discountGiven: number }>
}
```
Used for: `ANALYTICS.PROMOTIONS` response.

---

## Notification

### `NotificationPriority`, `NotificationChannel`, `NotificationStatus`, `NotificationCategory`, `RichNotificationType` (notification.ts)
```
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms'
type NotificationStatus = 'unread' | 'read' | 'archived' | 'deleted'
type NotificationCategory = 'order' | 'reservation' | 'staff' | 'branch' | 'promotion' | 'tenant' | 'vendor' | 'loyalty' | 'payment' | 'system' | 'audit'
type RichNotificationType =
  | 'order_created' | 'order_status_changed'
  | 'reservation_created' | 'reservation_confirmed' | 'reservation_cancelled'
  | 'staff_created' | 'staff_suspended' | 'staff_removed' | 'ownership_transferred'
  | 'branch_created' | 'branch_deactivated' | 'branch_maintenance'
  | 'promotion_created' | 'promotion_disabled'
  | 'tenant_activated' | 'tenant_suspended' | 'tenant_archived'
  | 'vendor_created' | 'loyalty_reward_created' | 'payment_refunded'
  | 'feature_flag_changed' | 'system_alert' | 'audit_critical'
```

### `NotificationScope`, `NotificationActor`, `NotificationDeepLink` (notification.ts)
```
interface NotificationScope { tenantId: string; branchId?: string }
interface NotificationActor { id: string; name: string; roles: Role[] }
interface NotificationDeepLink {
  type: 'order' | 'reservation' | 'staff' | 'branch' | 'promotion' | 'audit_log' | 'vendor' | 'tenant'
  id: string; href: string
}
```

### `RichNotification` (notification.ts)
```
interface RichNotification {
  id: string; type: RichNotificationType; category: NotificationCategory
  priority: NotificationPriority; status: NotificationStatus
  title: string; message: string
  actor?: NotificationActor; scope: NotificationScope
  deepLink?: NotificationDeepLink
  sourceAuditAction?: AuditAction
  channels: NotificationChannel[]
  data?: Record<string, unknown>
  createdAt: string; readAt?: string; archivedAt?: string; expiresAt?: string
}
```
Used for: `notification.service.ts`'s enterprise notification list (no dedicated ENDPOINTS entry beyond the legacy `NOTIFICATIONS.*`; this richer model is the P7.6 layer served through the same mock/API pattern in `notification.service.ts`).

### `NotificationFilter`, `PaginatedNotifications`, `NotificationGroup`, `NotificationStatistics`, `NotificationSummary` (notification.ts)
```
interface NotificationFilter {
  tenantId?: string; branchId?: string; category?: NotificationCategory
  priority?: NotificationPriority; status?: NotificationStatus; type?: RichNotificationType
  search?: string; dateFrom?: string; dateTo?: string
  page?: number; pageSize?: number
  sortBy?: 'createdAt' | 'priority' | 'status'; sortOrder?: 'asc' | 'desc'
}
interface PaginatedNotifications { results: RichNotification[]; count: number; page: number; pageSize: number; totalPages: number; unreadCount: number }
interface NotificationGroup { category: NotificationCategory; notifications: RichNotification[]; unreadCount: number; latestAt: string }
interface NotificationStatistics {
  totalNotifications: number; unreadCount: number; readCount: number; archivedCount: number; readRate: number
  notificationsByCategory: Record<NotificationCategory, number>
  notificationsByPriority: Record<NotificationPriority, number>
  notificationsByBranch: Record<string, number>
  notificationsByDay: Record<string, number>
  topTypes: Array<{ type: RichNotificationType; count: number }>
  dateFrom: string; dateTo: string
}
interface NotificationSummary { unreadCount: number; urgentCount: number; latestNotification?: RichNotification; categories: Partial<Record<NotificationCategory, number>> }
```
Used for: `notification.service.ts` query params (`NotificationFilter`) and list/stat responses.

### `ChannelPreference`, `NotificationPreference` (notification.ts)
```
interface ChannelPreference { in_app: boolean; push: boolean; email: boolean; sms: boolean }
interface NotificationPreference {
  id: string; userId: string; tenantId: string; branchId?: string
  category: NotificationCategory; enabled: boolean
  channels: ChannelPreference; minPriority: NotificationPriority; updatedAt: string
}
```
Used for: `notification-preferences.service.ts` (no ENDPOINTS entry — client-managed preference store).

### `CreatePreferenceParams` (notification-preferences.service.ts, inline)
```
interface CreatePreferenceParams {
  userId: string; tenantId: string; branchId?: string
  category: NotificationCategory; enabled?: boolean
  channels?: Partial<ChannelPreference>; minPriority?: NotificationPriority
}
```
Not endpoint-bound — internal helper param object for `buildDefaultPreferences()`.

### `NotificationDelivery` (notification.ts)
```
interface NotificationDelivery {
  notificationId: string; channel: NotificationChannel
  status: 'pending' | 'delivered' | 'failed'
  deliveredAt?: string; failureReason?: string; retryCount: number
}
```
Delivery tracking record; not directly wired to an ENDPOINTS entry (internal/simulated).

### `NotificationType`, `Notification` (notification.ts AND duplicated verbatim in index.ts)
```
type NotificationType = 'order_update' | 'reservation_update' | 'promotion' | 'system'
interface Notification { id: string; type: NotificationType; title: string; message: string; data?: Record<string, unknown>; is_read: boolean; created_at: string }
```
Used for: `NOTIFICATIONS.LIST`, `NOTIFICATIONS.MARK_READ(id)`, `NOTIFICATIONS.MARK_ALL_READ`, `NOTIFICATIONS.DELETE(id)`, `NOTIFICATIONS.REGISTER_DEVICE` — `combined.service.ts`'s `notificationService`. **Note: this legacy `Notification`/`NotificationType` pair is defined identically in both `src/types/notification.ts` and `src/types/index.ts` — a duplicate declaration, not re-exported from one to the other.**

---

## Staff

### `StaffStatus`, `InviteStatus`, `StaffAuditAction` (staff.ts)
```
type StaffStatus = 'pending' | 'active' | 'suspended' | 'removed'
type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'
type StaffAuditAction = 'staff.invited' | 'staff.role_changed' | 'staff.suspended' | 'staff.activated' | 'staff.removed' | 'staff.ownership_transferred'
```

### `StaffMember` (staff.ts)
```
interface StaffMember {
  id: string; tenantId: string; userId: string; email: string
  firstName: string; lastName: string; avatar?: string
  status: StaffStatus; roles: Role[]
  invitedAt: string; activatedAt?: string; lastSeenAt?: string
  createdBy: string
  branchIds?: string[]
  ownerId?: string
  metadata?: Record<string, unknown>
}
```
Used for: `STAFF.LIST(tenantId)`, `STAFF.DETAIL(id)`, `STAFF.ACTIVATE/SUSPEND/REMOVE(id)` responses (`staff.service.ts`).

### `StaffInvite` (staff.ts)
```
interface StaffInvite { id: string; tenantId: string; email: string; roles: Role[]; invitedBy: string; expiresAt: string; status: InviteStatus }
```
Used for: `STAFF.INVITE(tenantId)`, `STAFF.INVITES(tenantId)`, `STAFF.CANCEL_INVITE(id)`, `STAFF.RESEND_INVITE(id)`, `STAFF.ACCEPT_INVITE(id)` responses.

### `TenantMembership` (staff.ts)
```
interface TenantMembership { userId: string; tenantId: string; staffMemberId: string; roles: Role[]; status: StaffStatus; joinedAt: string }
```
Used internally by `staff.service.ts` for multi-tenant membership resolution; no dedicated ENDPOINTS entry.

### `StaffAnalytics` (staff.ts)
```
interface StaffAnalytics { totalStaff: number; activeStaff: number; pendingInvites: number; suspendedStaff: number; byRole: Record<Role, number> }
```
Derived client-side from `STAFF.LIST` results — not a separate endpoint.

### `InviteStaffPayload`, `UpdateStaffRolesPayload`, `TransferOwnershipPayload` (staff.ts)
```
interface InviteStaffPayload { email: string; roles: Role[]; firstName?: string; lastName?: string }
interface UpdateStaffRolesPayload { roles: Role[] }
interface TransferOwnershipPayload { targetMemberId: string }
```
Used for: `STAFF.INVITE(tenantId)` request body, `STAFF.UPDATE_ROLES(id)` request body, `STAFF.TRANSFER_OWNERSHIP(tenantId)` request body / `TENANTS.TRANSFER_OWNERSHIP(slugOrId)`.

### `StaffAuditEvent` (staff.ts)
```
interface StaffAuditEvent {
  action: StaffAuditAction; staffMemberId?: string; inviteId?: string; tenantId: string
  performedBy?: string; metadata?: Record<string, unknown>; timestamp: string
}
```
Not endpoint-bound — emitted client-side via `staffAuditHooks.subscribe()` in `staff.service.ts` for audit-log integration.

### `StaffAuditListener` (staff.service.ts, inline)
```
type StaffAuditListener = (event: StaffAuditEvent) => void
```
Internal callback type, not a DTO.

---

## RBAC

### `Role` (rbac.ts)
```
type Role = 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'marketing' | 'support'
```
Used pervasively: `StaffMember.roles`, `AuditActor.roles`, `NotificationActor.roles`, `UserTenantRole.roles`, etc.

### `P7Permission` (rbac.ts)
```
type P7Permission =
  | 'orders.view' | 'orders.manage' | 'orders.create' | 'orders.edit' | 'orders.cancel' | 'orders.delete'
  | 'menu.view' | 'menu.manage'
  | 'reservations.view' | 'reservations.manage'
  | 'customers.view' | 'customers.manage' | 'customers.create' | 'customers.edit'
  | 'payments.process' | 'payments.refund'
  | 'tables.view' | 'tables.assign'
  | 'kitchen.view' | 'kitchen.manage'
  | 'vendors.view' | 'vendors.manage'
  | 'promotions.view' | 'promotions.manage'
  | 'loyalty.view' | 'loyalty.manage'
  | 'analytics.view' | 'analytics.export'
  | 'staff.view' | 'staff.manage' | 'staff.create' | 'staff.edit' | 'staff.delete'
  | 'branches.view' | 'branches.manage'
  | 'settings.view' | 'settings.manage' | 'featureflags.manage'
  | 'tenant.view' | 'tenant.manage'
  | 'audit.view' | 'audit.export' | 'audit.manage'
  | 'notifications.view' | 'notifications.manage' | 'notifications.preferences'
  | 'operations.view' | 'operations.manage'
  | 'reviews.view' | 'reviews.manage'
  | 'dashboard:access'
```
Used pervasively across the RBAC/permission layer (`permission.service.ts`), `NavItem.permissionKey`, `RoleTemplate.permissions`.

### `UserTenantRole`, `TenantRoleAssignment` (rbac.ts)
```
interface UserTenantRole { userId: string; tenantId: string; roles: Role[] }
interface TenantRoleAssignment { tenantId: string; roles: Role[] }
```
Session role-assignment records; consumed by `permission.service.ts`.

### `PermissionCheckOptions` (rbac.ts)
```
interface PermissionCheckOptions { featureFlags?: Record<string, boolean>; capabilities?: Record<string, boolean> }
```
Param object for `permission.service.ts` checks — not endpoint-bound.

### `AuditEvent` (rbac.ts)
```
interface AuditEvent { permission: P7Permission; granted: boolean; roles: Role[]; tenantId?: string; userId?: string; timestamp: string }
```
Emitted via `permissionService.auditHooks.subscribe()` — feeds the P7.6 audit log, not directly endpoint-bound.

### `AuditListener` (permission.service.ts, inline)
```
type AuditListener = (event: AuditEvent) => void
```
Internal callback type.

### `MockRbacUser` (rbac.ts)
```
interface MockRbacUser { id: string; email: string; first_name: string; last_name: string; tenantAssignments: UserTenantRole[] }
```
Mock-only fixture type used by `permission.service.ts`'s `MOCK_RBAC_USERS` — not endpoint-bound.

### `UserPermissionOverride` (rbac.ts)
```
interface UserPermissionOverride { userId: string; tenantId: string; allow: P7Permission[]; deny: P7Permission[] }
```
Per-user override record; managed client-side by `permission.service.ts`.

### `EffectivePermissionResult` (rbac.ts)
```
interface EffectivePermissionResult { permission: P7Permission; fromRole: boolean; fromOverride: boolean; denied: boolean; effective: boolean }
```
Computed result, not endpoint-bound.

### `RoleTemplate` (rbac.ts)
```
interface RoleTemplate { role: Role; label: string; description: string; system: boolean; permissions: readonly P7Permission[] }
```
Static/derived catalog data for role management UI.

### `CustomRoleTemplate` (rbac.ts)
```
interface CustomRoleTemplate {
  id: string; name: string; description: string; color: string; icon?: string
  permissions: P7Permission[]; tenantId: string
  createdBy: string; createdAt: string; updatedAt: string
  enabled: boolean; clonedFrom?: Role
}
```
Tenant-editable custom role — no dedicated ENDPOINTS entry (managed client-side via `permission.service.ts` in-memory store).

### `PermissionDependency` (rbac.ts)
```
interface PermissionDependency { permission: P7Permission; requires?: P7Permission[]; implies?: P7Permission[]; conflicts?: P7Permission[] }
```
Static dependency graph data used by the dependency engine.

### `RbacAuditEvent` (rbac.ts)
```
interface RbacAuditEvent {
  id: string
  type: 'role_assigned' | 'role_removed' | 'role_disabled' | 'role_enabled'
    | 'permission_granted' | 'permission_denied' | 'permission_reset' | 'override_cleared'
    | 'custom_role_created' | 'custom_role_edited' | 'custom_role_deleted'
    | 'branch_role_set' | 'branch_role_cleared'
  actorId: string; targetUserId: string; tenantId: string; branchId?: string
  role?: Role | string; permission?: P7Permission
  oldValue?: unknown; newValue?: unknown; reason?: string; timestamp: string
}
```
Used for: in-session audit trail in `rbac-audit.service.ts` — backend-compatible shape, no dedicated ENDPOINTS entry (not currently wired to a live endpoint).

### `SimulationResult` (rbac.ts)
```
interface SimulationResult { label: string; roles: (Role | string)[]; effectivePermissions: P7Permission[]; deniedPermissions: P7Permission[]; grantedByOverride: P7Permission[]; permissionCount: number }
```
Client-side "Permission Simulator" preview result, not endpoint-bound.

### `DependencyValidationResult` (rbac.ts)
```
interface DependencyValidationResult { permission: P7Permission; missingRequirements: P7Permission[]; impliedGrants: P7Permission[]; conflicts: P7Permission[]; hasIssues: boolean }
```
Client-side validation result, not endpoint-bound.

---

## Ownership

### `StaffRole`, `OwnerStatus` (ownership.ts)
```
type StaffRole = Exclude<Role, 'owner'>
type OwnerStatus = 'active' | 'suspended' | 'pending_verification'
```

### `BillingRef` (ownership.ts)
```
interface BillingRef { customerId: string | null; billingEmail: string }
```
Nested in `Owner.billing`.

### `Owner` (ownership.ts)
```
interface Owner {
  ownerId: string; userId: string; status: OwnerStatus
  plan: string; maxTenants: number | null
  billing: BillingRef
  createdAt: string; verifiedAt?: string
}
```
Used for: `owner.service.ts` operations (no dedicated ENDPOINTS entry — service comment notes real backend endpoints don't exist yet; USE_MOCK=false will 404 until implemented). Also carried on `AuthSessionRbacPayload.ownership`.

### `StaffAssignmentMode`, `StaffAssignmentStatus` (ownership.ts)
```
type StaffAssignmentMode = 'read' | 'manage'
type StaffAssignmentStatus = 'active' | 'future' | 'revoked' | 'expired'
```

### `StaffAssignment` (ownership.ts)
```
interface StaffAssignment {
  assignmentId: string; staffId: string; tenantId: string
  branchIds: string[] | 'all'
  role: StaffRole; mode: StaffAssignmentMode
  status: StaffAssignmentStatus
  validFrom?: string; validUntil?: string
  grantedBy: string; grantedAt: string
  revokedBy?: string; revokedAt?: string
}
```
Used for: `staff-assignment.service.ts` (no dedicated ENDPOINTS entry — backend not yet implemented per file comments); also carried on `AuthSessionRbacPayload.staffAssignments`.

### `GrantStaffAssignmentPayload`, `UpdateStaffAssignmentPayload`, `RevokeStaffAssignmentPayload`, `MoveStaffAssignmentPayload` (ownership.ts)
```
interface GrantStaffAssignmentPayload {
  staffId: string; tenantId: string; branchIds: string[] | 'all'
  role: StaffRole; mode: StaffAssignmentMode
  validFrom?: string; validUntil?: string; grantedBy: string
}
interface UpdateStaffAssignmentPayload { branchIds?: string[] | 'all'; role?: StaffRole; mode?: StaffAssignmentMode; validFrom?: string; validUntil?: string }
interface RevokeStaffAssignmentPayload { revokedBy: string; reason?: string }
interface MoveStaffAssignmentPayload { fromAssignmentId: string; to: GrantStaffAssignmentPayload }
```
Request-body DTOs for `staff-assignment.service.ts`'s grant/update/revoke/move operations (mirrors `docs/BACKEND_API_CONTRACT.md §39.5` — endpoints not yet in `ENDPOINTS`).

### `OwnershipIdentity` (ownership-resolution.service.ts, inline)
```
interface OwnershipIdentity { owner?: Owner; staffMember?: StaffMember }
```
Not endpoint-bound — client-side identity resolution container.

### `AssignmentValidationResult` (ownership.service.ts, inline)
```
interface AssignmentValidationResult { valid: boolean; errors: string[] }
```
Not endpoint-bound — result of `validateAssignment()` invariant check.

### `BackfillReport`, `BackfillResult` (ownership-migration.service.ts, inline)
```
interface BackfillReport { resolvedTenantIds: string[]; ambiguousTenantIds: string[]; createdOwners: Owner[] }
interface BackfillResult { tenants: Tenant[]; owners: Owner[]; report: BackfillReport }
```
Not endpoint-bound — pure migration helper output (`backfillTenantOwnership()`).

---

## Analytics

### `TimeSeries`, `AnalyticsSummary` (analytics.ts)
```
interface TimeSeries { date: string; value: number }
interface AnalyticsSummary {
  periodDays: number
  totalRevenue: number; revenueChangePct: number
  totalOrders: number; ordersChangePct: number
  totalReservations: number; reservationsChangePct: number
  newCustomers: number; customersChangePct: number
  activeVendors: number; loyaltyMembersActive: number; activePromotions: number
}
```
Used for: `ANALYTICS.SUMMARY` response.

*(`RevenueAnalytics`, `ReservationAnalytics`, `LoyaltyAnalytics`, `PromotionAnalytics`, `VendorAnalytics`, `MenuAnalytics`, `MenuItemPerformance`, `MenuCategoryPerformance`, `BranchRevenueAnalytics`, `BranchOrderAnalytics`, `BranchReservationAnalytics` are documented above in their respective domain sections but all live in `analytics.ts`.)*

### `ReservationAnalytics` (analytics.ts)
```
interface ReservationAnalytics {
  totalReservations: number; reservationsChangePct: number
  upcomingReservations: number; cancelledReservations: number
  tablesTotal: number; tablesOccupied: number; occupancyRate: number
  dailyReservations: TimeSeries[]
}
```
Used for: `ANALYTICS.RESERVATIONS` response.

### `AdminStats`, `AdminTopItem`, `AdminCustomerStats`, `AdminCustomer`, `AdminCustomerTier`, `AdminOrderFilters`, `AdminReservationFilters`, `AdminCustomerFilters` (index.ts)
```
type AdminCustomerTier = 'new' | 'regular' | 'vip'

interface AdminCustomer extends User {
  order_count: number; total_spent: number; avg_order_value: number
  tier: AdminCustomerTier; last_order_at?: string
}

interface AdminCustomerStats {
  customer_id: string; tenant_id: string
  order_count: number; total_spent: number; avg_order_value: number
  favorite_item?: string; last_order_at?: string
}

interface AdminTopItem { menu_item_id: string; name: string; order_count: number; revenue: number; trend_pct: number }

interface AdminStats {
  period_days: number
  total_revenue: number; revenue_change_pct: number
  total_orders: number; orders_change_pct: number
  new_customers: number; customers_change_pct: number
  total_reservations: number; reservations_change_pct: number
  top_items: AdminTopItem[]
  orders_in_queue: number; avg_prep_time_minutes: number
  tables_reserved: number; tables_total: number
}

interface AdminOrderFilters { status?: OrderStatus; order_type?: OrderType; branch_id?: string; search?: string; page?: number; page_size?: number }
interface AdminReservationFilters { status?: ReservationStatus; branch_id?: string; date?: string; search?: string; page?: number; page_size?: number }
interface AdminCustomerFilters { tenantId?: string; branchId?: string; tier?: AdminCustomerTier; search?: string; page?: number; page_size?: number }
```
Used for: `ADMIN.STATS` (`AdminStats`), `ADMIN.ORDERS` (`AdminOrderFilters` query + `Order[]`/paginated response), `ADMIN.RESERVATIONS` (`AdminReservationFilters` query), `ADMIN.CUSTOMERS`/`ADMIN.CUSTOMER_DETAIL(id)` (`AdminCustomer`, `AdminCustomerFilters` query), `ADMIN.CUSTOMER_STATS(id)` (`AdminCustomerStats`) — all in `admin.service.ts`.

### `CustomerAnalytics` (index.ts)
```
interface CustomerAnalytics {
  userId: string; tenantId: string
  lifetimeValue: number; avgOrderValue: number; avgReservationPartySize: number
  visitFrequencyDays: number; daysSinceLastVisit: number
  favoriteBranchId?: string; favoriteBranchName?: string
  favoriteWeekday?: string; favoriteHour?: number
  favoriteCategories: string[]
  favoriteItems: Array<{ name: string; count: number }>
  revenueByMonth: Array<{ month: string; revenue: number }>
  visitsByMonth: Array<{ month: string; visits: number }>
  pointsByMonth: Array<{ month: string; points: number }>
}
```
Used for: Customer 360 CRM analytics (P8.9.7), served via `admin.service.ts` customer-detail aggregation; no standalone ENDPOINTS entry (composed client-side from `ADMIN.CUSTOMER_STATS` + CRM data).

---

## Website Builder

### `SectionKey`, `SectionConfig` (website-builder.ts)
```
type SectionKey = 'hero' | 'featured_menu' | 'about' | 'gallery' | 'promotions' | 'reviews' | 'branches' | 'events' | 'faq' | 'contact'
interface SectionConfig { key: SectionKey; enabled: boolean; order: number }
```
Nested in `HomepageLayout.sections` / `HomepageVersion.sections`.

### `HeroAlignment`, `HeroTheme`, `HeroContent` (website-builder.ts)
```
type HeroAlignment = 'left' | 'center' | 'right'
type HeroTheme = 'light' | 'dark' | 'auto'
interface HeroContent {
  headline?: string; subheadline?: string; backgroundImage?: string
  ctaText?: string; ctaTarget?: string; overlayOpacity?: number
  alignment?: HeroAlignment; theme?: HeroTheme
  mobileVariant?: 'compact' | 'full'
}
```

### `FAQItem` (website-builder.ts)
```
interface FAQItem { id: string; question: string; answer: string }
```

### `AboutContent` (website-builder.ts)
```
interface AboutContent { story?: string; mission?: string; history?: string; founderName?: string; founderBio?: string; founderImage?: string; awards?: string[]; languages?: string[] }
```

### `ContactContent` (website-builder.ts)
```
interface ContactContent {
  phone_number?: string; email?: string; website?: string
  whatsapp?: string; instagram?: string; facebook?: string; tiktok?: string; youtube?: string; telegram?: string
  mapEmbedUrl?: string; latitude?: number; longitude?: number
}
```

### `BorderRadius`, `CardStyle`, `DarkModePreference`, `ThemeSettings` (website-builder.ts)
```
type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
type CardStyle = 'flat' | 'elevated' | 'outlined'
type DarkModePreference = 'light' | 'dark' | 'system'
interface ThemeSettings { primaryColor?: string; accentColor?: string; backgroundColor?: string; borderRadius?: BorderRadius; cardStyle?: CardStyle; fontFamily?: string; darkModePreference?: DarkModePreference }
```

### `PublishStatus`, `HomepageVersion`, `HomepageLayout` (website-builder.ts)
```
type PublishStatus = 'draft' | 'published'
interface HomepageVersion {
  id: string; savedAt: string; label?: string
  sections: SectionConfig[]; hero: HeroContent; about: AboutContent; contact: ContactContent; faq: FAQItem[]; theme: ThemeSettings
}
interface HomepageLayout {
  sections: SectionConfig[]; hero: HeroContent; about: AboutContent; contact: ContactContent; faq: FAQItem[]; theme: ThemeSettings
  status: PublishStatus; lastPublishedAt?: string; lastSavedAt?: string
  publishedVersion?: HomepageVersion; versions?: HomepageVersion[]
  brandTheme?: BrandThemeName; heroConfig?: HeroConfig; sectionTemplates?: SectionTemplates
  navItems?: TenantNavItemConfig[]
}
```
Used for: `WEBSITE_BUILDER.LAYOUT(tenantSlug)` (GET/PUT), `WEBSITE_BUILDER.PUBLISH(tenantSlug)`, `WEBSITE_BUILDER.VERSIONS(tenantSlug)`, `WEBSITE_BUILDER.RESTORE(tenantSlug, versionId)` — `website-builder.service.ts`.

### `BranchContentOverrides` (website-builder.ts)
```
interface BranchContentOverrides { heroHeadline?: string; heroSubheadline?: string; heroImage?: string; description?: string; phone_number?: string; gallery?: string[]; about?: string }
```
Used for: `WEBSITE_BUILDER.BRANCH_OVERRIDES(tenantSlug, branchSlug)` request/response body.

### `TenantNavItemConfig` (website-builder.ts)
```
interface TenantNavItemConfig { key: string; enabled: boolean; order: number; label?: string }
```
Nested in `HomepageLayout.navItems`.

### `BrandThemeName`, `BrandThemeTokens`, `BrandThemeDef` (website-builder.ts)
```
type BrandThemeName = 'elegant' | 'modern' | 'luxury' | 'coffee' | 'street_food' | 'minimal' | 'dark' | 'fresh' | 'family' | 'premium'
interface BrandThemeTokens { primary: string; accent: string; bg: string; fg: string; card: string; fgMuted: string; fontFamily: string; borderRadius: string; cardShadow: string }
interface BrandThemeDef { name: BrandThemeName; label: string; description: string; tokens: BrandThemeTokens; darkModePreference: DarkModePreference }
```
Static theme catalog (`BRAND_THEMES` const) — client-only, not endpoint-bound; referenced from `HomepageLayout.brandTheme`.

### `HeroLayoutVariant`, `HeroBackgroundType`, `HeroPrimaryCtaType`, `HeroSecondaryCtaType`, `HeroConfig` (website-builder.ts)
```
type HeroLayoutVariant = 'hero_a' | 'hero_b' | 'hero_c' | 'hero_d' | 'hero_e'
type HeroBackgroundType = 'image' | 'video' | 'gradient' | 'solid'
type HeroPrimaryCtaType = 'reserve' | 'order_online' | 'view_menu' | 'contact' | 'directions'
type HeroSecondaryCtaType = 'promotions' | 'loyalty' | 'gallery' | 'reviews'
interface HeroConfig {
  layout: HeroLayoutVariant; backgroundType: HeroBackgroundType
  backgroundImage?: string; backgroundVideo?: string; backgroundGradient?: string; backgroundSolid?: string
  alignment: HeroAlignment; primaryCta?: HeroPrimaryCtaType; secondaryCta?: HeroSecondaryCtaType
}
```
Nested in `HomepageLayout.heroConfig`.

### `GalleryTemplate`, `ReviewsTemplate`, `ContactTemplate`, `AboutTemplate`, `SectionTemplates` (website-builder.ts)
```
type GalleryTemplate = 'grid' | 'slider' | 'masonry' | 'compact'
type ReviewsTemplate = 'cards' | 'carousel' | 'minimal' | 'compact'
type ContactTemplate = 'map_left' | 'map_right' | 'card' | 'minimal'
type AboutTemplate = 'story_left' | 'story_right' | 'wide' | 'compact'
interface SectionTemplates { gallery?: GalleryTemplate; reviews?: ReviewsTemplate; contact?: ContactTemplate; about?: AboutTemplate }
```
Nested in `HomepageLayout.sectionTemplates`.

---

## QR Experience

### `QRExperience` (qr-experience.ts)
```
interface QRExperience {
  experienceType: 'restaurant' | 'cafe' | 'bar' | 'food_court' | 'food_truck' | 'mobile_cafe'
  showMenu: boolean; showReservations: boolean; showReviews: boolean; showLoyalty: boolean
  showEvents: boolean; showVendors: boolean; showLocation: boolean; showPromotions: boolean
}
```
Used for: `qr-experience.service.ts` (no dedicated ENDPOINTS entry — resolved client-side from `Module.qrExperienceType` + tenant/branch context for the QR landing page).

---

## Realtime Operations

### `OperationsEventPriority`, `OperationsEventType`, `OrderLiveStatus`, `ReservationLiveStatus`, `StaffPresenceStatus`, `BranchHealthLevel`, `SLAAlertType` (realtime-operations.ts)
```
type OperationsEventPriority = 'low' | 'normal' | 'high' | 'critical'
type OperationsEventType =
  | 'LIVE_ORDER_CREATED' | 'LIVE_ORDER_UPDATED' | 'LIVE_ORDER_CANCELLED'
  | 'LIVE_RESERVATION_CREATED' | 'LIVE_RESERVATION_UPDATED' | 'LIVE_RESERVATION_CANCELLED' | 'LIVE_RESERVATION_CHECKED_IN'
  | 'STAFF_STATUS_CHANGED' | 'STAFF_PRESENCE_UPDATED'
  | 'BRANCH_STATUS_CHANGED' | 'BRANCH_HEALTH_UPDATED'
  | 'LIVE_NOTIFICATION' | 'LIVE_AUDIT_EVENT'
  | 'SLA_ALERT_RAISED' | 'SLA_ALERT_RESOLVED'
  | 'KITCHEN_QUEUE_UPDATED' | 'METRICS_UPDATED' | 'SYSTEM_ALERT'
type ReservationLiveStatus = 'upcoming' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
type StaffPresenceStatus = 'online' | 'busy' | 'break' | 'offline'
type BranchHealthLevel = 'healthy' | 'degraded' | 'critical' | 'offline'
type SLAAlertType = 'order_prep_exceeded' | 'order_delivery_exceeded' | 'reservation_wait_exceeded' | 'kitchen_queue_depth' | 'staff_shortage'
```

### `OperationsScope`, `OperationsEvent` (realtime-operations.ts)
```
interface OperationsScope { tenantId: string; branchId?: string }
interface OperationsEvent {
  id: string; type: OperationsEventType; priority: OperationsEventPriority
  scope: OperationsScope; sourceAuditAction?: AuditAction
  payload: Record<string, unknown>
  actor?: { id: string; name: string; roles: Role[] }
  occurredAt: string; processedAt?: string
}
```
Used for: WebSocket event stream payloads (`realtime-operations.service.ts`, `websocket.service.ts` channels).

### `LiveOrder` — see Order section.

### `LiveReservation` (realtime-operations.ts)
```
interface LiveReservation {
  id: string; guestName: string; partySize: number; status: ReservationLiveStatus
  tableId?: string; tableNumber?: string
  scheduledAt: string; checkedInAt?: string; completedAt?: string
  waitMinutes: number; notes?: string
  scope: OperationsScope; isOverdue: boolean
}
```
Used for: `reservations.broadcast` channel payload.

### `StaffPresence` (realtime-operations.ts)
```
interface StaffPresence {
  userId: string; name: string; role: Role; status: StaffPresenceStatus
  branchId: string; branchName: string; lastActivity: string
  activeOrderCount: number; shiftStartedAt?: string
}
```
Used for: `staff.broadcast` channel payload.

### `BranchStatus` (realtime-operations.ts — note: name collides with `branch.ts`'s `BranchStatus` string-literal type; different type entirely)
```
interface BranchStatus {
  branchId: string; branchName: string; health: BranchHealthLevel; tenantId: string
  isOpen: boolean; activeOrders: number; pendingReservations: number; staffOnline: number
  notificationCount: number; systemAlerts: string[]; lastUpdated: string
}
```
Used for: `branch.operations` channel payload (branch status board).

### `BranchHealth` (realtime-operations.ts)
```
interface BranchHealth { branchId: string; health: BranchHealthLevel; issues: string[]; score: number; lastChecked: string }
```
Used for: branch health check derivation, part of `BranchStatus` aggregation.

### `KitchenStatus` (realtime-operations.ts)
```
interface KitchenStatus {
  branchId: string; branchName: string
  pendingOrders: LiveOrder[]; preparingOrders: LiveOrder[]; readyOrders: LiveOrder[]; delayedOrders: LiveOrder[]; priorityOrders: LiveOrder[]
  averagePrepMinutes: number; queueDepth: number; capacityPercent: number; lastUpdated: string
}
```
Used for: kitchen display data, `KITCHEN_QUEUE_UPDATED` event payload.

### `SLAAlert` (realtime-operations.ts)
```
interface SLAAlert {
  id: string; type: SLAAlertType; priority: OperationsEventPriority; scope: OperationsScope
  entityId: string; entityType: 'order' | 'reservation' | 'branch' | 'staff'
  entityLabel: string; message: string
  thresholdMinutes: number; elapsedMinutes: number
  raisedAt: string; resolvedAt?: string; isActive: boolean
}
```
Used for: `SLA_ALERT_RAISED`/`SLA_ALERT_RESOLVED` event payload.

### `LiveMetric` (realtime-operations.ts)
```
interface LiveMetric { key: string; label: string; value: number; previousValue?: number; unit: string; trend: 'up' | 'down' | 'stable'; updatedAt: string; scope: OperationsScope }
```
Used for: `METRICS_UPDATED` event payload.

### `OperationsDashboard` (realtime-operations.ts)
```
interface OperationsDashboard {
  scope: OperationsScope
  liveOrders: LiveOrder[]; liveReservations: LiveReservation[]
  branchStatuses: BranchStatus[]; staffPresences: StaffPresence[]; kitchenStatuses: KitchenStatus[]
  slaAlerts: SLAAlert[]; recentEvents: OperationsEvent[]; metrics: LiveMetric[]
  lastUpdated: string
}
```
Used for: `realtime-operations.service.ts`'s aggregate dashboard fetch (no dedicated ENDPOINTS entry — composed from the mock arrays / WS stream in mock mode).

### `OperationsChannelName`, `OperationsStream` (realtime-operations.ts)
```
type OperationsChannelName = 'admin.operations' | 'branch.operations' | 'orders.broadcast' | 'reservations.broadcast' | 'staff.broadcast' | 'notifications.broadcast' | 'audit.broadcast'
interface OperationsStream {
  channel: OperationsChannelName; scope: OperationsScope
  connected: boolean; connectionStatus: ConnectionStatus
  events: OperationsEvent[]; lastEventAt?: string; reconnectCount: number
}
```
Used for: `websocket.service.ts`'s `OperationsChannelManager` per-channel state.

### `RealtimeConnectionState` (realtime-operations.ts)
```
interface RealtimeConnectionState { status: ConnectionStatus; reconnectCount: number; lastConnectedAt?: string; lastDisconnectedAt?: string; pingLatencyMs?: number; isHealthy: boolean }
```
Client connection state, mirrors `ConnectionHealth` (websocket.service.ts) — not endpoint-bound.

### `RealtimeStatistics` (realtime-operations.ts)
```
interface RealtimeStatistics {
  eventsPerMinute: number; totalEventsToday: number; activeConnections: number
  ordersProcessedToday: number; reservationsToday: number; averageOrderPrepMinutes: number
  slaCompliancePercent: number; activeStaff: number
  branchHealthSummary: { healthy: number; degraded: number; critical: number; offline: number }
  updatedAt: string; scope: OperationsScope
}
```
Used for: realtime dashboard stat panel (`realtime-operations.service.ts`).

### `RealtimeEventMap` (realtime-operations.ts)
```
interface RealtimeEventMap {
  'live_order': LiveOrder
  'live_reservation': LiveReservation
  'staff_presence': StaffPresence
  'branch_status': BranchStatus
  'sla_alert': SLAAlert
  'operations_event': OperationsEvent
  'metrics_update': LiveMetric[]
  'system_alert': { message: string; severity: 'info' | 'warning' | 'critical' }
}
```
Typed event-name → payload map for typed WS consumers; not endpoint-bound.

### WebSocket service inline types (websocket.service.ts)
```
type MessageHandler = (data: unknown) => void

interface WebSocketMessage { type: string; data: unknown }

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'disconnected'

interface BroadcastPayload { type: 'ws:status'; status: ConnectionStatus; channel: string }

interface WebSocketServiceOptions {
  channelName?: string
  wsFactory?: (url: string) => WebSocket
}

interface HeartbeatOptions { intervalMs?: number; timeoutMs?: number }

interface ConnectionHealth {
  status: ConnectionStatus; reconnectCount: number
  lastConnectedAt?: string; lastDisconnectedAt?: string
  pingLatencyMs?: number; isHealthy: boolean
}
```
All not endpoint-bound (pure WebSocket transport-layer types). `ConnectionStatus` is imported by `realtime-operations.ts` for `OperationsStream.connectionStatus` and `RealtimeConnectionState.status`.

---

## Provisioning

*(see also Tenant domain above — provisioning.ts types are cross-listed there since they're tightly tenant-coupled)*

All types in `provisioning.ts` documented under **Tenant** above: `ProvisionableBusinessType`, `TenantBrandingConfig`, `TenantProvisionRequest`, `TenantProvisionResult`, `TenantTemplate`, `TenantCapabilityPreset`.

---

## Ownership

*(cross-referenced above under **Ownership** domain heading — see full listing there: `Owner`, `BillingRef`, `StaffAssignment`, `StaffRole`, `OwnerStatus`, `StaffAssignmentMode`, `StaffAssignmentStatus`, `AuthSessionRbacPayload`, `GrantStaffAssignmentPayload`, `UpdateStaffAssignmentPayload`, `RevokeStaffAssignmentPayload`, `MoveStaffAssignmentPayload`, plus service-inline `OwnershipIdentity`, `AssignmentValidationResult`, `BackfillReport`, `BackfillResult`.)*

---

## Audit Log

### `AuditSeverity` (audit-log.ts)
```
type AuditSeverity = 'info' | 'warning' | 'critical'
```

### `AuditAction` (audit-log.ts)
```
type AuditAction =
  | 'STAFF_CREATED' | 'STAFF_UPDATED' | 'STAFF_SUSPENDED' | 'STAFF_REACTIVATED' | 'STAFF_REMOVED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'STAFF_INVITE_SENT' | 'STAFF_INVITE_CANCELLED' | 'STAFF_INVITE_RESENT' | 'INVITE_ACCEPTED'
  | 'BRANCH_CREATED' | 'BRANCH_UPDATED' | 'BRANCH_ACTIVATED' | 'BRANCH_DEACTIVATED'
  | 'BRANCH_MAINTENANCE_SET' | 'BRANCH_MANAGER_ASSIGNED'
  | 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED'
  | 'RESERVATION_CREATED' | 'RESERVATION_CONFIRMED' | 'RESERVATION_CANCELLED'
  | 'TENANT_ACTIVATED' | 'TENANT_SUSPENDED' | 'TENANT_ARCHIVED' | 'TENANT_PROVISIONED' | 'TENANT_CLONED'
  | 'PROMOTION_CREATED' | 'PROMOTION_UPDATED' | 'PROMOTION_DISABLED' | 'PROMOTION_ACTIVATED'
  | 'VENDOR_CREATED' | 'VENDOR_UPDATED' | 'VENDOR_DISABLED' | 'VENDOR_SETTLEMENT_CREATED'
  | 'MENU_ITEM_CREATED' | 'MENU_ITEM_UPDATED' | 'MENU_ITEM_DELETED'
  | 'LOYALTY_REWARD_CREATED' | 'LOYALTY_REWARD_UPDATED' | 'LOYALTY_REWARD_DISABLED'
  | 'LOYALTY_POINTS_EARNED' | 'LOYALTY_REWARD_REDEEMED'
  | 'PAYMENT_REFUNDED' | 'FEATURE_FLAG_CHANGED'
```
Used for: `AuditLog.action`, `AuditFilter.action`, `RbacAuditEvent`/`RichNotification.sourceAuditAction`, `OperationsEvent.sourceAuditAction`.

### `AuditTargetType` (audit-log.ts)
```
type AuditTargetType = 'staff' | 'branch' | 'order' | 'reservation' | 'tenant' | 'promotion' | 'vendor' | 'menu_item' | 'loyalty_reward' | 'payment' | 'feature_flag'
```

### `AuditActor`, `AuditTarget`, `AuditScope`, `AuditMetadata`, `AuditChangeSet` (audit-log.ts)
```
interface AuditActor { id: string; name: string; email?: string; roles: Role[] }
interface AuditTarget { type: AuditTargetType; id: string; displayName: string }
interface AuditScope { tenantId: string; branchId?: string }
interface AuditMetadata { correlationId?: string; ipAddress?: string; userAgent?: string; sessionId?: string }
interface AuditChangeSet { before: Record<string, unknown> | null; after: Record<string, unknown> | null; changedFields?: string[] }
```
Nested fields of `AuditLog`.

### `AuditLog` (audit-log.ts)
```
interface AuditLog {
  id: string; action: AuditAction; actor: AuditActor; target: AuditTarget
  scope: AuditScope; severity: AuditSeverity; changeset: AuditChangeSet; metadata: AuditMetadata
  timestamp: string; description: string
}
```
Used for: `audit-log.service.ts`'s primary record type (no dedicated ENDPOINTS entry — served entirely via the mock/API `USE_MOCK` pattern inside `audit-log.service.ts` directly against a base path, not through the shared `ENDPOINTS` map).

### `AuditFilter` (audit-log.ts)
```
interface AuditFilter {
  tenantId?: string; branchId?: string; actorId?: string
  targetType?: AuditTargetType; action?: AuditAction; severity?: AuditSeverity
  search?: string; dateFrom?: string; dateTo?: string
  page?: number; pageSize?: number
  sortBy?: 'timestamp' | 'severity' | 'action'; sortOrder?: 'asc' | 'desc'
}
```
Query-param DTO for audit log listing/export.

### `AuditExportRequest` (audit-log.ts)
```
interface AuditExportRequest { filter: AuditFilter; format: 'csv' | 'excel'; includeChangeset: boolean }
```
Request body for audit log export.

### `AuditTimelineItem`, `AuditStatistics`, `PaginatedAuditLogs` (audit-log.ts)
```
interface AuditTimelineItem { date: string; events: AuditLog[] }
interface AuditStatistics {
  totalEvents: number
  eventsPerDay: Record<string, number>; eventsPerActor: Record<string, number>
  eventsPerBranch: Record<string, number>; eventsPerDomain: Record<string, number>
  criticalEvents: number; warningEvents: number; infoEvents: number
  topActions: Array<{ action: AuditAction; count: number }>
  dateFrom: string; dateTo: string
}
interface PaginatedAuditLogs { results: AuditLog[]; count: number; page: number; pageSize: number; totalPages: number }
```
Response shapes for timeline/statistics/paginated-list views in `audit-log.service.ts`.

*(Note: `audit-event-registry.ts` also exists in `src/services/` but was out of the requested scope of "*.service.ts" DTO scan for this pass — it's a registry/lookup module, not a service with axios calls; flagged for completeness.)*

---

## Marketplace

### `PublicBranchInfo` (marketplace.ts)
```
interface PublicBranchInfo {
  slug: string; name: string; address: string; city: string
  phone_number?: string; openNow: boolean; todayHours?: string; image?: string
}
```
Nested in `MarketplaceMeta.branches`.

### `MarketplaceMeta` (marketplace.ts)
```
interface MarketplaceMeta {
  description: string; coverImage: string
  cuisines: string[]; tags: string[]
  rating: number; reviewCount: number
  city: string; branchCount: number; openNow: boolean
  primaryBranchSlug: string
  featured?: boolean; popular?: boolean; isNew?: boolean
  branches?: PublicBranchInfo[]
  tagline?: string
  priceLevel?: 1 | 2 | 3 | 4
  phone_number?: string; email?: string; website?: string
  gallery?: string[]; story?: string; amenities?: string[]
  socialLinks?: { instagram?: string; twitter?: string; facebook?: string; youtube?: string }
  heroImage?: string
}
```
Stored inside `Tenant.settings.marketplace`; read via `TENANTS.SETTINGS(slug)` / `TENANTS.DETAIL(slug)` responses, consumed by the public `/discover` marketplace page. Not a standalone endpoint — a nested settings blob.

### `SortOption` (marketplace.ts)
```
type SortOption = 'recommended' | 'highest_rated' | 'most_reviewed' | 'newest' | 'alphabetical' | 'price_asc' | 'open_now'
```

### `FilterState` (marketplace.ts) + `DEFAULT_FILTERS` const
```
interface FilterState { cuisines: string[]; cities: string[]; priceLevels: number[]; openNow: boolean; services: string[]; amenities: string[] }
```
Client-side discovery-page filter state — not endpoint-bound (applied to `TENANTS.LIST` results in-memory via `matchesFilters()`).

### Related consts (not types, noted for completeness)
`BUSINESS_TYPE_LABELS: Record<string, string>`, `PRICE_LEVEL_LABELS: Record<number, string>` — static label maps.

---

## Cross-cutting / Pagination & Errors

### `PaginatedResponse<T>` (index.ts)
```
interface PaginatedResponse<T> { count: number; next: string | null; previous: string | null; results: T[] }
```
Generic wrapper used by: `ORDERS.LIST`, `RESERVATIONS.LIST`, `NOTIFICATIONS.LIST`, `ADMIN.ORDERS`, `ADMIN.RESERVATIONS`, `ADMIN.CUSTOMERS` and others across `order.service.ts`, `combined.service.ts`, `admin.service.ts`.

### `ApiError` (index.ts)
```
interface ApiError { message: string; code?: string; errors?: Record<string, string[]> }
```
Standard error-response shape used by `axios.instance.ts` error interceptors.

### `Address` (index.ts)
```
interface Address { id: string; label: string; street: string; city: string; state?: string; zip?: string; lat?: number; lng?: number; is_default: boolean }
```
Used for: `USERS.ADDRESSES`, `USERS.ADDRESS(id)` responses.

### `Reservation`, `ReservationStatus` (index.ts)
```
type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
interface Reservation {
  id: string; user?: User; branch_id: string; branch?: Branch
  date: string; time: string; guests: number; notes?: string
  name: string; phone_number: string; email?: string
  status: ReservationStatus; confirmation_code?: string; created_at: string
}
```
Used for: `RESERVATIONS.LIST`, `RESERVATIONS.CREATE`, `RESERVATIONS.DETAIL(id)`, `RESERVATIONS.CANCEL(id)`, `RESERVATIONS.CONFIRM(id)` responses (`combined.service.ts`'s `reservationService`).

### `CreateReservationPayload` (combined.service.ts, inline)
```
interface CreateReservationPayload {
  branch_id: string; date: string; time: string; guests: number
  name: string; phone_number: string; email?: string; notes?: string
}
```
Used for: `RESERVATIONS.CREATE` request body.

---

## Platform Customer / CRM (P8.9.6 / P8.9.7) — cross-cutting, index.ts

These support the Customer 360 CRM console and don't map 1:1 onto a single domain heading above; included here for completeness since they're real, non-mock-only types.

### `PlatformUser`
```
interface PlatformUser { id: string; phone_number: string; name: string; avatar?: string; email?: string; language?: string; createdAt: string; status: 'active' | 'inactive' | 'suspended' }
```

### `BusinessCustomer`
```
interface BusinessCustomer {
  id: string; userId: string; tenantId: string
  firstInteractionAt: string; lastInteractionAt: string
  ordersCount: number; reservationsCount: number; totalSpent: number
  favorite: boolean; lifetimeValue: number; lastBranchId?: string
  loyaltyPoints: number; loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum'
  status: 'active' | 'inactive'
}
```

### `BranchCustomer`
```
interface BranchCustomer {
  id: string; businessCustomerId: string; branchId: string
  ordersCount: number; reservationsCount: number; visits: number
  favoriteBranch: boolean; lastVisit?: string; lastOrder?: string
}
```

### `CustomerTimelineEventType`, `CustomerTimelineEvent`
```
type CustomerTimelineEventType =
  | 'account_created' | 'first_visit'
  | 'order_placed' | 'order_completed' | 'order_cancelled' | 'order_refunded'
  | 'reservation_made' | 'reservation_confirmed' | 'reservation_completed' | 'reservation_cancelled' | 'reservation_no_show'
  | 'points_earned' | 'points_redeemed' | 'reward_redeemed' | 'tier_upgraded' | 'tier_downgraded'
  | 'coupon_received' | 'coupon_redeemed' | 'review_posted'
  | 'payment_completed' | 'refund_issued'
  | 'admin_note' | 'tag_added' | 'tag_removed'
  | 'marketing_email' | 'marketing_sms'
  | 'profile_updated' | 'phone_verified' | 'birthday'

interface CustomerTimelineEvent {
  id: string; userId: string; tenantId: string; type: CustomerTimelineEventType
  title: string; description?: string; amount?: number; points?: number
  branchId?: string; referenceId?: string
  referenceType?: 'order' | 'reservation' | 'review' | 'coupon' | 'reward' | 'note'
  actorId?: string; actorName?: string
  metadata?: Record<string, unknown>; createdAt: string
}
```

### `CustomerNote`
```
interface CustomerNote { id: string; userId: string; tenantId: string; content: string; authorId: string; authorName: string; createdAt: string; updatedAt: string }
```

### `CustomerTagColor`, `CustomerTag`, `CustomerTagAssignment`
```
type CustomerTagColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange'
interface CustomerTag { id: string; tenantId: string; label: string; color: CustomerTagColor; createdAt: string }
interface CustomerTagAssignment { userId: string; tenantId: string; tags: CustomerTag[] }
```

### `MarketingChannel`, `CustomerMarketingPreference`, `CustomerMarketingCampaign`, `CustomerMarketing`
```
type MarketingChannel = 'email' | 'sms' | 'push' | 'whatsapp'
interface CustomerMarketingPreference { channel: MarketingChannel; subscribed: boolean; subscribedAt?: string; unsubscribedAt?: string }
interface CustomerMarketingCampaign { id: string; name: string; channel: MarketingChannel; sentAt: string; opened: boolean; openedAt?: string; clicked: boolean; clickedAt?: string }
interface CustomerMarketing { userId: string; tenantId: string; preferences: CustomerMarketingPreference[]; campaigns: CustomerMarketingCampaign[]; couponsReceived: number; couponsRedeemed: number; lastCampaignAt?: string }
```

### `CustomerCoupon`
```
interface CustomerCoupon {
  id: string; userId: string; tenantId: string; code: string; description: string
  discountType: 'percent' | 'fixed'; discountValue: number; minOrderAmount?: number
  status: 'available' | 'redeemed' | 'expired'; redeemedAt?: string; expiresAt?: string; createdAt: string
}
```

All of the above CRM types have no dedicated `ENDPOINTS` entries — they are composed/aggregated client-side within `admin.service.ts`'s customer-detail views (built on `ADMIN.CUSTOMER_DETAIL(id)` / `ADMIN.CUSTOMER_STATS(id)`), no direct 1:1 endpoint mapping found in `endpoints.ts`.

---

## index.ts re-export coverage gaps

`src/types/index.ts` re-exports only a subset of the sibling type-module contents:
- From `rbac.ts`: only `Role, P7Permission, UserTenantRole, TenantRoleAssignment, PermissionCheckOptions, AuditEvent, MockRbacUser` — **NOT re-exported**: `UserPermissionOverride, EffectivePermissionResult, RoleTemplate, CustomRoleTemplate, PermissionDependency, RbacAuditEvent, SimulationResult, DependencyValidationResult`.
- From `branch.ts`: re-exports most fields, but under an aliased name `Branch as BranchEntity` (to avoid clashing with index.ts's own `Branch`/`Location` alias).
- From `branch-routing.ts`: full re-export (all 5 types).
- From `analytics.ts`: only the 3 branch-scoped analytics types (`BranchRevenueAnalytics, BranchOrderAnalytics, BranchReservationAnalytics`) — **NOT re-exported**: `TimeSeries, AnalyticsSummary, RevenueAnalytics, ReservationAnalytics, LoyaltyAnalytics, PromotionAnalytics, VendorAnalytics, MenuItemPerformance, MenuCategoryPerformance, MenuAnalytics`.
- From `audit-log.ts`: full re-export (all types).
- **No re-export at all** from: `business-review.ts`, `marketplace.ts`, `notification.ts` (has its own duplicate `Notification`/`NotificationType` defined natively in index.ts instead), `ownership.ts`, `provisioning.ts`, `qr-experience.ts`, `realtime-operations.ts`, `staff.ts`, `website-builder.ts`. Consumers of these must import directly from `@/types/<module>`, not from `@/types`.

---

## Summary

- **Type modules read in full**: 14/14 in `src/types/` plus `index.ts` (15 files).
- **Service files scanned for inline DTOs**: all 35 `*.service.ts` files in `src/services/` (none excluded as mock-only — every file follows the USE_MOCK pattern with a real axios branch, or is a pure client-side derivation service with no network calls at all).
- Approximate count of distinct named interfaces/types/enums documented: **180+** across 22 domain groupings.
