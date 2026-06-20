// ============================================================
// AUTH TYPES
// ============================================================
export interface User {
  id: string
  email: string
  phone?: string
  first_name: string
  last_name: string
  avatar?: string
  role: 'customer' | 'staff' | 'admin'
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
 * Authoritative execution gate for all Phase 1B systems.
 * Returned by useSystemReady() — fully derived from TenantLifecycle,
 * no additional state.
 *
 * canExecutePhase1B is the single field all consumers should check first:
 *   false (loading)         → block; return safe defaults
 *   true  (ready/fallback)  → proceed with the appropriate rule set
 *
 * isReady and isFallback allow consumers that need finer-grained branching
 * (e.g. "show a degraded-mode banner when isFallback") without re-deriving
 * the same logic from tenantState in every callsite.
 */
export interface SystemReadiness {
  /** tenantState === 'loading' */
  isLoading: boolean
  /** tenantState === 'ready' — live source, full overrides apply */
  isReady: boolean
  /** tenantState === 'fallback' — DEFAULT_TENANT in use, single-tenant rules apply */
  isFallback: boolean
  /**
   * true when tenantState is 'ready' OR 'fallback'.
   * The single gate all Phase 1B systems check before executing:
   *   RBAC        → if (!canExecutePhase1B) return safe default (deny)
   *   Feature flags → if (!canExecutePhase1B) return module defaults only
   *   Routing     → if (!canExecutePhase1B) skip access validation
   */
  canExecutePhase1B: boolean
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
