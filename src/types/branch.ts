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
  tableOrderingEnabled: boolean
  reservationsEnabled: boolean
  maxCapacity?: number
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
  status: BranchStatus
  type: BranchType
  location: BranchLocation
  contact: BranchContact
  managerId?: string
  businessHours: BranchBusinessHours[]
  settings: BranchSettings
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
  type: BranchType
  location: BranchLocation
  contact?: BranchContact
  managerId?: string
  businessHours?: BranchBusinessHours[]
  settings?: Partial<BranchSettings>
}

export interface UpdateBranchPayload {
  name?: string
  location?: Partial<BranchLocation>
  contact?: Partial<BranchContact>
  managerId?: string
  businessHours?: BranchBusinessHours[]
  settings?: Partial<BranchSettings>
}

export interface AssignManagerPayload {
  managerId: string
}
