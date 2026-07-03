import type { Branch, Category, MenuItem, Notification, Order, Reservation, User } from '@/types'

// ── Users ────────────────────────────────────────────────────────────────────
export const MOCK_USER: User = {
  id: '1',
  email: 'john@example.com',
  phone: '+1234567890',
  first_name: 'John',
  last_name: 'Doe',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
  role: 'customer',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// Mock demo accounts for staff/console roles (mock mode only).
// These are separate from MOCK_USER to preserve the security invariant
// that MOCK_USER.role === 'customer'.
export const MOCK_STAFF_USER: User = {
  id: '2',
  email: 'staff@savor.com',
  phone: '+1234567891',
  first_name: 'Sam',
  last_name: 'Staff',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  role: 'staff',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_ADMIN_USER: User = {
  id: '3',
  email: 'admin@savor.com',
  phone: '+1234567892',
  first_name: 'Alex',
  last_name: 'Admin',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
  role: 'admin',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_OWNER_USER: User = {
  id: '4',
  email: 'owner@savor.com',
  phone: '+1234567893',
  first_name: 'Olivia',
  last_name: 'Owner',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  role: 'admin',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_CASHIER_USER: User = {
  id: '5',
  email: 'cashier@savor.com',
  phone: '+1234567894',
  first_name: 'Casey',
  last_name: 'Cashier',
  avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
  role: 'staff',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_KITCHEN_USER: User = {
  id: '6',
  email: 'kitchen@savor.com',
  phone: '+1234567895',
  first_name: 'Kai',
  last_name: 'Kitchen',
  avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=100&h=100&fit=crop',
  role: 'staff',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_MARKETING_USER: User = {
  id: '7',
  email: 'marketing@savor.com',
  phone: '+1234567896',
  first_name: 'Morgan',
  last_name: 'Marketing',
  avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop',
  role: 'staff',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_SUPPORT_USER: User = {
  id: '8',
  email: 'support@savor.com',
  phone: '+1234567897',
  first_name: 'Sam',
  last_name: 'Support',
  avatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=100&h=100&fit=crop',
  role: 'staff',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// P8.9.1 — Platform Admin: cross-tenant visibility (owner P7 role)
export const MOCK_PLATFORM_ADMIN_USER: User = {
  id: '10',
  email: 'platform@savor.com',
  phone: '+14155550109',
  first_name: 'Pat',
  last_name: 'Platform',
  role: 'admin',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// P8.5 — Multi-role demo user: Cashier + Kitchen combined
export const MOCK_MULTI_ROLE_USER: User = {
  id: '9',
  email: 'multirole@savor.com',
  phone: '+1234567898',
  first_name: 'Max',
  last_name: 'MultiRole',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
  role: 'staff',
  is_verified: true,
  created_at: '2024-01-01T00:00:00Z',
}

// ── Branches ─────────────────────────────────────────────────────────────────
export const MOCK_BRANCHES: Branch[] = [
  {
    id: '1',
    name: 'Main Branch',
    slug: 'main',
    address: '123 Culinary Avenue',
    city: 'New York',
    phone: '+1 (212) 555-0100',
    email: 'main@savor.com',
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
    phone: '+1 (212) 555-0200',
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
    phone: '+1 (212) 555-0300',
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
    phone: '+7 (999) 999-9999',
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

// ── Tenant-scoped branches (id = slug, consistent with publicBranchToLocation) ──
// P8.7.7.10 — used by branchService.getBranches(tenantId) so the reservation form
// shows branches that belong to the active tenant and whose ids match activeBranch.id.
export const MOCK_TENANT_BRANCHES: Record<string, Branch[]> = {
  'tenant-savor-01': [
    { id: 'main', slug: 'main', name: 'Main Branch', address: '123 Culinary Avenue', city: 'New York', phone: '+1 (212) 555-0100', lat: 40.7128, lng: -74.006, is_active: true, working_hours: [
      { day: 'Monday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Tuesday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Wednesday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Thursday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Friday', open: '10:00', close: '00:00', is_closed: false },
      { day: 'Saturday', open: '09:00', close: '00:00', is_closed: false },
      { day: 'Sunday', open: '11:00', close: '22:00', is_closed: false },
    ] },
    { id: 'downtown', slug: 'downtown', name: 'Downtown Branch', address: '456 Urban Street', city: 'New York', phone: '+1 (212) 555-0200', lat: 40.72, lng: -73.99, is_active: true, working_hours: [
      { day: 'Monday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Tuesday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Wednesday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Thursday', open: '11:00', close: '22:00', is_closed: false },
      { day: 'Friday', open: '11:00', close: '23:00', is_closed: false },
      { day: 'Saturday', open: '10:00', close: '23:00', is_closed: false },
      { day: 'Sunday', open: '12:00', close: '21:00', is_closed: false },
    ] },
    { id: 'airport', slug: 'airport', name: 'Airport Branch', address: 'JFK Terminal 4', city: 'New York', phone: '+1 (212) 555-0300', lat: 40.6413, lng: -73.7781, is_active: true, working_hours: [
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
    { id: 'main', slug: 'main', name: 'Midtown Cafe', address: '789 Coffee Lane', city: 'New York', phone: '+1 (212) 555-0400', lat: 40.754, lng: -73.984, is_active: true, working_hours: [
      { day: 'Monday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Tuesday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Wednesday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Thursday', open: '07:00', close: '20:00', is_closed: false },
      { day: 'Friday', open: '07:00', close: '21:00', is_closed: false },
      { day: 'Saturday', open: '08:00', close: '21:00', is_closed: false },
      { day: 'Sunday', open: '09:00', close: '18:00', is_closed: false },
    ] },
    { id: 'brooklyn-cafe', slug: 'brooklyn-cafe', name: 'Brooklyn Cafe', address: '321 Brew Boulevard', city: 'Brooklyn', phone: '+1 (718) 555-0500', lat: 40.678, lng: -73.944, is_active: true, working_hours: [
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
    { id: 'main', slug: 'main', name: 'The Oak Bar', address: '789 Oak Street', city: 'Chicago', phone: '+1 (312) 555-0600', lat: 41.8781, lng: -87.6298, is_active: true, working_hours: [
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
    { id: 'main', slug: 'main', name: 'Central Food Court', address: '500 Mall Drive', city: 'Los Angeles', phone: '+1 (323) 555-0700', lat: 34.0522, lng: -118.2437, is_active: true, working_hours: [
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
    { id: 'main', slug: 'main', name: 'Wheels & Brews HQ', address: '100 Roaster Road', city: 'Austin', phone: '+1 (512) 555-0800', lat: 30.2672, lng: -97.7431, is_active: true, working_hours: [
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
    { id: 'main', slug: 'main', name: 'Road Bites HQ', address: '200 Food Truck Row', city: 'Miami', phone: '+1 (305) 555-0900', lat: 25.7617, lng: -80.1918, is_active: true, working_hours: [
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

// ── Categories ────────────────────────────────────────────────────────────────
export const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'Pizza', slug: 'pizza', icon: '🍕', order: 1, items_count: 8 },
  { id: '2', name: 'Burger', slug: 'burger', icon: '🍔', order: 2, items_count: 6 },
  { id: '3', name: 'Pasta', slug: 'pasta', icon: '🍝', order: 3, items_count: 5 },
  { id: '4', name: 'Drinks', slug: 'drinks', icon: '🥤', order: 4, items_count: 7 },
  { id: '5', name: 'Desserts', slug: 'desserts', icon: '🍰', order: 5, items_count: 6 },
]

// ── Menu Items ────────────────────────────────────────────────────────────────
export const MOCK_MENU_ITEMS: MenuItem[] = [
  // PIZZA
  {
    id: '1', category_id: '1', name: 'Margherita Classic',
    slug: 'margherita-classic',
    description: 'San Marzano tomatoes, fresh mozzarella di bufala, hand-torn basil, extra virgin olive oil on our signature 72-hour cold-fermented dough.',
    price: 18.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600',
    calories: 850, preparation_time: 20, rating: 4.8, rating_count: 324,
    available: true, is_popular: true, is_featured: true,
    tags: ['vegetarian', 'classic'],
    extras: [
      { id: 'e1', name: 'Extra Cheese', price: 2.50, available: true },
      { id: 'e2', name: 'Truffle Oil', price: 3.00, available: true },
    ],
  },
  {
    id: '2', category_id: '1', name: 'Diavola',
    slug: 'diavola',
    description: 'Spicy Calabrian salami, fresh chili, smoked mozzarella, and a drizzle of chili-infused olive oil.',
    price: 22.99, discount: 10,
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600',
    calories: 1050, preparation_time: 22, rating: 4.7, rating_count: 198,
    available: true, is_new: true,
    tags: ['spicy', 'meat'],
    extras: [{ id: 'e1', name: 'Extra Cheese', price: 2.50, available: true }],
  },
  {
    id: '3', category_id: '1', name: 'Quattro Stagioni',
    slug: 'quattro-stagioni',
    description: 'Four seasons pizza: artichokes, ham, mushrooms, and olives — each quadrant celebrating a unique flavor.',
    price: 24.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600',
    calories: 980, preparation_time: 25, rating: 4.6, rating_count: 145,
    available: true,
    tags: ['classic', 'meat'],
    extras: [],
  },
  {
    id: '4', category_id: '1', name: 'Truffle Mushroom',
    slug: 'truffle-mushroom',
    description: 'Wild mushroom medley, black truffle shavings, taleggio cheese, and fresh thyme on white sauce.',
    price: 28.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
    calories: 920, preparation_time: 25, rating: 4.9, rating_count: 267,
    available: true, is_featured: true,
    tags: ['vegetarian', 'premium'],
    extras: [{ id: 'e2', name: 'Truffle Oil', price: 3.00, available: true }],
  },

  // BURGERS
  {
    id: '5', category_id: '2', name: 'Wagyu Smash',
    slug: 'wagyu-smash',
    description: 'Double wagyu beef smash patty, aged cheddar, caramelized onions, pickles, house sauce on brioche bun.',
    price: 24.99, discount: 15,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
    calories: 1200, preparation_time: 15, rating: 4.9, rating_count: 412,
    available: true, is_popular: true, is_featured: true,
    tags: ['meat', 'premium'],
    extras: [
      { id: 'e3', name: 'Bacon', price: 2.00, available: true },
      { id: 'e4', name: 'Avocado', price: 1.50, available: true },
      { id: 'e5', name: 'Extra Patty', price: 4.00, available: true },
    ],
  },
  {
    id: '6', category_id: '2', name: 'Crispy Chicken',
    slug: 'crispy-chicken',
    description: 'Buttermilk-brined fried chicken, jalapeño slaw, honey hot sauce, dill pickles on potato bun.',
    price: 19.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600',
    calories: 980, preparation_time: 18, rating: 4.7, rating_count: 289,
    available: true, is_new: true,
    tags: ['chicken', 'spicy'],
    extras: [{ id: 'e4', name: 'Avocado', price: 1.50, available: true }],
  },
  {
    id: '7', category_id: '2', name: 'Black Bean Royale',
    slug: 'black-bean-royale',
    description: 'Spiced black bean patty, cashew cheese, roasted peppers, arugula, chipotle mayo on whole grain bun.',
    price: 17.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=600',
    calories: 720, preparation_time: 15, rating: 4.5, rating_count: 156,
    available: true,
    tags: ['vegan', 'plant-based'],
    extras: [],
  },

  // PASTA
  {
    id: '8', category_id: '3', name: 'Carbonara Autentica',
    slug: 'carbonara-autentica',
    description: 'Rigatoni, guanciale, Pecorino Romano, Parmigiano-Reggiano, free-range egg yolk. The Roman way, no cream.',
    price: 21.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600',
    calories: 880, preparation_time: 20, rating: 4.9, rating_count: 378,
    available: true, is_featured: true, is_popular: true,
    tags: ['classic', 'meat'],
    extras: [{ id: 'e6', name: 'Extra Guanciale', price: 3.00, available: true }],
  },
  {
    id: '9', category_id: '3', name: 'Lobster Linguine',
    slug: 'lobster-linguine',
    description: 'Fresh Maine lobster, cherry tomatoes, garlic, white wine, chili, and parsley in olive oil sauce.',
    price: 38.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600',
    calories: 760, preparation_time: 25, rating: 4.8, rating_count: 201,
    available: true,
    tags: ['seafood', 'premium'],
    extras: [],
  },

  // DRINKS
  {
    id: '10', category_id: '4', name: 'Cold Brew Coffee',
    slug: 'cold-brew-coffee',
    description: 'Single-origin Ethiopian beans, 24-hour cold extraction, served over crystal-clear ice.',
    price: 7.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600',
    calories: 15, preparation_time: 2, rating: 4.7, rating_count: 445,
    available: true, is_popular: true,
    tags: ['coffee', 'cold'],
    extras: [
      { id: 'e7', name: 'Oat Milk', price: 1.00, available: true },
      { id: 'e8', name: 'Vanilla Syrup', price: 0.75, available: true },
    ],
  },
  {
    id: '11', category_id: '4', name: 'Mango Lassi',
    slug: 'mango-lassi',
    description: 'Alphonso mangoes, whole-milk yogurt, cardamom, and a hint of rose water.',
    price: 6.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1582126892906-5ba118eaf46b?w=600',
    calories: 220, preparation_time: 3, rating: 4.8, rating_count: 289,
    available: true,
    tags: ['refreshing', 'tropical'],
    extras: [],
  },

  // DESSERTS
  {
    id: '12', category_id: '5', name: 'Crème Brûlée',
    slug: 'creme-brulee',
    description: 'Classic French custard with Madagascar vanilla, torched caramel crust, served with fresh berries.',
    price: 11.99, discount: 0,
    image: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=600',
    calories: 420, preparation_time: 10, rating: 4.9, rating_count: 312,
    available: true, is_featured: true, is_popular: true,
    tags: ['classic', 'vegetarian'],
    extras: [],
  },
  {
    id: '13', category_id: '5', name: 'Molten Lava Cake',
    slug: 'molten-lava-cake',
    description: '72% Valrhona chocolate, salted caramel core, served warm with vanilla bean gelato.',
    price: 13.99, discount: 20,
    image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600',
    calories: 580, preparation_time: 12, rating: 4.8, rating_count: 267,
    available: true, is_popular: true,
    tags: ['chocolate', 'vegetarian'],
    extras: [{ id: 'e9', name: 'Extra Ice Cream', price: 2.00, available: true }],
  },
]

// ── Orders ────────────────────────────────────────────────────────────────────
export const MOCK_ORDERS: Partial<Order>[] = [
  {
    id: 'ord-001',
    order_number: '#3847',
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
    title: 'Welcome to Savor!',
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
    phone: '+1234567890',
    email: 'john@example.com',
    status: 'confirmed',
    confirmation_code: 'SAV-8472',
    notes: 'Window seat preferred',
    created_at: new Date().toISOString(),
  },
]
