// ============================================================
// P10.3 Phase H — Login Flow Routing — regression tests
//
// Phase 2 (RBAC unification) rewrite: getPostLoginRedirect() no longer
// consults ownership/staff-assignment data — it is a pure function of
// `role` via resolveWorkspace(). The `email` parameter is accepted for
// call-site backward compatibility but has no effect on the result.
// ============================================================
import { describe, it, expect } from 'vitest'
import { getPostLoginRedirect } from '@/utils/auth-redirect'

describe('P10.3 Phase H — getPostLoginRedirect is role-based only', () => {
  it('routes based on role regardless of email, even for a known Owner/Staff email', () => {
    // Ownership/staff-assignment data must never override the role-based
    // decision — 'customer' role routes to /dashboard even with an
    // owner/staff email attached.
    expect(getPostLoginRedirect('customer', 'owner@samoon.com')).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', 'cashier@samoon.com')).toBe('/dashboard')
  })

  it('routes staff/owner roles to /console', () => {
    expect(getPostLoginRedirect('owner')).toBe('/console')
    expect(getPostLoginRedirect('admin')).toBe('/console')
  })

  it('routes customer role to /dashboard', () => {
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
  })

  it('is unaffected by a null/undefined email', () => {
    expect(getPostLoginRedirect('owner', null)).toBe('/console')
    expect(getPostLoginRedirect('owner', undefined)).toBe('/console')
  })
})
