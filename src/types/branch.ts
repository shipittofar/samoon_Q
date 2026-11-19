// ============================================================
// P7.3 — Branch Management Domain Types
// ============================================================

import type { QrCode } from '@/types/qr'

export type BranchStatus = 'active' | 'inactive' | 'maintenance'

export type BranchType = 'physical' | 'mobile'

export type BranchOrderTypeDefault = 'delivery' | 'pickup' | 'dine_in' | null

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
  delivery: boolean
  pickup: boolean
  dineIn: boolean
  default: string | null
  /** Additional order types returned by backend (e.g. driveThrough). */
  [key: string]: boolean | string | null | undefined
}

export interface BranchCheckoutPayments {
  cash: boolean
  cashOnDelivery: boolean
  card: boolean
  online: boolean
  wallet: boolean
  default: string | null
  /** Additional payment methods returned by backend. */
  [key: string]: boolean | string | null | undefined
}

export interface BranchCheckoutDelivery {
  radius: number | null
  minimumOrder: string | null
  sameDay: boolean
  scheduled: boolean
  contactless: boolean
  /** Additional delivery flags returned by backend. */
  [key: string]: boolean | string | number | null | undefined
}

export interface BranchCheckout {
  orderingEnabled: boolean
  orderTypes: BranchCheckoutOrderTypes
  payments: BranchCheckoutPayments
  delivery: BranchCheckoutDelivery
}

// ── Service area (Phase L1 — docs/BUSINESS_SERVICES_ROADMAP.md) ──────────────

/**
 * What a branch offers inside its area:
 *  - delivery   — sends orders to the customer (restaurants with delivery)
 *  - on_site    — staff come to the customer (home hairdresser, home doctor)
 *  - visit_only — customer comes to the branch; the area only decides whose
 *                 "near me" results the branch appears in
 */
export type ServiceAreaMode = 'delivery' | 'on_site' | 'visit_only'

export interface GeoPoint {
  lat: number
  lng: number
}

export type ServiceAreaShape =
  | { type: 'circle'; radiusKm: number }
  /** Closed polygon, vertices in order (first ≠ last; the ring closes implicitly). */
  | { type: 'polygon'; points: GeoPoint[] }

/** Optional distance bands with their own fee / ETA (e.g. 0–3 km free, 3–8 km $2). */
export interface ServiceAreaZone {
  upToKm: number
  fee?: number
  etaMinutes?: number
}

export interface BranchServiceArea {
  mode: ServiceAreaMode
  shape: ServiceAreaShape
  zones?: ServiceAreaZone[]
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
  /** Branch brand logo URL. Not cover or hero. */
  image?: string
  /** Branch page cover and branch page avatar. Independent of logo and hero. */
  coverImage?: string
  /** Branch homepage hero/background. Independent of logo and cover. */
  heroImage?: string
  /** Whether this is the tenant's default branch. */
  isDefault?: boolean
  /** IANA time zone, e.g. "America/New_York". */
  timeZone?: string
  /** ISO 4217 currency code, e.g. "USD". */
  currency?: string
  /** BCP 47 language tag, e.g. "en". */
  language?: string
  /** Cuisine / specialty labels for this location (branch-owned). */
  cuisines?: string[]
  /** Amenity labels for this location (branch-owned). */
  amenities?: string[]
  created_at: string
  updated_at: string
  /** Extension-only JSON — never used for operational checkout configuration. */
  settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
  /** Stable QR payload from the backend. Encode `qr.url` only — never slugs. */
  qr?: QrCode | null
  /**
   * Phase L1 — where this branch serves customers. Absent → derived by
   * resolveBranchServiceArea() (delivery radius, else the vertical default).
   */
  serviceArea?: BranchServiceArea
  /**
   * Phase L2 — when the owner last confirmed the map pin is exact (ISO).
   * Null/absent → unverified (nearby results can flag it).
   */
  locationVerifiedAt?: string | null
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

/** Canonical console create fields (multipart files are File at runtime). */
export interface CreateBranchPayload {
  name: string
  description?: string
  type: BranchType
  location: BranchLocation
  contact?: BranchContact
  businessHours?: BranchBusinessHours[]
  isDefault?: boolean
  orderingEnabled?: boolean
  deliveryEnabled?: boolean
  pickupEnabled?: boolean
  tableOrderingEnabled?: boolean
  deliveryRadius?: number
  minimumOrder?: string
  defaultOrderType?: string
  cashPaymentEnabled?: boolean
  cardPaymentEnabled?: boolean
  onlinePaymentEnabled?: boolean
  walletPaymentEnabled?: boolean
  cashOnDeliveryEnabled?: boolean
  defaultPaymentMethod?: string
  sameDayDeliveryEnabled?: boolean
  scheduledDeliveryEnabled?: boolean
  contactlessDeliveryEnabled?: boolean
  marketplaceVisible?: boolean
  reservationsEnabled?: boolean
  maxCapacity?: number
  image?: File
  coverImage?: File
  heroImage?: File
  cuisines?: string[]
  amenities?: string[]
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
  heroImage?: string
  isDefault?: boolean
  timeZone?: string
  currency?: string
  language?: string
  cuisines?: string[]
  amenities?: string[]
}

export interface AssignManagerPayload {
  managerId: string
}
