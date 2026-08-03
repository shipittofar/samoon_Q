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
// Routing is centralized in establishAuthenticatedSession() (hooks/index.ts)
// via dispatchPostLoginRedirect / resolvePostAuthDestination — not inlined
// in every page component.
// ============================================================
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPostLoginRedirect, resolvePostAuthDestination } from '@/utils/auth-redirect'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const hooksSrc = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')

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

  it('resolvePostAuthDestination mirrors getPostLoginRedirect', () => {
    expect(resolvePostAuthDestination('business', ['cashier'])).toBe('/console/orders')
    expect(resolvePostAuthDestination('customer', ['owner'])).toBe('/dashboard')
  })
})

describe('Phase Z.9 — complete-profile/page.tsx delegates routing to useRegister', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'complete-profile', 'page.tsx'), 'utf-8')

  it('uses useRegister from hooks (session + redirect via establishAuthenticatedSession)', () => {
    expect(src).toContain('useRegister')
    expect(src).toMatch(/from\s*['"]@\/hooks['"]/)
  })

  it('onSuccess does not hardcode router.push("/dashboard")', () => {
    const onSuccessBlock = src.slice(src.indexOf('onSuccess:'), src.indexOf('onError:'))
    expect(onSuccessBlock).not.toMatch(/router\.push\(['"]\/dashboard['"]\)/)
  })
})

describe('Phase Z.9 — Login and verify route through centralized post-auth navigation', () => {
  it('LoginClientPage.tsx uses centralized login transition (executeLogin)', () => {
    const src = readFileSync(join(__dirname, '..', 'app', 'login', 'LoginClientPage.tsx'), 'utf-8')
    expect(src).toContain('executeLogin')
    expect(src).toContain('useLoginTransition')
  })

  it('hooks establishAuthenticatedSession dispatches post-login redirect', () => {
    expect(hooksSrc).toContain('establishAuthenticatedSession')
    expect(hooksSrc).toContain('dispatchPostLoginRedirect')
  })

  it('verify flow uses useVerifyOTP which calls establishAuthenticatedSession for existing users', () => {
    expect(hooksSrc).toContain('export function useVerifyOTP')
    expect(hooksSrc).toContain('establishAuthenticatedSession')
  })
})
