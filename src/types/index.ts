// ============================================================
// AUTH TYPES
// ============================================================

/** Role assigned to an authenticated user. Matches the backend auth model. */
export type UserRole = 'customer' | 'staff' | 'admin'

export interface User {
  id: string
  email: string
  phone?: string
  first_name: string
  last_name: string
  avatar?: string
  role: UserRole
  is_verified: boolean
  created_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  phone?: string
  password: string
  confirm_password: string
  first_name: string
  last_name: string
}

export interface OTPVerifyData {
  phone: string
  otp: string
}

// ============================================================
// MENU TYPES
// ============================================================
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  icon?: string
  order: number
  items_count?: number
}

export interface Extra {
  id: string
  name: string
  price: number
  available: boolean
}

export interface MenuItem {
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

export interface NutritionalInfo {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

export interface TableInfo {
  id: string
  number: number
  capacity?: number
  section?: string
  server_name?: string
  status?: 'available' | 'occupied' | 'reserved'
}

// ============================================================
// CART TYPES
// ============================================================
export interface CartItem {
  id: string
  menu_item: MenuItem
  quantity: number
  notes?: string
  extras: Extra[]
  unit_price: number
  total_price: number
}

export interface Cart {
  items: CartItem[]
  subtotal: number
  discount_amount: number
  tax: number
  service_charge: number
  total: number
  discount_code?: string
}

// ============================================================
// ORDER TYPES
// ============================================================
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type OrderType = 'delivery' | 'pickup' | 'dine_in'

export type PaymentMethod = 'card' | 'cash' | 'online' | 'wallet'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface OrderItem {
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

export interface DeliveryAddress {
  street: string
  city: string
  state?: string
  zip?: string
  lat?: number
  lng?: number
}

export interface Order {
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

export interface OrderStatusHistory {
  status: OrderStatus
  timestamp: string
  note?: string
}

// ============================================================
// RESERVATION TYPES
// ============================================================
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface Reservation {
  id: string
  user?: User
  branch_id: string
  branch?: Branch
  date: string
  time: string
  guests: number
  notes?: string
  name: string
  phone: string
  email?: string
  status: ReservationStatus
  confirmation_code?: string
  created_at: string
}

// ============================================================
// TENANT TYPES  (Phase 1A — P1A.1)
// ============================================================
export type BusinessType = 'restaurant' | 'cafe' | 'bar' | 'hotel' | 'other'

export type TenantStatus = 'active' | 'trial' | 'suspended' | 'churned'

/**
 * Runtime-only lifecycle state for the tenant bootstrap sequence.
 * Never persisted to localStorage — always starts as 'loading' on each page load.
 *
 *   loading  → TenantBootstrapper has not yet completed loadTenant()
 *   ready    → loadTenant() succeeded; tenant is from a live source
 *   fallback → loadTenant() failed; tenant is DEFAULT_TENANT
 *
 * Phase 1B systems must branch on all three states:
 *   loading  → block or apply safe defaults (deny RBAC, module-only flags, skip routing)
 *   fallback → apply DEFAULT_TENANT rules (single-tenant behaviour)
 *   ready    → full system behaviour with tenant-specific overrides
 */
export type TenantLifecycle = 'loading' | 'ready' | 'fallback'

/**
 * Authoritative execution gate for all Phase 1B+ systems.
 * Returned by useSystemReady() — fully derived at runtime, never persisted.
 *
 * Responsibility: P1B.6 — System Execution Gate.
 * This is NOT a store, NOT a source of truth, NOT business logic.
 * It is a safety layer that aggregates three independent bootstrap signals:
 *   TenantState     → lifecycle (loading / ready / fallback)
 *   rbacInitialized → RBAC system has completed its own setup (P1B.1)
 *   featureFlagsInitialized → Feature flag system has completed setup (P1B.2)
 *
 * Layer responsibilities:
 *   TenantState     → tenant lifecycle (single source of truth)
 *   RBAC            → permissions
 *   Feature Flags   → capability toggles
 *   SystemReadiness → execution safety gate (derived from the above)
 *
 * canExecute is the single field all consumers must check:
 *   false → block; return safe defaults (deny RBAC, module-only flags, skip routing)
 *   true  → all subsystems ready; proceed with appropriate rules for isReady/isFallback
 */
export interface SystemReadiness {
  /** tenantState === 'loading' */
  isLoading: boolean
  /** tenantState === 'ready' — live source, full overrides apply */
  isReady: boolean
  /** tenantState === 'fallback' — DEFAULT_TENANT in use, single-tenant rules apply */
  isFallback: boolean
  /**
   * true when ALL of the following hold:
   *   tenantState !== 'loading'    — bootstrap completed (ready or fallback)
   *   rbacInitialized === true     — RBAC system ready (P1B.1)
   *   featureFlagsInitialized === true — Feature flags ready (P1B.2)
   *
   * Canonical usage in every Phase 1B consumer:
   *   const { canExecute, isFallback } = useSystemReady()
   *   if (!canExecute) return <safe-default>
   */
  canExecute: boolean
}

export interface Tenant {
  id: string
  name: string
  slug: string
  /**
   * Active module keys for this tenant (e.g. ['restaurant']).
   *
   * INVARIANT: every value in this array must match a Module.key registered in
   * the module registry (src/modules/registry.ts). These are module identifiers,
   * NOT LocationType values ('restaurant_branch', 'cafe', etc.) and NOT arbitrary
   * business-type strings. Passing a LocationType value will cause getHeaderNav()
   * and getModuleRoutes() to silently return empty results.
   *
   * Valid values in Phase 1: ['restaurant']
   * Future values (Phase 6/8): ['hotel', 'bar', 'food_court', ...]
   *
   * Roadmap: Tenant.businessTypes — P1A.1.
   * Rename to moduleKeys in a future breaking-change release (tracked: M-2).
   */
  businessTypes: string[]
  status: TenantStatus
  createdAt: string
  settings?: Record<string, unknown>
}

// ============================================================
// BRANCH / LOCATION TYPES  (Phase 1A — P1A.2)
// ============================================================
export interface WorkingHours {
  day: string
  open: string
  close: string
  is_closed: boolean
}

/**
 * Discriminates location kinds for business-type-specific logic.
 * Matches the roadmap P1A.2 type enum exactly.
 */
export type LocationType =
  | 'restaurant_branch'
  | 'cafe'
  | 'bar'
  | 'hotel_property'
  | 'food_court_stall'
  | 'mobile_truck'

/** Location generalises Branch for multi-tenant use. Roadmap: P1A.2. */
export interface Location {
  id: string
  tenant_id?: string
  name: string
  slug: string
  type?: LocationType
  address: string
  city: string
  phone: string
  email?: string
  lat: number
  lng: number
  working_hours: WorkingHours[]
  is_active: boolean
  delivery_radius?: number
  images?: string[]
  /** Mobile-unit fields — only present when type === 'mobile_truck' */
  is_mobile?: boolean
  mobile_schedule?: string
}

/** Backward-compatible alias — existing code referencing Branch continues to compile. */
export type Branch = Location

// ============================================================
// MODULE TYPES  (Phase 1A — P1A.3)
// ============================================================
export interface NavItem {
  href: string
  label: string
  /** Icon name — maps to lucide-react component via ICON_MAP in consumers. */
  icon?: string
  exact?: boolean
  /**
   * Optional feature flag key (Phase 2 — P2.4).
   * When set, useModuleNav() hides the item if the flag resolves to false.
   * Items without this field are always shown (backward compatible).
   */
  featureFlagKey?: string
}

/**
 * A Module is a self-contained business-type capability.
 * Shape aligned with roadmap P1A.3: Module { key, name, routes, navItems, defaultFeatureFlags }.
 */
export interface Module {
  /** Unique module identifier used as the lookup key. */
  key: string
  name: string
  /** Business types this module is applicable to. Empty array means all types. */
  businessTypes: BusinessType[]
  /** Client-side route prefixes owned by this module (e.g. ['/menu', '/checkout']). */
  routes: string[]
  navItems: NavItem[]
  /**
   * Feature flags that default on/off for this module.
   * Resolved by the feature flag service in Phase 1B before per-tenant overrides are applied.
   */
  defaultFeatureFlags: Record<string, boolean>
  enabled: boolean
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================
export type NotificationType =
  | 'order_update'
  | 'reservation_update'
  | 'promotion'
  | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

// ============================================================
// PAGINATION & API TYPES
// ============================================================
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  message: string
  code?: string
  errors?: Record<string, string[]>
}

// ============================================================
// REVIEW TYPES
// ============================================================
export interface Review {
  id: string
  user: User
  menu_item_id?: string
  order_id?: string
  rating: number
  comment?: string
  created_at: string
}

// ============================================================
// ADDRESS TYPES
// ============================================================
export interface Address {
  id: string
  label: string
  street: string
  city: string
  state?: string
  zip?: string
  lat?: number
  lng?: number
  is_default: boolean
}

// ============================================================
// RBAC TYPES  (Phase 1B — P1B.1)
// ============================================================

/**
 * Atomic permission strings for the RBAC system.
 * Format: resource:action
 *
 * Consumers check a single permission via rbacService.hasPermission(role, permission)
 * or the useHasPermission(permission) hook — never enumerate this list directly.
 */
export type Permission =
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

// ============================================================
// TENANT THEME TYPES  (Phase 2 — P2.2)
// ============================================================

/**
 * Per-tenant visual overrides applied as CSS variable mutations at runtime.
 * Stored in Tenant.settings.theme — consumed by TenantThemeProvider in providers.
 *
 * All fields are optional: absent fields fall back to the default Savor theme.
 * Overrides are applied to CSS vars only — no style injection, no runtime deps.
 *
 * Supported override targets: --accent, --accent-hover, --font-body.
 * See TENANT_OVERRIDABLE_VARS in src/lib/tokens.ts for the full allowed set.
 */
export interface TenantTheme {
  /** Overrides --accent (primary action colour). CSS color value, e.g. '#3b82f6'. */
  primaryColor?: string
  /**
   * Overrides --accent-hover. Defaults to primaryColor if omitted.
   * Provide a slightly darker/lighter variant for accessible hover states.
   */
  accentHoverColor?: string
  /** URL to the tenant's logo image. Rendered in the Header instead of the default wordmark. */
  logoUrl?: string
  /** CSS font-family string overriding --font-body, e.g. '"Inter", sans-serif'. */
  fontBody?: string
}

// ── Admin Types (P5.1) ────────────────────────────────────────────────────────

export type AdminCustomerTier = 'new' | 'regular' | 'vip'

/** Admin-extended user view — reuses User; adds aggregated commerce metrics. */
export interface AdminCustomer extends User {
  order_count: number
  total_spent: number
  avg_order_value: number
  tier: AdminCustomerTier
  last_order_at?: string
}

/** Per-customer aggregated stats returned by /admin/customers/{id}/stats/ */
export interface AdminCustomerStats {
  customer_id: string
  order_count: number
  total_spent: number
  avg_order_value: number
  favorite_item?: string
  last_order_at?: string
}

/** Top-selling item entry inside AdminStats */
export interface AdminTopItem {
  menu_item_id: string
  name: string
  order_count: number
  revenue: number
  trend_pct: number
}

/** Dashboard KPI snapshot returned by /admin/stats/ */
export interface AdminStats {
  period_days: number
  total_revenue: number
  revenue_change_pct: number
  total_orders: number
  orders_change_pct: number
  new_customers: number
  customers_change_pct: number
  total_reservations: number
  reservations_change_pct: number
  top_items: AdminTopItem[]
  orders_in_queue: number
  avg_prep_time_minutes: number
  tables_reserved: number
  tables_total: number
}

/** Filter params accepted by getAdminOrders() */
export interface AdminOrderFilters {
  status?: OrderStatus
  order_type?: OrderType
  search?: string
  page?: number
  page_size?: number
}

/** Filter params accepted by getAdminReservations() */
export interface AdminReservationFilters {
  status?: ReservationStatus
  branch_id?: string
  date?: string
  search?: string
  page?: number
  page_size?: number
}

/** Filter params accepted by getCustomers() */
export interface AdminCustomerFilters {
  tier?: AdminCustomerTier
  search?: string
  page?: number
  page_size?: number
}
