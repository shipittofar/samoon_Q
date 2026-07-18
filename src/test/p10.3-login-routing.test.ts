// ============================================================
// P10.3 Phase H — Login Flow Routing — regression tests
//
// Phase 9.3 rewrite: getPostLoginRedirect() no longer takes the removed,
// ambiguous `User.role` — it takes `accountType` (UX hint only) plus an
// optional `tenantRoles` list. Neither argument is an authorization
// decision — AuthGuard's `dashboard:access` permission check is what
// actually gates Console.
//
// Phase Z.9 rewrite: `accountType` is now the AUTHORITATIVE gate on
// direction (Console vs. /dashboard) — `tenantRoles` no longer overrides
// it. A `customer` account always lands on `/dashboard`, even if
// `tenantRoles` is non-empty (was previously routed to `/console` — see
// docs/POST_LOGIN_ROUTING_ACCOUNT_TYPE_AUDIT.md). `tenantRoles` still
// refines WHICH `/console/*` sub-page a `business` account lands on.
// ============================================================
import { describe, it, expect } from 'vitest'
import { getPostLoginRedirect } from '@/utils/auth-redirect'

describe('P10.3 / Z.9 — getPostLoginRedirect: accountType is authoritative for direction', () => {
  it('a customer account always lands on /dashboard, even with tenant roles present', () => {
    expect(getPostLoginRedirect('customer', ['owner'])).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', ['cashier'])).toBe('/dashboard')
  })

  it('tenantRoles refines which /console/* sub-page a business account lands on', () => {
    expect(getPostLoginRedirect('business', ['owner'])).toBe('/console')
    expect(getPostLoginRedirect('business', ['admin'])).toBe('/console')
    expect(getPostLoginRedirect('business', ['cashier'])).toBe('/console/orders')
  })

  it('business falls back to /console (never /dashboard) when tenantRoles is absent, null, or empty', () => {
    expect(getPostLoginRedirect('business')).toBe('/console')
    expect(getPostLoginRedirect('business', null)).toBe('/console')
    expect(getPostLoginRedirect('business', [])).toBe('/console')
  })

  it('customer falls back to /dashboard (never /console) when tenantRoles is absent, null, or empty', () => {
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', null)).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', [])).toBe('/dashboard')
  })
})
