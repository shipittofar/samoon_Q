// ============================================================
// AUTH TYPES
// ============================================================

/** Role assigned to an authenticated user. Matches the backend auth model. */
export type UserRole = 'customer' | 'staff' | 'owner' | 'admin'

export interface User {
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

export type SendOTPRequest = {
  phone_number: string
  dialCode: string
}

export interface VerifyOTPRequest {
  phone_number: string
  dialCode: string
  otp: string
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
  // email: string
  /** Local phone number WITHOUT the country prefix — see country_code. */
  phone_number?: string
  /** User's selected dial code (e.g. '+1'), never hardcoded. Sent
   *  separately from phone_number, never concatenated — matches the
   *  OTP request shape (SendOTPRequest/VerifyOTPRequest). */
  country_code?: string
  // P10.9 — password/confirm_password are temporarily NOT part of the
  // phone-OTP registration flow (see src/app/complete-profile/page.tsx).
  // Kept here (optional, not removed) so the existing email+password
  // flow (/register, RegisterClientPage.tsx) keeps working unchanged,
  // and so password support can be re-enabled for the phone flow later
  // without another type change.
  password?: string
  confirm_password?: string
  first_name: string
  last_name: string
}

export interface OTPVerifyData {
  phone_number: string
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
  phone_number: string
  email?: string
  status: ReservationStatus
  confirmation_code?: string
  created_at: string
}

// ============================================================
// TENANT TYPES  (Phase 1A — P1A.1)
// ============================================================
export type BusinessType =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'food_court'
  | 'food_truck'
  | 'mobile_cafe'
  | 'hotel'
  | 'other'

export type TenantStatus = 'active' | 'trial' | 'suspended' | 'churned' | 'archived'

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
  /**
   * P10.2.1 — FK to Owner.ownerId (src/types/ownership.ts). Additive and
   * optional during the migration window described in
   * docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §10.2/§10.3 — every existing
   * reader of `Tenant` that doesn't know about `ownerId` keeps working
   * unchanged. Backfilled via `ownership-migration.service.ts`. Becomes
   * required only once a later phase enforces the non-nullable invariant.
   */
  ownerId?: string
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
  | 'mobile_cafe'

/** Location generalises Branch for multi-tenant use. Roadmap: P1A.2. */
export interface Location {
  id: string
  tenant_id?: string
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
  delivery_radius?: number
  images?: string[]
  /** Mobile-unit fields — only present when type === 'mobile_truck' */
  is_mobile?: boolean
  mobile_schedule?: string
}

/** Backward-compatible alias — existing code referencing Branch continues to compile. */
export type Branch = Location

// ============================================================
// MODULE TYPES  (Phase 1A — P1A.3 / Phase 6 — P6.2)
// ============================================================

/**
 * Atomic business capability that a module can declare.
 * Each capability maps to a feature flag key via CAPABILITY_FLAG_MAP in the registry.
 *
 * Capabilities are declared on Module.capabilities; the feature flag service
 * derives boolean flags from them so tenants can override individual capabilities
 * without coupling to internal module flag naming.
 *
 * P6.2 — Multi-Business Foundation
 */
export type Capability =
  | 'menu'
  | 'ordering'
  | 'qr_table'
  | 'reservations'
  | 'reviews'
  | 'loyalty'
  | 'notifications'

/**
 * Declares the capability contract for a business-type module.
 *
 * required     — always active for this business type; cannot be disabled by tenant
 * optional     — may be enabled or disabled per tenant; off by default unless in defaultEnabled
 * defaultEnabled — subset of optional that is on by default (before tenant overrides)
 *
 * P6.2 — Multi-Business Foundation
 */
export interface ModuleCapabilitySet {
  readonly required: readonly Capability[]
  readonly optional: readonly Capability[]
  readonly defaultEnabled: readonly Capability[]
}

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
  /**
   * Optional P7 permission key (P7.2).
   * When set, useAdminModuleNav() hides the item if the current user lacks the permission.
   * Items without this field are always shown.
   */
  permissionKey?: import('./rbac').P7Permission
  /**
   * Sidebar group label (P8.9.4).
   * Items with the same group label are rendered under a shared section header.
   * Items without a group appear in an implicit ungrouped section.
   */
  group?: string
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
  /**
   * Capability contract for this module (P6.2 — Multi-Business Foundation).
   * Optional for backward compatibility — modules without this field produce no
   * capability-derived flags; their defaultFeatureFlags are still honoured.
   */
  capabilities?: ModuleCapabilitySet
  /**
   * Admin-shell nav items surfaced when this module is active (P6.3+).
   * Each item carries a featureFlagKey so the admin shell can gate visibility
   * without knowing which business type is active — the module self-describes.
   */
  adminNavItems?: NavItem[]
  /**
   * QR experience type for this module (P6.12).
   * Drives business-specific QR landing page sections without hardcoding
   * business-type checks in page components.
   */
  qrExperienceType?: 'restaurant' | 'cafe' | 'bar' | 'food_court' | 'food_truck' | 'mobile_cafe'
}

// ============================================================
// CAFE TYPES  (Phase 6 — P6.3)
// ============================================================

/**
 * Per-tenant cafe configuration stored in Tenant.settings.cafeSettings.
 * Fields are additive — absent fields fall back to disabled/off.
 *
 * Do NOT add UI until P6.3 screens are implemented.
 * Types only — consumed by CafeModule feature flag resolution and admin forms.
 */
export interface CafeSettings {
  /** Enable happy-hour pricing rules. Corresponds to cafe.happy_hour.enabled flag. */
  happyHourEnabled: boolean
  /** ISO time string, e.g. "15:00". Ignored when happyHourEnabled is false. */
  happyHourStart?: string
  /** ISO time string, e.g. "18:00". Ignored when happyHourEnabled is false. */
  happyHourEnd?: string
  /** Enable stamp-card / points loyalty program. Corresponds to cafe.loyalty.enabled flag. */
  loyaltyEnabled: boolean
  /** Surface a curated featured-coffee section on the menu. Corresponds to cafe.featured_coffee.enabled. */
  featuredCoffeeEnabled: boolean
}

export interface BarSettings {
  /** Enable happy-hour pricing rules. Corresponds to bar.happy_hour.enabled flag. */
  happyHourEnabled: boolean
  /** ISO time string, e.g. "17:00". Ignored when happyHourEnabled is false. */
  happyHourStart?: string
  /** ISO time string, e.g. "20:00". Ignored when happyHourEnabled is false. */
  happyHourEnd?: string
  /** Enable event listings and event-based reservations. Corresponds to bar.events.enabled flag. */
  eventsEnabled: boolean
  /** When true, reservations are required to attend events. */
  reservationsRequiredForEvents: boolean
  /** Surface a curated featured-cocktails section on the menu. Corresponds to bar.featured_cocktails.enabled. */
  featuredCocktailsEnabled: boolean
}

export interface FoodCourtSettings {
  /** Enable multi-vendor ordering under one tenant. Corresponds to food_court.multi_vendor.enabled flag. */
  multiVendorEnabled: boolean
  /** Enable vendor onboarding and management tools. Corresponds to food_court.vendor_management.enabled flag. */
  vendorManagementEnabled: boolean
  /** Enable shared seating area management. Corresponds to food_court.shared_seating.enabled flag. */
  sharedSeatingEnabled: boolean
  /** Allow a single order to span multiple vendors. Corresponds to food_court.cross_vendor_ordering.enabled flag. */
  crossVendorOrderingEnabled: boolean
  /** Surface a featured vendor section on the menu. Corresponds to food_court.featured_vendor.enabled flag. */
  featuredVendorEnabled: boolean
}

// ── Loyalty Domain Types (P6.9) ───────────────────────────────────────────────

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface LoyaltyAccount {
  id: string
  userId: string
  tenantId: string     // loyalty is per-tenant, never global
  points: number
  lifetimePoints: number
  tier: LoyaltyTier
  tierExpiresAt?: string
  createdAt: string
  updatedAt: string
}

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'adjustment'

export interface LoyaltyTransaction {
  id: string
  accountId: string
  tenantId: string     // inherited from parent LoyaltyAccount for query convenience
  type: LoyaltyTransactionType
  points: number
  /** Human-readable description (e.g. "Order #1234 — earned 120 pts"). */
  description: string
  /** ISO timestamp of when the transaction occurred. */
  createdAt: string
  /** Optional reference to an order or reward that triggered the transaction. */
  referenceId?: string
}

export interface LoyaltyReward {
  id: string
  name: string
  description: string
  /** Points required to redeem this reward. */
  pointsCost: number
  /** Whether the reward is currently available for redemption. */
  active: boolean
  /** Minimum tier required (null means no restriction). */
  minimumTier?: LoyaltyTier
  /** ISO expiry date for time-limited rewards. */
  expiresAt?: string
  createdAt: string
}

/** Tier thresholds — lifetime points needed to reach each tier. */
export const LOYALTY_TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze:   0,
  silver:   1_000,
  gold:     5_000,
  platinum: 15_000,
}

// ── Promotion & Happy Hour Domain Types (P6.10) ───────────────────────────────

export type PromotionType =
  | 'percentage_discount'
  | 'fixed_discount'
  | 'buy_one_get_one'
  | 'happy_hour'

/** Days of the week using ISO numeric convention (1=Mon … 7=Sun). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface PromotionSchedule {
  /** ISO date-time for when the promotion becomes active. */
  startAt: string
  /** ISO date-time for when the promotion expires. Omit for open-ended. */
  endAt?: string
  /** Restrict to specific weekdays. Omit to apply every day. */
  weekdays?: Weekday[]
  /** Wall-clock start of the daily time window, e.g. "16:00". */
  timeWindowStart?: string
  /** Wall-clock end of the daily time window, e.g. "19:00". */
  timeWindowEnd?: string
}

export interface HappyHourRule {
  /** Unique identifier. */
  id: string
  /** Display name. */
  name: string
  /** Discount percentage applied during happy-hour window (0–100). */
  discountPercent: number
  /** Applies to specific menu item IDs; empty means all items. */
  applicableItemIds: string[]
  schedule: PromotionSchedule
  active: boolean
  createdAt: string
}

export interface PromotionRule {
  id: string
  name: string
  description: string
  type: PromotionType
  /** Percentage off (0–100) for percentage_discount / happy_hour. */
  discountPercent?: number
  /** Fixed currency amount off for fixed_discount. */
  discountAmount?: number
  /** Applies to specific menu item IDs; empty means all items. */
  applicableItemIds: string[]
  schedule: PromotionSchedule
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface FoodTruckSettings {
  /** Enable route tracking for the food truck. Corresponds to food_truck.route_tracking.enabled flag. */
  routeTrackingEnabled: boolean
  /** Broadcast live GPS location to customers. Corresponds to food_truck.live_location.enabled flag. */
  liveLocationEnabled: boolean
  /** Enable scheduled stop listings. Corresponds to food_truck.scheduled_stops.enabled flag. */
  scheduledStopsEnabled: boolean
  /** Allow customers to place orders ahead of arrival. Corresponds to food_truck.pre_order.enabled flag. */
  preOrderEnabled: boolean
  /** Surface a featured route on the menu/home page. Corresponds to food_truck.featured_route.enabled flag. */
  featuredRouteEnabled: boolean
}

export interface MobileCafeSettings {
  /** Enable route tracking for the mobile cafe. Corresponds to mobile_cafe.route_tracking.enabled flag. */
  routeTrackingEnabled: boolean
  /** Broadcast live GPS location to customers. Corresponds to mobile_cafe.live_location.enabled flag. */
  liveLocationEnabled: boolean
  /** Enable stamp-card / points loyalty program. Corresponds to mobile_cafe.loyalty.enabled flag. */
  loyaltyEnabled: boolean
  /** Surface a curated featured-coffee section on the menu. Corresponds to mobile_cafe.featured_coffee.enabled flag. */
  featuredCoffeeEnabled: boolean
  /** Highlight daily specials on the menu/home page. Corresponds to mobile_cafe.daily_specials.enabled flag. */
  dailySpecialsEnabled: boolean
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
// RBAC TYPES  (Phase 1B — P1B.1 / P7.1)
// ============================================================

// Re-export P7 types from rbac module for consumers that import from '@/types'
export type {
  Role,
  P7Permission,
  UserTenantRole,
  TenantRoleAssignment,
  PermissionCheckOptions,
  AuditEvent,
  MockRbacUser,
} from './rbac'

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

/** Per-customer aggregated stats returned by /console/customers/{id}/stats/ */
export interface AdminCustomerStats {
  customer_id: string
  tenant_id: string     // stats are always scoped to the requesting tenant
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

/** Dashboard KPI snapshot returned by /console/stats/ */
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
  branch_id?: string
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
  tenantId?: string
  branchId?: string
  tier?: AdminCustomerTier
  search?: string
  page?: number
  page_size?: number
}

// ── P8.9.6 — Platform Customer Identity & Business Relationship Types ─────────

/**
 * Platform-wide customer identity. Created once at account registration.
 * Phone is the primary identifier (phone_number-first auth per P8.9.3).
 * A single PlatformUser may have BusinessCustomer relationships at many tenants.
 */
export interface PlatformUser {
  id: string
  phone_number: string
  name: string
  avatar?: string
  email?: string
  language?: string
  createdAt: string
  status: 'active' | 'inactive' | 'suspended'
}

/**
 * A PlatformUser's relationship to a single tenant.
 * Created only on first interaction (order, reservation, QR scan, or payment).
 * All commerce aggregates are scoped to this tenant only — never cross-tenant.
 * Loyalty points and tier are per-tenant, independent of other businesses.
 */
export interface BusinessCustomer {
  id: string
  userId: string           // references PlatformUser.id
  tenantId: string
  firstInteractionAt: string
  lastInteractionAt: string
  ordersCount: number
  reservationsCount: number
  totalSpent: number
  favorite: boolean
  lifetimeValue: number
  lastBranchId?: string
  loyaltyPoints: number
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum'
  status: 'active' | 'inactive'
}

/**
 * A BusinessCustomer's visit behaviour at a single branch.
 * Created only on first branch-level interaction.
 */
export interface BranchCustomer {
  id: string
  businessCustomerId: string   // references BusinessCustomer.id
  branchId: string
  ordersCount: number
  reservationsCount: number
  visits: number
  favoriteBranch: boolean
  lastVisit?: string
  lastOrder?: string
}

// ── P8.9.7 — Customer 360° CRM Types ─────────────────────────────────────────

export type CustomerTimelineEventType =
  | 'account_created'
  | 'first_visit'
  | 'order_placed'
  | 'order_completed'
  | 'order_cancelled'
  | 'order_refunded'
  | 'reservation_made'
  | 'reservation_confirmed'
  | 'reservation_completed'
  | 'reservation_cancelled'
  | 'reservation_no_show'
  | 'points_earned'
  | 'points_redeemed'
  | 'reward_redeemed'
  | 'tier_upgraded'
  | 'tier_downgraded'
  | 'coupon_received'
  | 'coupon_redeemed'
  | 'review_posted'
  | 'payment_completed'
  | 'refund_issued'
  | 'admin_note'
  | 'tag_added'
  | 'tag_removed'
  | 'marketing_email'
  | 'marketing_sms'
  | 'profile_updated'
  | 'phone_verified'
  | 'birthday'

export interface CustomerTimelineEvent {
  id: string
  userId: string
  tenantId: string
  type: CustomerTimelineEventType
  title: string
  description?: string
  amount?: number
  points?: number
  branchId?: string
  referenceId?: string
  referenceType?: 'order' | 'reservation' | 'review' | 'coupon' | 'reward' | 'note'
  actorId?: string
  actorName?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface CustomerNote {
  id: string
  userId: string
  tenantId: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}

export type CustomerTagColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange'

export interface CustomerTag {
  id: string
  tenantId: string
  label: string
  color: CustomerTagColor
  createdAt: string
}

export interface CustomerTagAssignment {
  userId: string
  tenantId: string
  tags: CustomerTag[]
}

export interface CustomerAnalytics {
  userId: string
  tenantId: string
  lifetimeValue: number
  avgOrderValue: number
  avgReservationPartySize: number
  visitFrequencyDays: number
  daysSinceLastVisit: number
  favoriteBranchId?: string
  favoriteBranchName?: string
  favoriteWeekday?: string
  favoriteHour?: number
  favoriteCategories: string[]
  favoriteItems: Array<{ name: string; count: number }>
  revenueByMonth: Array<{ month: string; revenue: number }>
  visitsByMonth: Array<{ month: string; visits: number }>
  pointsByMonth: Array<{ month: string; points: number }>
}

export type MarketingChannel = 'email' | 'sms' | 'push' | 'whatsapp'

export interface CustomerMarketingPreference {
  channel: MarketingChannel
  subscribed: boolean
  subscribedAt?: string
  unsubscribedAt?: string
}

export interface CustomerMarketingCampaign {
  id: string
  name: string
  channel: MarketingChannel
  sentAt: string
  opened: boolean
  openedAt?: string
  clicked: boolean
  clickedAt?: string
}

export interface CustomerMarketing {
  userId: string
  tenantId: string
  preferences: CustomerMarketingPreference[]
  campaigns: CustomerMarketingCampaign[]
  couponsReceived: number
  couponsRedeemed: number
  lastCampaignAt?: string
}

export interface CustomerCoupon {
  id: string
  userId: string
  tenantId: string
  code: string
  description: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderAmount?: number
  status: 'available' | 'redeemed' | 'expired'
  redeemedAt?: string
  expiresAt?: string
  createdAt: string
}

export interface CustomerPayment {
  id: string
  userId: string
  tenantId: string
  orderId?: string
  amount: number
  currency: string
  method: 'card' | 'cash' | 'wallet' | 'gift_card'
  status: 'completed' | 'refunded' | 'partial_refund' | 'failed'
  refundAmount?: number
  processedAt: string
}

// ── Vendor Management Domain Types (P6.11) ────────────────────────────────────

export type VendorStatus = 'active' | 'inactive' | 'pending' | 'suspended'

export type VendorCategory =
  | 'asian'
  | 'western'
  | 'mediterranean'
  | 'mexican'
  | 'indian'
  | 'desserts'
  | 'beverages'
  | 'fast_food'
  | 'healthy'
  | 'other'

export interface Vendor {
  id: string
  name: string
  description: string
  /** Branch(es) this vendor operates in. Food-court vendors may span multiple branches. */
  branchIds?: string[]
  category: VendorCategory
  status: VendorStatus
  /** Star rating 0–5, one decimal place. */
  rating: number
  /** Number of ratings contributing to rating average. */
  ratingCount: number
  featured: boolean
  logoUrl?: string
  /** Stall / booth identifier in the food court. */
  stallNumber?: string
  /** Commission percentage taken from vendor revenue (0–100). */
  commissionRate: number
  contactEmail: string
  contactPhone?: string
  createdAt: string
  updatedAt: string
}

export interface VendorStats {
  vendorId: string
  ordersCount: number
  revenue: number
  commissionPaid: number
  avgRating: number
  activeProducts: number
  /** ISO month string e.g. "2025-06". */
  period: string
}

export type SettlementStatus = 'pending' | 'paid' | 'failed'

export interface VendorCommission {
  vendorId: string
  /** Gross revenue for the settlement period. */
  grossRevenue: number
  commissionRate: number
  commissionAmount: number
  netPayout: number
}

export interface VendorSettlement {
  id: string
  vendorId: string
  amount: number
  status: SettlementStatus
  /** ISO date string for when the settlement was created. */
  settlementDate: string
  /** External payout reference (e.g. bank transfer ID). */
  payoutReference?: string
  commission: VendorCommission
  createdAt: string
  updatedAt: string
}

// ── P7.3 Branch Management types (re-exported for convenience) ────────────────
export type {
  BranchStatus,
  BranchType,
  BranchLocation,
  BranchBusinessHours,
  BranchContact,
  BranchSettings,
  BranchMetrics,
  Branch as BranchEntity,
  BranchAnalyticsSummary,
  CreateBranchPayload,
  UpdateBranchPayload,
  AssignManagerPayload,
} from '@/types/branch'

// ── P7.4 Branch Routing types (re-exported for convenience) ──────────────────
export type {
  BranchScope,
  BranchFilter,
  BranchAccessContext,
  BranchIsolationResult,
  BranchAssignmentRule,
} from '@/types/branch-routing'

// ── P7.4 Branch Analytics types (re-exported for convenience) ────────────────
export type {
  BranchRevenueAnalytics,
  BranchOrderAnalytics,
  BranchReservationAnalytics,
} from '@/types/analytics'

// ── P7.5 Audit Log types (re-exported for convenience) ───────────────────────
export type {
  AuditLog,
  AuditAction,
  AuditActor,
  AuditTarget,
  AuditScope,
  AuditMetadata,
  AuditChangeSet,
  AuditSeverity,
  AuditFilter,
  AuditExportRequest,
  AuditTimelineItem,
  AuditStatistics,
  PaginatedAuditLogs,
  AuditTargetType,
} from '@/types/audit-log'
