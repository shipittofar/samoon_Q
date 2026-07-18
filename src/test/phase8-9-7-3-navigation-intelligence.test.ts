/**
 * P8.9.7.3 — Navigation Intelligence
 *
 * Regression tests for the navigation-intelligence utility and all
 * downstream consumers that were updated as part of this phase.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveWorkspace,
  resolveBestMenu,
  resolveBestReservation,
  resolveBestBusiness,
  resolveBestDashboardActions,
  resolveFallbackRoute,
  resolvePostLoginRedirect,
} from '@/utils/navigation-intelligence'
import { getPostLoginRedirect } from '@/utils/auth-redirect'

// ── resolveWorkspace ──────────────────────────────────────────────────────────

describe('resolveWorkspace', () => {
  it('routes platform admin to /console/tenants', () => {
    expect(resolveWorkspace('platform')).toBe('/console/tenants')
  })

  it('routes owner to /console', () => {
    expect(resolveWorkspace('owner')).toBe('/console')
  })

  it('routes admin to /console', () => {
    expect(resolveWorkspace('admin')).toBe('/console')
  })

  it('routes marketing to /console/analytics', () => {
    expect(resolveWorkspace('marketing')).toBe('/console/analytics')
  })

  it('routes support to /console/customers', () => {
    expect(resolveWorkspace('support')).toBe('/console/customers')
  })

  it('routes cashier to /console/orders', () => {
    expect(resolveWorkspace('cashier')).toBe('/console/orders')
  })

  it('routes kitchen to /console/kitchen', () => {
    expect(resolveWorkspace('kitchen')).toBe('/console/kitchen')
  })

  it('routes generic staff role to /console', () => {
    expect(resolveWorkspace('staff')).toBe('/console')
  })

  it('routes customer to /dashboard', () => {
    expect(resolveWorkspace('customer')).toBe('/dashboard')
  })

  it('falls back to /console for unknown role', () => {
    expect(resolveWorkspace('unknown-role')).toBe('/console')
  })

  it('accepts an array and uses highest-priority role', () => {
    expect(resolveWorkspace(['customer', 'admin'])).toBe('/console')
    expect(resolveWorkspace(['kitchen', 'cashier'])).toBe('/console/orders')
    expect(resolveWorkspace(['platform', 'owner'])).toBe('/console/tenants')
  })

  it('with single-item array returns same as string form', () => {
    expect(resolveWorkspace(['marketing'])).toBe(resolveWorkspace('marketing'))
  })

  it('empty array falls back to /console', () => {
    expect(resolveWorkspace([])).toBe('/console')
  })
})

// ── resolveBestMenu ───────────────────────────────────────────────────────────

describe('resolveBestMenu', () => {
  it('returns /menu for default tenant', () => {
    expect(resolveBestMenu('default')).toBe('/menu')
  })

  it('returns /menu when no slug given', () => {
    expect(resolveBestMenu()).toBe('/menu')
    expect(resolveBestMenu(null)).toBe('/menu')
    expect(resolveBestMenu(undefined)).toBe('/menu')
  })

  it('returns /menu for a named tenant slug', () => {
    expect(resolveBestMenu('restaurant-a')).toBe('/menu')
  })
})

// ── resolveBestReservation ────────────────────────────────────────────────────

describe('resolveBestReservation', () => {
  it('returns /reservation for default tenant', () => {
    expect(resolveBestReservation('default')).toBe('/reservation')
  })

  it('returns /reservation when no slug given', () => {
    expect(resolveBestReservation()).toBe('/reservation')
  })
})

// ── resolveBestBusiness ───────────────────────────────────────────────────────

describe('resolveBestBusiness', () => {
  it('returns /discover on the default (platform) surface', () => {
    expect(resolveBestBusiness()).toBe('/discover')
    expect(resolveBestBusiness(null)).toBe('/discover')
    expect(resolveBestBusiness('default')).toBe('/discover')
  })

  it('returns /menu when a tenant slug is active', () => {
    expect(resolveBestBusiness('restaurant-a')).toBe('/menu')
  })
})

// ── resolveBestDashboardActions ───────────────────────────────────────────────

describe('resolveBestDashboardActions', () => {
  it('returns exactly four actions', () => {
    expect(resolveBestDashboardActions()).toHaveLength(4)
  })

  it('first action links to the menu route', () => {
    const [orderFood] = resolveBestDashboardActions()
    expect(orderFood.label).toBe('Order Food')
    expect(orderFood.href).toBe('/menu')
  })

  it('second action links to the reservation route', () => {
    const [, reserve] = resolveBestDashboardActions()
    expect(reserve.label).toBe('Reserve Table')
    expect(reserve.href).toBe('/reservation')
  })

  it('third action always links to /dashboard/orders', () => {
    const [,, trackOrder] = resolveBestDashboardActions()
    expect(trackOrder.href).toBe('/dashboard/orders')
  })

  it('fourth action always links to /dashboard/favorites', () => {
    const [,,, favorites] = resolveBestDashboardActions()
    expect(favorites.href).toBe('/dashboard/favorites')
  })

  it('actions have required shape', () => {
    for (const action of resolveBestDashboardActions()) {
      expect(action).toHaveProperty('label')
      expect(action).toHaveProperty('href')
      expect(action).toHaveProperty('icon')
      expect(action).toHaveProperty('color')
      expect(action).toHaveProperty('desc')
    }
  })
})

// ── resolveFallbackRoute ──────────────────────────────────────────────────────

describe('resolveFallbackRoute', () => {
  it('unauthenticated always returns /', () => {
    expect(resolveFallbackRoute(false)).toBe('/')
    expect(resolveFallbackRoute(false, 'admin')).toBe('/')
  })

  it('authenticated customer returns /dashboard', () => {
    expect(resolveFallbackRoute(true, 'customer')).toBe('/dashboard')
  })

  it('authenticated staff returns workspace route', () => {
    expect(resolveFallbackRoute(true, 'kitchen')).toBe('/console/kitchen')
    expect(resolveFallbackRoute(true, 'marketing')).toBe('/console/analytics')
  })

  it('authenticated with no role defaults to customer workspace', () => {
    expect(resolveFallbackRoute(true, null)).toBe('/dashboard')
    expect(resolveFallbackRoute(true, undefined)).toBe('/dashboard')
  })
})

// ── resolvePostLoginRedirect ──────────────────────────────────────────────────

describe('resolvePostLoginRedirect', () => {
  it('maps customer to /dashboard', () => {
    expect(resolvePostLoginRedirect('customer')).toBe('/dashboard')
  })

  it('maps staff roles to console destinations', () => {
    expect(resolvePostLoginRedirect('kitchen')).toBe('/console/kitchen')
    expect(resolvePostLoginRedirect('cashier')).toBe('/console/orders')
  })

  it('consistent with resolveWorkspace', () => {
    for (const role of ['customer', 'admin', 'owner', 'kitchen', 'cashier', 'marketing', 'support', 'platform']) {
      expect(resolvePostLoginRedirect(role)).toBe(resolveWorkspace(role))
    }
  })
})

// ── auth-redirect.ts integration ─────────────────────────────────────────────
// Phase 9.3 — getPostLoginRedirect() takes accountType (UX hint only) plus
// an optional tenantRoles list (the real RBAC signal, preferred when present).

describe('getPostLoginRedirect (auth-redirect.ts)', () => {
  it('customer accountType, no tenant roles → /dashboard', () => {
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
  })

  it('a tenant role of admin → /console', () => {
    expect(getPostLoginRedirect('business', ['admin'])).toBe('/console')
  })

  it('a tenant role of kitchen → /console/kitchen', () => {
    expect(getPostLoginRedirect('business', ['kitchen'])).toBe('/console/kitchen')
  })

  it('a tenant role of marketing → /console/analytics', () => {
    expect(getPostLoginRedirect('business', ['marketing'])).toBe('/console/analytics')
  })

  it('business accountType with no tenant roles still lands in /console (UX hint only, not a grant)', () => {
    expect(getPostLoginRedirect('business')).toBe('/console')
  })

  // Phase Z.9 — accountType is authoritative for direction; tenant roles
  // can no longer route a customer account into Console.
  it('customer accountType never lands in /console, even with tenant roles present', () => {
    expect(getPostLoginRedirect('customer', ['owner'])).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', ['admin'])).toBe('/dashboard')
  })
})

// ── No route leakage between surfaces ────────────────────────────────────────

describe('surface isolation', () => {
  const consoleRoles = ['platform', 'owner', 'admin', 'marketing', 'support', 'cashier', 'kitchen', 'staff']
  const customerRoles = ['customer']

  it('no console role resolves to /dashboard', () => {
    for (const role of consoleRoles) {
      expect(resolveWorkspace(role)).not.toBe('/dashboard')
    }
  })

  it('no customer role resolves to a /console path', () => {
    for (const role of customerRoles) {
      expect(resolveWorkspace(role)).not.toMatch(/^\/console/)
    }
  })

  it('AccessDenied workspace never falls back to hardcoded /console/orders for all roles', () => {
    // Every role should get its own destination, not the old hardcoded fallback.
    expect(resolveWorkspace('marketing')).not.toBe('/console/orders')
    expect(resolveWorkspace('support')).not.toBe('/console/orders')
    expect(resolveWorkspace('platform')).not.toBe('/console/orders')
  })
})
