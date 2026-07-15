// ============================================================
// P7.3 — Branch Management Domain Types
// ============================================================

export type BranchStatus = 'active' | 'inactive' | 'maintenance'

export type BranchType = 'physical' | 'mobile'

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

export interface BranchSettings {
  deliveryEnabled: boolean
  deliveryRadius?: number
  pickupEnabled: boolean
  /** Dine-in / table ordering. */
  tableOrderingEnabled: boolean
  reservationsEnabled: boolean
  maxCapacity?: number
  /** Master switch for online ordering at this branch. Optional — absent means enabled, matching prior behavior for existing branches. */
  orderingEnabled?: boolean
  /** Whether this branch is shown on the tenant's public marketplace listing. Optional — absent means visible, matching prior behavior. */
  marketplaceVisible?: boolean
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
  settings: BranchSettings
  /** Logo/branding image URL. */
  image?: string
  /** Cover/hero image URL. */
  coverImage?: string
  /** Whether this is the tenant's default branch. Exactly one branch per tenant should have this true. */
  isDefault?: boolean
  /** IANA time zone, e.g. "America/New_York". */
  timeZone?: string
  /** ISO 4217 currency code, e.g. "USD". */
  currency?: string
  /** BCP 47 language tag, e.g. "en". */
  language?: string
  createdAt: string
  updatedAt: string
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
  settings?: Partial<BranchSettings>
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
  settings?: Partial<BranchSettings>
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
