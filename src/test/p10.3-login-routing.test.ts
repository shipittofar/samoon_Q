// ============================================================
// P10.3 Phase H — Login Flow Routing — regression tests
//
// Phase 9.3 rewrite: getPostLoginRedirect() no longer takes the removed,
// ambiguous `User.role` — it takes `accountType` (UX hint only) plus an
// optional `tenantRoles` list (the real RBAC-role signal, preferred when
// present). Neither argument is an authorization decision — AuthGuard's
// `dashboard:access` permission check is what actually gates Console.
// ============================================================
import { describe, it, expect } from 'vitest'
import { getPostLoginRedirect } from '@/utils/auth-redirect'

describe('P10.3 Phase H — getPostLoginRedirect prefers tenantRoles over accountType', () => {
  it('a non-empty tenantRoles list wins regardless of accountType', () => {
    expect(getPostLoginRedirect('customer', ['owner'])).toBe('/console')
    expect(getPostLoginRedirect('customer', ['cashier'])).toBe('/console/orders')
  })

  it('routes tenant-role-bearing business accounts to their specific workspace', () => {
    expect(getPostLoginRedirect('business', ['owner'])).toBe('/console')
    expect(getPostLoginRedirect('business', ['admin'])).toBe('/console')
  })

  it('falls back to accountType when tenantRoles is absent, null, or empty', () => {
    expect(getPostLoginRedirect('business')).toBe('/console')
    expect(getPostLoginRedirect('business', null)).toBe('/console')
    expect(getPostLoginRedirect('business', [])).toBe('/console')
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', [])).toBe('/dashboard')
  })
})
