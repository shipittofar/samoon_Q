/**
 * Module Registry — Phase 1A (P1A.3)
 *
 * A Module is a self-contained business-type capability (Restaurant, Cafe, Bar,
 * Hotel, Food Court, Mobile Truck). This registry is the single source of truth
 * the app shell reads to determine which routes, nav items, and dashboard widgets
 * are active for the current tenant.
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

import type { BusinessType, Module, NavItem } from '@/types'

// ── Built-in module definitions ───────────────────────────────────────────────

export const RESTAURANT_MODULE: Module = {
  key: 'restaurant',
  name: 'Restaurant',
  businessTypes: ['restaurant', 'cafe', 'bar'],
  routes: ['/menu', '/checkout', '/checkout/success', '/checkout/failure', '/order', '/reservation'],
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
const INITIAL_MODULES: ReadonlyArray<Module> = Object.freeze([RESTAURANT_MODULE])

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
