import type { BusinessType, Module, NavItem } from '@/types'

// ── Built-in module definitions ───────────────────────────────────────────────

const RESTAURANT_MODULE: Module = {
  id: 'restaurant',
  label: 'Restaurant',
  business_types: ['restaurant', 'cafe', 'bar'],
  enabled: true,
  nav: [
    { href: '/menu', label: 'Menu' },
    { href: '/reservation', label: 'Reservation' },
    { href: '/restaurant', label: 'Restaurant' },
  ],
}

const DASHBOARD_MODULE: Module = {
  id: 'dashboard',
  label: 'Dashboard',
  business_types: [],
  enabled: true,
  nav: [
    { href: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', exact: true },
    { href: '/dashboard/orders', label: 'My Orders', icon: 'Package' },
    { href: '/dashboard/favorites', label: 'Favorites', icon: 'Heart' },
    { href: '/dashboard/addresses', label: 'Addresses', icon: 'MapPin' },
    { href: '/dashboard/reservations', label: 'Reservations', icon: 'Calendar' },
    { href: '/dashboard/settings', label: 'Settings', icon: 'Settings' },
  ],
}

// ── Registry ──────────────────────────────────────────────────────────────────

const REGISTRY: Module[] = [RESTAURANT_MODULE, DASHBOARD_MODULE]

/**
 * Returns nav links for the top-level header, filtered by business type.
 * Falls back to all modules when no type is specified (single-tenant default).
 */
export function getHeaderNav(businessType?: BusinessType): NavItem[] {
  return REGISTRY.filter(
    (m) => m.enabled && (m.business_types.length === 0 || !businessType || m.business_types.includes(businessType)),
  )
    .filter((m) => m.id === 'restaurant')
    .flatMap((m) => m.nav)
}

/**
 * Returns nav links for the user dashboard sidebar.
 */
export function getDashboardNav(): NavItem[] {
  return REGISTRY.find((m) => m.id === 'dashboard')?.nav ?? []
}

export function getModule(id: string): Module | undefined {
  return REGISTRY.find((m) => m.id === id)
}

export function registerModule(module: Module): void {
  const idx = REGISTRY.findIndex((m) => m.id === module.id)
  if (idx >= 0) {
    REGISTRY[idx] = module
  } else {
    REGISTRY.push(module)
  }
}
