/**
 * P8.4.8 — Enterprise RBAC Navigation Regression Tests
 *
 * Covers the new tighter role-permission matrix introduced in P8.4.8:
 * - manager: 13 permissions (lost vendors, promotions, loyalty, analytics, settings, audit)
 * - cashier: 5 permissions (lost menu.view, reservations.view, notifications.preferences)
 * - kitchen: 3 permissions (lost orders.manage, menu.view, notifications.preferences)
 * - marketing: 7 permissions (lost menu.view, operations.view, notifications.preferences)
 * - support: 4 permissions (lost orders.view, analytics.view, settings.view, and more)
 *
 * These tests verify ONLY the new/changed assertions.
 * Existing assertions live in phase7-rbac.test.ts.
 */

import { describe, it, expect } from 'vitest'

// ── Manager (new matrix) ───────────────────────────────────────────────────────

describe('P8 — Manager tightened permissions', () => {
  it('manager has orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'orders.view')).toBe(true)
  })
  it('manager has orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'orders.manage')).toBe(true)
  })
  it('manager has menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'menu.view')).toBe(true)
  })
  it('manager has menu.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'menu.manage')).toBe(true)
  })
  it('manager has customers.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'customers.manage')).toBe(true)
  })
  it('manager has staff.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'staff.manage')).toBe(true)
  })
  it('manager has branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'branches.view')).toBe(true)
  })
  it('manager has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'operations.view')).toBe(true)
  })
  it('manager does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'analytics.view')).toBe(false)
  })
  it('manager does NOT have promotions.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'promotions.view')).toBe(false)
  })
  it('manager does NOT have promotions.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'promotions.manage')).toBe(false)
  })
  it('manager does NOT have loyalty.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'loyalty.view')).toBe(false)
  })
  it('manager does NOT have loyalty.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'loyalty.manage')).toBe(false)
  })
  it('manager does NOT have vendors.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'vendors.view')).toBe(false)
  })
  it('manager does NOT have settings.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'settings.view')).toBe(false)
  })
  it('manager does NOT have audit.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'audit.view')).toBe(false)
  })
  it('manager does NOT have tenant.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'tenant.view')).toBe(false)
  })
  it('manager does NOT have operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'operations.manage')).toBe(false)
  })
  // Category Management: manager gained category.view/create/update/delete
  // alongside its existing menu.view/menu.manage (docs/CATEGORY_MANAGEMENT_IMPLEMENTATION.md).
  it('manager has exactly 28 permissions', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.manager).toHaveLength(28)
  })
})

// ── Cashier (new matrix) ───────────────────────────────────────────────────────

describe('P8 — Cashier tightened permissions', () => {
  it('cashier has orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'orders.view')).toBe(true)
  })
  it('cashier has orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'orders.manage')).toBe(true)
  })
  it('cashier has customers.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'customers.view')).toBe(true)
  })
  it('cashier has notifications.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'notifications.view')).toBe(true)
  })
  it('cashier has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'operations.view')).toBe(true)
  })
  it('cashier does NOT have menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'menu.view')).toBe(false)
  })
  it('cashier does NOT have reservations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'reservations.view')).toBe(false)
  })
  it('cashier does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'analytics.view')).toBe(false)
  })
  it('cashier does NOT have notifications.preferences', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'notifications.preferences')).toBe(false)
  })
  it('cashier has exactly 11 permissions', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.cashier).toHaveLength(11)
  })
})

// ── Kitchen (new matrix) ───────────────────────────────────────────────────────

describe('P8 — Kitchen tightened permissions', () => {
  it('kitchen has orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'orders.view')).toBe(true)
  })
  it('kitchen has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'operations.view')).toBe(true)
  })
  it('kitchen has notifications.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'notifications.view')).toBe(true)
  })
  it('kitchen does NOT have orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'orders.manage')).toBe(false)
  })
  it('kitchen does NOT have menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'menu.view')).toBe(false)
  })
  it('kitchen does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'analytics.view')).toBe(false)
  })
  it('kitchen does NOT have notifications.preferences', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'notifications.preferences')).toBe(false)
  })
  it('kitchen has exactly 5 permissions', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.kitchen).toHaveLength(5)
  })
})

// ── Marketing (new matrix) ────────────────────────────────────────────────────

describe('P8 — Marketing tightened permissions', () => {
  it('marketing has analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'analytics.view')).toBe(true)
  })
  it('marketing has customers.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'customers.view')).toBe(true)
  })
  it('marketing has promotions.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'promotions.manage')).toBe(true)
  })
  it('marketing has loyalty.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'loyalty.manage')).toBe(true)
  })
  it('marketing has notifications.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'notifications.view')).toBe(true)
  })
  it('marketing does NOT have menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'menu.view')).toBe(false)
  })
  it('marketing does NOT have operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'operations.view')).toBe(false)
  })
  it('marketing does NOT have orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'orders.view')).toBe(false)
  })
  it('marketing does NOT have staff.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'staff.view')).toBe(false)
  })
  it('marketing does NOT have notifications.preferences', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'notifications.preferences')).toBe(false)
  })
  it('marketing has exactly 8 permissions', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.marketing).toHaveLength(8)
  })
})

// ── Support (new matrix) ──────────────────────────────────────────────────────

describe('P8 — Support tightened permissions', () => {
  it('support has customers.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'customers.view')).toBe(true)
  })
  it('support has reservations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'reservations.view')).toBe(true)
  })
  it('support has branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'branches.view')).toBe(true)
  })
  it('support has notifications.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'notifications.view')).toBe(true)
  })
  it('support does NOT have orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'orders.view')).toBe(false)
  })
  it('support does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'analytics.view')).toBe(false)
  })
  it('support does NOT have settings.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'settings.view')).toBe(false)
  })
  it('support does NOT have audit.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'audit.view')).toBe(false)
  })
  it('support does NOT have vendors.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'vendors.view')).toBe(false)
  })
  it('support does NOT have staff.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'staff.view')).toBe(false)
  })
  it('support does NOT have operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'operations.view')).toBe(false)
  })
  it('support does NOT have notifications.preferences', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'notifications.preferences')).toBe(false)
  })
  it('support has exactly 4 permissions', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.support).toHaveLength(4)
  })
})

// ── Owner / Admin unchanged ───────────────────────────────────────────────────

describe('P8 — Owner and admin unchanged', () => {
  it('owner still has all 31 permissions', async () => {
    const { ROLE_PERMISSION_MAP, ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.owner).toHaveLength(ALL_PERMISSIONS.length)
  })
  // P10.2.2 — updated from "-1" (tenant.manage only) to "-2": admin also
  // loses tenant.view, per docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md
  // §4.2/§7.2 — both are now owner-exclusive. Intentional architecture
  // change, not a regression.
  it('admin still has all permissions except tenant.manage and tenant.view', async () => {
    const { ROLE_PERMISSION_MAP, ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.admin).toHaveLength(ALL_PERMISSIONS.length - 2)
  })
  it('admin does NOT have tenant.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'tenant.manage')).toBe(false)
  })
  it('admin has analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'analytics.view')).toBe(true)
  })
  it('admin has audit.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'audit.view')).toBe(true)
  })
})

// ── Waiter unchanged ──────────────────────────────────────────────────────────

describe('P8 — Waiter permissions unchanged', () => {
  // Category Management: waiter gained read-only category.view alongside its
  // existing menu.view (docs/CATEGORY_MANAGEMENT_IMPLEMENTATION.md).
  it('waiter still has 15 permissions', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.waiter).toHaveLength(15)
  })
  it('waiter has menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'menu.view')).toBe(true)
  })
  it('waiter has reservations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'reservations.manage')).toBe(true)
  })
})

// ── AccessDenied component exists ─────────────────────────────────────────────

describe('P8 — AccessDenied component', () => {
  it('AccessDenied component can be imported', async () => {
    const mod = await import('@/components/admin/AccessDenied')
    expect(typeof mod.AccessDenied).toBe('function')
  })
})
