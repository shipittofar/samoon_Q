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

export interface Tenant {
  id: string
  name: string
  slug: string
  business_type: BusinessType
  is_active: boolean
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

export type LocationType = 'physical' | 'mobile' | 'virtual'

/** Location generalises Branch for multi-tenant use. */
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
  /** Mobile-unit fields — only present when type === 'mobile' */
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
  /** Optional icon component name (maps to lucide-react) */
  icon?: string
  exact?: boolean
}

export interface Module {
  id: string
  label: string
  /** Business types this module applies to; empty = all */
  business_types: BusinessType[]
  nav: NavItem[]
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
