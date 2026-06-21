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

// ── Built-in module definitions ───────────────────────────────────────────────

export const RESTAURANT_MODULE: Module = {
  key: 'restaurant',
  name: 'Restaurant',
  businessTypes: ['restaurant'],
  capabilities: {
    required: ['menu', 'ordering', 'qr_table', 'notifications'],
    optional: ['reservations', 'reviews'],
    defaultEnabled: ['reservations', 'reviews'],
  },
  routes: ['/menu', '/checkout', '/checkout/success', '/checkout/failure', '/order', '/reservation', '/restaurant'],
  navItems: [
    { href: '/menu', label: 'Menu' },
    { href: '/reservation', label: 'Reservation' },
    { href: '/restaurant', label: 'Restaurant' },
  ],
  defaultFeatureFlags: {
    'menu.enabled': true,
    'reservations.enabled': true,
    'delivery.enabled': true,
    'table_ordering.enabled': true,
    'order_tracking.enabled': true,
  },
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
  },
  adminNavItems: [
    { href: '/admin/cafe/loyalty', label: 'Loyalty Management', featureFlagKey: 'cafe.loyalty.enabled' },
    { href: '/admin/cafe/happy-hour', label: 'Happy Hour Settings', featureFlagKey: 'cafe.happy_hour.enabled' },
    { href: '/admin/promotions', label: 'Promotions', featureFlagKey: 'promotions.enabled' },
  ],
  enabled: true,
}

export const BAR_MODULE: Module = {
  key: 'bar',
  name: 'Bar',
  businessTypes: ['bar'],
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
  },
  adminNavItems: [
    { href: '/admin/bar/events', label: 'Event Management', featureFlagKey: 'bar.events.enabled' },
    { href: '/admin/bar/happy-hour', label: 'Happy Hour Settings', featureFlagKey: 'bar.happy_hour.enabled' },
    { href: '/admin/promotions', label: 'Promotions', featureFlagKey: 'promotions.enabled' },
  ],
  enabled: true,
}

export const FOOD_COURT_MODULE: Module = {
  key: 'food_court',
  name: 'Food Court',
  businessTypes: ['food_court'],
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
    'food_court.vendor_management.enabled': false,
    'food_court.shared_seating.enabled': true,
    'food_court.cross_vendor_ordering.enabled': false,
    'food_court.featured_vendor.enabled': false,
  },
  adminNavItems: [
    { href: '/admin/food-court/vendors', label: 'Vendor Management', featureFlagKey: 'food_court.vendor_management.enabled' },
    { href: '/admin/food-court/seating', label: 'Seating Management', featureFlagKey: 'food_court.shared_seating.enabled' },
  ],
  enabled: true,
}

export const FOOD_TRUCK_MODULE: Module = {
  key: 'food_truck',
  name: 'Food Truck',
  businessTypes: ['food_truck'],
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
  },
  adminNavItems: [
    { href: '/admin/food-truck/routes', label: 'Route Management', featureFlagKey: 'food_truck.route_tracking.enabled' },
    { href: '/admin/food-truck/stops', label: 'Stop Management', featureFlagKey: 'food_truck.scheduled_stops.enabled' },
  ],
  enabled: true,
}

export const MOBILE_CAFE_MODULE: Module = {
  key: 'mobile_cafe',
  name: 'Mobile Cafe',
  businessTypes: ['mobile_cafe'],
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
  },
  adminNavItems: [
    { href: '/admin/mobile-cafe/routes', label: 'Route Management', featureFlagKey: 'mobile_cafe.route_tracking.enabled' },
    { href: '/admin/mobile-cafe/loyalty', label: 'Loyalty Management', featureFlagKey: 'mobile_cafe.loyalty.enabled' },
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
