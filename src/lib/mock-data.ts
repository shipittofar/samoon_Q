import type { Branch, BusinessCustomer, BranchCustomer, Category, ConsoleMenuTag, CustomerAnalytics, CustomerCoupon, CustomerMarketing, CustomerNote, CustomerTag, CustomerTimelineEvent, Extra, ExtraGroup, LoyaltyAccount, MenuItem, MenuItemTag, MenuTag, Notification, Order, PlatformUser, Reservation, User } from '@/types'
import { buildBranchCheckout } from '@/lib/branch-checkout'

/** Attaches backend-shaped checkout config to legacy Location mock branches. */
function withLocationCheckout(
  branch: Branch,
  opts: {
    delivery?: boolean
    pickup?: boolean
    dineIn?: boolean
    radius?: number | null
  } = {},
): Branch {
  const checkout = buildBranchCheckout({
    delivery: opts.delivery ?? true,
    pickup: opts.pickup ?? true,
    dineIn: opts.dineIn ?? true,
    radius: opts.radius ?? branch.delivery_radius ?? null,
  })
  return {
    ...branch,
    checkout,
    marketplaceVisible: true,
    reservationsEnabled: false,
    delivery_radius: checkout.delivery.radius ?? undefined,
  }
}

// ── Users ────────────────────────────────────────────────────────────────────
export const MOCK_USER: User = {
  id: '1',
  email: 'john@example.com',
  phone_number: '+1234567890',
  first_name: 'John',
  last_name: 'Doe',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
  accountType: 'customer',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// Mock demo accounts for staff/console roles (mock mode only).
// These are separate from MOCK_USER to preserve the security invariant
// that MOCK_USER.accountType === 'customer'. Console access for these
// accounts still comes entirely from their tenant-scoped RBAC roles
// (see MOCK_CREDENTIALS' p7Roles in auth.service.ts), never from
// accountType — accountType is a UX hint only (Phase 9.3).
export const MOCK_STAFF_USER: User = {
  id: '2',
  email: 'staff@samoon.com',
  phone_number: '+1234567891',
  first_name: 'Sam',
  last_name: 'Staff',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_ADMIN_USER: User = {
  id: '3',
  email: 'admin@samoon.com',
  phone_number: '+1234567892',
  first_name: 'Alex',
  last_name: 'Admin',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_OWNER_USER: User = {
  id: '4',
  email: 'owner@samoon.com',
  phone_number: '+1234567893',
  first_name: 'Olivia',
  last_name: 'Owner',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_CASHIER_USER: User = {
  id: '5',
  email: 'cashier@samoon.com',
  phone_number: '+1234567894',
  first_name: 'Casey',
  last_name: 'Cashier',
  avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_KITCHEN_USER: User = {
  id: '6',
  email: 'kitchen@samoon.com',
  phone_number: '+1234567895',
  first_name: 'Kai',
  last_name: 'Kitchen',
  avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_MARKETING_USER: User = {
  id: '7',
  email: 'marketing@samoon.com',
  phone_number: '+1234567896',
  first_name: 'Morgan',
  last_name: 'Marketing',
  avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_SUPPORT_USER: User = {
  id: '8',
  email: 'support@samoon.com',
  phone_number: '+1234567897',
  first_name: 'Sam',
  last_name: 'Support',
  avatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// P8.9.1 — Platform Admin: cross-tenant visibility (owner P7 role)
export const MOCK_PLATFORM_ADMIN_USER: User = {
  id: '10',
  email: 'platform@samoon.com',
  phone_number: '+14155550109',
  first_name: 'Pat',
  last_name: 'Platform',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// P8.5 — Multi-role demo user: Cashier + Kitchen combined
export const MOCK_MULTI_ROLE_USER: User = {
  id: '9',
  email: 'multirole@samoon.com',
  phone_number: '+1234567898',
  first_name: 'Max',
  last_name: 'MultiRole',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
  accountType: 'business',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// ── Branches ─────────────────────────────────────────────────────────────────
const RAW_MOCK_BRANCHES: Branch[] = [
  {
    id: '1',
    name: 'Main Branch',
    slug: 'main',
    address: '123 Culinary Avenue',
    city: 'New York',
    phone_number: '+1 (212) 555-0100',
    email: 'main@samoon.com',
    lat: 40.7128,
    lng: -74.006,
    is_active: true,
    delivery_radius: 10,
    working_hours: [
      { day: 'Monday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Tuesday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Wednesday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Thursday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Friday', open: '10:00', close: '00:00', is_closed: false },
      { day: 'Saturday', open: '09:00', close: '00:00', is_closed: false },
      { day: 'Sunday', open: '11:00', close: '22:00', is_closed: false },
    ],
    images: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    ],
  },
  {
    id: '2',
    name: 'Downtown Branch',
    slug: 'downtown',
    address: '456 Urban Street',
    city: 'New York',
    phone_number: '+1 (212) 555-0200',
    lat: 40.72,
    lng: -73.99,
    is_active: true,
    delivery_radius: 8,
    working_hours: [
      { day: 'Monday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Tuesday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Wednesday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Thursday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Friday', open: '11:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '12:00', close: '21:00', is_closed: false },
    ],
    images: ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800'],
  },
  {
    id: '3',
    name: 'Airport Branch',
    slug: 'airport',
    address: 'JFK International Airport, Terminal 4',
    city: 'New York',
    phone_number: '+1 (212) 555-0300',
    lat: 40.6413,
    lng: -73.7781,
    is_active: true,
    delivery_radius: 2,
    working_hours: [
      { day: 'Monday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Tuesday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Wednesday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Thursday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Friday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '06:00', close: '23:00', is_closed: false },
    ],
    images: [],
  },
  {
    id: '4',
    name: 'Moscow Branch',
    slug: 'moscow',
    address: 'Moscow, Russia',
    city: 'Moscow',
    phone_number: '+7 (999) 999-9999',
    lat: 55.7558,
    lng: 37.6173,
    is_active: true,
    delivery_radius: 10,
    working_hours: [
      { day: 'Monday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Tuesday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Wednesday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Thursday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Friday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '06:00', close: '23:00', is_closed: false },
    ],
    images: [],
  },
]

export const MOCK_BRANCHES: Branch[] = RAW_MOCK_BRANCHES.map((branch, index) =>
  withLocationCheckout(branch, {
    radius: branch.delivery_radius ?? [10, 8, 2, 10][index] ?? null,
  }),
)

// ── Tenant-scoped branches (id = slug, consistent with publicBranchToLocation) ──
// P8.7.7.10 — used by branchService.getBranches(tenantId) so the reservation form
// shows branches that belong to the active tenant and whose ids match activeBranch.id.
const RAW_MOCK_TENANT_BRANCHES: Record<string, Branch[]> = {
  'tenant-samoon-01': [
    { id: 'main', slug: 'main', name: 'Main Branch', address: '123 Culinary Avenue', city: 'New York', phone_number: '+1 (212) 555-0100', lat: 40.7128, lng: -74.006, is_active: true, working_hours: [
      { day: 'Monday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Tuesday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Wednesday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Thursday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Friday', open: '10:00', close: '00:00', is_closed: false },
      { day: 'Saturday', open: '09:00', close: '00:00', is_closed: false },
      { day: 'Sunday', open: '11:00', close: '22:00', is_closed: false },
    ] },
    { id: 'downtown', slug: 'downtown', name: 'Downtown Branch', address: '456 Urban Street', city: 'New York', phone_number: '+1 (212) 555-0200', lat: 40.72, lng: -73.99, is_active: true, working_hours: [
      { day: 'Monday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Tuesday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Wednesday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Thursday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Friday', open: '11:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '12:00', close: '21:00', is_closed: false },
    ] },
    { id: 'airport', slug: 'airport', name: 'Airport Branch', address: 'JFK Terminal 4', city: 'New York', phone_number: '+1 (212) 555-0300', lat: 40.6413, lng: -73.7781, is_active: true, working_hours: [
      { day: 'Monday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Tuesday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Wednesday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Thursday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Friday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '06:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '06:00', close: '23:00', is_closed: false },
    ] },
  ],
  'tenant-brew-cafe-01': [
    { id: 'main', slug: 'main', name: 'Midtown Cafe', address: '789 Coffee Lane', city: 'New York', phone_number: '+1 (212) 555-0400', lat: 40.754, lng: -73.984, is_active: true, working_hours: [
      { day: 'Monday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Tuesday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Wednesday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Thursday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Friday', open: '07:00', close: '21:00', is_closed: false },
      { day: 'Saturday', open: '08:00', close: '21:00', is_closed: false },
      { day: 'Sunday', open: '09:00', close: '18:00', is_closed: false },
    ] },
    { id: 'brooklyn-cafe', slug: 'brooklyn-cafe', name: 'Brooklyn Cafe', address: '321 Brew Boulevard', city: 'Brooklyn', phone_number: '+1 (718) 555-0500', lat: 40.678, lng: -73.944, is_active: true, working_hours: [
      { day: 'Monday', open: '08:00', close: '19:00', is_closed: false },
      { day: 'Tuesday', open: '08:00', close: '19:00', is_closed: false },
      { day: 'Wednesday', open: '08:00', close: '19:00', is_closed: false },
      { day: 'Thursday', open: '08:00', close: '19:00', is_closed: false },
      { day: 'Friday', open: '08:00', close: '20:00', is_closed: false },
      { day: 'Saturday', open: '09:00', close: '20:00', is_closed: false },
      { day: 'Sunday', open: '10:00', close: '17:00', is_closed: false },
    ] },
  ],
  'tenant-oak-bar-01': [
    { id: 'main', slug: 'main', name: 'The Oak Bar', address: '789 Oak Street', city: 'Chicago', phone_number: '+1 (312) 555-0600', lat: 41.8781, lng: -87.6298, is_active: true, working_hours: [
      { day: 'Monday', open: '16:00', close: '02:00', is_closed: false },
      { day: 'Tuesday', open: '16:00', close: '02:00', is_closed: false },
      { day: 'Wednesday', open: '16:00', close: '02:00', is_closed: false },
      { day: 'Thursday', open: '16:00', close: '02:00', is_closed: false },
      { day: 'Friday', open: '15:00', close: '03:00', is_closed: false },
      { day: 'Saturday', open: '14:00', close: '03:00', is_closed: false },
      { day: 'Sunday', open: '14:00', close: '00:00', is_closed: false },
    ] },
  ],
  'tenant-central-fc-01': [
    { id: 'main', slug: 'main', name: 'Central Food Court', address: '500 Mall Drive', city: 'Los Angeles', phone_number: '+1 (323) 555-0700', lat: 34.0522, lng: -118.2437, is_active: true, working_hours: [
      { day: 'Monday', open: '10:00', close: '22:00', is_closed: false },
      { day: 'Tuesday', open: '10:00', close: '22:00', is_closed: false },
      { day: 'Wednesday', open: '10:00', close: '22:00', is_closed: false },
      { day: 'Thursday', open: '10:00', close: '22:00', is_closed: false },
      { day: 'Friday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '09:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '11:00', close: '21:00', is_closed: false },
    ] },
  ],
  'tenant-wheels-brews-01': [
    { id: 'main', slug: 'main', name: 'Wheels & Brews HQ', address: '100 Roaster Road', city: 'Austin', phone_number: '+1 (512) 555-0800', lat: 30.2672, lng: -97.7431, is_active: true, working_hours: [
      { day: 'Monday', open: '08:00', close: '18:00', is_closed: false },
      { day: 'Tuesday', open: '08:00', close: '18:00', is_closed: false },
      { day: 'Wednesday', open: '08:00', close: '18:00', is_closed: false },
      { day: 'Thursday', open: '08:00', close: '18:00', is_closed: false },
      { day: 'Friday', open: '08:00', close: '20:00', is_closed: false },
      { day: 'Saturday', open: '09:00', close: '20:00', is_closed: false },
      { day: 'Sunday', open: '10:00', close: '16:00', is_closed: false },
    ] },
  ],
  'tenant-road-bites-01': [
    { id: 'main', slug: 'main', name: 'Road Bites HQ', address: '200 Food Truck Row', city: 'Miami', phone_number: '+1 (305) 555-0900', lat: 25.7617, lng: -80.1918, is_active: true, working_hours: [
      { day: 'Monday', open: '11:00', close: '21:00', is_closed: false },
      { day: 'Tuesday', open: '11:00', close: '21:00', is_closed: false },
      { day: 'Wednesday', open: '11:00', close: '21:00', is_closed: false },
      { day: 'Thursday', open: '11:00', close: '21:00', is_closed: false },
      { day: 'Friday', open: '11:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '11:00', close: '20:00', is_closed: false },
    ] },
  ],
}

export const MOCK_TENANT_BRANCHES: Record<string, Branch[]> = Object.fromEntries(
  Object.entries(RAW_MOCK_TENANT_BRANCHES).map(([tenantId, branches]) => [
    tenantId,
    branches.map((branch) => withLocationCheckout(branch)),
  ]),
)

// ── Categories ────────────────────────────────────────────────────────────────
export const MOCK_CATEGORIES: Category[] = [
  { id: '1', branch_id: 'branch-rest-01', name: 'Pizza', slug: 'pizza', icon: '🍕', sort_order: 1, items_count: 8 , is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: '2', branch_id: 'branch-rest-01', name: 'Burger', slug: 'burger', icon: '🍔', sort_order: 2, items_count: 6 , is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: '3', branch_id: 'branch-rest-01', name: 'Pasta', slug: 'pasta', icon: '🍝', sort_order: 3, items_count: 5 , is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: '4', branch_id: 'branch-rest-01', name: 'Drinks', slug: 'drinks', icon: '🥤', sort_order: 4, items_count: 7 , is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: '5', branch_id: 'branch-rest-01', name: 'Desserts', slug: 'desserts', icon: '🍰', sort_order: 5, items_count: 6 , is_active: true, created_at: '2024-01-01T00:00:00Z' },
]

// ── Menu Tags (mock) ──────────────────────────────────────────────────────────

const MOCK_TAG_CATALOG: MenuItemTag[] = [
  { id: 1, name: 'Vegan', slug: 'vegan', icon: '🌱', image: '', color: '#2ecc71' },
  { id: 2, name: 'Vegetarian', slug: 'vegetarian', icon: '🥗', image: '', color: '#27ae60' },
  { id: 3, name: 'Halal', slug: 'halal', icon: '✡', image: '', color: '#3498db' },
  { id: 4, name: 'Gluten-Free', slug: 'gluten-free', icon: '🌾', image: '', color: '#f39c12' },
  { id: 5, name: 'Spicy', slug: 'spicy', icon: '🌶', image: '', color: '#e74c3c' },
  { id: 6, name: 'Classic', slug: 'classic', icon: '⭐', image: '', color: '#95a5a6' },
  { id: 7, name: 'Meat', slug: 'meat', icon: '🥩', image: '', color: '#c0392b' },
  { id: 8, name: 'Premium', slug: 'premium', icon: '✨', image: '', color: '#9b59b6' },
  { id: 9, name: 'Chicken', slug: 'chicken', icon: '🍗', image: '', color: '#e67e22' },
  { id: 10, name: 'Plant-Based', slug: 'plant-based', icon: '🌿', image: '', color: '#1abc9c' },
  { id: 11, name: 'Seafood', slug: 'seafood', icon: '🦐', image: '', color: '#2980b9' },
  { id: 12, name: 'Coffee', slug: 'coffee', icon: '☕', image: '', color: '#6f4e37' },
  { id: 13, name: 'Cold', slug: 'cold', icon: '🧊', image: '', color: '#00bcd4' },
  { id: 14, name: 'Refreshing', slug: 'refreshing', icon: '💧', image: '', color: '#00acc1' },
  { id: 15, name: 'Tropical', slug: 'tropical', icon: '🌴', image: '', color: '#43a047' },
  { id: 16, name: 'Chocolate', slug: 'chocolate', icon: '🍫', image: '', color: '#5d4037' },
  { id: 17, name: 'Healthy', slug: 'healthy', icon: '💚', image: '', color: '#66bb6a' },
  { id: 18, name: 'Grab & Go', slug: 'grab-and-go', icon: '🥡', image: '', color: '#78909c' },
]

const MOCK_TAG_BY_SLUG = new Map(MOCK_TAG_CATALOG.map((tag) => [tag.slug, tag]))

function mockItemTags(...slugs: string[]): MenuItemTag[] {
  return slugs.flatMap((slug) => {
    const tag = MOCK_TAG_BY_SLUG.get(slug)
    return tag ? [tag] : []
  })
}

// ── Menu Items ────────────────────────────────────────────────────────────────
export const MOCK_MENU_ITEMS: MenuItem[] = [
  // PIZZA
  {
    id: '1', branch_id: 'branch-rest-01', category_id: '1', name: 'Margherita Classic',
    slug: 'margherita-classic',
    description: 'San Marzano tomatoes, fresh mozzarella di bufala, hand-torn basil, extra virgin olive oil on our signature 72-hour cold-fermented dough.',
    price: 18.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600',
    images: [
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
    ],
    allergens: ['dairy', 'gluten'],
    calories: 850, preparation_time: 20, rating: 4.8, rating_count: 324,
    available: true, is_active: true, is_popular: true, is_featured: true,
    tags: mockItemTags('vegetarian', 'classic'),
    extras: [
      { id: 'e1', name: 'Extra Cheese', price: 2.50, available: true },
      { id: 'e2', name: 'Truffle Oil', price: 3.00, available: true },
    ],
    // Demonstrates Console-managed Extra Group assignment (see
    // MOCK_MAIN_EXTRA_GROUPS) alongside the legacy inline `extras` above.
    extra_group_ids: ['grp-size', 'grp-sauces'],
  },
  {
    id: '2', branch_id: 'branch-rest-01', category_id: '1', name: 'Diavola',
    slug: 'diavola',
    description: 'Spicy Calabrian salami, fresh chili, smoked mozzarella, and a drizzle of chili-infused olive oil.',
    price: 22.99, discount: 10,
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600',
    calories: 1050, preparation_time: 22, rating: 4.7, rating_count: 198,
    available: true, is_active: true, is_new: true,
    tags: mockItemTags('spicy', 'meat'),
    extras: [{ id: 'e1', name: 'Extra Cheese', price: 2.50, available: true }],
  },
  {
    id: '3', branch_id: 'branch-rest-01', category_id: '1', name: 'Quattro Stagioni',
    slug: 'quattro-stagioni',
    description: 'Four seasons pizza: artichokes, ham, mushrooms, and olives — each quadrant celebrating a unique flavor.',
    price: 24.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600',
    calories: 980, preparation_time: 25, rating: 4.6, rating_count: 145,
    available: true, is_active: true,
    tags: mockItemTags('classic', 'meat'),
    extras: [],
  },
  {
    id: '4', branch_id: 'branch-rest-01', category_id: '1', name: 'Truffle Mushroom',
    slug: 'truffle-mushroom',
    description: 'Wild mushroom medley, black truffle shavings, taleggio cheese, and fresh thyme on white sauce.',
    price: 28.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
    calories: 920, preparation_time: 25, rating: 4.9, rating_count: 267,
    available: true, is_active: true, is_featured: true,
    tags: mockItemTags('vegetarian', 'premium'),
    extras: [{ id: 'e2', name: 'Truffle Oil', price: 3.00, available: true }],
  },

  // BURGERS
  {
    id: '5', branch_id: 'branch-rest-01', category_id: '2', name: 'Wagyu Smash',
    slug: 'wagyu-smash',
    description: 'Double wagyu beef smash patty, aged cheddar, caramelized onions, pickles, house sauce on brioche bun.',
    price: 24.99, discount: 15,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
    calories: 1200, preparation_time: 15, rating: 4.9, rating_count: 412,
    available: true, is_active: true, is_popular: true, is_featured: true,
    tags: mockItemTags('meat', 'premium'),
    extras: [
      { id: 'e3', name: 'Bacon', price: 2.00, available: true },
      { id: 'e4', name: 'Avocado', price: 1.50, available: true },
      { id: 'e5', name: 'Extra Patty', price: 4.00, available: true },
    ],
  },
  {
    id: '6', branch_id: 'branch-rest-01', category_id: '2', name: 'Crispy Chicken',
    slug: 'crispy-chicken',
    description: 'Buttermilk-brined fried chicken, jalapeño slaw, honey hot sauce, dill pickles on potato bun.',
    price: 19.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600',
    calories: 980, preparation_time: 18, rating: 4.7, rating_count: 289,
    available: true, is_active: true, is_new: true,
    tags: mockItemTags('chicken', 'spicy'),
    extras: [{ id: 'e4', name: 'Avocado', price: 1.50, available: true }],
  },
  {
    id: '7', branch_id: 'branch-rest-01', category_id: '2', name: 'Black Bean Royale',
    slug: 'black-bean-royale',
    description: 'Spiced black bean patty, cashew cheese, roasted peppers, arugula, chipotle mayo on whole grain bun.',
    price: 17.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=600',
    calories: 720, preparation_time: 15, rating: 4.5, rating_count: 156,
    available: true, is_active: true,
    tags: mockItemTags('vegan', 'plant-based'),
    extras: [],
  },

  // PASTA
  {
    id: '8', branch_id: 'branch-rest-01', category_id: '3', name: 'Carbonara Autentica',
    slug: 'carbonara-autentica',
    description: 'Rigatoni, guanciale, Pecorino Romano, Parmigiano-Reggiano, free-range egg yolk. The Roman way, no cream.',
    price: 21.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600',
    calories: 880, preparation_time: 20, rating: 4.9, rating_count: 378,
    available: true, is_active: true, is_featured: true, is_popular: true,
    tags: mockItemTags('classic', 'meat'),
    extras: [{ id: 'e6', name: 'Extra Guanciale', price: 3.00, available: true }],
  },
  {
    id: '9', branch_id: 'branch-rest-01', category_id: '3', name: 'Lobster Linguine',
    slug: 'lobster-linguine',
    description: 'Fresh Maine lobster, cherry tomatoes, garlic, white wine, chili, and parsley in olive oil sauce.',
    price: 38.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600',
    calories: 760, preparation_time: 25, rating: 4.8, rating_count: 201,
    available: true, is_active: true,
    tags: mockItemTags('seafood', 'premium'),
    extras: [],
  },

  // DRINKS
  {
    id: '10', branch_id: 'branch-rest-01', category_id: '4', name: 'Cold Brew Coffee',
    slug: 'cold-brew-coffee',
    description: 'Single-origin Ethiopian beans, 24-hour cold extraction, served over crystal-clear ice.',
    price: 7.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600',
    calories: 15, preparation_time: 2, rating: 4.7, rating_count: 445,
    available: true, is_active: true, is_popular: true,
    tags: mockItemTags('coffee', 'cold'),
    extras: [
      { id: 'e7', name: 'Oat Milk', price: 1.00, available: true },
      { id: 'e8', name: 'Vanilla Syrup', price: 0.75, available: true },
    ],
  },
  {
    id: '11', branch_id: 'branch-rest-01', category_id: '4', name: 'Mango Lassi',
    slug: 'mango-lassi',
    description: 'Alphonso mangoes, whole-milk yogurt, cardamom, and a hint of rose water.',
    price: 6.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1582126892906-5ba118eaf46b?w=600',
    calories: 220, preparation_time: 3, rating: 4.8, rating_count: 289,
    available: true, is_active: true,
    tags: mockItemTags('refreshing', 'tropical'),
    extras: [],
  },

  // DESSERTS
  {
    id: '12', branch_id: 'branch-rest-01', category_id: '5', name: 'Crème Brûlée',
    slug: 'creme-brulee',
    description: 'Classic French custard with Madagascar vanilla, torched caramel crust, served with fresh berries.',
    price: 11.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=600',
    calories: 420, preparation_time: 10, rating: 4.9, rating_count: 312,
    available: true, is_active: true, is_featured: true, is_popular: true,
    tags: mockItemTags('classic', 'vegetarian'),
    extras: [],
  },
  {
    id: '13', branch_id: 'branch-rest-01', category_id: '5', name: 'Molten Lava Cake',
    slug: 'molten-lava-cake',
    description: '72% Valrhona chocolate, salted caramel core, served warm with vanilla bean gelato.',
    price: 13.99, discount: 20,
    image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600',
    calories: 580, preparation_time: 12, rating: 4.8, rating_count: 267,
    available: true, is_active: true, is_popular: true,
    tags: mockItemTags('chocolate', 'vegetarian'),
    extras: [{ id: 'e9', name: 'Extra Ice Cream', price: 2.00, available: true }],
  },
]

// ── Branch-scoped menu data ───────────────────────────────────────────────────
// tenant-samoon-01 has three branches (main/downtown/airport, see
// MOCK_TENANT_BRANCHES above). `main` uses MOCK_CATEGORIES/MOCK_MENU_ITEMS
// above; the other branches get their own, entirely independent category and
// item objects — never the same object references — so editing one branch's
// menu can never mutate another branch's data.
export const MOCK_DOWNTOWN_CATEGORIES: Category[] = [
  { id: 'dt-1', branch_id: 'branch-rest-02', name: 'Express Bowls', slug: 'express-bowls', icon: '🥗', sort_order: 1, items_count: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'dt-2', branch_id: 'branch-rest-02', name: 'Coffee', slug: 'coffee', icon: '☕', sort_order: 2, items_count: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_DOWNTOWN_ITEMS: MenuItem[] = [
  {
    id: 'dt-item-1', branch_id: 'branch-rest-02', category_id: 'dt-1', name: 'Downtown Power Bowl',
    slug: 'downtown-power-bowl',
    description: 'Quinoa, grilled chicken, avocado, lime dressing — built for a fast lunch break.',
    price: 13.50, discount: 0,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600',
    calories: 540, preparation_time: 8, rating: 4.6, rating_count: 54,
    available: true, is_active: true, is_popular: true,
    tags: mockItemTags('healthy'),
    extras: [{ id: 'dt-e1', name: 'Extra Chicken', price: 3.00, available: true }],
  },
  {
    id: 'dt-item-2', branch_id: 'branch-rest-02', category_id: 'dt-2', name: 'Downtown Espresso',
    slug: 'downtown-espresso',
    description: 'Double shot, locally roasted beans.',
    price: 3.50, discount: 0,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
    calories: 5, preparation_time: 3, rating: 4.7, rating_count: 88,
    available: true, is_active: true,
    tags: mockItemTags('coffee'),
    extras: [],
  },
]

export const MOCK_AIRPORT_CATEGORIES: Category[] = [
  { id: 'ap-1', branch_id: 'branch-rest-03', name: 'Grab & Go', slug: 'grab-and-go', icon: '🥪', sort_order: 1, items_count: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_AIRPORT_ITEMS: MenuItem[] = [
  {
    id: 'ap-item-1', branch_id: 'branch-rest-03', category_id: 'ap-1', name: 'Terminal Club Sandwich',
    slug: 'terminal-club-sandwich',
    description: 'Turkey, bacon, swiss, sourdough — packaged for security lines.',
    price: 11.00, discount: 0,
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=600',
    calories: 610, preparation_time: 2, rating: 4.2, rating_count: 31,
    available: true, is_active: true,
    tags: mockItemTags('grab-and-go'),
    extras: [],
  },
]

/** Resolves a branch's independent category set in mock/dev mode. Defaults to the primary branch for any unlisted branch id. */
export const MOCK_BRANCH_CATEGORIES: Record<string, Category[]> = {
  'branch-rest-01': MOCK_CATEGORIES,
  'branch-rest-02': MOCK_DOWNTOWN_CATEGORIES,
  'branch-rest-03': MOCK_AIRPORT_CATEGORIES,
}

/** Resolves a branch's independent item set in mock/dev mode. Defaults to the primary branch for any unlisted branch id. */
export const MOCK_BRANCH_ITEMS: Record<string, MenuItem[]> = {
  'branch-rest-01': MOCK_MENU_ITEMS,
  'branch-rest-02': MOCK_DOWNTOWN_ITEMS,
  'branch-rest-03': MOCK_AIRPORT_ITEMS,
}

const DEFAULT_MOCK_AVAILABLE_TAGS: MenuTag[] = [
  { ...MOCK_TAG_BY_SLUG.get('vegan')!, item_count: 1 },
  { ...MOCK_TAG_BY_SLUG.get('vegetarian')!, item_count: 4 },
  { ...MOCK_TAG_BY_SLUG.get('halal')!, item_count: 0 },
  { ...MOCK_TAG_BY_SLUG.get('gluten-free')!, item_count: 0 },
  { ...MOCK_TAG_BY_SLUG.get('spicy')!, item_count: 2 },
]

export const MOCK_BRANCH_AVAILABLE_TAGS: Record<string, MenuTag[]> = {
  'branch-rest-01': DEFAULT_MOCK_AVAILABLE_TAGS,
  'branch-rest-02': DEFAULT_MOCK_AVAILABLE_TAGS,
  'branch-rest-03': DEFAULT_MOCK_AVAILABLE_TAGS,
}

const mockConsoleTagsStore: Record<string, ConsoleMenuTag[]> = {}

export function getMockConsoleTags(branchId: string): ConsoleMenuTag[] {
  if (!mockConsoleTagsStore[branchId]) {
    const counts = new Map(DEFAULT_MOCK_AVAILABLE_TAGS.map((t) => [t.id, t.item_count]))
    mockConsoleTagsStore[branchId] = MOCK_TAG_CATALOG.map((tag, index) => ({
      ...tag,
      branch_id: branchId,
      description: '',
      is_active: true,
      display_order: index + 1,
      item_count: counts.get(tag.id) ?? 0,
      created_at: '2024-01-01T00:00:00Z',
    }))
  }
  return mockConsoleTagsStore[branchId]
}

export function setMockConsoleTags(branchId: string, tags: ConsoleMenuTag[]): void {
  mockConsoleTagsStore[branchId] = tags
}

// ── Extra Groups & Extras ──────────────────────────────────────────────────────
// Branch-scoped, independent of both Category and MenuItem — a group belongs to
// exactly one branch, and its Extras belong to exactly one group. `main`'s data
// below is the working example from the task ("Size", "Sauces", "Toppings",
// "Drinks"); `downtown`/`airport` get their own, separate groups/extras — never
// the same object references — so branch isolation is provable in mock/dev mode
// exactly like MOCK_DOWNTOWN_CATEGORIES/MOCK_AIRPORT_CATEGORIES already are.

export const MOCK_MAIN_EXTRA_GROUPS: ExtraGroup[] = [
  { id: 'grp-size', branch_id: 'branch-rest-01', name: 'Size', description: 'Choose one size', selection_type: 'single', required: true, min_selection: 1, max_selection: 1, order: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'grp-sauces', branch_id: 'branch-rest-01', name: 'Sauces', description: 'Add extra sauces', selection_type: 'multiple', required: false, min_selection: 0, max_selection: 3, order: 2, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'grp-toppings', branch_id: 'branch-rest-01', name: 'Toppings', description: 'Customize with toppings', selection_type: 'multiple', required: false, min_selection: 0, max_selection: 5, order: 3, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'grp-drinks', branch_id: 'branch-rest-01', name: 'Drinks', description: 'Add a drink', selection_type: 'single', required: false, min_selection: 0, max_selection: 1, order: 4, is_active: true, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_MAIN_EXTRAS: Extra[] = [
  { id: 'ext-size-reg', branch_id: 'branch-rest-01', group_id: 'grp-size', name: 'Regular', price: 0, available: true, order: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-size-lg', branch_id: 'branch-rest-01', group_id: 'grp-size', name: 'Large', price: 3.00, available: true, order: 2, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-sauce-cheese', branch_id: 'branch-rest-01', group_id: 'grp-sauces', name: 'Extra Cheese', description: 'Extra mozzarella', price: 2.50, available: true, order: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-sauce-truffle', branch_id: 'branch-rest-01', group_id: 'grp-sauces', name: 'Truffle Oil', price: 3.00, available: true, order: 2, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-topping-bacon', branch_id: 'branch-rest-01', group_id: 'grp-toppings', name: 'Bacon', price: 2.00, available: true, order: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-topping-avocado', branch_id: 'branch-rest-01', group_id: 'grp-toppings', name: 'Avocado', price: 1.50, available: true, order: 2, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-drink-cola', branch_id: 'branch-rest-01', group_id: 'grp-drinks', name: 'Cola', price: 2.99, available: true, order: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-drink-lemonade', branch_id: 'branch-rest-01', group_id: 'grp-drinks', name: 'Lemonade', price: 3.49, available: true, order: 2, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_DOWNTOWN_EXTRA_GROUPS: ExtraGroup[] = [
  { id: 'grp-dt-milk', branch_id: 'branch-rest-02', name: 'Milk Options', description: 'Choose your milk', selection_type: 'single', required: true, min_selection: 1, max_selection: 1, order: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_DOWNTOWN_EXTRAS: Extra[] = [
  { id: 'ext-dt-oat', branch_id: 'branch-rest-02', group_id: 'grp-dt-milk', name: 'Oat Milk', price: 1.00, available: true, order: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'ext-dt-almond', branch_id: 'branch-rest-02', group_id: 'grp-dt-milk', name: 'Almond Milk', price: 1.00, available: true, order: 2, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_AIRPORT_EXTRA_GROUPS: ExtraGroup[] = [
  { id: 'grp-ap-sides', branch_id: 'branch-rest-03', name: 'Sides', description: 'Add a side', selection_type: 'multiple', required: false, min_selection: 0, max_selection: 2, order: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_AIRPORT_EXTRAS: Extra[] = [
  { id: 'ext-ap-chips', branch_id: 'branch-rest-03', group_id: 'grp-ap-sides', name: 'Chips', price: 1.50, available: true, order: 1, created_at: '2024-01-01T00:00:00Z' },
]

/** Resolves a branch's independent Extra Group set in mock/dev mode. Defaults to the primary branch for any unlisted branch id. */
export const MOCK_BRANCH_EXTRA_GROUPS: Record<string, ExtraGroup[]> = {
  'branch-rest-01': MOCK_MAIN_EXTRA_GROUPS,
  'branch-rest-02': MOCK_DOWNTOWN_EXTRA_GROUPS,
  'branch-rest-03': MOCK_AIRPORT_EXTRA_GROUPS,
}

/** Resolves a branch's independent Extra set in mock/dev mode. Defaults to the primary branch for any unlisted branch id. */
export const MOCK_BRANCH_EXTRAS: Record<string, Extra[]> = {
  'branch-rest-01': MOCK_MAIN_EXTRAS,
  'branch-rest-02': MOCK_DOWNTOWN_EXTRAS,
  'branch-rest-03': MOCK_AIRPORT_EXTRAS,
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const MOCK_ORDERS: Partial<Order>[] = [
  {
    id: 'ord-001',
    order_number: '#3847',
    branch_id: 'branch-rest-01',
    status: 'delivered',
    order_type: 'delivery',
    total: 79.96,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    items: [
      { id: '1', menu_item: MOCK_MENU_ITEMS[0], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 3, unit_price: 18.99, total_price: 56.97, extras: [] }, 
      { id: '2', menu_item: MOCK_MENU_ITEMS[1], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 22.99, total_price: 22.99, extras: [] },
    ],
    payment_method: 'card',
    payment_status: 'paid',
  },
  {
    id: 'ord-002',
    order_number: '#3901',
    branch_id: 'branch-rest-02',
    status: 'preparing',
    order_type: 'dine_in',
    total: 228.86,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    items: [
      { id: '1', menu_item: MOCK_MENU_ITEMS[0], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 3, unit_price: 18.99, total_price: 56.97, extras: [] }, 
      { id: '2', menu_item: MOCK_MENU_ITEMS[1], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 22.99, total_price: 22.99, extras: [] },
      { id: '3', menu_item: MOCK_MENU_ITEMS[2], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 24.99, total_price: 24.99, extras: [] },
      { id: '4', menu_item: MOCK_MENU_ITEMS[3], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 28.99, total_price: 28.99, extras: [] },
      { id: '5', menu_item: MOCK_MENU_ITEMS[4], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 24.99, total_price: 24.99, extras: [] },
      { id: '6', menu_item: MOCK_MENU_ITEMS[5], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 2, unit_price: 19.99, total_price: 39.98, extras: [] },
      { id: '7', menu_item: MOCK_MENU_ITEMS[6], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 17.99, total_price: 17.99, extras: [] },
      { id: '8', menu_item: MOCK_MENU_ITEMS[7], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 21.99, total_price: 21.99, extras: [] },
      { id: '9', menu_item: MOCK_MENU_ITEMS[8], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 2, unit_price: 38.99, total_price: 77.98, extras: [] },
      { id: '10', menu_item: MOCK_MENU_ITEMS[9], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 7.99, total_price: 7.99, extras: [] },
      { id: '11', menu_item: MOCK_MENU_ITEMS[10], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 6.99, total_price: 6.99, extras: [] },
      { id: '12', menu_item: MOCK_MENU_ITEMS[11], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 11.99, total_price: 11.99, extras: [] },
      { id: '13', menu_item: MOCK_MENU_ITEMS[12], image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600', name: 'Bacon', quantity: 1, unit_price: 13.99, total_price: 13.99, extras: [] },
    ],    payment_method: 'card',
    payment_status: 'paid',
  },
]

// ── Notifications ─────────────────────────────────────────────────────────────
export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'order_update',
    title: 'Order Ready!',
    message: 'Your order #3901 is ready for pickup.',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    data: { order_id: 'ord-002' },
  },
  {
    id: 'n2',
    type: 'promotion',
    title: '20% Off This Weekend',
    message: 'Use code WEEKEND20 for 20% off your next order this weekend only.',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'n3',
    type: 'reservation_update',
    title: 'Reservation Confirmed',
    message: 'Your table for 4 on Saturday at 7:30 PM has been confirmed.',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'n4',
    type: 'system',
    title: 'Welcome to Samoon!',
    message: 'Thanks for joining us. Explore our menu and enjoy 10% off your first order.',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
]

// ── Reservations ─────────────────────────────────────────────────────────────
export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'res-001',
    branch_id: '1',
    date: '2025-02-15',
    time: '19:30',
    guests: 4,
    name: 'John Doe',
    phone_number: '+1234567890',
    email: 'john@example.com',
    status: 'confirmed',
    confirmation_code: 'SAV-8472',
    notes: 'Window seat preferred',
    created_at: new Date().toISOString(),
  },
]

// ── P8.9.6 — Platform Customer Identity ──────────────────────────────────────
//
// PlatformUser = one record per real person, created at registration.
// Phone is the primary identifier (phone_number-first auth per P8.9.3).
// These users are NOT customers of any specific business until they interact.
//
// Tenant IDs used below:
//   tenant-samoon-01         (restaurant — 3 branches: main, downtown, airport)
//   tenant-brew-cafe-01     (cafe       — 2 branches: main/midtown, brooklyn-cafe)
//   tenant-oak-bar-01       (bar        — 1 branch:   main)
//   tenant-central-fc-01    (food court — 1 branch:   main)
//   tenant-wheels-brews-01  (mobile cafe — 1 branch:  main)
//   tenant-road-bites-01    (food truck — 1 branch:   main)

export const MOCK_PLATFORM_USERS: PlatformUser[] = [
  // ── Regular cross-business users ──
  { id: 'pu-001', phone_number: '+12125550101', name: 'Alice Johnson',   email: 'alice@example.com',   avatar: undefined, language: 'en', created_at: '2023-06-15T10:00:00Z', status: 'active' },
  { id: 'pu-002', phone_number: '+12125550102', name: 'Bob Smith',       email: 'bob@example.com',     avatar: undefined, language: 'en', created_at: '2023-07-20T09:30:00Z', status: 'active' },
  { id: 'pu-003', phone_number: '+12125550103', name: 'Carol Davis',     email: 'carol@example.com',   avatar: undefined, language: 'en', created_at: '2023-04-10T14:00:00Z', status: 'active' },
  { id: 'pu-004', phone_number: '+12125550104', name: 'David Wilson',    email: undefined,             avatar: undefined, language: 'en', created_at: '2024-01-05T11:00:00Z', status: 'active' },
  { id: 'pu-005', phone_number: '+12125550105', name: 'Emma Brown',      email: 'emma@example.com',    avatar: undefined, language: 'en', created_at: '2023-03-01T08:00:00Z', status: 'active' },
  { id: 'pu-006', phone_number: '+12125550106', name: 'Frank Garcia',    email: 'frank@example.com',   avatar: undefined, language: 'es', created_at: '2023-09-12T13:00:00Z', status: 'active' },
  { id: 'pu-007', phone_number: '+12125550107', name: 'Grace Lee',       email: 'grace@example.com',   avatar: undefined, language: 'en', created_at: '2023-11-08T16:00:00Z', status: 'active' },
  { id: 'pu-008', phone_number: '+12125550108', name: 'Henry Martinez',  email: undefined,             avatar: undefined, language: 'es', created_at: '2024-02-14T10:30:00Z', status: 'active' },
  { id: 'pu-009', phone_number: '+12125550109', name: 'Iris Chen',       email: 'iris@example.com',    avatar: undefined, language: 'zh', created_at: '2023-08-25T15:00:00Z', status: 'active' },
  { id: 'pu-010', phone_number: '+12125550110', name: 'James Taylor',    email: 'james@example.com',   avatar: undefined, language: 'en', created_at: '2023-05-30T12:00:00Z', status: 'active' },
  { id: 'pu-011', phone_number: '+12125550111', name: 'Karen White',     email: 'karen@example.com',   avatar: undefined, language: 'en', created_at: '2023-10-17T09:00:00Z', status: 'active' },
  { id: 'pu-012', phone_number: '+12125550112', name: 'Liam Anderson',   email: undefined,             avatar: undefined, language: 'en', created_at: '2024-03-22T14:00:00Z', status: 'active' },
  { id: 'pu-013', phone_number: '+12125550113', name: 'Mia Jackson',     email: 'mia@example.com',     avatar: undefined, language: 'en', created_at: '2023-12-01T10:00:00Z', status: 'active' },
  { id: 'pu-014', phone_number: '+12125550114', name: 'Noah Harris',     email: 'noah@example.com',    avatar: undefined, language: 'en', created_at: '2023-07-07T11:00:00Z', status: 'active' },
  { id: 'pu-015', phone_number: '+12125550115', name: 'Olivia Thomas',   email: 'olivia@example.com',  avatar: undefined, language: 'en', created_at: '2023-02-20T08:30:00Z', status: 'active' },
  { id: 'pu-016', phone_number: '+12125550116', name: 'Peter Robinson',  email: 'peter@example.com',   avatar: undefined, language: 'en', created_at: '2024-04-10T13:00:00Z', status: 'active' },
  { id: 'pu-017', phone_number: '+12125550117', name: 'Quinn Walker',    email: undefined,             avatar: undefined, language: 'en', created_at: '2024-01-18T16:00:00Z', status: 'active' },
  { id: 'pu-018', phone_number: '+12125550118', name: 'Rachel Hall',     email: 'rachel@example.com',  avatar: undefined, language: 'en', created_at: '2023-06-30T09:30:00Z', status: 'active' },
  { id: 'pu-019', phone_number: '+12125550119', name: 'Samuel Young',    email: 'samuel@example.com',  avatar: undefined, language: 'en', created_at: '2023-09-05T10:00:00Z', status: 'active' },
  { id: 'pu-020', phone_number: '+12125550120', name: 'Tina King',       email: 'tina@example.com',    avatar: undefined, language: 'en', created_at: '2023-04-15T14:30:00Z', status: 'active' },
  // ── Additional users for realistic list density ──
  { id: 'pu-021', phone_number: '+12125550121', name: 'Uma Scott',       email: 'uma@example.com',     avatar: undefined, language: 'en', created_at: '2024-05-01T11:00:00Z', status: 'active' },
  { id: 'pu-022', phone_number: '+12125550122', name: 'Victor Green',    email: undefined,             avatar: undefined, language: 'pt', created_at: '2024-02-28T09:00:00Z', status: 'active' },
  { id: 'pu-023', phone_number: '+12125550123', name: 'Wendy Adams',     email: 'wendy@example.com',   avatar: undefined, language: 'en', created_at: '2023-11-20T15:00:00Z', status: 'active' },
  { id: 'pu-024', phone_number: '+12125550124', name: 'Xavier Baker',    email: 'xavier@example.com',  avatar: undefined, language: 'en', created_at: '2023-08-14T10:00:00Z', status: 'active' },
  { id: 'pu-025', phone_number: '+12125550125', name: 'Yara Nelson',     email: 'yara@example.com',    avatar: undefined, language: 'ar', created_at: '2024-01-30T12:00:00Z', status: 'active' },
  { id: 'pu-026', phone_number: '+12125550126', name: 'Zoe Carter',      email: 'zoe@example.com',     avatar: undefined, language: 'en', created_at: '2023-10-05T09:30:00Z', status: 'active' },
  { id: 'pu-027', phone_number: '+12125550127', name: 'Aaron Mitchell',  email: undefined,             avatar: undefined, language: 'en', created_at: '2024-03-08T14:00:00Z', status: 'active' },
  { id: 'pu-028', phone_number: '+12125550128', name: 'Bella Perez',     email: 'bella@example.com',   avatar: undefined, language: 'es', created_at: '2023-12-18T11:00:00Z', status: 'active' },
  { id: 'pu-029', phone_number: '+12125550129', name: 'Carlos Rivera',   email: 'carlos@example.com',  avatar: undefined, language: 'es', created_at: '2023-05-22T10:30:00Z', status: 'active' },
  { id: 'pu-030', phone_number: '+12125550130', name: 'Diana Evans',     email: 'diana@example.com',   avatar: undefined, language: 'en', created_at: '2023-07-11T08:00:00Z', status: 'active' },
  // ── Suspended / inactive users (edge case testing) ──
  { id: 'pu-031', phone_number: '+12125550131', name: 'Ethan Collins',   email: 'ethan@example.com',   avatar: undefined, language: 'en', created_at: '2023-09-29T13:00:00Z', status: 'suspended' },
  { id: 'pu-032', phone_number: '+12125550132', name: 'Fiona Stewart',   email: undefined,             avatar: undefined, language: 'en', created_at: '2024-04-20T10:00:00Z', status: 'inactive' },
]

// ── BusinessCustomer — per-tenant relationships ───────────────────────────────
//
// Each BusinessCustomer links one PlatformUser to one tenant.
// Metrics (ordersCount, totalSpent, loyaltyPoints) are SCOPED to this tenant only.
// A user visiting both samoon-01 and brew-cafe-01 gets two separate BusinessCustomer records.

export const MOCK_BUSINESS_CUSTOMERS: BusinessCustomer[] = [
  // ── tenant-samoon-01 (restaurant, 3 branches) ──
  { id: 'bc-s01-001', userId: 'pu-001', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-06-20T12:00:00Z', lastInteractionAt: '2024-05-10T19:30:00Z', ordersCount: 14, reservationsCount: 3, totalSpent: 420.50, favorite: true,  lifetimeValue: 420.50, lastBranchId: 'downtown', loyaltyPoints: 1240, loyaltyTier: 'gold',     status: 'active' },
  { id: 'bc-s01-002', userId: 'pu-002', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-08-05T13:00:00Z', lastInteractionAt: '2024-04-20T20:00:00Z', ordersCount: 6,  reservationsCount: 1, totalSpent: 180.00, favorite: false, lifetimeValue: 180.00, lastBranchId: 'main',     loyaltyPoints: 420,  loyaltyTier: 'silver',   status: 'active' },
  { id: 'bc-s01-003', userId: 'pu-003', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-04-12T18:00:00Z', lastInteractionAt: '2024-05-15T20:30:00Z', ordersCount: 22, reservationsCount: 6, totalSpent: 890.75, favorite: true,  lifetimeValue: 890.75, lastBranchId: 'airport',  loyaltyPoints: 2680, loyaltyTier: 'platinum', status: 'active' },
  { id: 'bc-s01-004', userId: 'pu-004', tenantId: 'tenant-samoon-01', firstInteractionAt: '2024-01-10T12:30:00Z', lastInteractionAt: '2024-01-10T12:30:00Z', ordersCount: 1,  reservationsCount: 0, totalSpent: 29.99,  favorite: false, lifetimeValue: 29.99,  lastBranchId: 'main',     loyaltyPoints: 90,   loyaltyTier: 'bronze',   status: 'active' },
  { id: 'bc-s01-005', userId: 'pu-005', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-03-05T19:00:00Z', lastInteractionAt: '2024-05-18T21:00:00Z', ordersCount: 18, reservationsCount: 4, totalSpent: 650.00, favorite: true,  lifetimeValue: 650.00, lastBranchId: 'downtown', loyaltyPoints: 1950, loyaltyTier: 'gold',     status: 'active' },
  { id: 'bc-s01-006', userId: 'pu-006', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-09-18T13:30:00Z', lastInteractionAt: '2024-03-30T20:00:00Z', ordersCount: 9,  reservationsCount: 2, totalSpent: 310.25, favorite: false, lifetimeValue: 310.25, lastBranchId: 'main',     loyaltyPoints: 930,  loyaltyTier: 'silver',   status: 'active' },
  { id: 'bc-s01-007', userId: 'pu-007', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-11-12T18:30:00Z', lastInteractionAt: '2024-04-25T19:30:00Z', ordersCount: 7,  reservationsCount: 1, totalSpent: 245.00, favorite: false, lifetimeValue: 245.00, lastBranchId: 'airport',  loyaltyPoints: 735,  loyaltyTier: 'silver',   status: 'active' },
  { id: 'bc-s01-008', userId: 'pu-008', tenantId: 'tenant-samoon-01', firstInteractionAt: '2024-02-20T20:00:00Z', lastInteractionAt: '2024-04-05T19:00:00Z', ordersCount: 3,  reservationsCount: 1, totalSpent: 89.50,  favorite: false, lifetimeValue: 89.50,  lastBranchId: 'main',     loyaltyPoints: 270,  loyaltyTier: 'bronze',   status: 'active' },
  { id: 'bc-s01-009', userId: 'pu-009', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-08-28T12:00:00Z', lastInteractionAt: '2024-05-08T13:00:00Z', ordersCount: 11, reservationsCount: 2, totalSpent: 380.00, favorite: true,  lifetimeValue: 380.00, lastBranchId: 'downtown', loyaltyPoints: 1140, loyaltyTier: 'gold',     status: 'active' },
  { id: 'bc-s01-010', userId: 'pu-010', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-06-02T19:30:00Z', lastInteractionAt: '2024-05-01T20:00:00Z', ordersCount: 15, reservationsCount: 3, totalSpent: 510.00, favorite: false, lifetimeValue: 510.00, lastBranchId: 'main',     loyaltyPoints: 1530, loyaltyTier: 'gold',     status: 'active' },
  { id: 'bc-s01-011', userId: 'pu-011', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-10-20T18:00:00Z', lastInteractionAt: '2024-04-15T19:00:00Z', ordersCount: 8,  reservationsCount: 2, totalSpent: 275.00, favorite: false, lifetimeValue: 275.00, lastBranchId: 'downtown', loyaltyPoints: 825,  loyaltyTier: 'silver',   status: 'active' },
  { id: 'bc-s01-012', userId: 'pu-013', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-12-05T20:00:00Z', lastInteractionAt: '2024-03-20T21:00:00Z', ordersCount: 5,  reservationsCount: 1, totalSpent: 165.00, favorite: false, lifetimeValue: 165.00, lastBranchId: 'main',     loyaltyPoints: 495,  loyaltyTier: 'bronze',   status: 'active' },
  { id: 'bc-s01-013', userId: 'pu-015', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-02-25T19:00:00Z', lastInteractionAt: '2024-05-12T20:30:00Z', ordersCount: 28, reservationsCount: 7, totalSpent: 1120.00, favorite: true, lifetimeValue: 1120.00, lastBranchId: 'downtown', loyaltyPoints: 3360, loyaltyTier: 'platinum', status: 'active' },
  { id: 'bc-s01-014', userId: 'pu-018', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-07-05T18:30:00Z', lastInteractionAt: '2024-04-28T19:30:00Z', ordersCount: 12, reservationsCount: 2, totalSpent: 420.00, favorite: false, lifetimeValue: 420.00, lastBranchId: 'airport',  loyaltyPoints: 1260, loyaltyTier: 'gold',     status: 'active' },
  { id: 'bc-s01-015', userId: 'pu-020', tenantId: 'tenant-samoon-01', firstInteractionAt: '2023-04-18T13:00:00Z', lastInteractionAt: '2024-05-05T12:30:00Z', ordersCount: 16, reservationsCount: 4, totalSpent: 555.00, favorite: true,  lifetimeValue: 555.00, lastBranchId: 'main',     loyaltyPoints: 1665, loyaltyTier: 'gold',     status: 'active' },

  // ── tenant-brew-cafe-01 (cafe, 2 branches) ──
  // Note: pu-001 (Alice) also visits the cafe — she has TWO BusinessCustomer records across the platform
  { id: 'bc-bc01-001', userId: 'pu-001', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2023-07-01T08:30:00Z', lastInteractionAt: '2024-05-12T09:00:00Z', ordersCount: 31, reservationsCount: 0, totalSpent: 248.00, favorite: true,  lifetimeValue: 248.00, lastBranchId: 'main',           loyaltyPoints: 744,  loyaltyTier: 'gold',   status: 'active' },
  { id: 'bc-bc01-002', userId: 'pu-003', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2023-05-10T07:45:00Z', lastInteractionAt: '2024-05-14T08:30:00Z', ordersCount: 45, reservationsCount: 0, totalSpent: 360.00, favorite: true,  lifetimeValue: 360.00, lastBranchId: 'brooklyn-cafe',  loyaltyPoints: 1080, loyaltyTier: 'gold',   status: 'active' },
  { id: 'bc-bc01-003', userId: 'pu-009', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2023-09-02T08:00:00Z', lastInteractionAt: '2024-04-30T09:15:00Z', ordersCount: 22, reservationsCount: 0, totalSpent: 176.00, favorite: false, lifetimeValue: 176.00, lastBranchId: 'main',           loyaltyPoints: 528,  loyaltyTier: 'silver', status: 'active' },
  { id: 'bc-bc01-004', userId: 'pu-014', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2023-07-10T09:00:00Z', lastInteractionAt: '2024-05-10T08:45:00Z', ordersCount: 18, reservationsCount: 0, totalSpent: 144.00, favorite: false, lifetimeValue: 144.00, lastBranchId: 'brooklyn-cafe',  loyaltyPoints: 432,  loyaltyTier: 'silver', status: 'active' },
  { id: 'bc-bc01-005', userId: 'pu-016', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2024-04-15T07:30:00Z', lastInteractionAt: '2024-05-08T08:00:00Z', ordersCount: 4,  reservationsCount: 0, totalSpent: 32.00,  favorite: false, lifetimeValue: 32.00,  lastBranchId: 'main',           loyaltyPoints: 96,   loyaltyTier: 'bronze', status: 'active' },
  { id: 'bc-bc01-006', userId: 'pu-021', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2024-05-02T08:15:00Z', lastInteractionAt: '2024-05-15T09:00:00Z', ordersCount: 3,  reservationsCount: 0, totalSpent: 24.00,  favorite: false, lifetimeValue: 24.00,  lastBranchId: 'main',           loyaltyPoints: 72,   loyaltyTier: 'bronze', status: 'active' },
  { id: 'bc-bc01-007', userId: 'pu-023', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2023-11-25T07:00:00Z', lastInteractionAt: '2024-05-13T08:00:00Z', ordersCount: 28, reservationsCount: 0, totalSpent: 224.00, favorite: false, lifetimeValue: 224.00, lastBranchId: 'brooklyn-cafe',  loyaltyPoints: 672,  loyaltyTier: 'gold',   status: 'active' },
  { id: 'bc-bc01-008', userId: 'pu-026', tenantId: 'tenant-brew-cafe-01', firstInteractionAt: '2023-10-10T08:00:00Z', lastInteractionAt: '2024-05-11T09:30:00Z', ordersCount: 35, reservationsCount: 0, totalSpent: 280.00, favorite: true,  lifetimeValue: 280.00, lastBranchId: 'main',           loyaltyPoints: 840,  loyaltyTier: 'gold',   status: 'active' },

  // ── tenant-oak-bar-01 (bar, 1 branch) ──
  { id: 'bc-ob01-001', userId: 'pu-002', tenantId: 'tenant-oak-bar-01', firstInteractionAt: '2023-09-01T20:00:00Z', lastInteractionAt: '2024-05-04T22:00:00Z', ordersCount: 8,  reservationsCount: 2, totalSpent: 320.00, favorite: false, lifetimeValue: 320.00, lastBranchId: 'main', loyaltyPoints: 640,  loyaltyTier: 'silver', status: 'active' },
  { id: 'bc-ob01-002', userId: 'pu-005', tenantId: 'tenant-oak-bar-01', firstInteractionAt: '2023-04-15T21:00:00Z', lastInteractionAt: '2024-04-20T23:00:00Z', ordersCount: 15, reservationsCount: 4, totalSpent: 600.00, favorite: true,  lifetimeValue: 600.00, lastBranchId: 'main', loyaltyPoints: 1200, loyaltyTier: 'gold',   status: 'active' },
  { id: 'bc-ob01-003', userId: 'pu-010', tenantId: 'tenant-oak-bar-01', firstInteractionAt: '2023-06-10T20:30:00Z', lastInteractionAt: '2024-05-01T22:30:00Z', ordersCount: 11, reservationsCount: 1, totalSpent: 440.00, favorite: false, lifetimeValue: 440.00, lastBranchId: 'main', loyaltyPoints: 880,  loyaltyTier: 'silver', status: 'active' },
  { id: 'bc-ob01-004', userId: 'pu-019', tenantId: 'tenant-oak-bar-01', firstInteractionAt: '2023-09-08T21:00:00Z', lastInteractionAt: '2024-03-15T23:00:00Z', ordersCount: 6,  reservationsCount: 1, totalSpent: 240.00, favorite: false, lifetimeValue: 240.00, lastBranchId: 'main', loyaltyPoints: 480,  loyaltyTier: 'bronze', status: 'active' },
  { id: 'bc-ob01-005', userId: 'pu-024', tenantId: 'tenant-oak-bar-01', firstInteractionAt: '2023-08-18T22:00:00Z', lastInteractionAt: '2024-05-10T23:30:00Z', ordersCount: 12, reservationsCount: 3, totalSpent: 480.00, favorite: true,  lifetimeValue: 480.00, lastBranchId: 'main', loyaltyPoints: 960,  loyaltyTier: 'gold',   status: 'active' },

  // ── tenant-central-fc-01 (food court, 1 branch) ──
  { id: 'bc-fc01-001', userId: 'pu-003', tenantId: 'tenant-central-fc-01', firstInteractionAt: '2023-05-20T12:00:00Z', lastInteractionAt: '2024-05-15T13:30:00Z', ordersCount: 19, reservationsCount: 0, totalSpent: 380.00, favorite: true,  lifetimeValue: 380.00, lastBranchId: 'main', loyaltyPoints: 760,  loyaltyTier: 'gold',   status: 'active' },
  { id: 'bc-fc01-002', userId: 'pu-007', tenantId: 'tenant-central-fc-01', firstInteractionAt: '2023-11-15T11:30:00Z', lastInteractionAt: '2024-04-28T12:00:00Z', ordersCount: 8,  reservationsCount: 0, totalSpent: 160.00, favorite: false, lifetimeValue: 160.00, lastBranchId: 'main', loyaltyPoints: 320,  loyaltyTier: 'silver', status: 'active' },
  { id: 'bc-fc01-003', userId: 'pu-012', tenantId: 'tenant-central-fc-01', firstInteractionAt: '2024-03-25T12:30:00Z', lastInteractionAt: '2024-05-10T13:00:00Z', ordersCount: 4,  reservationsCount: 0, totalSpent: 80.00,  favorite: false, lifetimeValue: 80.00,  lastBranchId: 'main', loyaltyPoints: 160,  loyaltyTier: 'bronze', status: 'active' },
  { id: 'bc-fc01-004', userId: 'pu-017', tenantId: 'tenant-central-fc-01', firstInteractionAt: '2024-01-22T11:00:00Z', lastInteractionAt: '2024-04-20T12:30:00Z', ordersCount: 6,  reservationsCount: 0, totalSpent: 120.00, favorite: false, lifetimeValue: 120.00, lastBranchId: 'main', loyaltyPoints: 240,  loyaltyTier: 'bronze', status: 'active' },
  { id: 'bc-fc01-005', userId: 'pu-029', tenantId: 'tenant-central-fc-01', firstInteractionAt: '2023-05-25T12:00:00Z', lastInteractionAt: '2024-05-14T13:00:00Z', ordersCount: 22, reservationsCount: 0, totalSpent: 440.00, favorite: true,  lifetimeValue: 440.00, lastBranchId: 'main', loyaltyPoints: 880,  loyaltyTier: 'gold',   status: 'active' },

  // ── tenant-wheels-brews-01 (mobile cafe, 1 branch) ──
  { id: 'bc-wb01-001', userId: 'pu-001', tenantId: 'tenant-wheels-brews-01', firstInteractionAt: '2023-07-15T07:30:00Z', lastInteractionAt: '2024-05-13T08:00:00Z', ordersCount: 25, reservationsCount: 0, totalSpent: 175.00, favorite: true,  lifetimeValue: 175.00, lastBranchId: 'main', loyaltyPoints: 525,  loyaltyTier: 'gold',   status: 'active' },
  { id: 'bc-wb01-002', userId: 'pu-011', tenantId: 'tenant-wheels-brews-01', firstInteractionAt: '2023-10-22T07:00:00Z', lastInteractionAt: '2024-05-08T08:15:00Z', ordersCount: 14, reservationsCount: 0, totalSpent: 98.00,  favorite: false, lifetimeValue: 98.00,  lastBranchId: 'main', loyaltyPoints: 294,  loyaltyTier: 'silver', status: 'active' },
  { id: 'bc-wb01-003', userId: 'pu-022', tenantId: 'tenant-wheels-brews-01', firstInteractionAt: '2024-03-01T08:00:00Z', lastInteractionAt: '2024-05-12T08:45:00Z', ordersCount: 6,  reservationsCount: 0, totalSpent: 42.00,  favorite: false, lifetimeValue: 42.00,  lastBranchId: 'main', loyaltyPoints: 126,  loyaltyTier: 'bronze', status: 'active' },

  // ── tenant-road-bites-01 (food truck, 1 branch) ──
  { id: 'bc-rb01-001', userId: 'pu-006', tenantId: 'tenant-road-bites-01', firstInteractionAt: '2023-09-20T12:30:00Z', lastInteractionAt: '2024-05-11T13:00:00Z', ordersCount: 10, reservationsCount: 0, totalSpent: 150.00, favorite: false, lifetimeValue: 150.00, lastBranchId: 'main', loyaltyPoints: 300,  loyaltyTier: 'silver', status: 'active' },
  { id: 'bc-rb01-002', userId: 'pu-028', tenantId: 'tenant-road-bites-01', firstInteractionAt: '2023-12-20T12:00:00Z', lastInteractionAt: '2024-05-09T13:30:00Z', ordersCount: 7,  reservationsCount: 0, totalSpent: 105.00, favorite: false, lifetimeValue: 105.00, lastBranchId: 'main', loyaltyPoints: 210,  loyaltyTier: 'bronze', status: 'active' },
  { id: 'bc-rb01-003', userId: 'pu-030', tenantId: 'tenant-road-bites-01', firstInteractionAt: '2023-07-15T11:30:00Z', lastInteractionAt: '2024-04-30T12:30:00Z', ordersCount: 13, reservationsCount: 0, totalSpent: 195.00, favorite: true,  lifetimeValue: 195.00, lastBranchId: 'main', loyaltyPoints: 390,  loyaltyTier: 'silver', status: 'active' },
]

// ── BranchCustomer — per-branch visit behaviour ───────────────────────────────
//
// Each BranchCustomer links one BusinessCustomer to one branch.
// For tenants with a single branch, each BusinessCustomer has exactly one BranchCustomer.
// For multi-branch tenants (samoon-01, brew-cafe-01) customers may have records at multiple branches.

export const MOCK_BRANCH_CUSTOMERS: BranchCustomer[] = [
  // ── tenant-samoon-01 — main branch ──
  { id: 'brc-s01-main-001', businessCustomerId: 'bc-s01-001', branchId: 'main',     ordersCount: 4,  reservationsCount: 1, visits: 5,  favoriteBranch: false, lastVisit: '2024-03-15T19:30:00Z', lastOrder: '2024-03-15T19:45:00Z' },
  { id: 'brc-s01-main-002', businessCustomerId: 'bc-s01-002', branchId: 'main',     ordersCount: 6,  reservationsCount: 1, visits: 7,  favoriteBranch: true,  lastVisit: '2024-04-20T20:00:00Z', lastOrder: '2024-04-20T20:15:00Z' },
  { id: 'brc-s01-main-003', businessCustomerId: 'bc-s01-004', branchId: 'main',     ordersCount: 1,  reservationsCount: 0, visits: 1,  favoriteBranch: true,  lastVisit: '2024-01-10T12:30:00Z', lastOrder: '2024-01-10T12:30:00Z' },
  { id: 'brc-s01-main-004', businessCustomerId: 'bc-s01-006', branchId: 'main',     ordersCount: 5,  reservationsCount: 1, visits: 6,  favoriteBranch: true,  lastVisit: '2024-03-30T20:00:00Z', lastOrder: '2024-03-30T20:10:00Z' },
  { id: 'brc-s01-main-005', businessCustomerId: 'bc-s01-008', branchId: 'main',     ordersCount: 3,  reservationsCount: 1, visits: 4,  favoriteBranch: true,  lastVisit: '2024-04-05T19:00:00Z', lastOrder: '2024-04-05T19:10:00Z' },
  { id: 'brc-s01-main-006', businessCustomerId: 'bc-s01-010', branchId: 'main',     ordersCount: 8,  reservationsCount: 2, visits: 10, favoriteBranch: true,  lastVisit: '2024-05-01T20:00:00Z', lastOrder: '2024-05-01T20:05:00Z' },
  { id: 'brc-s01-main-007', businessCustomerId: 'bc-s01-012', branchId: 'main',     ordersCount: 5,  reservationsCount: 1, visits: 6,  favoriteBranch: true,  lastVisit: '2024-03-20T21:00:00Z', lastOrder: '2024-03-20T21:05:00Z' },
  { id: 'brc-s01-main-008', businessCustomerId: 'bc-s01-015', branchId: 'main',     ordersCount: 10, reservationsCount: 2, visits: 12, favoriteBranch: true,  lastVisit: '2024-05-05T12:30:00Z', lastOrder: '2024-05-05T12:40:00Z' },
  // ── tenant-samoon-01 — downtown branch ──
  { id: 'brc-s01-dt-001',  businessCustomerId: 'bc-s01-001', branchId: 'downtown', ordersCount: 10, reservationsCount: 2, visits: 12, favoriteBranch: true,  lastVisit: '2024-05-10T19:30:00Z', lastOrder: '2024-05-10T19:45:00Z' },
  { id: 'brc-s01-dt-002',  businessCustomerId: 'bc-s01-005', branchId: 'downtown', ordersCount: 12, reservationsCount: 3, visits: 15, favoriteBranch: true,  lastVisit: '2024-05-18T21:00:00Z', lastOrder: '2024-05-18T21:10:00Z' },
  { id: 'brc-s01-dt-003',  businessCustomerId: 'bc-s01-009', branchId: 'downtown', ordersCount: 7,  reservationsCount: 1, visits: 8,  favoriteBranch: true,  lastVisit: '2024-05-08T13:00:00Z', lastOrder: '2024-05-08T13:05:00Z' },
  { id: 'brc-s01-dt-004',  businessCustomerId: 'bc-s01-011', branchId: 'downtown', ordersCount: 5,  reservationsCount: 2, visits: 7,  favoriteBranch: true,  lastVisit: '2024-04-15T19:00:00Z', lastOrder: '2024-04-15T19:10:00Z' },
  { id: 'brc-s01-dt-005',  businessCustomerId: 'bc-s01-013', branchId: 'downtown', ordersCount: 20, reservationsCount: 5, visits: 25, favoriteBranch: true,  lastVisit: '2024-05-12T20:30:00Z', lastOrder: '2024-05-12T20:45:00Z' },
  { id: 'brc-s01-dt-006',  businessCustomerId: 'bc-s01-015', branchId: 'downtown', ordersCount: 6,  reservationsCount: 2, visits: 8,  favoriteBranch: false, lastVisit: '2024-04-28T13:00:00Z', lastOrder: '2024-04-28T13:10:00Z' },
  // ── tenant-samoon-01 — airport branch ──
  { id: 'brc-s01-ap-001',  businessCustomerId: 'bc-s01-003', branchId: 'airport',  ordersCount: 22, reservationsCount: 6, visits: 28, favoriteBranch: true,  lastVisit: '2024-05-15T20:30:00Z', lastOrder: '2024-05-15T20:45:00Z' },
  { id: 'brc-s01-ap-002',  businessCustomerId: 'bc-s01-007', branchId: 'airport',  ordersCount: 7,  reservationsCount: 1, visits: 8,  favoriteBranch: true,  lastVisit: '2024-04-25T19:30:00Z', lastOrder: '2024-04-25T19:40:00Z' },
  { id: 'brc-s01-ap-003',  businessCustomerId: 'bc-s01-014', branchId: 'airport',  ordersCount: 12, reservationsCount: 2, visits: 14, favoriteBranch: true,  lastVisit: '2024-04-28T19:30:00Z', lastOrder: '2024-04-28T19:45:00Z' },
  // ── tenant-brew-cafe-01 — main (midtown) branch ──
  { id: 'brc-bc01-main-001', businessCustomerId: 'bc-bc01-001', branchId: 'main',          ordersCount: 18, reservationsCount: 0, visits: 18, favoriteBranch: true,  lastVisit: '2024-05-12T09:00:00Z', lastOrder: '2024-05-12T09:05:00Z' },
  { id: 'brc-bc01-main-002', businessCustomerId: 'bc-bc01-003', branchId: 'main',          ordersCount: 22, reservationsCount: 0, visits: 22, favoriteBranch: true,  lastVisit: '2024-04-30T09:15:00Z', lastOrder: '2024-04-30T09:20:00Z' },
  { id: 'brc-bc01-main-003', businessCustomerId: 'bc-bc01-005', branchId: 'main',          ordersCount: 4,  reservationsCount: 0, visits: 4,  favoriteBranch: true,  lastVisit: '2024-05-08T08:00:00Z', lastOrder: '2024-05-08T08:05:00Z' },
  { id: 'brc-bc01-main-004', businessCustomerId: 'bc-bc01-006', branchId: 'main',          ordersCount: 3,  reservationsCount: 0, visits: 3,  favoriteBranch: true,  lastVisit: '2024-05-15T09:00:00Z', lastOrder: '2024-05-15T09:05:00Z' },
  { id: 'brc-bc01-main-005', businessCustomerId: 'bc-bc01-008', branchId: 'main',          ordersCount: 35, reservationsCount: 0, visits: 35, favoriteBranch: true,  lastVisit: '2024-05-11T09:30:00Z', lastOrder: '2024-05-11T09:35:00Z' },
  // ── tenant-brew-cafe-01 — brooklyn branch ──
  { id: 'brc-bc01-bk-001',  businessCustomerId: 'bc-bc01-001', branchId: 'brooklyn-cafe', ordersCount: 13, reservationsCount: 0, visits: 13, favoriteBranch: false, lastVisit: '2024-04-25T08:45:00Z', lastOrder: '2024-04-25T08:50:00Z' },
  { id: 'brc-bc01-bk-002',  businessCustomerId: 'bc-bc01-002', branchId: 'brooklyn-cafe', ordersCount: 45, reservationsCount: 0, visits: 45, favoriteBranch: true,  lastVisit: '2024-05-14T08:30:00Z', lastOrder: '2024-05-14T08:35:00Z' },
  { id: 'brc-bc01-bk-003',  businessCustomerId: 'bc-bc01-004', branchId: 'brooklyn-cafe', ordersCount: 18, reservationsCount: 0, visits: 18, favoriteBranch: true,  lastVisit: '2024-05-10T08:45:00Z', lastOrder: '2024-05-10T08:50:00Z' },
  { id: 'brc-bc01-bk-004',  businessCustomerId: 'bc-bc01-007', branchId: 'brooklyn-cafe', ordersCount: 28, reservationsCount: 0, visits: 28, favoriteBranch: true,  lastVisit: '2024-05-13T08:00:00Z', lastOrder: '2024-05-13T08:05:00Z' },
  // ── Single-branch tenants — one BranchCustomer per BusinessCustomer ──
  // oak-bar-01
  { id: 'brc-ob01-001', businessCustomerId: 'bc-ob01-001', branchId: 'main', ordersCount: 8,  reservationsCount: 2, visits: 10, favoriteBranch: true, lastVisit: '2024-05-04T22:00:00Z', lastOrder: '2024-05-04T22:15:00Z' },
  { id: 'brc-ob01-002', businessCustomerId: 'bc-ob01-002', branchId: 'main', ordersCount: 15, reservationsCount: 4, visits: 19, favoriteBranch: true, lastVisit: '2024-04-20T23:00:00Z', lastOrder: '2024-04-20T23:15:00Z' },
  { id: 'brc-ob01-003', businessCustomerId: 'bc-ob01-003', branchId: 'main', ordersCount: 11, reservationsCount: 1, visits: 12, favoriteBranch: true, lastVisit: '2024-05-01T22:30:00Z', lastOrder: '2024-05-01T22:40:00Z' },
  { id: 'brc-ob01-004', businessCustomerId: 'bc-ob01-004', branchId: 'main', ordersCount: 6,  reservationsCount: 1, visits: 7,  favoriteBranch: true, lastVisit: '2024-03-15T23:00:00Z', lastOrder: '2024-03-15T23:10:00Z' },
  { id: 'brc-ob01-005', businessCustomerId: 'bc-ob01-005', branchId: 'main', ordersCount: 12, reservationsCount: 3, visits: 15, favoriteBranch: true, lastVisit: '2024-05-10T23:30:00Z', lastOrder: '2024-05-10T23:45:00Z' },
  // central-fc-01
  { id: 'brc-fc01-001', businessCustomerId: 'bc-fc01-001', branchId: 'main', ordersCount: 19, reservationsCount: 0, visits: 19, favoriteBranch: true, lastVisit: '2024-05-15T13:30:00Z', lastOrder: '2024-05-15T13:35:00Z' },
  { id: 'brc-fc01-002', businessCustomerId: 'bc-fc01-002', branchId: 'main', ordersCount: 8,  reservationsCount: 0, visits: 8,  favoriteBranch: true, lastVisit: '2024-04-28T12:00:00Z', lastOrder: '2024-04-28T12:05:00Z' },
  { id: 'brc-fc01-003', businessCustomerId: 'bc-fc01-003', branchId: 'main', ordersCount: 4,  reservationsCount: 0, visits: 4,  favoriteBranch: true, lastVisit: '2024-05-10T13:00:00Z', lastOrder: '2024-05-10T13:05:00Z' },
  { id: 'brc-fc01-004', businessCustomerId: 'bc-fc01-004', branchId: 'main', ordersCount: 6,  reservationsCount: 0, visits: 6,  favoriteBranch: true, lastVisit: '2024-04-20T12:30:00Z', lastOrder: '2024-04-20T12:35:00Z' },
  { id: 'brc-fc01-005', businessCustomerId: 'bc-fc01-005', branchId: 'main', ordersCount: 22, reservationsCount: 0, visits: 22, favoriteBranch: true, lastVisit: '2024-05-14T13:00:00Z', lastOrder: '2024-05-14T13:05:00Z' },
  // wheels-brews-01
  { id: 'brc-wb01-001', businessCustomerId: 'bc-wb01-001', branchId: 'main', ordersCount: 25, reservationsCount: 0, visits: 25, favoriteBranch: true, lastVisit: '2024-05-13T08:00:00Z', lastOrder: '2024-05-13T08:05:00Z' },
  { id: 'brc-wb01-002', businessCustomerId: 'bc-wb01-002', branchId: 'main', ordersCount: 14, reservationsCount: 0, visits: 14, favoriteBranch: true, lastVisit: '2024-05-08T08:15:00Z', lastOrder: '2024-05-08T08:20:00Z' },
  { id: 'brc-wb01-003', businessCustomerId: 'bc-wb01-003', branchId: 'main', ordersCount: 6,  reservationsCount: 0, visits: 6,  favoriteBranch: true, lastVisit: '2024-05-12T08:45:00Z', lastOrder: '2024-05-12T08:50:00Z' },
  // road-bites-01
  { id: 'brc-rb01-001', businessCustomerId: 'bc-rb01-001', branchId: 'main', ordersCount: 10, reservationsCount: 0, visits: 10, favoriteBranch: true, lastVisit: '2024-05-11T13:00:00Z', lastOrder: '2024-05-11T13:05:00Z' },
  { id: 'brc-rb01-002', businessCustomerId: 'bc-rb01-002', branchId: 'main', ordersCount: 7,  reservationsCount: 0, visits: 7,  favoriteBranch: true, lastVisit: '2024-05-09T13:30:00Z', lastOrder: '2024-05-09T13:35:00Z' },
  { id: 'brc-rb01-003', businessCustomerId: 'bc-rb01-003', branchId: 'main', ordersCount: 13, reservationsCount: 0, visits: 13, favoriteBranch: true, lastVisit: '2024-04-30T12:30:00Z', lastOrder: '2024-04-30T12:35:00Z' },
]

// ── Loyalty Accounts — per tenant per user ────────────────────────────────────
//
// Each LoyaltyAccount is scoped to a tenantId. A PlatformUser visiting two businesses
// has two independent LoyaltyAccount records. Points and tier at one business do NOT
// carry over to another.

export const MOCK_LOYALTY_ACCOUNTS: LoyaltyAccount[] = [
  // tenant-samoon-01
  { id: 'la-s01-001', userId: 'pu-001', tenantId: 'tenant-samoon-01', points: 1240, lifetimePoints: 2080, tier: 'gold',     created_at: '2023-06-20T12:00:00Z', updated_at: '2024-05-10T19:30:00Z' },
  { id: 'la-s01-002', userId: 'pu-002', tenantId: 'tenant-samoon-01', points: 420,  lifetimePoints: 680,  tier: 'silver',   created_at: '2023-08-05T13:00:00Z', updated_at: '2024-04-20T20:00:00Z' },
  { id: 'la-s01-003', userId: 'pu-003', tenantId: 'tenant-samoon-01', points: 2680, lifetimePoints: 4450, tier: 'platinum', created_at: '2023-04-12T18:00:00Z', updated_at: '2024-05-15T20:30:00Z' },
  { id: 'la-s01-004', userId: 'pu-004', tenantId: 'tenant-samoon-01', points: 90,   lifetimePoints: 90,   tier: 'bronze',   created_at: '2024-01-10T12:30:00Z', updated_at: '2024-01-10T12:30:00Z' },
  { id: 'la-s01-005', userId: 'pu-005', tenantId: 'tenant-samoon-01', points: 1950, lifetimePoints: 3250, tier: 'gold',     created_at: '2023-03-05T19:00:00Z', updated_at: '2024-05-18T21:00:00Z' },
  { id: 'la-s01-009', userId: 'pu-009', tenantId: 'tenant-samoon-01', points: 1140, lifetimePoints: 1900, tier: 'gold',     created_at: '2023-08-28T12:00:00Z', updated_at: '2024-05-08T13:00:00Z' },
  { id: 'la-s01-010', userId: 'pu-010', tenantId: 'tenant-samoon-01', points: 1530, lifetimePoints: 2550, tier: 'gold',     created_at: '2023-06-02T19:30:00Z', updated_at: '2024-05-01T20:00:00Z' },
  { id: 'la-s01-013', userId: 'pu-015', tenantId: 'tenant-samoon-01', points: 3360, lifetimePoints: 5600, tier: 'platinum', created_at: '2023-02-25T19:00:00Z', updated_at: '2024-05-12T20:30:00Z' },
  // tenant-brew-cafe-01
  { id: 'la-bc01-001', userId: 'pu-001', tenantId: 'tenant-brew-cafe-01', points: 744,  lifetimePoints: 1240, tier: 'gold',   created_at: '2023-07-01T08:30:00Z', updated_at: '2024-05-12T09:00:00Z' },
  { id: 'la-bc01-002', userId: 'pu-003', tenantId: 'tenant-brew-cafe-01', points: 1080, lifetimePoints: 1800, tier: 'gold',   created_at: '2023-05-10T07:45:00Z', updated_at: '2024-05-14T08:30:00Z' },
  { id: 'la-bc01-003', userId: 'pu-009', tenantId: 'tenant-brew-cafe-01', points: 528,  lifetimePoints: 880,  tier: 'silver', created_at: '2023-09-02T08:00:00Z', updated_at: '2024-04-30T09:15:00Z' },
  { id: 'la-bc01-004', userId: 'pu-026', tenantId: 'tenant-brew-cafe-01', points: 840,  lifetimePoints: 1400, tier: 'gold',   created_at: '2023-10-10T08:00:00Z', updated_at: '2024-05-11T09:30:00Z' },
  // tenant-oak-bar-01
  { id: 'la-ob01-001', userId: 'pu-005', tenantId: 'tenant-oak-bar-01', points: 1200, lifetimePoints: 2000, tier: 'gold',   created_at: '2023-04-15T21:00:00Z', updated_at: '2024-04-20T23:00:00Z' },
  { id: 'la-ob01-002', userId: 'pu-010', tenantId: 'tenant-oak-bar-01', points: 880,  lifetimePoints: 1467, tier: 'silver', created_at: '2023-06-10T20:30:00Z', updated_at: '2024-05-01T22:30:00Z' },
  { id: 'la-ob01-003', userId: 'pu-024', tenantId: 'tenant-oak-bar-01', points: 960,  lifetimePoints: 1600, tier: 'gold',   created_at: '2023-08-18T22:00:00Z', updated_at: '2024-05-10T23:30:00Z' },
]

// ── P8.9.7 — Customer 360° CRM Mock Data ─────────────────────────────────────

// Customer Notes (tenant-scoped, private to business owner)
export const MOCK_CUSTOMER_NOTES: CustomerNote[] = [
  { id: 'cn-001', userId: 'pu-001', tenantId: 'tenant-samoon-01', content: 'Prefers window seat. Always orders the Wagyu Smash — mention when there\'s a new beef special.', authorId: '4', authorName: 'Olivia Owner', created_at: '2024-02-10T10:00:00Z', updated_at: '2024-02-10T10:00:00Z' },
  { id: 'cn-002', userId: 'pu-001', tenantId: 'tenant-samoon-01', content: 'Called ahead for anniversary dinner on March 15. Send complimentary dessert.', authorId: '2', authorName: 'Sam Staff', created_at: '2024-03-10T14:30:00Z', updated_at: '2024-03-10T14:30:00Z' },
  { id: 'cn-003', userId: 'pu-003', tenantId: 'tenant-samoon-01', content: 'VIP customer — Carol flies in from LA monthly. Always 6+ guests. Reserve private dining.', authorId: '4', authorName: 'Olivia Owner', created_at: '2023-06-01T09:00:00Z', updated_at: '2024-01-15T11:00:00Z' },
  { id: 'cn-004', userId: 'pu-003', tenantId: 'tenant-samoon-01', content: 'Severe peanut allergy. Kitchen must be notified on every order. Red flag on account.', authorId: '4', authorName: 'Olivia Owner', created_at: '2023-06-05T10:00:00Z', updated_at: '2023-06-05T10:00:00Z' },
  { id: 'cn-005', userId: 'pu-005', tenantId: 'tenant-samoon-01', content: 'Corporate account — Emma books team lunches every Thursday. Invoice sent monthly.', authorId: '4', authorName: 'Olivia Owner', created_at: '2023-05-01T09:00:00Z', updated_at: '2024-03-01T09:00:00Z' },
  { id: 'cn-006', userId: 'pu-009', tenantId: 'tenant-samoon-01', content: 'Regular lunch customer at Downtown. Usually arrives at 1pm. Prefers corner table.', authorId: '2', authorName: 'Sam Staff', created_at: '2023-10-15T13:00:00Z', updated_at: '2023-10-15T13:00:00Z' },
  { id: 'cn-007', userId: 'pu-015', tenantId: 'tenant-samoon-01', content: 'Platinum VIP. Influencer with 50k followers. Comped desserts on every visit.', authorId: '4', authorName: 'Olivia Owner', created_at: '2023-04-01T10:00:00Z', updated_at: '2024-02-20T10:00:00Z' },
]

// Customer Tags (tenant-scoped labelling system)
export const MOCK_CUSTOMER_TAG_DEFINITIONS: CustomerTag[] = [
  { id: 'tag-vip',      tenantId: 'tenant-samoon-01', label: 'VIP',              color: 'purple', created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-hv',       tenantId: 'tenant-samoon-01', label: 'High Value',       color: 'green',  created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-freq',     tenantId: 'tenant-samoon-01', label: 'Frequent Visitor', color: 'blue',   created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-corp',     tenantId: 'tenant-samoon-01', label: 'Corporate',        color: 'gray',   created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-allergy',  tenantId: 'tenant-samoon-01', label: 'Allergy Alert',    color: 'red',    created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-birthday', tenantId: 'tenant-samoon-01', label: 'Birthday',         color: 'yellow', created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-family',   tenantId: 'tenant-samoon-01', label: 'Family',           color: 'orange', created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-new',      tenantId: 'tenant-samoon-01', label: 'New Customer',     color: 'blue',   created_at: '2023-01-01T00:00:00Z' },
  { id: 'tag-inactive', tenantId: 'tenant-samoon-01', label: 'Inactive',         color: 'gray',   created_at: '2023-01-01T00:00:00Z' },
]

// Customer tag assignments per user
export const MOCK_CUSTOMER_TAG_ASSIGNMENTS: Record<string, string[]> = {
  'pu-001:tenant-samoon-01': ['tag-vip', 'tag-hv', 'tag-freq'],
  'pu-003:tenant-samoon-01': ['tag-vip', 'tag-hv', 'tag-allergy', 'tag-freq'],
  'pu-004:tenant-samoon-01': ['tag-new'],
  'pu-005:tenant-samoon-01': ['tag-corp', 'tag-hv', 'tag-freq'],
  'pu-007:tenant-samoon-01': ['tag-freq'],
  'pu-009:tenant-samoon-01': ['tag-freq'],
  'pu-015:tenant-samoon-01': ['tag-vip', 'tag-hv', 'tag-freq', 'tag-birthday'],
}

// Customer Analytics (per user per tenant)
export const MOCK_CUSTOMER_ANALYTICS: CustomerAnalytics[] = [
  {
    userId: 'pu-001', tenantId: 'tenant-samoon-01',
    lifetimeValue: 420.50, avgOrderValue: 30.04, avgReservationPartySize: 2.3,
    visitFrequencyDays: 11, daysSinceLastVisit: 24,
    favoriteBranchId: 'downtown', favoriteBranchName: 'Downtown Branch',
    favoriteWeekday: 'Friday', favoriteHour: 19,
    favoriteCategories: ['Burgers', 'Pasta', 'Drinks'],
    favoriteItems: [{ name: 'Wagyu Smash', count: 8 }, { name: 'Carbonara Autentica', count: 5 }, { name: 'Cold Brew Coffee', count: 4 }],
    revenueByMonth: [
      { month: '2024-01', revenue: 62.50 }, { month: '2024-02', revenue: 89.00 },
      { month: '2024-03', revenue: 45.00 }, { month: '2024-04', revenue: 124.00 }, { month: '2024-05', revenue: 100.00 },
    ],
    visitsByMonth: [
      { month: '2024-01', visits: 2 }, { month: '2024-02', visits: 3 },
      { month: '2024-03', visits: 1 }, { month: '2024-04', visits: 4 }, { month: '2024-05', visits: 3 },
    ],
    pointsByMonth: [
      { month: '2024-01', points: 188 }, { month: '2024-02', points: 267 },
      { month: '2024-03', points: 135 }, { month: '2024-04', points: 372 }, { month: '2024-05', points: 300 },
    ],
  },
  {
    userId: 'pu-003', tenantId: 'tenant-samoon-01',
    lifetimeValue: 890.75, avgOrderValue: 40.49, avgReservationPartySize: 4.2,
    visitFrequencyDays: 7, daysSinceLastVisit: 9,
    favoriteBranchId: 'airport', favoriteBranchName: 'Airport Branch',
    favoriteWeekday: 'Saturday', favoriteHour: 20,
    favoriteCategories: ['Pizza', 'Pasta', 'Desserts'],
    favoriteItems: [{ name: 'Truffle Mushroom', count: 12 }, { name: 'Crème Brûlée', count: 9 }, { name: 'Carbonara Autentica', count: 7 }],
    revenueByMonth: [
      { month: '2024-01', revenue: 145.00 }, { month: '2024-02', revenue: 162.00 },
      { month: '2024-03', revenue: 98.75 }, { month: '2024-04', revenue: 210.00 }, { month: '2024-05', revenue: 275.00 },
    ],
    visitsByMonth: [
      { month: '2024-01', visits: 4 }, { month: '2024-02', visits: 4 },
      { month: '2024-03', visits: 2 }, { month: '2024-04', visits: 5 }, { month: '2024-05', visits: 7 },
    ],
    pointsByMonth: [
      { month: '2024-01', points: 435 }, { month: '2024-02', points: 486 },
      { month: '2024-03', points: 296 }, { month: '2024-04', points: 630 }, { month: '2024-05', points: 825 },
    ],
  },
  {
    userId: 'pu-005', tenantId: 'tenant-samoon-01',
    lifetimeValue: 650.00, avgOrderValue: 36.11, avgReservationPartySize: 5.5,
    visitFrequencyDays: 9, daysSinceLastVisit: 6,
    favoriteBranchId: 'downtown', favoriteBranchName: 'Downtown Branch',
    favoriteWeekday: 'Thursday', favoriteHour: 13,
    favoriteCategories: ['Pasta', 'Burgers', 'Drinks'],
    favoriteItems: [{ name: 'Lobster Linguine', count: 6 }, { name: 'Wagyu Smash', count: 5 }, { name: 'Cold Brew Coffee', count: 8 }],
    revenueByMonth: [
      { month: '2024-01', revenue: 110.00 }, { month: '2024-02', revenue: 140.00 },
      { month: '2024-03', revenue: 72.50 }, { month: '2024-04', revenue: 185.00 }, { month: '2024-05', revenue: 142.50 },
    ],
    visitsByMonth: [
      { month: '2024-01', visits: 3 }, { month: '2024-02', visits: 4 },
      { month: '2024-03', visits: 2 }, { month: '2024-04', visits: 5 }, { month: '2024-05', visits: 4 },
    ],
    pointsByMonth: [
      { month: '2024-01', points: 330 }, { month: '2024-02', points: 420 },
      { month: '2024-03', points: 218 }, { month: '2024-04', points: 555 }, { month: '2024-05', points: 428 },
    ],
  },
]

// Customer Marketing (per user per tenant)
export const MOCK_CUSTOMER_MARKETING: CustomerMarketing[] = [
  {
    userId: 'pu-001', tenantId: 'tenant-samoon-01',
    preferences: [
      { channel: 'email',    subscribed: true,  subscribedAt: '2023-06-20T12:00:00Z' },
      { channel: 'sms',      subscribed: true,  subscribedAt: '2023-06-20T12:00:00Z' },
      { channel: 'push',     subscribed: true,  subscribedAt: '2023-06-20T12:00:00Z' },
      { channel: 'whatsapp', subscribed: false },
    ],
    campaigns: [
      { id: 'camp-001', name: 'Spring Menu Launch',  channel: 'email', sentAt: '2024-03-01T10:00:00Z', opened: true,  openedAt: '2024-03-01T14:30:00Z', clicked: true,  clickedAt: '2024-03-01T14:32:00Z' },
      { id: 'camp-002', name: 'Valentine\'s Day Offer', channel: 'sms', sentAt: '2024-02-10T09:00:00Z', opened: true,  openedAt: '2024-02-10T09:05:00Z', clicked: false },
      { id: 'camp-003', name: 'Loyalty Tier Upgrade', channel: 'push', sentAt: '2024-01-15T12:00:00Z', opened: true,  openedAt: '2024-01-15T18:00:00Z', clicked: true,  clickedAt: '2024-01-15T18:02:00Z' },
      { id: 'camp-004', name: 'Birthday Month Special', channel: 'email', sentAt: '2024-04-01T10:00:00Z', opened: false, clicked: false },
    ],
    couponsReceived: 4, couponsRedeemed: 2,
    lastCampaignAt: '2024-04-01T10:00:00Z',
  },
  {
    userId: 'pu-003', tenantId: 'tenant-samoon-01',
    preferences: [
      { channel: 'email',    subscribed: true,  subscribedAt: '2023-04-12T18:00:00Z' },
      { channel: 'sms',      subscribed: false, unsubscribedAt: '2023-09-01T00:00:00Z' },
      { channel: 'push',     subscribed: true,  subscribedAt: '2023-04-12T18:00:00Z' },
      { channel: 'whatsapp', subscribed: true,  subscribedAt: '2023-10-01T00:00:00Z' },
    ],
    campaigns: [
      { id: 'camp-001', name: 'Spring Menu Launch', channel: 'email', sentAt: '2024-03-01T10:00:00Z', opened: true, openedAt: '2024-03-01T11:00:00Z', clicked: true, clickedAt: '2024-03-01T11:05:00Z' },
      { id: 'camp-003', name: 'Loyalty Tier Upgrade', channel: 'push', sentAt: '2024-01-15T12:00:00Z', opened: true, openedAt: '2024-01-15T20:00:00Z', clicked: false },
    ],
    couponsReceived: 6, couponsRedeemed: 5,
    lastCampaignAt: '2024-03-01T10:00:00Z',
  },
  {
    userId: 'pu-005', tenantId: 'tenant-samoon-01',
    preferences: [
      { channel: 'email',    subscribed: true,  subscribedAt: '2023-03-05T19:00:00Z' },
      { channel: 'sms',      subscribed: true,  subscribedAt: '2023-03-05T19:00:00Z' },
      { channel: 'push',     subscribed: false },
      { channel: 'whatsapp', subscribed: false },
    ],
    campaigns: [
      { id: 'camp-001', name: 'Spring Menu Launch', channel: 'email', sentAt: '2024-03-01T10:00:00Z', opened: true, openedAt: '2024-03-01T16:00:00Z', clicked: false },
    ],
    couponsReceived: 3, couponsRedeemed: 2,
    lastCampaignAt: '2024-03-01T10:00:00Z',
  },
]

// Customer Coupons (per user per tenant)
export const MOCK_CUSTOMER_COUPONS: CustomerCoupon[] = [
  { id: 'coup-001', userId: 'pu-001', tenantId: 'tenant-samoon-01', code: 'ALICE15', description: '15% off your next order', discountType: 'percent', discountValue: 15, minOrderAmount: 30, status: 'redeemed', redeemedAt: '2024-02-15T20:00:00Z', expiresAt: '2024-03-01T00:00:00Z', created_at: '2024-02-01T00:00:00Z' },
  { id: 'coup-002', userId: 'pu-001', tenantId: 'tenant-samoon-01', code: 'BDAY2024', description: 'Birthday month — $10 off', discountType: 'fixed', discountValue: 10, status: 'available', expiresAt: '2024-05-31T23:59:59Z', created_at: '2024-04-01T00:00:00Z' },
  { id: 'coup-003', userId: 'pu-001', tenantId: 'tenant-samoon-01', code: 'SPRING24', description: '20% off spring menu items', discountType: 'percent', discountValue: 20, status: 'redeemed', redeemedAt: '2024-03-15T19:30:00Z', expiresAt: '2024-04-30T23:59:59Z', created_at: '2024-03-01T00:00:00Z' },
  { id: 'coup-004', userId: 'pu-001', tenantId: 'tenant-samoon-01', code: 'LOYAL50', description: '$5 off as loyalty bonus', discountType: 'fixed', discountValue: 5, status: 'expired', expiresAt: '2024-01-31T23:59:59Z', created_at: '2024-01-01T00:00:00Z' },
  { id: 'coup-005', userId: 'pu-003', tenantId: 'tenant-samoon-01', code: 'CAROL10', description: '10% off for platinum tier', discountType: 'percent', discountValue: 10, status: 'redeemed', redeemedAt: '2024-04-01T20:00:00Z', expiresAt: '2024-05-01T00:00:00Z', created_at: '2024-03-01T00:00:00Z' },
  { id: 'coup-006', userId: 'pu-003', tenantId: 'tenant-samoon-01', code: 'VIP2024', description: 'VIP $20 off order $100+', discountType: 'fixed', discountValue: 20, minOrderAmount: 100, status: 'available', expiresAt: '2024-12-31T23:59:59Z', created_at: '2024-01-01T00:00:00Z' },
  { id: 'coup-007', userId: 'pu-005', tenantId: 'tenant-samoon-01', code: 'CORP15', description: '15% corporate discount', discountType: 'percent', discountValue: 15, status: 'redeemed', redeemedAt: '2024-03-07T13:00:00Z', expiresAt: '2024-04-01T00:00:00Z', created_at: '2024-03-01T00:00:00Z' },
  { id: 'coup-008', userId: 'pu-005', tenantId: 'tenant-samoon-01', code: 'Q2CORP', description: 'Q2 corporate lunch deal — $15 off', discountType: 'fixed', discountValue: 15, minOrderAmount: 80, status: 'available', expiresAt: '2024-06-30T23:59:59Z', created_at: '2024-04-01T00:00:00Z' },
]

// Customer Timeline Events (per user per tenant — chronological interaction log)
export const MOCK_CUSTOMER_TIMELINE: CustomerTimelineEvent[] = [
  // ── Alice (pu-001) at tenant-samoon-01 ──
  { id: 'tl-a001', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'account_created',    title: 'Account created',                   description: 'Platform account registered via phone_number', created_at: '2023-06-15T10:00:00Z' },
  { id: 'tl-a002', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'first_visit',        title: 'First visit at Samoon',              description: 'First interaction at Downtown Branch',   branchId: 'downtown',  created_at: '2023-06-20T12:00:00Z' },
  { id: 'tl-a003', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'order_placed',       title: 'Order placed',                      description: 'Wagyu Smash × 2, Carbonara × 1',         amount: 68.97, points: 207, branchId: 'downtown',  referenceId: 'ord-a-001', referenceType: 'order',   created_at: '2023-06-20T12:05:00Z' },
  { id: 'tl-a004', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'points_earned',      title: '207 points earned',                 description: 'From order #A-001',                      points: 207,  created_at: '2023-06-20T12:30:00Z' },
  { id: 'tl-a005', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'reservation_made',   title: 'Reservation made',                  description: '2 guests · Downtown · Jul 4 7:30 PM',    branchId: 'downtown',  referenceId: 'res-a-001', referenceType: 'reservation', created_at: '2023-07-01T14:00:00Z' },
  { id: 'tl-a006', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'reservation_completed', title: 'Reservation completed',            description: '2 guests · 90 min visit',               branchId: 'downtown',  referenceId: 'res-a-001', referenceType: 'reservation', created_at: '2023-07-04T21:00:00Z' },
  { id: 'tl-a007', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'coupon_received',    title: 'Coupon received',                   description: 'LOYAL50 — $5 off loyalty bonus',                        referenceId: 'coup-004', referenceType: 'coupon', created_at: '2024-01-01T00:00:00Z' },
  { id: 'tl-a008', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'tier_upgraded',      title: 'Tier upgraded to Gold',             description: 'Reached 1,000 lifetime points',          points: 1000,  created_at: '2024-01-10T09:00:00Z' },
  { id: 'tl-a009', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'marketing_email',    title: 'Email campaign received',           description: 'Loyalty Tier Upgrade notification',                     referenceId: 'camp-003', created_at: '2024-01-15T12:00:00Z' },
  { id: 'tl-a010', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'order_placed',       title: 'Order placed',                      description: 'Truffle Mushroom Pizza, Crème Brûlée',   amount: 40.98, points: 123, branchId: 'downtown',  referenceId: 'ord-a-002', referenceType: 'order',   created_at: '2024-02-08T19:30:00Z' },
  { id: 'tl-a011', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'coupon_received',    title: 'Coupon received',                   description: 'ALICE15 — 15% off next order',                          referenceId: 'coup-001', referenceType: 'coupon', created_at: '2024-02-01T00:00:00Z' },
  { id: 'tl-a012', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'coupon_redeemed',    title: 'Coupon redeemed',                   description: 'ALICE15 — saved $6.15',                  amount: -6.15,         referenceId: 'coup-001', referenceType: 'coupon', created_at: '2024-02-15T20:00:00Z' },
  { id: 'tl-a013', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'review_posted',      title: 'Review posted',                     description: '⭐⭐⭐⭐⭐ — "Excellent food and service!"',              referenceId: 'rev-a-001', referenceType: 'review', created_at: '2024-02-16T10:00:00Z' },
  { id: 'tl-a014', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'admin_note',         title: 'Note added',                        description: 'Prefers window seat. Anniversary dinner booked.', actorId: '4', actorName: 'Olivia Owner', created_at: '2024-03-10T14:30:00Z' },
  { id: 'tl-a015', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'coupon_received',    title: 'Coupon received',                   description: 'SPRING24 — 20% off spring menu',                        referenceId: 'coup-003', referenceType: 'coupon', created_at: '2024-03-01T00:00:00Z' },
  { id: 'tl-a016', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'reservation_made',   title: 'Reservation made',                  description: '2 guests · Downtown · Mar 15 8:00 PM',  branchId: 'downtown',  referenceId: 'res-a-002', referenceType: 'reservation', created_at: '2024-03-10T10:00:00Z' },
  { id: 'tl-a017', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'tag_added',          title: 'Tag added: VIP',                    actorId: '4', actorName: 'Olivia Owner', created_at: '2024-03-12T09:00:00Z' },
  { id: 'tl-a018', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'points_redeemed',    title: '200 points redeemed',               description: 'Reward: Free Latte',                     points: -200,          referenceId: 'reward-free-latte', referenceType: 'reward', created_at: '2024-04-01T19:00:00Z' },
  { id: 'tl-a019', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'coupon_redeemed',    title: 'Coupon redeemed',                   description: 'SPRING24 — saved $8.20',                 amount: -8.20,         referenceId: 'coup-003', referenceType: 'coupon', created_at: '2024-03-15T19:30:00Z' },
  { id: 'tl-a020', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'coupon_received',    title: 'Coupon received',                   description: 'BDAY2024 — Birthday $10 off',                           referenceId: 'coup-002', referenceType: 'coupon', created_at: '2024-04-01T00:00:00Z' },
  { id: 'tl-a021', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'order_placed',       title: 'Order placed',                      description: 'Lobster Linguine, Mango Lassi',          amount: 45.98, points: 138, branchId: 'airport',   referenceId: 'ord-a-003', referenceType: 'order',   created_at: '2024-04-22T12:15:00Z' },
  { id: 'tl-a022', userId: 'pu-001', tenantId: 'tenant-samoon-01', type: 'order_placed',       title: 'Order placed',                      description: 'Wagyu Smash, Crème Brûlée, Cold Brew',   amount: 44.97, points: 135, branchId: 'downtown',  referenceId: 'ord-a-004', referenceType: 'order',   created_at: '2024-05-10T19:45:00Z' },

  // ── Carol (pu-003) at tenant-samoon-01 ──
  { id: 'tl-c001', userId: 'pu-003', tenantId: 'tenant-samoon-01', type: 'first_visit',        title: 'First visit at Samoon',              description: 'First interaction at Airport Branch',    branchId: 'airport',   created_at: '2023-04-12T18:00:00Z' },
  { id: 'tl-c002', userId: 'pu-003', tenantId: 'tenant-samoon-01', type: 'order_placed',       title: 'Order placed',                      description: 'Truffle Mushroom × 2, Lobster Linguine', amount: 96.97, points: 291, branchId: 'airport',   referenceId: 'ord-c-001', referenceType: 'order',   created_at: '2023-04-12T18:10:00Z' },
  { id: 'tl-c003', userId: 'pu-003', tenantId: 'tenant-samoon-01', type: 'admin_note',         title: 'Note added',                        description: 'Severe peanut allergy. Alert kitchen.', actorId: '4', actorName: 'Olivia Owner', created_at: '2023-06-05T10:00:00Z' },
  { id: 'tl-c004', userId: 'pu-003', tenantId: 'tenant-samoon-01', type: 'tier_upgraded',      title: 'Tier upgraded to Platinum',         description: 'Reached 4,000 lifetime points',          points: 4000, created_at: '2024-01-20T09:00:00Z' },
  { id: 'tl-c005', userId: 'pu-003', tenantId: 'tenant-samoon-01', type: 'review_posted',      title: 'Review posted',                     description: '⭐⭐⭐⭐⭐ — "Best airport dining ever!"',               referenceId: 'rev-c-001', referenceType: 'review', created_at: '2024-02-01T10:00:00Z' },
  { id: 'tl-c006', userId: 'pu-003', tenantId: 'tenant-samoon-01', type: 'reservation_made',   title: 'Private dining reserved',           description: '8 guests · Airport · May 15',            branchId: 'airport',   referenceId: 'res-c-001', referenceType: 'reservation', created_at: '2024-05-10T11:00:00Z' },

  // ── Emma (pu-005) at tenant-samoon-01 ──
  { id: 'tl-e001', userId: 'pu-005', tenantId: 'tenant-samoon-01', type: 'first_visit',        title: 'First visit at Samoon',              description: 'Corporate lunch at Downtown',             branchId: 'downtown',  created_at: '2023-03-05T19:00:00Z' },
  { id: 'tl-e002', userId: 'pu-005', tenantId: 'tenant-samoon-01', type: 'tag_added',          title: 'Tag added: Corporate',             actorId: '4', actorName: 'Olivia Owner', created_at: '2023-05-01T09:00:00Z' },
  { id: 'tl-e003', userId: 'pu-005', tenantId: 'tenant-samoon-01', type: 'order_placed',       title: 'Order placed',                      description: 'Team lunch — 12 items',                  amount: 248.00, points: 744, branchId: 'downtown',  referenceId: 'ord-e-001', referenceType: 'order', created_at: '2024-03-07T13:00:00Z' },
  { id: 'tl-e004', userId: 'pu-005', tenantId: 'tenant-samoon-01', type: 'coupon_redeemed',    title: 'Coupon redeemed',                   description: 'CORP15 — saved $37.20',                  amount: -37.20,        referenceId: 'coup-007', referenceType: 'coupon', created_at: '2024-03-07T13:00:00Z' },
  { id: 'tl-e005', userId: 'pu-005', tenantId: 'tenant-samoon-01', type: 'order_placed',       title: 'Order placed',                      description: 'Team lunch — 8 items',                   amount: 175.00, points: 525, branchId: 'downtown',  referenceId: 'ord-e-002', referenceType: 'order', created_at: '2024-04-04T13:00:00Z' },
  { id: 'tl-e006', userId: 'pu-005', tenantId: 'tenant-samoon-01', type: 'review_posted',      title: 'Review posted',                     description: '⭐⭐⭐⭐ — "Great for corporate events!"',               referenceId: 'rev-e-001', referenceType: 'review', created_at: '2024-04-06T10:00:00Z' },
]
