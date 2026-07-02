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
      'demo@savor.com',
      'staff@savor.com',
      'cashier@savor.com',
      'kitchen@savor.com',
      'marketing@savor.com',
      'support@savor.com',
      'admin@savor.com',
      'owner@savor.com',
      'platform@savor.com',
      'multirole@savor.com',
    ]
    for (const email of expected) {
      expect(DEMO_EMAIL_REDIRECTS).toHaveProperty(email)
    }
  })
})

describe('getDemoRedirect', () => {
  it('sends customer demo to /dashboard', () => {
    expect(getDemoRedirect('demo@savor.com')).toBe('/dashboard')
  })

  it('sends staff to /admin/orders', () => {
    expect(getDemoRedirect('staff@savor.com')).toBe('/admin/orders')
  })

  it('sends cashier to /admin/orders', () => {
    expect(getDemoRedirect('cashier@savor.com')).toBe('/admin/orders')
  })

  it('sends kitchen to /admin/kitchen', () => {
    expect(getDemoRedirect('kitchen@savor.com')).toBe('/admin/kitchen')
  })

  it('sends marketing to /admin/analytics', () => {
    expect(getDemoRedirect('marketing@savor.com')).toBe('/admin/analytics')
  })

  it('sends support to /admin/customers', () => {
    expect(getDemoRedirect('support@savor.com')).toBe('/admin/customers')
  })

  it('sends admin to /admin', () => {
    expect(getDemoRedirect('admin@savor.com')).toBe('/admin')
  })

  it('sends owner to /admin', () => {
    expect(getDemoRedirect('owner@savor.com')).toBe('/admin')
  })

  it('sends platform admin to /admin/tenants', () => {
    expect(getDemoRedirect('platform@savor.com')).toBe('/admin/tenants')
  })

  it('sends multi-role to /admin/orders', () => {
    expect(getDemoRedirect('multirole@savor.com')).toBe('/admin/orders')
  })

  it('falls back to /admin for unknown email', () => {
    expect(getDemoRedirect('unknown@example.com')).toBe('/admin')
  })
})

describe('getPostLoginRedirect', () => {
  it('sends customer role to /dashboard', () => {
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
  })

  it('sends staff role to /admin', () => {
    expect(getPostLoginRedirect('staff')).toBe('/admin')
  })

  it('sends admin role to /admin', () => {
    expect(getPostLoginRedirect('admin')).toBe('/admin')
  })

  it('sends unknown role to /admin', () => {
    expect(getPostLoginRedirect('superuser')).toBe('/admin')
  })
})
