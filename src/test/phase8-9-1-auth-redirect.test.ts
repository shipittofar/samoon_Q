/**
 * P8.9.1 — Auth redirect regression tests.
 *
 * Verifies that every demo account maps to the correct post-login destination
 * and that the role-based fallback for real users is correct.
 */

import { describe, it, expect } from 'vitest'
import {
  DEMO_EMAIL_REDIRECTS,
  getDemoRedirect,
  getPostLoginRedirect,
} from '@/utils/auth-redirect'

describe('DEMO_EMAIL_REDIRECTS', () => {
  it('covers all 10 demo accounts', () => {
    const expected = [
      'demo@samoon.com',
      'staff@samoon.com',
      'cashier@samoon.com',
      'kitchen@samoon.com',
      'marketing@samoon.com',
      'support@samoon.com',
      'admin@samoon.com',
      'owner@samoon.com',
      'platform@samoon.com',
      'multirole@samoon.com',
    ]
    for (const email of expected) {
      expect(DEMO_EMAIL_REDIRECTS).toHaveProperty(email)
    }
  })
})

describe('getDemoRedirect', () => {
  it('sends customer demo to /dashboard', () => {
    expect(getDemoRedirect('demo@samoon.com')).toBe('/dashboard')
  })

  it('sends staff to /console/orders', () => {
    expect(getDemoRedirect('staff@samoon.com')).toBe('/console/orders')
  })

  it('sends cashier to /console/orders', () => {
    expect(getDemoRedirect('cashier@samoon.com')).toBe('/console/orders')
  })

  it('sends kitchen to /console/kitchen', () => {
    expect(getDemoRedirect('kitchen@samoon.com')).toBe('/console/kitchen')
  })

  it('sends marketing to /console/analytics', () => {
    expect(getDemoRedirect('marketing@samoon.com')).toBe('/console/analytics')
  })

  it('sends support to /console/customers', () => {
    expect(getDemoRedirect('support@samoon.com')).toBe('/console/customers')
  })

  it('sends admin to /console', () => {
    expect(getDemoRedirect('admin@samoon.com')).toBe('/console')
  })

  it('sends owner to /console', () => {
    expect(getDemoRedirect('owner@samoon.com')).toBe('/console')
  })

  it('sends platform admin to /console/tenants', () => {
    expect(getDemoRedirect('platform@samoon.com')).toBe('/console/tenants')
  })

  it('sends multi-role to /console/orders', () => {
    expect(getDemoRedirect('multirole@samoon.com')).toBe('/console/orders')
  })

  it('falls back to /console for unknown email', () => {
    expect(getDemoRedirect('unknown@example.com')).toBe('/console')
  })
})

// Phase 9.3 — getPostLoginRedirect() no longer takes an arbitrary role
// string; it takes accountType ('customer'|'business', a UX hint only)
// plus an optional tenantRoles list.
//
// Phase Z.9 — accountType is now authoritative for DIRECTION (Console vs.
// /dashboard); tenantRoles only refines which /console/* sub-page a
// business account lands on. It can no longer override accountType in
// either direction.
describe('getPostLoginRedirect', () => {
  it('sends customer accountType to /dashboard when there are no tenant roles', () => {
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
  })

  it('sends business accountType to /console when there are no tenant roles', () => {
    expect(getPostLoginRedirect('business')).toBe('/console')
  })

  it('a customer accountType always lands on /dashboard, even with tenant roles present', () => {
    expect(getPostLoginRedirect('customer', ['owner'])).toBe('/dashboard')
  })

  it('an unrecognized tenant role still lands in /console for a business account (resolveWorkspace default)', () => {
    expect(getPostLoginRedirect('business', ['superuser' as never])).toBe('/console')
  })
})
