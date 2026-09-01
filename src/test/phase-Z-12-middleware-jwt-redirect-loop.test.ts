// ============================================================
// Phase Z.12 — Post-login redirect loop fix
//
// Bug report: a user logs in successfully (verified /auth/me response —
// is_verified: true, activeMembership present, multiple real
// memberships) but gets bounced to /login?redirect=%2Fconsole instead of
// landing on /console — reliably, every login attempt.
//
// That exact URL (`/login?redirect=<path>`) is constructed in exactly
// one place in this codebase: middleware.ts's unauthenticated-redirect
// branch. Nothing in AuthGuard, ConsoleWorkspaceGate, or any client-side
// routing logic builds this URL — so the loop originates at the Edge
// middleware layer, before the React app for /console ever mounts.
//
// Root cause: `isValidJWT()` returned `false` — "not logged in" — for
// ANY token it could not parse as a well-formed 3-segment JWT with a
// numeric `exp` claim in seconds. A present-but-unparseable token (an
// opaque access token, or a JWT shape this heuristic didn't recognize)
// is not proof the user is logged out; it only proves the heuristic
// couldn't read it. Worse, the middleware's redirect response ALSO
// deletes the cookie on any rejection — but `localStorage`'s copy of the

// same token survives untouched (setTokens() writes both), so the
// client-side app kept believing it was authenticated and kept sending
// the user right back to /console, which the now-cookie-less middleware
// rejected again on the very next request. Every login attempt
// reproduced the identical bounce.
//
// This file proves: setTokens() writes both localStorage and the cookie
// synchronously before login's promise resolves (so a race is not the
// cause), and that middleware now only rejects a token it can positively
// prove is expired — never merely unparseable.
// ============================================================
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function req(pathname: string, cookieValue?: string) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers: cookieValue ? { cookie: `access_token=${cookieValue}` } : {},
  })
}

function futureJwt() {
  // header.payload.signature, exp far in the future, seconds (per JWT spec)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: 9999999999 })).toString('base64url')
  return `${header}.${payload}.signature`
}

function expiredJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: 1 })).toString('base64url')
  return `${header}.${payload}.signature`
}

describe('Phase Z.12 — middleware no longer redirect-loops on a present-but-unparseable token', () => {
  it('a well-formed, unexpired JWT is accepted (baseline — unchanged behavior)', () => {
    const res = middleware(req('/console', futureJwt()))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('an opaque (non-JWT) access token — reproduces the reported bug — no longer forces a redirect', () => {
    const res = middleware(req('/console', 'opaque-real-backend-access-token-not-a-jwt'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('a 3-segment token whose payload is not valid base64/JSON is not treated as proof of logout', () => {
    const res = middleware(req('/console', 'not.valid.jwt'))
    expect(res.status).toBe(200)
  })

  it('a well-formed JWT with a non-numeric exp claim is not treated as proof of logout', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: '9999999999' })).toString('base64url')
    const res = middleware(req('/console', `${header}.${payload}.signature`))
    expect(res.status).toBe(200)
  })

  it('a genuinely expired, well-formed JWT is still rejected (the real invalid case is unchanged)', () => {
    const res = middleware(req('/console', expiredJwt()))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fconsole')
  })

  it('no cookie at all still redirects to /login?redirect=%2Fconsole — the genuinely-logged-out case is unchanged', () => {
    const res = middleware(req('/console'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fconsole')
  })

  it('unprotected routes are never redirected, regardless of token', () => {
    const res = middleware(req('/discover'))
    expect(res.status).toBe(200)
  })
})

describe('Phase Z.12 — /platform-admin is a protected prefix (auth cookie), same as /console', () => {
  it('no cookie on /platform-admin redirects to /login?redirect=%2Fplatform-admin', () => {
    const res = middleware(req('/platform-admin'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fplatform-admin')
  })

  it('no cookie on /platform-admin/<module> redirects with the module path preserved', () => {
    const res = middleware(req('/platform-admin/system'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fplatform-admin%2Fsystem')
  })

  it('a well-formed unexpired JWT is accepted on /platform-admin (middleware is auth-only, matching /console)', () => {
    const res = middleware(req('/platform-admin', futureJwt()))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('an expired JWT on /platform-admin is rejected (refresh of a stale session cannot keep the route open)', () => {
    const res = middleware(req('/platform-admin/system', expiredJwt()))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fplatform-admin%2Fsystem')
  })

  it('/console and /dashboard unauthenticated behavior is unchanged', () => {
    const consoleRes = middleware(req('/console'))
    expect(consoleRes.status).toBe(307)
    expect(consoleRes.headers.get('location')).toContain('/login?redirect=%2Fconsole')

    const dashRes = middleware(req('/dashboard'))
    expect(dashRes.status).toBe(307)
    expect(dashRes.headers.get('location')).toContain('/login?redirect=%2Fdashboard')
  })

  it('/console, /dashboard, and /checkout still accept a valid JWT', () => {
    expect(middleware(req('/console', futureJwt())).status).toBe(200)
    expect(middleware(req('/dashboard', futureJwt())).status).toBe(200)
    expect(middleware(req('/checkout', futureJwt())).status).toBe(200)
  })
})

describe('Phase Z.12 — token persistence: setTokens() writes localStorage and the cookie synchronously (no race)', () => {
  it('axios.instance.ts setTokens() source writes both before returning, and login() calls it before resolving', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const __dirname = dirname(fileURLToPath(import.meta.url))

    const axiosSrc = readFileSync(join(__dirname, '..', 'services', 'axios.instance.ts'), 'utf-8')
    const setTokensBlock = axiosSrc.slice(axiosSrc.indexOf('export function setTokens'), axiosSrc.indexOf('export function clearTokens'))
    expect(setTokensBlock).toContain('localStorage.setItem(JWT_ACCESS_KEY')
    expect(setTokensBlock).toContain('writeAccessTokenCookie(access)')
    expect(axiosSrc).toContain('document.cookie')

    const authSrc = readFileSync(join(__dirname, '..', 'services', 'auth.service.ts'), 'utf-8')
    // The real-mode login() branch calls setTokens() before `return data` —
    // i.e. before LoginClientPage's router.push() can ever fire.
    const loginFnStart = authSrc.indexOf('async login(')
    const loginFnBlock = authSrc.slice(loginFnStart, authSrc.indexOf('async register(', loginFnStart))
    const setTokensIndex = loginFnBlock.lastIndexOf('extractAndPersistTokens(')
    const returnTokensIndex = loginFnBlock.lastIndexOf('return {')
    expect(setTokensIndex).toBeGreaterThan(-1)
    expect(returnTokensIndex).toBeGreaterThan(setTokensIndex)
  })
})
