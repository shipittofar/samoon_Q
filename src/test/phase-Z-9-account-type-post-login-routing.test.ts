// ============================================================
// Phase Z.9 — Post-login routing: accountType is authoritative for direction
//
// Requirement: user.accountType === 'business' -> /console (never
// /dashboard). user.accountType === 'customer' -> /dashboard (never
// /console). Neither is an authorization decision — AuthGuard's
// dashboard:access permission check still gates Console; a business
// account with no permission on its tenant lands on /console and sees
// AccessDenied there, which is correct.
//
// Two real gaps existed before this fix:
//   1. getPostLoginRedirect() (src/utils/auth-redirect.ts) checked
//      tenantRoles BEFORE accountType, so a `customer` account with any
//      tenant-scoped roles present (e.g. stale/demo data) could resolve
//      to /console — violating the "customer never sees console" rule.
//   2. complete-profile/page.tsx (the phone-OTP registration completion
//      page) hardcoded `router.push('/dashboard')` regardless of the
//      newly-registered account's accountType, bypassing
//      getPostLoginRedirect() entirely — a business signup completed
//      through this flow always landed on /dashboard.
// ============================================================
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPostLoginRedirect } from '@/utils/auth-redirect'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Phase Z.9 — getPostLoginRedirect(): accountType is authoritative for direction', () => {
  it('reproduces the exact reported /auth/me payload: business + owner/admin roles -> /console', () => {
    expect(getPostLoginRedirect('business', ['owner', 'admin'])).toBe('/console')
  })

  it('business account always resolves under /console, regardless of tenantRoles', () => {
    expect(getPostLoginRedirect('business')).toBe('/console')
    expect(getPostLoginRedirect('business', null)).toBe('/console')
    expect(getPostLoginRedirect('business', [])).toBe('/console')
    expect(getPostLoginRedirect('business', ['owner'])).toBe('/console')
    expect(getPostLoginRedirect('business', ['cashier'])).toBe('/console/orders')
  })

  it('customer account always resolves to /dashboard, regardless of tenantRoles (the closed gap)', () => {
    expect(getPostLoginRedirect('customer')).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', null)).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', [])).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', ['owner'])).toBe('/dashboard')
    expect(getPostLoginRedirect('customer', ['admin'])).toBe('/dashboard')
  })
})

describe('Phase Z.9 — complete-profile/page.tsx honors accountType instead of hardcoding /dashboard', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'complete-profile', 'page.tsx'), 'utf-8')

  it('imports getPostLoginRedirect', () => {
    expect(src).toContain("getPostLoginRedirect")
    expect(src).toMatch(/import\s*\{[^}]*getPostLoginRedirect[^}]*\}\s*from\s*['"]@\/utils\/auth-redirect['"]/)
  })

  it('the register() onSuccess handler routes through getPostLoginRedirect, not a hardcoded /dashboard', () => {
    const onSuccessBlock = src.slice(src.indexOf('onSuccess: (result)'), src.indexOf('onError:'))
    expect(onSuccessBlock).toContain('getPostLoginRedirect(result.user.accountType, result.p7Roles)')
    expect(onSuccessBlock).not.toMatch(/router\.push\(['"]\/dashboard['"]\)/)
  })
})

describe('Phase Z.9 — LoginClientPage.tsx and verify/page.tsx already route through getPostLoginRedirect (no regression)', () => {
  it('LoginClientPage.tsx uses getPostLoginRedirect with the login result', () => {
    const src = readFileSync(join(__dirname, '..', 'app', 'login', 'LoginClientPage.tsx'), 'utf-8')
    expect(src).toContain('getPostLoginRedirect(result.user.accountType, result.p7Roles)')
  })

  it('verify/page.tsx uses getPostLoginRedirect for the OTP-login (existing user) success path', () => {
    const src = readFileSync(join(__dirname, '..', 'app', 'verify', 'page.tsx'), 'utf-8')
    expect(src).toContain('getPostLoginRedirect')
  })
})
