/**
 * Cross-tab session: middleware reads the access_token cookie; the client
 * reads localStorage. A second tab must pass middleware using the same
 * browser session Tab A created — not the in-memory Zustand store.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { middleware } from '@/middleware'
import { JWT_ACCESS_KEY } from '@/constants'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'
import type { User } from '@/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

function req(pathname: string, cookieValue?: string) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers: cookieValue ? { cookie: `access_token=${cookieValue}` } : {},
  })
}

function futureJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: 9999999999 })).toString('base64url')
  return `${header}.${payload}.signature`
}

function expiredJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: 1 })).toString('base64url')
  return `${header}.${payload}.signature`
}

function cookieValueFromDocument(): string | undefined {
  const prefix = `${JWT_ACCESS_KEY}=`
  const part = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  if (!part) return undefined
  return decodeURIComponent(part.slice(prefix.length))
}

const PROTECTED = ['/platform-admin', '/console', '/dashboard'] as const

describe('Login creates a browser session middleware can see (second tab)', () => {
  beforeEach(async () => {
    localStorage.clear()
    document.cookie.split('; ').forEach((c) => {
      const name = c.split('=')[0]
      if (name) document.cookie = `${name}=; path=/; max-age=0`
    })
  })

  it('setTokens writes localStorage and a cookie with the same access token', async () => {
    const { setTokens } = await import('@/services/axios.instance')
    const access = futureJwt()
    setTokens(access, 'refresh-token')
    expect(localStorage.getItem(JWT_ACCESS_KEY)).toBe(access)
    expect(cookieValueFromDocument()).toBe(access)
  })

  it.each(PROTECTED)('second-tab document GET %s is allowed with that cookie', async (path) => {
    const { setTokens } = await import('@/services/axios.instance')
    const access = futureJwt()
    setTokens(access, 'refresh-token')
    const cookie = cookieValueFromDocument()
    expect(cookie).toBeTruthy()
    const res = middleware(req(path, cookie))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it.each(PROTECTED)('missing authentication still redirects %s to /login?redirect=', (path) => {
    const res = middleware(req(path))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain(`/login?redirect=${encodeURIComponent(path)}`)
  })

  it.each(PROTECTED)('expired JWT still cannot access %s', (path) => {
    const res = middleware(req(path, expiredJwt()))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?redirect=')
  })

  it.each(PROTECTED)('malformed empty cookie still cannot access %s', (path) => {
    const res = middleware(req(path, ''))
    expect(res.status).toBe(307)
  })

  it('guest /checkout is not redirected to /login', () => {
    const res = middleware(req('/checkout'))
    expect(res.status).not.toBe(307)
    expect(res.headers.get('location')).toBeNull()
  })
})

describe('Token stores stay aligned', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('setTokens still writes the cookie if configuration resolveField throws', async () => {
    const { configurationService } = await import('@/config')
    const { setTokens } = await import('@/services/axios.instance')
    const spy = vi.spyOn(configurationService, 'resolveField').mockImplementation(() => {
      throw new Error('registry unavailable')
    })
    const access = futureJwt()
    try {
      expect(() => setTokens(access, 'refresh')).not.toThrow()
      expect(localStorage.getItem(JWT_ACCESS_KEY)).toBe(access)
      expect(cookieValueFromDocument()).toBe(access)
    } finally {
      spy.mockRestore()
    }
  })

  it('oversized access tokens still produce a cookie middleware accepts', async () => {
    const { accessTokenCookieValue, ACCESS_TOKEN_COOKIE_SENTINEL } = await import(
      '@/services/axios.instance'
    )
    const huge = `opaque.${'a'.repeat(4000)}.pad`
    expect(accessTokenCookieValue(huge)).toBe(ACCESS_TOKEN_COOKIE_SENTINEL)
    const res = middleware(req('/console', ACCESS_TOKEN_COOKIE_SENTINEL))
    expect(res.status).toBe(200)
  })

  it('refresh interceptor persists via setTokens (cookie + localStorage together)', async () => {
    const axiosSrc = readFileSync(join(__dirname, '..', 'services', 'axios.instance.ts'), 'utf-8')
    const refreshBlock = axiosSrc.slice(
      axiosSrc.indexOf('async (error: AxiosError)'),
      axiosSrc.indexOf('export default api'),
    )
    expect(refreshBlock).toContain('setTokens(data.access, data.refresh || refresh)')
    expect(refreshBlock).toContain('clearTokens()')
  })

  it('syncAccessTokenCookieFromStorage restores a missing cookie from localStorage', async () => {
    const { setTokens, clearAccessTokenCookie, syncAccessTokenCookieFromStorage } = await import(
      '@/services/axios.instance'
    )
    const access = futureJwt()
    setTokens(access, 'refresh')
    clearAccessTokenCookie()
    expect(cookieValueFromDocument()).toBeFalsy()
    expect(localStorage.getItem(JWT_ACCESS_KEY)).toBe(access)
    syncAccessTokenCookieFromStorage()
    expect(cookieValueFromDocument()).toBe(access)
    expect(middleware(req('/platform-admin', cookieValueFromDocument())).status).toBe(200)
  })

  it('middleware reject does not delete the access_token cookie (no silent localStorage-only session)', () => {
    const res = middleware(req('/console', expiredJwt()))
    expect(res.status).toBe(307)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie.toLowerCase()).not.toContain('access_token=')
  })

  it('AuthBootstrapper re-mirrors the cookie before getMe', () => {
    const src = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('syncAccessTokenCookieFromStorage()')
    const check = src.slice(src.indexOf('function checkSession()'), src.indexOf('authService.getMe()'))
    expect(check.indexOf('syncAccessTokenCookieFromStorage')).toBeGreaterThan(
      check.indexOf('getAccessToken'),
    )
  })

  it('login page holds the form during session restore; AuthGuard does not build ?redirect=', () => {
    const loginSrc = readFileSync(join(__dirname, '..', 'app', 'login', 'LoginClientPage.tsx'), 'utf-8')
    expect(loginSrc).toContain('shouldHoldLoginFormForSessionRestore')
    expect(loginSrc).toContain('login-session-restore')
    const guardSrc = readFileSync(join(__dirname, '..', 'components', 'auth', 'AuthGuard.tsx'), 'utf-8')
    expect(guardSrc).not.toContain('redirect=')
    const mw = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf-8')
    expect(mw).toContain("searchParams.set('redirect'")
    expect(mw).not.toContain('cookies.delete')
  })
})

describe('Logout invalidates the browser session for a new tab', () => {
  it('clearTokens removes localStorage and the cookie; middleware then denies protected routes', async () => {
    const { setTokens, clearTokens } = await import('@/services/axios.instance')
    setTokens(futureJwt(), 'refresh')
    clearTokens()
    expect(localStorage.getItem(JWT_ACCESS_KEY)).toBeNull()
    expect(cookieValueFromDocument()).toBeFalsy()
    for (const path of PROTECTED) {
      expect(middleware(req(path)).status).toBe(307)
    }
  })
})

describe('Platform Admin authorization is unchanged (is_superuser only)', () => {
  function user(overrides: Partial<User> = {}): User {
    return {
      id: 'u-1',
      email: 'a@b.c',
      first_name: 'A',
      last_name: 'B',
      accountType: 'business',
      is_verified: true,
      created_at: '2024-01-01T00:00:00Z',
      ...overrides,
    }
  }

  it('is_superuser=true can enter Platform Admin', () => {
    expect(isPlatformSuperuser(user({ is_superuser: true }))).toBe(true)
  })

  it('is_superuser=false cannot enter Platform Admin', () => {
    expect(isPlatformSuperuser(user({ is_superuser: false }))).toBe(false)
  })

  it('is_staff=true without is_superuser cannot enter Platform Admin', () => {
    expect(isPlatformSuperuser(user({ is_staff: true, is_superuser: false }))).toBe(false)
  })

  it('tenant owner fields are irrelevant to Platform Admin access', () => {
    expect(isPlatformSuperuser(user({ is_superuser: undefined }))).toBe(false)
  })

  it('no platform_super_admin client fallback on the route guards', () => {
    const layout = readFileSync(join(__dirname, '..', 'app', 'platform-admin', 'layout.tsx'), 'utf-8')
    const guard = readFileSync(join(__dirname, '..', 'components', 'auth', 'PlatformSuperuserGuard.tsx'), 'utf-8')
    const access = readFileSync(join(__dirname, '..', 'lib', 'platform-admin-access.ts'), 'utf-8')
    expect(layout).not.toMatch(/from ['"]@\/platform-admin/)
    expect(`${layout}\n${guard}\n${access}`).not.toContain('platform_super_admin')
    expect(access).toContain('is_superuser === true')
    expect(guard).toContain('isPlatformSuperuser')
  })
})
