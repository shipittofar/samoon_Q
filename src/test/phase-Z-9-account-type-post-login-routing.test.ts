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

// Post-auth navigation is centralized: useLogin()/useRegister()/useVerifyOTP()
// call establishAuthenticatedSession(), which dispatches POST_LOGIN_REDIRECT_EVENT
// after /auth/me hydrates; PostLoginRedirectHandler then navigates via
// resolvePostAuthDestination() -> getPostLoginRedirect(accountType, roles).
// Pages must not hardcode a destination of their own.
const readApp = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf-8')

describe('Phase Z.9 — post-auth redirect is resolved in one place from accountType', () => {
  it('PostLoginRedirectHandler navigates via resolvePostAuthDestination(accountType, roles)', () => {
    const src = readApp('providers', 'PostLoginRedirectHandler.tsx')
    expect(src).toContain('POST_LOGIN_REDIRECT_EVENT')
    expect(src).toContain('resolvePostAuthDestination(user.accountType, p7Roles)')
  })

  it('resolvePostAuthDestination falls back to getPostLoginRedirect', () => {
    const src = readApp('utils', 'auth-redirect.ts')
    expect(src).toMatch(/export function resolvePostAuthDestination[\s\S]*?return getPostLoginRedirect\(accountType, tenantRoles\)/)
  })

  it('login, register and OTP verify all establish the session through the shared helper', () => {
    const hooks = readApp('hooks', 'index.ts').replace(/\r\n/g, '\n')
    for (const name of ['useLogin', 'useRegister', 'useVerifyOTP']) {
      const start = hooks.indexOf(`export function ${name}(`)
      expect(start).toBeGreaterThan(-1)
      const body = hooks.slice(start, hooks.indexOf('\n}\n', start))
      expect(body).toContain('establishAuthenticatedSession(')
    }
    expect(hooks).toContain('dispatchPostLoginRedirect(data.user, p7Roles)')
  })

  it('complete-profile, login and verify pages never hardcode /dashboard or /console', () => {
    for (const p of [
      ['app', 'complete-profile', 'page.tsx'],
      ['app', 'login', 'LoginClientPage.tsx'],
      ['app', 'verify', 'page.tsx'],
    ]) {
      const src = readApp(...p)
      expect(src).not.toMatch(/router\.(push|replace)\(['"]\/(dashboard|console)['"]\)/)
    }
  })
})
