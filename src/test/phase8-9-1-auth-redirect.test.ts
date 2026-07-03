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

  it('sends staff to /console/orders', () => {
    expect(getDemoRedirect('staff@savor.com')).toBe('/console/orders')
  })

  it('sends cashier to /console/orders', () => {
    expect(getDemoRedirect('cashier@savor.com')).toBe('/console/orders')
  })

  it('sends kitchen to /console/kitchen', () => {
    expect(getDemoRedirect('kitchen@savor.com')).toBe('/console/kitchen')
  })

  it('sends marketing to /console/analytics', () => {
    expect(getDemoRedirect('marketing@savor.com')).toBe('/console/analytics')
  })

  it('sends support to /console/customers', () => {
    expect(getDemoRedirect('support@savor.com')).toBe('/console/customers')
  })

  it('sends admin to /console', () => {
    expect(getDemoRedirect('admin@savor.com')).toBe('/console')
  })

  it('sends owner to /console', () => {
    expect(getDemoRedirect('owner@savor.com')).toBe('/console')
  })

  it('sends platform admin to /console/tenants', () => {
    expect(getDemoRedirect('platform@savor.com')).toBe('/console/tenants')
  })

  it('sends multi-role to /console/orders', () => {
    expect(getDemoRedirect('multirole@savor.com')).toBe('/console/orders')
  })

  it('falls back to /console for unknown email', () => {
    expect(getDemoRedirect('unknown@example.com')).toBe('/console')
  })
})

describe('getPostLoginRedirect', () => {
  it('sends customer role to /dashboard', () => {
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
  })

  it('sends staff role to /console', () => {
    expect(getPostLoginRedirect('staff')).toBe('/console')
  })

  it('sends admin role to /console', () => {
    expect(getPostLoginRedirect('admin')).toBe('/console')
  })

  it('sends unknown role to /console', () => {
    expect(getPostLoginRedirect('superuser')).toBe('/console')
  })
})
