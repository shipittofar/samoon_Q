# Backend Types Reference

> Complete TypeScript → Backend model mapping.
> All types sourced from `src/types/index.ts` and domain-specific type files unless noted.
> Use this to implement Django serializers, Pydantic models, or OpenAPI schemas.
>
> Last updated: 2026-06-25 (added P7.x types: analytics, realtime operations, RBAC, staff, audit logs)

---

## User

**Source:** `src/types/index.ts:8`  
**Django Model:** `auth.User` (extended)

```typescript
interface User {
  id: string               // UUID or string PK
  email: string            // Unique, required
  phone_number?: string           // Optional E.164 format
  first_name: string       // Required
  last_name: string        // Required
  avatar?: string          // URL to avatar image
  role: UserRole           // 'customer' | 'staff' | 'admin'
  is_verified: boolean     // Email verification status
  created_at: string       // ISO 8601 timestamp
}

type UserRole = 'customer' | 'staff' | 'admin'
```

**Backend Requirements:**
- `role` must be a persisted field — RBAC checks happen server-side too
- `is_verified` toggled by email verification flow
- `avatar` is a URL (not base64); store in object storage, return CDN URL
- `id` must be stable across sessions (UUID recommended)

---

## AuthTokens

**Source:** `src/types/index.ts:23`

```typescript
interface AuthTokens {
  access: string    // JWT access token (short-lived)
  refresh: string   // JWT refresh token (long-lived)
}
```

---

## RegisterData

**Source:** `src/types/index.ts:30`

```typescript
interface RegisterData {
  email: string
  phone_number?: string
  password: string
  confirm_password: string
  first_name: string
  last_name: string
}
```

**Backend:** Validate `password === confirm_password`, then discard `confirm_password` before storing.

---

## OTPVerifyData

**Source:** `src/types/index.ts:39`

```typescript
interface OTPVerifyData {
  phone_number: string   // E.164 format
  otp: string     // Numeric OTP string
}
```

---

## Category

**Source:** `src/types/index.ts:47`  
**Django Model:** `menu.Category`

```typescript
interface Category {
  id: string
  name: string
  slug: string         // URL-safe, auto-generated from name
  description?: string
  image?: string       // CDN URL
  icon?: string        // Icon name (maps to lucide-react in frontend)
  order: number        // Display ordering weight (lower = first)
  items_count?: number // Computed field: count of available menu items
}
```

---

## Extra (MenuItem add-on)

**Source:** `src/types/index.ts:58`  
**Django Model:** `menu.Extra`

```typescript
interface Extra {
  id: string
  name: string
  price: number     // Positive decimal
  available: boolean
}
```

---

## NutritionalInfo

**Source:** `src/types/index.ts:91`  
**Django Model:** `menu.NutritionalInfo` (or JSONField on MenuItem)

```typescript
interface NutritionalInfo {
  calories: number   // kcal
  protein: number    // grams
  carbs: number      // grams
  fat: number        // grams
  fiber?: number     // grams
}
```

---

## MenuItem

**Source:** `src/types/index.ts:65`  
**Django Model:** `menu.MenuItem`

```typescript
interface MenuItem {
  id: string
  category_id: string       // FK to Category.id
  category?: Category       // Nested (read only, optional expansion)
  name: string
  slug: string              // Auto-generated, unique
  description: string
  price: number             // Decimal, positive
  discount?: number         // Percentage (0–100)
  discounted_price?: number // Computed: price * (1 - discount/100)
  image: string             // CDN URL, required
  images?: string[]         // Additional CDN URLs
  calories?: number         // kcal
  preparation_time: number  // Minutes
  rating: number            // Aggregate average (0.0–5.0), computed
  rating_count: number      // Count of reviews, computed
  available: boolean        // Soft availability toggle
  is_featured?: boolean
  is_new?: boolean
  is_popular?: boolean
  tags?: string[]
  extras?: Extra[]
  allergens?: string[]      // e.g. ['gluten', 'dairy', 'nuts']
  nutritional_info?: NutritionalInfo
}
```

**Computed fields (backend responsibility):** `rating`, `rating_count`, `discounted_price`, `items_count` on Category.

---

## TableInfo

**Source:** `src/types/index.ts:99`  
**Django Model:** `tables.Table`

```typescript
interface TableInfo {
  id: string
  number: number                                    // Table number (displayed to staff)
  capacity?: number                                 // Max seated guests
  section?: string                                  // e.g. 'Garden', 'Rooftop'
  server_name?: string                              // Assigned server
  status?: 'available' | 'occupied' | 'reserved'
}
```

---

## Cart / CartItem

**Source:** `src/types/index.ts:111`  
**Note:** Cart state is managed client-side (Zustand store). Backend does not need to persist cart. These types describe the checkout payload shape.

```typescript
interface CartItem {
  id: string
  menu_item: MenuItem   // Full nested object
  quantity: number      // Positive integer
  notes?: string        // Per-item instructions
  extras: Extra[]       // Selected add-ons
  unit_price: number    // Price at time of adding (snapshot)
  total_price: number   // unit_price × quantity
}

interface Cart {
  items: CartItem[]
  subtotal: number
  discount_amount: number
  tax: number            // subtotal × 0.09
  service_charge: number // subtotal × 0.05
  total: number
  discount_code?: string
}
```

---

## OrderStatus / OrderType / PaymentMethod / PaymentStatus

**Source:** `src/types/index.ts:134`

```typescript
type OrderStatus   = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
type OrderType     = 'delivery' | 'pickup' | 'dine_in'
type PaymentMethod = 'card' | 'cash' | 'online' | 'wallet'
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
```

---

## OrderItem

**Source:** `src/types/index.ts:148`  
**Django Model:** `orders.OrderItem`

```typescript
interface OrderItem {
  id: string
  menu_item: MenuItem   // Snapshot of item at time of order
  quantity: number
  unit_price: number    // Price at order time (immutable after creation)
  total_price: number   // unit_price × quantity
  notes?: string
  extras: Extra[]
  image: string         // Snapshot of item image
  name: string          // Snapshot of item name
}
```

**Note:** `name` and `image` are snapshots — they must be copied at order creation time so menu edits don't affect historical orders.

---

## DeliveryAddress

**Source:** `src/types/index.ts:160`  
**Django Model:** JSONField on `orders.Order`

```typescript
interface DeliveryAddress {
  street: string
  city: string
  state?: string
  zip?: string
  lat?: number
  lng?: number
}
```

---

## Order

**Source:** `src/types/index.ts:169`  
**Django Model:** `orders.Order`

```typescript
interface Order {
  id: string
  order_number: string       // Human-readable, e.g. 'SAV-3902' (unique)
  user?: User                // Nullable for anonymous/guest orders
  branch_id: string          // FK to Branch.id
  branch?: Branch            // Nested (optional expansion)
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
  notes?: string             // Order-level instructions
  estimated_time?: number    // Minutes until ready
  created_at: string         // ISO 8601
  updated_at: string         // ISO 8601
  status_history: OrderStatusHistory[]
}

interface OrderStatusHistory {
  status: OrderStatus
  timestamp: string   // ISO 8601
  note?: string       // Optional admin note
}
```

---

## ReservationStatus / Reservation

**Source:** `src/types/index.ts:204`  
**Django Model:** `reservations.Reservation`

```typescript
type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

interface Reservation {
  id: string
  user?: User               // Nullable for anonymous bookings
  branch_id: string         // FK to Branch.id
  branch?: Branch           // Nested (optional expansion)
  date: string              // ISO date: 'YYYY-MM-DD'
  time: string              // 'HH:MM' (24-hour)
  guests: number            // Positive integer
  notes?: string
  name: string              // Guest name
  phone_number: string             // Guest phone_number
  email?: string            // Guest email
  status: ReservationStatus
  confirmation_code?: string // e.g. 'SAV-4521' (set on confirm)
  created_at: string
}
```

---

## WorkingHours / LocationType / Location (Branch)

**Source:** `src/types/index.ts:314`  
**Django Model:** `branches.Branch` (or `locations.Location`)

```typescript
interface WorkingHours {
  day: string        // e.g. 'Monday', 'Tuesday', ... 'Sunday'
  open: string       // 'HH:MM' (24-hour)
  close: string      // 'HH:MM' (24-hour)
  is_closed: boolean // Override: closed all day despite open/close times
}

type LocationType =
  | 'restaurant_branch'
  | 'cafe'
  | 'bar'
  | 'hotel_property'
  | 'food_court_stall'
  | 'mobile_truck'

interface Location {
  id: string
  tenant_id?: string         // FK to Tenant.id (for multi-tenant)
  name: string
  slug: string
  type?: LocationType
  address: string
  city: string
  phone_number: string
  email?: string
  lat: number
  lng: number
  working_hours: WorkingHours[]
  is_active: boolean
  delivery_radius?: number   // km
  images?: string[]          // CDN URLs
  is_mobile?: boolean        // true when type === 'mobile_truck'
  mobile_schedule?: string   // Free text schedule for mobile units
}

type Branch = Location       // Alias — fully interchangeable
```

---

## Tenant / TenantTheme

**Source:** `src/types/index.ts:286`  
**Django Model:** `tenants.Tenant`

```typescript
type TenantStatus = 'active' | 'trial' | 'suspended' | 'churned'

interface Tenant {
  id: string
  name: string
  slug: string             // Subdomain slug, URL-safe, unique
  businessTypes: string[]  // Module keys: currently ['restaurant']
  status: TenantStatus
  createdAt: string        // ISO 8601 (camelCase — note frontend expects this)
  settings?: {
    theme?: TenantTheme
    featureFlags?: Record<string, boolean>
    [key: string]: unknown
  }
}

interface TenantTheme {
  primaryColor?: string      // CSS color, e.g. '#3b82f6'
  accentHoverColor?: string  // CSS color for hover state
  logoUrl?: string           // CDN URL
  fontBody?: string          // CSS font-family string
}
```

**Important:** `createdAt` uses camelCase (not `created_at`) — this is the frontend type as defined. Backend should serialize this field as `createdAt`.

---

## Notification

**Source:** `src/types/index.ts:405`  
**Django Model:** `notifications.Notification`

```typescript
type NotificationType = 'order_update' | 'reservation_update' | 'promotion' | 'system'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>  // Arbitrary payload (e.g. { order_id: 'ord-001' })
  is_read: boolean
  created_at: string
}
```

---

## PaginatedResponse

**Source:** `src/types/index.ts:418`

```typescript
interface PaginatedResponse<T> {
  count: number           // Total item count (all pages)
  next: string | null     // Full next-page URL or null
  previous: string | null // Full previous-page URL or null
  results: T[]            // Current page items
}
```

---

## ApiError

**Source:** `src/types/index.ts:425`

```typescript
interface ApiError {
  message: string
  code?: string
  errors?: Record<string, string[]>   // Field-level validation errors
}
```

---

## Review

**Source:** `src/types/index.ts:434`  
**Django Model:** `reviews.Review`

```typescript
interface Review {
  id: string
  user: User
  menu_item_id?: string    // FK — can review an item
  order_id?: string        // FK — linked to a completed order
  rating: number           // Integer 1–5
  comment?: string
  created_at: string
}
```

---

## Address

**Source:** `src/types/index.ts:447`  
**Django Model:** `users.UserAddress`

```typescript
interface Address {
  id: string
  label: string       // User-defined label: 'Home', 'Work', etc.
  street: string
  city: string
  state?: string
  zip?: string
  lat?: number
  lng?: number
  is_default: boolean // One address per user can be default
}
```

---

## Permission (RBAC)

**Source:** `src/types/index.ts:470`

```typescript
type Permission =
  | 'orders:read'
  | 'orders:write'
  | 'orders:cancel'
  | 'orders:manage'
  | 'menu:read'
  | 'menu:write'
  | 'menu:manage'
  | 'reservations:read'
  | 'reservations:write'
  | 'reservations:manage'
  | 'users:read'
  | 'users:manage'
  | 'dashboard:access'
  | 'branches:read'
  | 'branches:manage'
  | 'notifications:read'
```

**Role → Permission mapping:**

| Role | Permissions |
|------|------------|
| `customer` | `orders:read`, `orders:write`, `orders:cancel`, `menu:read`, `reservations:read`, `reservations:write`, `users:read`, `branches:read`, `notifications:read` |
| `staff` | All customer permissions + `orders:manage`, `menu:write`, `reservations:manage`, `dashboard:access` |
| `admin` | All staff permissions + `menu:manage`, `users:manage`, `branches:manage` |

---

## Admin Types

### AdminCustomerTier / AdminCustomer

**Source:** `src/types/index.ts:518`  
**Django Model:** Annotated on `auth.User` queryset

```typescript
type AdminCustomerTier = 'new' | 'regular' | 'vip'

interface AdminCustomer extends User {
  order_count: number       // Lifetime order count
  total_spent: number       // Lifetime total spend (currency float)
  avg_order_value: number   // total_spent / order_count (or 0)
  tier: AdminCustomerTier   // Computed server-side
  last_order_at?: string    // ISO timestamp of most recent order
}
```

**Tier computation:**
```python
def get_tier(order_count):
    if order_count < 5:
        return 'new'
    elif order_count < 15:
        return 'regular'
    else:
        return 'vip'
```

---

### AdminCustomerStats

**Source:** `src/types/index.ts:530`

```typescript
interface AdminCustomerStats {
  customer_id: string       // Matches the {id} path param
  order_count: number
  total_spent: number
  avg_order_value: number
  favorite_item?: string    // Name string (not ID) of most-ordered item
  last_order_at?: string
}
```

---

### AdminTopItem

**Source:** `src/types/index.ts:539`

```typescript
interface AdminTopItem {
  menu_item_id: string
  name: string          // Item name snapshot
  order_count: number   // Total orders in period
  revenue: number       // Total revenue in period
  trend_pct: number     // % change vs previous period (negative = decline)
}
```

---

### AdminStats

**Source:** `src/types/index.ts:549`

```typescript
interface AdminStats {
  period_days: number              // Window for change calculations (default 30)
  total_revenue: number
  revenue_change_pct: number
  total_orders: number
  orders_change_pct: number
  new_customers: number
  customers_change_pct: number
  total_reservations: number
  reservations_change_pct: number
  top_items: AdminTopItem[]        // Top 5 by order count
  orders_in_queue: number          // Current pending+accepted orders
  avg_prep_time_minutes: number    // Rolling average
  tables_reserved: number          // Active reservations today
  tables_total: number             // Total table count (all branches)
}
```

---

### AdminOrderFilters

**Source:** `src/types/index.ts:567`

```typescript
interface AdminOrderFilters {
  status?: OrderStatus
  order_type?: OrderType
  search?: string    // Matches order_number or user first_name
  page?: number
  page_size?: number
}
```

---

### AdminReservationFilters

**Source:** `src/types/index.ts:574`

```typescript
interface AdminReservationFilters {
  status?: ReservationStatus
  branch_id?: string
  date?: string       // ISO date: 'YYYY-MM-DD'
  search?: string     // Matches name or phone_number
  page?: number
  page_size?: number
}
```

---

### AdminCustomerFilters

**Source:** `src/types/index.ts:586`

```typescript
interface AdminCustomerFilters {
  tier?: AdminCustomerTier
  search?: string     // Matches first_name, last_name, or email (case-insensitive)
  page?: number
  page_size?: number
}
```

---

## MenuFilters

**Source:** `src/services/menu.service.ts`

```typescript
interface MenuFilters {
  category?: string
  search?: string
  min_price?: number
  max_price?: number
  min_rating?: number
  available?: boolean
  sort?: string        // e.g. 'price', '-rating', 'name'
  page?: number
  page_size?: number
}
```

---

## CreateOrderPayload

**Source:** `src/services/order.service.ts`

```typescript
interface CreateOrderPayload {
  branch_id: string
  items: Array<{
    menu_item_id: string
    quantity: number
    notes?: string
    extras: string[]   // Extra IDs
  }>
  order_type: OrderType
  payment_method: PaymentMethod
  delivery_address?: DeliveryAddress
  table_number?: number
  discount_code?: string
  notes?: string
}
```

---

## CreateReservationPayload

**Source:** `src/services/combined.service.ts`

```typescript
interface CreateReservationPayload {
  branch_id: string
  date: string     // ISO date: 'YYYY-MM-DD'
  time: string     // 'HH:MM' (24-hour)
  guests: number
  name: string
  phone_number: string
  email?: string
  notes?: string
}
```

---

## CreatePaymentIntentPayload

**Source:** `src/services/payment.service.ts`

```typescript
interface CreatePaymentIntentPayload {
  amount: number           // In cents (e.g. 4560 = $45.60)
  currency?: string        // ISO 4217, default 'usd'
  order_description?: string
  branch_id?: string
}
```

---

## CreateReviewPayload

**Source:** `src/services/review.service.ts`

```typescript
interface CreateReviewPayload {
  menu_item_id: string
  rating: number      // 1–5
  comment?: string
  order_id?: string
}
```

---

## SystemReadiness (Frontend only)

**Source:** `src/types/index.ts:266`  
**Note:** This is a frontend runtime type — the backend does not need to implement this. It is derived client-side from tenant bootstrap state.

```typescript
interface SystemReadiness {
  isLoading: boolean
  isReady: boolean
  isFallback: boolean
  canExecute: boolean
}
```

---

## WebSocket Message Shapes

### Order Status Update

```typescript
interface OrderStatusUpdateMessage {
  type: 'order.status_update'
  data: {
    status: OrderStatus
    estimated_time?: number   // Minutes
  }
}
```

### Notification Push

```typescript
interface NotificationPushMessage {
  type: 'notification.new'
  data: Notification
}
```

### Connection Lifecycle

```typescript
type WSLifecycleMessage = 
  | { type: 'connected'; data: null }
  | { type: 'disconnected'; data: null }
  | { type: 'error'; data: { message: string } }
```

---

## Analytics Types

> Source: `src/types/analytics.ts` (added P7.13)

### MenuAnalytics

```typescript
interface MenuItemPerformance {
  itemId: string
  name: string
  orders: number
  revenue: number
  trend: number          // % change vs previous period
}

interface MenuCategoryPerformance {
  categoryId: string
  name: string
  orders: number
  revenue: number
  percentage: number     // % of total revenue
}

interface MenuAnalytics {
  period: '7d' | '30d' | '90d'
  topItems: MenuItemPerformance[]
  categoryBreakdown: MenuCategoryPerformance[]
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  comparisonPeriod: {
    totalRevenue: number
    totalOrders: number
    revenueChange: number    // % change (positive = growth)
    ordersChange: number
  }
}
```

### RevenueAnalytics

```typescript
interface RevenueAnalytics {
  period: '7d' | '30d' | '90d'
  groupBy: 'day' | 'week' | 'month'
  data: Array<{ date: string; revenue: number; orders: number; averageOrder: number }>
  total: number
  averagePerPeriod: number
  growth: number          // % change vs previous period
}
```

### AnalyticsSummary

```typescript
interface AnalyticsSummary {
  today: { revenue: number; orders: number; avgOrderValue: number }
  thisWeek: { revenue: number; orders: number; avgOrderValue: number }
  thisMonth: { revenue: number; orders: number; avgOrderValue: number }
  topItemToday: { itemId: string; name: string; orders: number } | null
}
```

---

## Realtime Operations Types

> Source: `src/types/realtime-operations.ts` (added P7.7–P7.8)

### LiveOrder

```typescript
interface LiveOrderItem {
  id: string
  name: string
  quantity: number
  notes?: string
}

interface LiveOrder {
  id: string
  orderNumber: string
  tableNumber?: string
  items: LiveOrderItem[]
  status: 'pending' | 'accepted' | 'preparing' | 'ready'
  estimatedPrepMinutes: number
  preparingAt?: string     // ISO timestamp when status became 'preparing'
  slaBreached: boolean
  isPriority: boolean
}
```

### KitchenStatus

```typescript
interface KitchenStatus {
  pendingOrders: LiveOrder[]
  preparingOrders: LiveOrder[]
  readyOrders: LiveOrder[]
  delayedOrders: LiveOrder[]      // Orders that have breached SLA
  priorityOrders: LiveOrder[]     // Orders flagged for priority handling
  averagePrepMinutes: number
  queueDepth: number
  capacityPercent: number         // 0–100, > 80 triggers warning UI
}
```

---

## RBAC Types

> Source: `src/types/rbac.ts` (added P1B + P7)

### P7Permission

Dot-notation permission strings used by `PermissionGuard` and `useRbacStore`:

```typescript
type P7Permission =
  | 'orders.view' | 'orders.manage'
  | 'reservations.view' | 'reservations.manage'
  | 'customers.view' | 'customers.manage' | 'customers.export'
  | 'menu.view' | 'menu.manage'
  | 'analytics.view'
  | 'staff.view' | 'staff.manage'
  | 'branches.view' | 'branches.manage'
  | 'tenants.view' | 'tenants.manage'
  | 'audit_logs.view'
  | 'kitchen.view'
  | 'operations.view'
  | 'notifications.view' | 'notifications.manage'
  | 'settings.view' | 'settings.manage'
  | 'loyalty.view' | 'loyalty.manage'
  | 'promotions.view' | 'promotions.manage'
  | 'vendors.view' | 'vendors.manage'
```

### RbacPolicy

```typescript
interface RbacPolicy {
  role: 'super_admin' | 'tenant_admin' | 'branch_manager' | 'staff' | 'customer'
  permissions: P7Permission[]
  tenantId?: string
  branchId?: string
}
```

---

## Staff Types

> Source: `src/types/staff.ts` (added P7.2)

```typescript
interface StaffMember {
  id: string
  userId: string
  firstName: string
  lastName: string
  email: string
  phone_number?: string
  role: 'branch_manager' | 'chef' | 'waiter' | 'cashier' | 'delivery'
  branchId: string
  tenantId: string
  isActive: boolean
  hiredAt: string
  avatar?: string
}

interface Shift {
  id: string
  staffId: string
  branchId: string
  startTime: string    // ISO datetime
  endTime: string      // ISO datetime
  role: StaffMember['role']
  status: 'scheduled' | 'active' | 'completed' | 'missed'
}
```

---

## Audit Log Types

> Source: `src/types/audit-log.ts` (added P7.5)

```typescript
type AuditEventType =
  | 'order.created' | 'order.status_changed' | 'order.cancelled'
  | 'reservation.created' | 'reservation.confirmed' | 'reservation.cancelled'
  | 'menu.item_created' | 'menu.item_updated' | 'menu.item_deleted'
  | 'user.login' | 'user.logout' | 'user.role_changed'
  | 'staff.created' | 'staff.deactivated'
  | 'settings.feature_flag_toggled'
  | 'tenant.provisioned'

interface AuditLog {
  id: string
  eventType: AuditEventType
  actorId: string
  actorEmail: string
  entityType: 'order' | 'reservation' | 'menu_item' | 'user' | 'staff' | 'tenant' | 'settings'
  entityId: string
  changes: Record<string, { before: unknown; after: unknown }>
  tenantId: string
  branchId?: string
  ipAddress?: string
  createdAt: string
}
```

---

## WebSocket Message Types (updated P7.7)

### Kitchen Update

```typescript
interface KitchenUpdateMessage {
  type: 'kitchen.status_update'
  data: KitchenStatus
}
```

### SLA Breach Alert

```typescript
interface SLABreachMessage {
  type: 'kitchen.sla_breach'
  data: {
    orderId: string
    orderNumber: string
    breachedAt: string
    minutesOverdue: number
  }
}
```

