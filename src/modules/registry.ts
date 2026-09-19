/**
 * Module Registry — Phase 1A (P1A.3) / Phase 6 (P6.2)
 *
 * A Module is a self-contained business-type capability (Restaurant, Cafe, Bar,
 * Food Court, Food Truck, Mobile Cafe). This registry is the single source of
 * truth the app shell reads to determine which routes, nav items, dashboard
 * widgets, and capability-derived feature flags are active for the current tenant.
 *
 * P6.2 — Capability-driven architecture:
 *   Each module declares a ModuleCapabilitySet (required / optional / defaultEnabled).
 *   The registry derives feature flags from capabilities so tenants can override
 *   individual capabilities without coupling to internal flag names.
 *   CAPABILITY_FLAG_MAP is the authoritative mapping from Capability → flag key.
 *
 * SAFETY (C-4 fix): Next.js App Router shares module-level state across all
 * concurrent requests on the same server instance. This registry is therefore
 * intentionally IMMUTABLE after the first read:
 *
 *   - registerModule() may only be called synchronously during module initialisation
 *     (i.e., in the body of a module file, before any request handler runs).
 *   - After getModules() / getHeaderNav() / getDashboardNav() is first called, the
 *     registry is sealed and registerModule() will throw.
 *   - Phase 6 and Phase 8 modules register by adding their Module constant to
 *     INITIAL_MODULES below and importing the file — not by calling registerModule()
 *     from a component render or API route.
 *
 * See src/modules/TENANT_RESOLUTION_STRATEGY.md for the tenant resolution decision.
 */

import type { BusinessType, Capability, Module, NavItem } from '@/types'

// ── Capability → Feature Flag mapping (P6.2) ─────────────────────────────────

/**
 * Authoritative map from each Capability to its feature flag key.
 * Consumed by getCapabilityFeatureFlags() and hasCapability() to translate
 * module capability declarations into the boolean flag map that tenants can override.
 */
export const CAPABILITY_FLAG_MAP: Readonly<Record<Capability, string>> = {
  menu:          'menu.enabled',
  ordering:      'ordering.enabled',
  qr_table:      'qr_table.enabled',
  reservations:  'reservations.enabled',
  reviews:       'reviews.enabled',
  loyalty:       'loyalty.enabled',
  notifications: 'notifications.enabled',
}

// ── Shared admin routes (P6.15) ───────────────────────────────────────────────

/**
 * Admin routes shared across all business-type modules.
 * Spread into each module's routes array so the route is registered once per source.
 * P6.15 — eliminates per-module duplication of /console/tenants routes.
 */
export const ADMIN_TENANT_ROUTES: readonly string[] = [
  '/console/tenants',
  '/console/tenants/new',
]

/** Staff management routes — spread into each module's routes array. */
export const ADMIN_STAFF_ROUTES: readonly string[] = ['/console/staff', '/console/staff/[id]']

/** RBAC Wave 4 routes */
export const ADMIN_RBAC_ROUTES: readonly string[] = [
  '/console/roles/[id]',
]

/** Branch management routes — spread into each module's routes array. */
export const ADMIN_BRANCHES_ROUTES: readonly string[] = ['/console/branches', '/console/branches/[id]']

/** Branch analytics routes (P7.4) — spread into each module's routes array. */
export const ADMIN_BRANCH_ANALYTICS_ROUTES: readonly string[] = [
  '/console/branches/analytics',
  '/console/branches/[id]/analytics',
]

/** Audit log routes (P7.5) — spread into each module's routes array. */
export const ADMIN_AUDIT_ROUTES: readonly string[] = [
  '/console/audit-logs',
  '/console/rbac/audit',
]

/** Notification center routes (P7.6) — spread into each module's routes array. */
export const ADMIN_NOTIFICATION_ROUTES: readonly string[] = ['/console/notifications']

// ── Shared admin nav items ────────────────────────────────────────────────────

// ── Grouped, icon-annotated nav item constants (P8.9.4) ──────────────────────
// group: matches the section header label rendered in AdminSidebar.
// icon:  lucide-react icon name, resolved via ADMIN_NAV_ICON_MAP in AdminSidebar.

const TENANTS_NAV_ITEM = {
  href: '/console/tenants',
  label: 'Tenants',
  icon: 'Layers',
  group: 'Platform',
  featureFlagKey: 'admin.tenants.enabled',
  permissionKey: 'tenant.view',
} as const

const STAFF_NAV_ITEM = {
  href: '/console/staff',
  label: 'Staff',
  icon: 'Users',
  group: 'People',
  featureFlagKey: 'admin.staff.enabled',
  permissionKey: 'staff.view',
} as const

const BRANCHES_NAV_ITEM = {
  href: '/console/branches',
  label: 'Branches',
  icon: 'GitBranch',
  group: 'Platform',
  featureFlagKey: 'admin.branches.enabled',
  permissionKey: 'branches.view',
} as const

const BRANCH_ANALYTICS_NAV_ITEM = {
  href: '/console/branches/analytics',
  label: 'Branch Analytics',
  icon: 'BarChart3',
  group: 'Analytics',
  featureFlagKey: 'admin.branches.enabled',
  permissionKey: 'branches.view',
} as const

const AUDIT_LOGS_NAV_ITEM = {
  href: '/console/audit-logs',
  label: 'Audit Logs',
  icon: 'ScrollText',
  group: 'Platform',
  featureFlagKey: 'admin.audit.enabled',
  permissionKey: 'audit.view',
} as const

const NOTIFICATIONS_NAV_ITEM = {
  href: '/console/notifications',
  label: 'Notifications',
  icon: 'Bell',
  group: 'System',
  featureFlagKey: 'notifications.enabled',
  permissionKey: 'notifications.view',
} as const

const OPERATIONS_NAV_ITEM = {
  href: '/console/operations',
  label: 'Live Operations',
  icon: 'Activity',
  group: 'Operations',
  featureFlagKey: 'operations.enabled',
  permissionKey: 'operations.view',
} as const

const SETTINGS_NAV_ITEM = {
  href: '/console/settings',
  label: 'Settings',
  icon: 'Settings',
  group: 'System',
  featureFlagKey: 'admin.settings.enabled',
  permissionKey: 'settings.view',
} as const

const QR_NAV_ITEM = {
  href: '/console/qr',
  label: 'QR Management',
  labelKey: 'qrManagementNav',
  icon: 'QrCode',
  group: 'System',
  permissionKey: 'tenant.view',
} as const

// P9.1.3 — Platform Configuration Console entry point. Lists every registered
// PlatformConfigurationRegistry module (Authentication first); future modules
// appear beside it automatically since the index page reads the registry,
// not a hardcoded list (see src/app/console/settings/configuration/page.tsx).
const PLATFORM_CONFIGURATION_NAV_ITEM = {
  href: '/console/settings/configuration',
  label: 'Platform Configuration',
  icon: 'SlidersHorizontal',
  group: 'System',
  permissionKey: 'settings.view',
} as const

// P8.5 — Enterprise RBAC management nav items
const PERMISSIONS_NAV_ITEM = {
  href: '/console/permissions',
  label: 'Permissions',
  icon: 'Shield',
  group: 'People',
  featureFlagKey: 'admin.staff.enabled',
  permissionKey: 'rbac.manage_roles',
} as const

const ROLES_NAV_ITEM = {
  href: '/console/roles',
  label: 'Roles',
  icon: 'KeyRound',
  group: 'People',
  featureFlagKey: 'admin.staff.enabled',
  permissionKey: 'rbac.manage_roles',
} as const

const RBAC_AUDIT_NAV_ITEM = {
  href: '/console/rbac/audit',
  label: 'RBAC Audit',
  icon: 'ScrollText',
  group: 'Platform',
  featureFlagKey: 'admin.audit.enabled',
  permissionKey: 'audit.view',
} as const

// P8.6 — User management nav item
const USERS_NAV_ITEM = {
  href: '/console/users',
  label: 'Users',
  icon: 'UserCog',
  group: 'People',
  featureFlagKey: 'admin.staff.enabled',
  permissionKey: 'staff.manage',
} as const

const REVIEWS_NAV_ITEM = {
  href: '/console/reviews',
  label: 'Reviews',
  icon: 'Star',
  group: 'Content',
  featureFlagKey: 'reviews.enabled',
  permissionKey: 'reviews.view',
} as const

const WEBSITE_BUILDER_NAV_ITEM = {
  href: '/console/website',
  label: 'Website Builder',
  icon: 'Globe',
  group: 'Content',
  featureFlagKey: 'website_builder.enabled',
  permissionKey: 'settings.view',
} as const

const ORDERS_NAV_ITEM = {
  href: '/console/orders',
  label: 'Orders',
  icon: 'ShoppingBag',
  group: 'Operations',
  featureFlagKey: 'ordering.enabled',
  permissionKey: 'orders.view',
} as const

const MENU_NAV_ITEM = {
  href: '/console/menu',
  label: 'Menu',
  icon: 'UtensilsCrossed',
  group: 'Content',
  featureFlagKey: 'menu.enabled',
  permissionKey: 'menu.view',
} as const

const CATEGORIES_NAV_ITEM = {
  href: '/console/categories',
  label: 'Categories',
  icon: 'Layers',
  group: 'Content',
  featureFlagKey: 'menu.enabled',
  permissionKey: 'category.view',
} as const

const TAGS_NAV_ITEM = {
  href: '/console/tags',
  label: 'Tags',
  icon: 'Tags',
  group: 'Content',
  featureFlagKey: 'menu.enabled',
  permissionKey: 'tag.view',
} as const

const EXTRAS_NAV_ITEM = {
  href: '/console/extras',
  label: 'Extras',
  icon: 'Tag',
  group: 'Content',
  featureFlagKey: 'menu.enabled',
  permissionKey: 'extras.view',
} as const

const LOYALTY_NAV_ITEM = {
  href: '/console/loyalty',
  label: 'Loyalty',
  icon: 'Heart',
  group: 'Content',
  featureFlagKey: 'loyalty.enabled',
  // Console loyalty management requires manage, not view-only.
  permissionKey: 'loyalty.manage',
} as const

const KITCHEN_NAV_ITEM = {
  href: '/console/kitchen',
  label: 'Kitchen Display',
  icon: 'ChefHat',
  group: 'Operations',
  featureFlagKey: 'ordering.enabled',
  permissionKey: 'kitchen.view',
} as const

const CUSTOMERS_NAV_ITEM = {
  href: '/console/customers',
  label: 'Customers',
  icon: 'Contact',
  group: 'Customers',
  // No featureFlagKey — customer management is always available; it was incorrectly
  // gated on 'menu.enabled' which would hide it when the menu module is disabled (P8.9.4 C7 fix)
  permissionKey: 'customers.view',
} as const

const RESERVATIONS_NAV_ITEM = {
  href: '/console/reservations',
  label: 'Reservations',
  icon: 'CalendarDays',
  group: 'Operations',
  featureFlagKey: 'reservations.enabled',
  permissionKey: 'reservations.view',
} as const

const ANALYTICS_NAV_ITEM = {
  href: '/console/analytics',
  label: 'Analytics',
  icon: 'TrendingUp',
  group: 'Analytics',
  featureFlagKey: 'analytics.enabled',
  permissionKey: 'analytics.view',
} as const

const PROMOTIONS_NAV_ITEM = {
  href: '/console/promotions',
  label: 'Promotions',
  icon: 'Tag',
  group: 'Content',
  featureFlagKey: 'promotions.enabled',
  permissionKey: 'promotions.view',
} as const

/** Operations dashboard routes (P7.7) — spread into each module's routes array. */
export const ADMIN_OPERATIONS_ROUTES: readonly string[] = ['/console/operations', '/console/kitchen']

/** Settings routes (P7.8) — spread into each module's routes array. */
export const ADMIN_SETTINGS_ROUTES: readonly string[] = [
  '/console/settings',
  '/console/settings/feature-flags',
  // P9.1.3 — Platform Configuration Console (generic, reused per module id).
  '/console/settings/configuration',
  '/console/settings/configuration/[moduleId]',
]

/** Dedicated Console QR management page — spread into each module's routes array. */
export const ADMIN_QR_ROUTES: readonly string[] = ['/console/qr']

/** User management routes (P8.6) — spread into each module's routes array. */
export const ADMIN_USERS_ROUTES: readonly string[] = ['/console/users', '/console/users/[id]']

/** Review management routes (P8.8.5) — spread into each module's routes array. */
export const ADMIN_REVIEWS_ROUTES: readonly string[] = ['/console/reviews']

/** Website builder routes (P8.8.6) — spread into each module's routes array. */
export const ADMIN_WEBSITE_ROUTES: readonly string[] = ['/console/website']

// ── Built-in module definitions ───────────────────────────────────────────────

export const RESTAURANT_MODULE: Module = {
  key: 'restaurant',
  name: 'Restaurant',
  businessTypes: ['restaurant'],
  qrExperienceType: 'restaurant',
  capabilities: {
    required: ['menu', 'ordering', 'qr_table', 'notifications'],
    optional: ['reservations', 'reviews'],
    defaultEnabled: ['reservations', 'reviews'],
  },
  routes: ['/menu', '/checkout', '/checkout/success', '/checkout/failure', '/order', '/reservation', '/restaurant', '/console/analytics', ...ADMIN_TENANT_ROUTES, ...ADMIN_STAFF_ROUTES, ...ADMIN_BRANCHES_ROUTES, ...ADMIN_BRANCH_ANALYTICS_ROUTES, ...ADMIN_AUDIT_ROUTES, ...ADMIN_NOTIFICATION_ROUTES, ...ADMIN_OPERATIONS_ROUTES, ...ADMIN_SETTINGS_ROUTES, ...ADMIN_QR_ROUTES, ...ADMIN_USERS_ROUTES, ...ADMIN_RBAC_ROUTES, ...ADMIN_REVIEWS_ROUTES, ...ADMIN_WEBSITE_ROUTES],
  navItems: [
    { href: '/menu', label: 'Menu' },
    { href: '/reservation', label: 'Reservation' },
    { href: '/restaurant', label: 'About' },
  ],
  defaultFeatureFlags: {
    'menu.enabled': true,
    'reservations.enabled': true,
    'delivery.enabled': true,
    'table_ordering.enabled': true,
    'order_tracking.enabled': true,
    'analytics.enabled': true,
  },
  adminNavItems: [
    // Operations
    ORDERS_NAV_ITEM,
    RESERVATIONS_NAV_ITEM,
    KITCHEN_NAV_ITEM,
    OPERATIONS_NAV_ITEM,
    // Content
    MENU_NAV_ITEM,
    CATEGORIES_NAV_ITEM,
    TAGS_NAV_ITEM,
    EXTRAS_NAV_ITEM,
    PROMOTIONS_NAV_ITEM,
    REVIEWS_NAV_ITEM,
    LOYALTY_NAV_ITEM,
    // Customers
    CUSTOMERS_NAV_ITEM,
    // Analytics
    ANALYTICS_NAV_ITEM,
    BRANCH_ANALYTICS_NAV_ITEM,
    // People
    STAFF_NAV_ITEM,
    USERS_NAV_ITEM,
    PERMISSIONS_NAV_ITEM,
    ROLES_NAV_ITEM,
    // Platform
    TENANTS_NAV_ITEM,
    BRANCHES_NAV_ITEM,
    WEBSITE_BUILDER_NAV_ITEM,
    AUDIT_LOGS_NAV_ITEM,
    RBAC_AUDIT_NAV_ITEM,
    // System
    NOTIFICATIONS_NAV_ITEM,
    SETTINGS_NAV_ITEM,
    QR_NAV_ITEM,
    PLATFORM_CONFIGURATION_NAV_ITEM,
  ],
  enabled: true,
}

// ── Phase 6 Business-Type Stubs (P6.2 — foundation only) ─────────────────────
// These modules declare their capability contracts and register in the module
// registry. Route pages, nav extensions, and custom service logic are
// implemented in P6.3+ tasks for each respective business type.

// ── P6.3 — Cafe Module (full implementation) ─────────────────────────────────
export const CAFE_MODULE: Module = {
  key: 'cafe',
  name: 'Cafe',
  businessTypes: ['cafe'],
  qrExperienceType: 'cafe',
  capabilities: {
    required: ['menu', 'ordering', 'qr_table', 'notifications'],
    optional: ['reservations', 'reviews', 'loyalty'],
    defaultEnabled: ['reservations', 'reviews'],
  },
  routes: [
    '/menu',
    '/checkout',
    '/checkout/success',
    '/checkout/failure',
    '/order',
    '/reservation',
    '/reviews',
    '/loyalty',
    '/promotions',
    '/console/analytics',
    ...ADMIN_TENANT_ROUTES,
    ...ADMIN_STAFF_ROUTES,
    ...ADMIN_BRANCHES_ROUTES,
    ...ADMIN_BRANCH_ANALYTICS_ROUTES,
    ...ADMIN_AUDIT_ROUTES,
    ...ADMIN_NOTIFICATION_ROUTES,
    ...ADMIN_OPERATIONS_ROUTES,
    ...ADMIN_SETTINGS_ROUTES, ...ADMIN_QR_ROUTES,
    ...ADMIN_USERS_ROUTES,
    ...ADMIN_RBAC_ROUTES,
    ...ADMIN_WEBSITE_ROUTES,
  ],
  navItems: [
    { href: '/menu', label: 'Menu' },
    { href: '/reservation', label: 'Reservations', featureFlagKey: 'reservations.enabled' },
    { href: '/reviews', label: 'Reviews', featureFlagKey: 'reviews.enabled' },
    { href: '/loyalty', label: 'Loyalty', featureFlagKey: 'cafe.loyalty.enabled' },
    { href: '/promotions', label: 'Promotions', featureFlagKey: 'promotions.enabled' },
  ],
  defaultFeatureFlags: {
    'menu.enabled': true,
    'delivery.enabled': true,
    'table_ordering.enabled': true,
    'order_tracking.enabled': true,
    'reservations.enabled': true,
    'cafe.loyalty.enabled': false,
    'loyalty.rewards.enabled': true,
    'loyalty.tiers.enabled': true,
    'cafe.happy_hour.enabled': false,
    'cafe.featured_coffee.enabled': false,
    'promotions.enabled': true,
    'analytics.enabled': true,
  },
  adminNavItems: [
    ANALYTICS_NAV_ITEM,
    ORDERS_NAV_ITEM,
    MENU_NAV_ITEM,
    CATEGORIES_NAV_ITEM,
    TAGS_NAV_ITEM,
    EXTRAS_NAV_ITEM,
    CUSTOMERS_NAV_ITEM,
    REVIEWS_NAV_ITEM,
    { href: '/console/cafe/loyalty', label: 'Loyalty Management', featureFlagKey: 'cafe.loyalty.enabled', permissionKey: 'loyalty.manage' },
    { href: '/console/cafe/happy-hour', label: 'Happy Hour Settings', featureFlagKey: 'cafe.happy_hour.enabled', permissionKey: 'promotions.view' },
    { href: '/console/promotions', label: 'Promotions', featureFlagKey: 'promotions.enabled', permissionKey: 'promotions.view' },
    KITCHEN_NAV_ITEM,
    TENANTS_NAV_ITEM,
    STAFF_NAV_ITEM,
    BRANCHES_NAV_ITEM,
    BRANCH_ANALYTICS_NAV_ITEM,
    AUDIT_LOGS_NAV_ITEM,
    RBAC_AUDIT_NAV_ITEM,
    NOTIFICATIONS_NAV_ITEM,
    OPERATIONS_NAV_ITEM,
    SETTINGS_NAV_ITEM,
    QR_NAV_ITEM,
    PLATFORM_CONFIGURATION_NAV_ITEM,
    PERMISSIONS_NAV_ITEM,
    ROLES_NAV_ITEM,
    USERS_NAV_ITEM,
    WEBSITE_BUILDER_NAV_ITEM,
  ],
  enabled: true,
}

export const BAR_MODULE: Module = {
  key: 'bar',
  name: 'Bar',
  businessTypes: ['bar'],
  qrExperienceType: 'bar',
  capabilities: {
    required: ['menu', 'ordering', 'qr_table', 'notifications'],
    optional: ['reservations', 'reviews', 'loyalty'],
    defaultEnabled: ['reservations'],
  },
  routes: [
    '/menu',
    '/checkout',
    '/checkout/success',
    '/checkout/failure',
    '/order',
    '/reservation',
    '/reviews',
    '/events',
    '/promotions',
    '/console/analytics',
    ...ADMIN_TENANT_ROUTES,
    ...ADMIN_STAFF_ROUTES,
    ...ADMIN_BRANCHES_ROUTES,
    ...ADMIN_BRANCH_ANALYTICS_ROUTES,
    ...ADMIN_AUDIT_ROUTES,
    ...ADMIN_NOTIFICATION_ROUTES,
    ...ADMIN_OPERATIONS_ROUTES,
    ...ADMIN_SETTINGS_ROUTES, ...ADMIN_QR_ROUTES,
    ...ADMIN_USERS_ROUTES,
    ...ADMIN_RBAC_ROUTES,
    ...ADMIN_WEBSITE_ROUTES,
  ],
  navItems: [
    { href: '/menu', label: 'Drinks' },
    { href: '/reservation', label: 'Reservations', featureFlagKey: 'reservations.enabled' },
    { href: '/reviews', label: 'Reviews', featureFlagKey: 'reviews.enabled' },
    { href: '/events', label: 'Events', featureFlagKey: 'bar.events.enabled' },
    { href: '/promotions', label: 'Promotions', featureFlagKey: 'promotions.enabled' },
  ],
  defaultFeatureFlags: {
    'menu.enabled': true,
    'delivery.enabled': false,
    'table_ordering.enabled': true,
    'order_tracking.enabled': true,
    'reservations.enabled': true,
    'bar.happy_hour.enabled': false,
    'bar.events.enabled': false,
    'bar.featured_cocktails.enabled': false,
    'promotions.enabled': true,
    'analytics.enabled': true,
  },
  adminNavItems: [
    ANALYTICS_NAV_ITEM,
    ORDERS_NAV_ITEM,
    MENU_NAV_ITEM,
    CATEGORIES_NAV_ITEM,
    TAGS_NAV_ITEM,
    EXTRAS_NAV_ITEM,
    CUSTOMERS_NAV_ITEM,
    RESERVATIONS_NAV_ITEM,
    REVIEWS_NAV_ITEM,
    { href: '/console/bar/events', label: 'Event Management', featureFlagKey: 'bar.events.enabled', permissionKey: 'operations.view' },
    { href: '/console/bar/happy-hour', label: 'Happy Hour Settings', featureFlagKey: 'bar.happy_hour.enabled', permissionKey: 'promotions.view' },
    { href: '/console/promotions', label: 'Promotions', featureFlagKey: 'promotions.enabled', permissionKey: 'promotions.view' },
    KITCHEN_NAV_ITEM,
    TENANTS_NAV_ITEM,
    STAFF_NAV_ITEM,
    BRANCHES_NAV_ITEM,
    BRANCH_ANALYTICS_NAV_ITEM,
    AUDIT_LOGS_NAV_ITEM,
    RBAC_AUDIT_NAV_ITEM,
    NOTIFICATIONS_NAV_ITEM,
    OPERATIONS_NAV_ITEM,
    SETTINGS_NAV_ITEM,
    QR_NAV_ITEM,
    PLATFORM_CONFIGURATION_NAV_ITEM,
    PERMISSIONS_NAV_ITEM,
    ROLES_NAV_ITEM,
    USERS_NAV_ITEM,
    WEBSITE_BUILDER_NAV_ITEM,
  ],
  enabled: true,
}

export const FOOD_COURT_MODULE: Module = {
  key: 'food_court',
  name: 'Food Court',
  businessTypes: ['food_court'],
  qrExperienceType: 'food_court',
  capabilities: {
    required: ['menu', 'ordering', 'notifications', 'qr_table', 'reservations'],
    optional: ['reviews', 'loyalty'],
    defaultEnabled: ['reviews'],
  },
  routes: [
    '/menu',
    '/checkout',
    '/checkout/success',
    '/checkout/failure',
    '/order',
    '/reservation',
    '/reviews',
    '/vendors',
    '/console/analytics',
    ...ADMIN_TENANT_ROUTES,
    ...ADMIN_STAFF_ROUTES,
    ...ADMIN_BRANCHES_ROUTES,
    ...ADMIN_BRANCH_ANALYTICS_ROUTES,
    ...ADMIN_AUDIT_ROUTES,
    ...ADMIN_NOTIFICATION_ROUTES,
    ...ADMIN_OPERATIONS_ROUTES,
    ...ADMIN_SETTINGS_ROUTES, ...ADMIN_QR_ROUTES,
    ...ADMIN_USERS_ROUTES,
    ...ADMIN_RBAC_ROUTES,
    ...ADMIN_WEBSITE_ROUTES,
  ],
  navItems: [
    { href: '/menu', label: 'Menu' },
    { href: '/reservation', label: 'Reservations' },
    { href: '/reviews', label: 'Reviews', featureFlagKey: 'reviews.enabled' },
    { href: '/vendors', label: 'Vendors', featureFlagKey: 'food_court.vendor_management.enabled' },
  ],
  defaultFeatureFlags: {
    'menu.enabled': true,
    'delivery.enabled': false,
    'table_ordering.enabled': true,
    'order_tracking.enabled': true,
    'reservations.enabled': true,
    'food_court.multi_vendor.enabled': true,
    'food_court.vendor_management.enabled': true,
    'food_court.shared_seating.enabled': true,
    'food_court.cross_vendor_ordering.enabled': false,
    'food_court.featured_vendor.enabled': false,
    'analytics.enabled': true,
  },
  adminNavItems: [
    ANALYTICS_NAV_ITEM,
    ORDERS_NAV_ITEM,
    MENU_NAV_ITEM,
    CATEGORIES_NAV_ITEM,
    TAGS_NAV_ITEM,
    EXTRAS_NAV_ITEM,
    CUSTOMERS_NAV_ITEM,
    RESERVATIONS_NAV_ITEM,
    REVIEWS_NAV_ITEM,
    { href: '/console/food-court/vendors', label: 'Vendor Management', featureFlagKey: 'food_court.vendor_management.enabled', permissionKey: 'vendors.view' },
    { href: '/console/food-court/seating', label: 'Seating Management', featureFlagKey: 'food_court.shared_seating.enabled', permissionKey: 'operations.view' },
    KITCHEN_NAV_ITEM,
    TENANTS_NAV_ITEM,
    STAFF_NAV_ITEM,
    BRANCHES_NAV_ITEM,
    BRANCH_ANALYTICS_NAV_ITEM,
    AUDIT_LOGS_NAV_ITEM,
    RBAC_AUDIT_NAV_ITEM,
    NOTIFICATIONS_NAV_ITEM,
    OPERATIONS_NAV_ITEM,
    SETTINGS_NAV_ITEM,
    QR_NAV_ITEM,
    PLATFORM_CONFIGURATION_NAV_ITEM,
    PERMISSIONS_NAV_ITEM,
    ROLES_NAV_ITEM,
    USERS_NAV_ITEM,
    WEBSITE_BUILDER_NAV_ITEM,
  ],
  enabled: true,
}

export const FOOD_TRUCK_MODULE: Module = {
  key: 'food_truck',
  name: 'Food Truck',
  businessTypes: ['food_truck'],
  qrExperienceType: 'food_truck',
  capabilities: {
    required: ['menu', 'ordering', 'qr_table', 'notifications'],
    optional: ['reservations', 'reviews', 'loyalty'],
    defaultEnabled: ['reviews'],
  },
  routes: [
    '/menu',
    '/checkout',
    '/checkout/success',
    '/checkout/failure',
    '/order',
    '/reviews',
    '/reservation',
    '/location',
    '/console/analytics',
    ...ADMIN_TENANT_ROUTES,
    ...ADMIN_STAFF_ROUTES,
    ...ADMIN_BRANCHES_ROUTES,
    ...ADMIN_BRANCH_ANALYTICS_ROUTES,
    ...ADMIN_AUDIT_ROUTES,
    ...ADMIN_NOTIFICATION_ROUTES,
    ...ADMIN_OPERATIONS_ROUTES,
    ...ADMIN_SETTINGS_ROUTES, ...ADMIN_QR_ROUTES,
    ...ADMIN_USERS_ROUTES,
    ...ADMIN_RBAC_ROUTES,
    ...ADMIN_WEBSITE_ROUTES,
  ],
  navItems: [
    { href: '/menu', label: 'Menu' },
    { href: '/reviews', label: 'Reviews', featureFlagKey: 'reviews.enabled' },
    { href: '/reservation', label: 'Reservations', featureFlagKey: 'reservations.enabled' },
    { href: '/location', label: 'Live Location', featureFlagKey: 'food_truck.live_location.enabled' },
  ],
  defaultFeatureFlags: {
    'menu.enabled': true,
    'delivery.enabled': false,
    'table_ordering.enabled': true,
    'order_tracking.enabled': true,
    'pickup.enabled': true,
    'reservations.enabled': false,
    'food_truck.route_tracking.enabled': true,
    'food_truck.live_location.enabled': true,
    'food_truck.scheduled_stops.enabled': false,
    'food_truck.pre_order.enabled': false,
    'food_truck.featured_route.enabled': false,
    'analytics.enabled': true,
  },
  adminNavItems: [
    ANALYTICS_NAV_ITEM,
    ORDERS_NAV_ITEM,
    MENU_NAV_ITEM,
    CATEGORIES_NAV_ITEM,
    TAGS_NAV_ITEM,
    EXTRAS_NAV_ITEM,
    CUSTOMERS_NAV_ITEM,
    REVIEWS_NAV_ITEM,
    { href: '/console/food-truck/routes', label: 'Route Management', featureFlagKey: 'food_truck.route_tracking.enabled', permissionKey: 'operations.view' },
    { href: '/console/food-truck/stops', label: 'Stop Management', featureFlagKey: 'food_truck.scheduled_stops.enabled', permissionKey: 'operations.view' },
    KITCHEN_NAV_ITEM,
    TENANTS_NAV_ITEM,
    STAFF_NAV_ITEM,
    BRANCHES_NAV_ITEM,
    BRANCH_ANALYTICS_NAV_ITEM,
    AUDIT_LOGS_NAV_ITEM,
    RBAC_AUDIT_NAV_ITEM,
    NOTIFICATIONS_NAV_ITEM,
    OPERATIONS_NAV_ITEM,
    SETTINGS_NAV_ITEM,
    QR_NAV_ITEM,
    PLATFORM_CONFIGURATION_NAV_ITEM,
    PERMISSIONS_NAV_ITEM,
    ROLES_NAV_ITEM,
    USERS_NAV_ITEM,
    WEBSITE_BUILDER_NAV_ITEM,
  ],
  enabled: true,
}

export const MOBILE_CAFE_MODULE: Module = {
  key: 'mobile_cafe',
  name: 'Mobile Cafe',
  businessTypes: ['mobile_cafe'],
  qrExperienceType: 'mobile_cafe',
  capabilities: {
    required: ['menu', 'ordering', 'qr_table', 'notifications'],
    optional: ['reservations', 'reviews', 'loyalty'],
    defaultEnabled: ['reviews', 'loyalty'],
  },
  routes: [
    '/menu',
    '/checkout',
    '/checkout/success',
    '/checkout/failure',
    '/order',
    '/reviews',
    '/loyalty',
    '/reservation',
    '/location',
    '/console/analytics',
    ...ADMIN_TENANT_ROUTES,
    ...ADMIN_STAFF_ROUTES,
    ...ADMIN_BRANCHES_ROUTES,
    ...ADMIN_BRANCH_ANALYTICS_ROUTES,
    ...ADMIN_AUDIT_ROUTES,
    ...ADMIN_NOTIFICATION_ROUTES,
    ...ADMIN_OPERATIONS_ROUTES,
    ...ADMIN_SETTINGS_ROUTES, ...ADMIN_QR_ROUTES,
    ...ADMIN_USERS_ROUTES,
    ...ADMIN_RBAC_ROUTES,
    ...ADMIN_WEBSITE_ROUTES,
  ],
  navItems: [
    { href: '/menu', label: 'Menu' },
    { href: '/reviews', label: 'Reviews', featureFlagKey: 'reviews.enabled' },
    { href: '/loyalty', label: 'Loyalty', featureFlagKey: 'mobile_cafe.loyalty.enabled' },
    { href: '/reservation', label: 'Reservations', featureFlagKey: 'reservations.enabled' },
    { href: '/location', label: 'Live Location', featureFlagKey: 'mobile_cafe.live_location.enabled' },
  ],
  defaultFeatureFlags: {
    'menu.enabled': true,
    'delivery.enabled': false,
    'table_ordering.enabled': true,
    'order_tracking.enabled': true,
    'pickup.enabled': true,
    'reservations.enabled': false,
    'mobile_cafe.route_tracking.enabled': true,
    'mobile_cafe.live_location.enabled': true,
    'mobile_cafe.loyalty.enabled': true,
    'loyalty.rewards.enabled': true,
    'loyalty.tiers.enabled': true,
    'mobile_cafe.featured_coffee.enabled': false,
    'mobile_cafe.daily_specials.enabled': false,
    'analytics.enabled': true,
  },
  adminNavItems: [
    ANALYTICS_NAV_ITEM,
    ORDERS_NAV_ITEM,
    MENU_NAV_ITEM,
    CATEGORIES_NAV_ITEM,
    TAGS_NAV_ITEM,
    EXTRAS_NAV_ITEM,
    CUSTOMERS_NAV_ITEM,
    REVIEWS_NAV_ITEM,
    { href: '/console/mobile-cafe/routes', label: 'Route Management', featureFlagKey: 'mobile_cafe.route_tracking.enabled', permissionKey: 'operations.view' },
    { href: '/console/mobile-cafe/loyalty', label: 'Loyalty Management', featureFlagKey: 'mobile_cafe.loyalty.enabled', permissionKey: 'loyalty.manage' },
    KITCHEN_NAV_ITEM,
    TENANTS_NAV_ITEM,
    STAFF_NAV_ITEM,
    BRANCHES_NAV_ITEM,
    BRANCH_ANALYTICS_NAV_ITEM,
    AUDIT_LOGS_NAV_ITEM,
    RBAC_AUDIT_NAV_ITEM,
    NOTIFICATIONS_NAV_ITEM,
    OPERATIONS_NAV_ITEM,
    SETTINGS_NAV_ITEM,
    QR_NAV_ITEM,
    PLATFORM_CONFIGURATION_NAV_ITEM,
    PERMISSIONS_NAV_ITEM,
    ROLES_NAV_ITEM,
    USERS_NAV_ITEM,
    WEBSITE_BUILDER_NAV_ITEM,
  ],
  enabled: true,
}

/**
 * Dashboard module — a cross-cutting shell concern, not a business-type module.
 * Kept separate from INITIAL_MODULES so it is never mistakenly included in
 * header nav or business-type-based filtering.
 */
export const DASHBOARD_MODULE: Module = {
  key: 'dashboard',
  name: 'User Dashboard',
  businessTypes: [],
  routes: ['/dashboard'],
  navItems: [
    { href: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', exact: true },
    { href: '/dashboard/orders', label: 'My Orders', icon: 'Package' },
    { href: '/dashboard/favorites', label: 'Favorites', icon: 'Heart' },
    { href: '/dashboard/addresses', label: 'Addresses', icon: 'MapPin' },
    { href: '/dashboard/reservations', label: 'Reservations', icon: 'Calendar' },
    { href: '/dashboard/settings', label: 'Settings', icon: 'Settings' },
  ],
  defaultFeatureFlags: {},
  enabled: true,
}

// ── Registry state ────────────────────────────────────────────────────────────

/** Add Phase 6 / Phase 8 modules to this list during their respective startup files. */
const INITIAL_MODULES: ReadonlyArray<Module> = Object.freeze([
  RESTAURANT_MODULE,
  CAFE_MODULE,
  BAR_MODULE,
  FOOD_COURT_MODULE,
  FOOD_TRUCK_MODULE,
  MOBILE_CAFE_MODULE,
])

let _modules: ReadonlyArray<Module> = INITIAL_MODULES
let _sealed = false

function seal(): void {
  _sealed = true
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all registered business-type modules.
 * Seals the registry on first call — registerModule() will throw after this.
 */
export function getModules(): ReadonlyArray<Module> {
  seal()
  return _modules
}

/**
 * Returns a module by key, or undefined if not registered.
 */
export function getModule(key: string): Module | undefined {
  seal()
  return _modules.find((m) => m.key === key)
}

/**
 * Returns header nav items for the given set of active module keys.
 *
 * When activeModuleKeys is empty or undefined (single-tenant fallback),
 * nav items from all enabled modules are returned — preserving backward
 * compatibility with the pre-multi-tenant deployment (P1A.4).
 *
 * The dashboard module is intentionally excluded — it is a shell concern,
 * not a business-type module. Use getDashboardNav() for sidebar nav.
 */
export function getHeaderNav(activeModuleKeys?: string[]): NavItem[] {
  seal()
  const modules = _modules.filter((m) => m.enabled)

  if (!activeModuleKeys?.length) {
    return modules.flatMap((m) => m.navItems)
  }

  return modules
    .filter((m) => activeModuleKeys.includes(m.key))
    .flatMap((m) => m.navItems)
}

/**
 * Returns routes owned by the given module keys.
 * Used by Phase 1B (P1B.3) middleware to determine route ownership for tenant-aware routing.
 */
export function getModuleRoutes(activeModuleKeys?: string[]): string[] {
  seal()
  const modules = _modules.filter((m) => m.enabled)

  if (!activeModuleKeys?.length) {
    return modules.flatMap((m) => m.routes)
  }

  return modules
    .filter((m) => activeModuleKeys.includes(m.key))
    .flatMap((m) => m.routes)
}

/**
 * Returns the merged default feature flags for the given module keys.
 * Phase 1B (P1B.2) reads this as the base layer before per-tenant overrides.
 */
export function getDefaultFeatureFlags(activeModuleKeys?: string[]): Record<string, boolean> {
  seal()
  const modules = _modules.filter((m) => m.enabled)
  const source = activeModuleKeys?.length
    ? modules.filter((m) => activeModuleKeys.includes(m.key))
    : modules

  return source.reduce<Record<string, boolean>>(
    (acc, m) => ({ ...acc, ...m.defaultFeatureFlags }),
    {},
  )
}

/**
 * Returns nav items for the user dashboard sidebar.
 * Always returns the DASHBOARD_MODULE nav — it is tenant-agnostic.
 */
export function getDashboardNav(): NavItem[] {
  return DASHBOARD_MODULE.navItems
}

/**
 * Registers a module or replaces an existing module with the same key.
 *
 * MUST be called synchronously at module initialisation time — before any
 * call to getModules(), getHeaderNav(), or getDashboardNav(). Calling this
 * from a request handler, Server Component render, or API route will throw
 * because the registry is sealed on first read.
 *
 * Intended usage: Phase 6 / Phase 8 module files call this in their own
 * module body so registration happens when the file is imported at startup.
 */
export function registerModule(module: Module): void {
  if (_sealed) {
    throw new Error(
      `[ModuleRegistry] registerModule("${module.key}") was called after the registry was sealed. ` +
        'Register modules at application startup (module body), not from request handlers or component renders.',
    )
  }
  _modules = Object.freeze([..._modules.filter((m) => m.key !== module.key), module])
}

/**
 * Resolves the active BusinessType values for a set of module keys.
 * Convenience helper for components that need to reason about business type
 * without importing the full Module objects.
 */
export function resolveBusinessTypes(activeModuleKeys: string[]): BusinessType[] {
  const types = new Set<BusinessType>()
  for (const key of activeModuleKeys) {
    const mod = getModule(key)
    if (mod) mod.businessTypes.forEach((t) => types.add(t))
  }
  return Array.from(types)
}

/**
 * Returns admin nav items declared by the given module keys.
 * Items carry a featureFlagKey that consumers use to gate visibility.
 *
 * When activeModuleKeys is empty or undefined, returns admin nav from all
 * enabled modules (single-tenant / admin shell fallback).
 *
 * P6.3 — Cafe Module (admin capability awareness)
 */
export function getAdminNav(activeModuleKeys?: string[]): NavItem[] {
  seal()
  const modules = _modules.filter((m) => m.enabled)
  if (activeModuleKeys !== undefined) {
    return modules
      .filter((m) => activeModuleKeys.includes(m.key))
      .flatMap((m) => m.adminNavItems ?? [])
  }
  return modules.flatMap((m) => m.adminNavItems ?? [])
}

// ── Capability API (P6.2 — Multi-Business Foundation) ────────────────────────

/**
 * Returns all capabilities (required ∪ optional) declared by the given module.
 * Returns an empty array for unknown modules or modules without capabilities.
 */
export function getModuleCapabilities(moduleKey: string): Capability[] {
  seal()
  const mod = _modules.find((m) => m.key === moduleKey)
  if (!mod?.capabilities) return []
  const { required, optional } = mod.capabilities
  return Array.from(new Set([...required, ...optional]))
}

/**
 * Returns true if any of the active modules has the given capability
 * in its required set OR in its defaultEnabled set.
 *
 * This reflects the module-level default, not a tenant-overridden value.
 * For tenant-overridden capability state, read the resolved feature flags
 * via useFeatureFlag(CAPABILITY_FLAG_MAP[cap]) instead.
 */
export function hasCapability(activeModuleKeys: string[], cap: Capability): boolean {
  seal()
  const active = _modules.filter((m) => m.enabled && activeModuleKeys.includes(m.key))
  return active.some((m) => {
    if (!m.capabilities) return false
    return (
      m.capabilities.required.includes(cap) ||
      m.capabilities.defaultEnabled.includes(cap)
    )
  })
}

/**
 * Returns the qrExperienceType for the first active module that declares one.
 * Falls back to 'restaurant' if no active module declares a qrExperienceType.
 * P6.12 — QR Experience Layer
 */
export function getQRExperienceType(
  activeModuleKeys?: string[],
): 'restaurant' | 'cafe' | 'bar' | 'food_court' | 'food_truck' | 'mobile_cafe' {
  seal()
  const modules = _modules.filter((m) => m.enabled)
  const source = activeModuleKeys?.length
    ? modules.filter((m) => activeModuleKeys.includes(m.key))
    : modules
  for (const mod of source) {
    if (mod.qrExperienceType) return mod.qrExperienceType
  }
  return 'restaurant'
}

/**
 * Derives a feature flag map from the capability declarations of the given modules.
 *
 * Resolution rules (per flag key, across all active modules):
 *   - A capability in `required`      → flag = true  (always)
 *   - A capability in `defaultEnabled` → flag = true  (unless another module sets it false first)
 *   - A capability in `optional` only → flag = false  (opt-in; tenant must override to enable)
 *   - Union semantics: if ANY active module enables a cap by default, the flag is true.
 *
 * This is layer 2 in featureFlagsService.resolve(); tenant overrides (layer 3) take precedence.
 *
 * P6.2 — Multi-Business Foundation
 */
export function getCapabilityFeatureFlags(activeModuleKeys?: string[]): Record<string, boolean> {
  seal()
  const modules = _modules.filter((m) => m.enabled)
  const source = activeModuleKeys?.length
    ? modules.filter((m) => activeModuleKeys.includes(m.key))
    : modules

  const flags: Record<string, boolean> = {}

  for (const mod of source) {
    if (!mod.capabilities) continue
    const { required, optional, defaultEnabled } = mod.capabilities

    for (const cap of required) {
      flags[CAPABILITY_FLAG_MAP[cap]] = true
    }

    for (const cap of optional) {
      const flagKey = CAPABILITY_FLAG_MAP[cap]
      if (defaultEnabled.includes(cap)) {
        flags[flagKey] = true
      } else if (!(flagKey in flags)) {
        flags[flagKey] = false
      }
    }
  }

  return flags
}
