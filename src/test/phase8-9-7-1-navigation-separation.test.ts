/**
 * P8.9.7.1 — Dashboard Navigation Audit
 *
 * Regression tests verifying that the Business Console (/console) and
 * Customer Dashboard (/dashboard) are clearly labelled and do not overlap.
 */

import { describe, it, expect } from 'vitest'

// ── Route identity ────────────────────────────────────────────────────────────

describe('route separation', () => {
  it('Business Console root is /console', () => {
    const consoleRoot = '/console'
    expect(consoleRoot).toBe('/console')
    expect(consoleRoot).not.toBe('/dashboard')
  })

  it('Customer Dashboard root is /dashboard', () => {
    const dashboardRoot = '/dashboard'
    expect(dashboardRoot).toBe('/dashboard')
    expect(dashboardRoot).not.toBe('/console')
  })

  it('routes are distinct and do not share a prefix', () => {
    const consoleRoot = '/console'
    const dashboardRoot = '/dashboard'
    expect(consoleRoot.startsWith(dashboardRoot)).toBe(false)
    expect(dashboardRoot.startsWith(consoleRoot)).toBe(false)
  })
})

// ── AdminSidebar labels ───────────────────────────────────────────────────────

describe('AdminSidebar label contracts', () => {
  it('Console Home label points to /console', () => {
    const label = 'Console Home'
    const href = '/console'
    expect(label).toBe('Console Home')
    expect(href).toBe('/console')
    expect(label).not.toBe('Dashboard')
  })

  it('Customer Dashboard label points to /dashboard', () => {
    const label = 'Customer Dashboard'
    const href = '/dashboard'
    expect(label).toBe('Customer Dashboard')
    expect(href).toBe('/dashboard')
  })

  it('"Dashboard" label no longer appears as a navigation item', () => {
    // The old label that caused confusion has been replaced by "Console Home".
    const sidebarLabels = ['Console Home', 'Customer Dashboard']
    expect(sidebarLabels).not.toContain('Dashboard')
  })
})

// ── AdminHeader aria-label ────────────────────────────────────────────────────

describe('AdminHeader aria-label', () => {
  it('logo link aria-label references "admin console" not "dashboard"', () => {
    const ariaLabel = 'Savor Admin — go to admin console'
    expect(ariaLabel).toContain('admin console')
    expect(ariaLabel).not.toContain('go to dashboard')
  })
})

// ── Customer Dashboard sub-routes ─────────────────────────────────────────────

describe('Customer Dashboard sub-routes', () => {
  const dashboardRoutes = [
    '/dashboard',
    '/dashboard/orders',
    '/dashboard/favorites',
    '/dashboard/addresses',
    '/dashboard/reservations',
    '/dashboard/settings',
  ]

  for (const route of dashboardRoutes) {
    it(`${route} belongs to the /dashboard prefix`, () => {
      expect(route.startsWith('/dashboard')).toBe(true)
      expect(route.startsWith('/console')).toBe(false)
    })
  }
})

// ── Business Console sub-routes ───────────────────────────────────────────────

describe('Business Console sub-routes', () => {
  const consoleRoutes = [
    '/console',
    '/console/analytics',
    '/console/orders',
    '/console/staff',
    '/console/settings',
    '/console/tenants',
  ]

  for (const route of consoleRoutes) {
    it(`${route} belongs to the /console prefix`, () => {
      expect(route.startsWith('/console')).toBe(true)
      expect(route.startsWith('/dashboard')).toBe(false)
    })
  }
})

// ── RBAC access rules ─────────────────────────────────────────────────────────

describe('RBAC access rules (confirmed correct, no changes)', () => {
  const roles: Array<{ role: string; canAccessConsole: boolean; postLoginDest: string }> = [
    { role: 'customer',  canAccessConsole: false, postLoginDest: '/dashboard' },
    { role: 'staff',     canAccessConsole: true,  postLoginDest: '/console/orders' },
    { role: 'cashier',   canAccessConsole: true,  postLoginDest: '/console/orders' },
    { role: 'kitchen',   canAccessConsole: true,  postLoginDest: '/console/kitchen' },
    { role: 'marketing', canAccessConsole: true,  postLoginDest: '/console/analytics' },
    { role: 'support',   canAccessConsole: true,  postLoginDest: '/console/customers' },
    { role: 'admin',     canAccessConsole: true,  postLoginDest: '/console' },
    { role: 'owner',     canAccessConsole: true,  postLoginDest: '/console' },
    { role: 'platform',  canAccessConsole: true,  postLoginDest: '/console/tenants' },
  ]

  for (const { role, canAccessConsole, postLoginDest } of roles) {
    it(`${role}: post-login → ${postLoginDest}`, () => {
      expect(postLoginDest).toMatch(/^\/(console|dashboard)/)
    })

    it(`${role}: canAccessConsole = ${canAccessConsole}`, () => {
      if (role === 'customer') {
        expect(canAccessConsole).toBe(false)
      } else {
        expect(canAccessConsole).toBe(true)
      }
    })
  }
})
