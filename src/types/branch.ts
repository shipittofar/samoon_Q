// ============================================================
// P7.3 — Branch Management Domain Types
// ============================================================

export type BranchStatus = 'active' | 'inactive' | 'maintenance'

export type BranchType = 'physical' | 'mobile'

export type BranchOrderTypeDefault = string | null

/**
 * Phase 3 — Branch Resolution state machine (useBranchStore.branchState).
 */
export type BranchResolutionState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export interface BranchLocation {
  address: string
  city: string
  country: string
  postalCode?: string
  latitude?: number
  longitude?: number
}

export interface BranchBusinessHours {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  open: string
  close: string
  isClosed: boolean
}

export interface BranchContact {
  phone_number?: string
  email?: string
  website?: string
}

/** Checkout configuration — mirrors backend `branch.checkout` nested serializer. */
export interface BranchCheckoutOrderTypes {
  default: string | null
  /** Order type flags or metadata objects returned by backend. */
  [key: string]: BranchCheckoutOrderTypeValue
}

export type BranchCheckoutOrderTypeValue =
  | boolean
  | BranchCheckoutOrderTypeConfig
  | string
  | null
  | undefined

/** Optional per-order-type checkout metadata from backend. */
export interface BranchCheckoutOrderTypeConfig {
  enabled?: boolean
  requiresDeliveryAddress?: boolean
  requires_delivery_address?: boolean
  requiresTableNumber?: boolean
  requires_table_number?: boolean
  fulfillmentMode?: string
  fulfillment_mode?: string
  [key: string]: unknown
}

export interface BranchCheckoutPayments {
  default: string | null
  /** Payment method flags or metadata objects returned by backend. */
  [key: string]: BranchCheckoutPaymentValue
}

/** Backend payment entry — boolean enabled flag or metadata object. */
export type BranchCheckoutPaymentValue =
  | boolean
  | BranchCheckoutPaymentMethodConfig
  | string
  | null
  | undefined

/** Optional per-method checkout metadata from backend (processor flow, etc.). */
export interface BranchCheckoutPaymentMethodConfig {
  enabled?: boolean
  requiresPaymentIntent?: boolean
  requires_payment_intent?: boolean
  flow?: string
  processor?: string
  payment_action?: string
  integration?: string
  [key: string]: unknown
}

export interface BranchCheckoutDelivery {
  radius?: number | null
  minimumOrder?: string | null
  /** Delivery capability flags returned by backend. */
  [key: string]: boolean | string | number | null | undefined
}

export interface BranchCheckout {
  orderingEnabled: boolean
  orderTypes: BranchCheckoutOrderTypes
  payments: BranchCheckoutPayments
  delivery: BranchCheckoutDelivery
}

export interface BranchMetrics {
  branchId: string
  totalOrders: number
  totalRevenue: number
  totalReservations: number
  totalCustomers: number
  staffCount: number
  averageOrderValue: number
  period: 'day' | 'week' | 'month' | 'all'
}

export interface Branch {
  id: string
  tenantId: string
  name: string
  slug: string
  description?: string
  status: BranchStatus
  type: BranchType
  location: BranchLocation
  contact: BranchContact
  managerId?: string
  businessHours: BranchBusinessHours[]
  checkout: BranchCheckout
  marketplaceVisible: boolean
  reservationsEnabled: boolean
  maxCapacity?: number
  /** Logo/branding image URL. */
  image?: string
  /** Cover/hero image URL. */
  coverImage?: string
  /** Whether this is the tenant's default branch. */
  isDefault?: boolean
  /** IANA time zone, e.g. "America/New_York". */
  timeZone?: string
  /** ISO 4217 currency code, e.g. "USD". */
  currency?: string
  /** BCP 47 language tag, e.g. "en". */
  language?: string
  created_at: string
  updated_at: string
  /** Extension-only JSON — never used for operational checkout configuration. */
  settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface BranchAnalyticsSummary {
  totalBranches: number
  activeBranches: number
  maintenanceBranches: number
  inactiveBranches: number
  totalStaffAssigned: number
  byType: Record<BranchType, number>
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateBranchPayload {
  name: string
  slug: string
  description?: string
  type: BranchType
  location: BranchLocation
  contact?: BranchContact
  managerId?: string
  businessHours?: BranchBusinessHours[]
  checkout?: Partial<BranchCheckout>
  marketplaceVisible?: boolean
  reservationsEnabled?: boolean
  maxCapacity?: number
  image?: string
  coverImage?: string
  isDefault?: boolean
  timeZone?: string
  currency?: string
  language?: string
}

export interface UpdateBranchPayload {
  name?: string
  slug?: string
  description?: string
  location?: Partial<BranchLocation>
  contact?: Partial<BranchContact>
  managerId?: string
  businessHours?: BranchBusinessHours[]
  checkout?: Partial<BranchCheckout>
  marketplaceVisible?: boolean
  reservationsEnabled?: boolean
  maxCapacity?: number
  image?: string
  coverImage?: string
  isDefault?: boolean
  timeZone?: string
  currency?: string
  language?: string
}

export interface AssignManagerPayload {
  managerId: string
}
