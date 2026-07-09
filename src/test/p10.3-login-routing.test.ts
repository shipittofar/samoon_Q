// ============================================================
// P10.3 Phase H — Ownership-aware Login Flow — regression tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { getPostLoginRedirect } from '@/utils/auth-redirect'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
})

describe('P10.3 Phase H — getPostLoginRedirect is ownership-aware', () => {
  it('routes a known Owner email to /console regardless of role string', () => {
    // 'customer' is deliberately the wrong role string here — ownership
    // data should still win and route to /console.
    expect(getPostLoginRedirect('customer', 'owner@savor.com')).toBe('/console')
  })

  it('routes a known Staff email to /console', () => {
    expect(getPostLoginRedirect('customer', 'cashier@savor.com')).toBe('/console')
  })

  it('falls back to role-based resolveWorkspace() when no email is provided', () => {
    expect(getPostLoginRedirect('owner')).toBe('/console')
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
  })

  it('falls back to role-based resolveWorkspace() when the email matches no Owner/Staff record', () => {
    expect(getPostLoginRedirect('customer', 'john@example.com')).toBe('/dashboard')
  })

  it('falls back to role-based resolveWorkspace() when email is null/undefined', () => {
    expect(getPostLoginRedirect('owner', null)).toBe('/console')
    expect(getPostLoginRedirect('owner', undefined)).toBe('/console')
  })
})
