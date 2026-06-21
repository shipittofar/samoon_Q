import { NextRequest, NextResponse } from 'next/server'
import { JWT_ACCESS_KEY } from '@/constants'

/**
 * Protected route prefixes — any request matching these must carry a valid
 * auth cookie. Unauthenticated requests are redirected to /login with the
 * original destination preserved in `?redirect=` so the login page can
 * restore the user's intent after they authenticate.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/checkout', '/admin'] as const

/** Returns true when the pathname starts with any protected prefix. */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Resolves the tenant slug from the incoming request (P1B.3).
 *
 * Priority:
 *   1. Subdomain of the host (production): restaurant-a.example.com → 'restaurant-a'
 *      Skips 'www' — treat www.example.com as no-tenant (DEFAULT_TENANT).
 *   2. NEXT_PUBLIC_TENANT_SLUG env var (development / local override).
 *   3. Returns undefined — caller falls back to DEFAULT_TENANT.
 */
function resolveTenantSlug(request: NextRequest): string | undefined {
  const host = request.headers.get('host') ?? ''
  // Strip port for local dev (e.g. localhost:3000 → localhost)
  const hostname = host.split(':')[0]
  const parts = hostname.split('.')

  // Subdomain present and not 'www' → use as slug
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0]
  }

  // Dev fallback: env var (set at build time, available in Edge runtime via process.env)
  const envSlug = process.env.NEXT_PUBLIC_TENANT_SLUG
  if (envSlug) return envSlug

  return undefined
}

/**
 * Lightweight JWT validation — Edge-runtime compatible (no Node.js crypto).
 * Checks structure (3 segments) and decodes the payload to verify `exp`.
 * Full signature verification is delegated to the backend on every API call.
 */
function isValidJWT(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    // base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>
    const exp = payload['exp']
    if (typeof exp !== 'number') return false
    // exp is seconds; Date.now() is ms
    return exp * 1000 > Date.now()
  } catch {
    return false
  }
}

/**
 * Middleware — authentication (P3.1) + tenant resolution (P1B.3).
 *
 * Runs on the Edge runtime before every matched request.
 *
 * Tenant resolution: extracts slug from subdomain or env var, then injects
 * it as the X-Tenant-Slug request header so server components and API routes
 * can read it without re-parsing the host.
 *
 * Auth: reads the `access_token` cookie and redirects unauthenticated users
 * to /login for protected routes.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // ── Tenant resolution (P1B.3) ──────────────────────────────────────────────
  const slug = resolveTenantSlug(request)
  const requestHeaders = new Headers(request.headers)
  if (slug) {
    requestHeaders.set('x-tenant-slug', slug)
  }

  // ── Auth guard (P3.1) ──────────────────────────────────────────────────────
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const token = request.cookies.get(JWT_ACCESS_KEY)?.value

  if (token && isValidJWT(token)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  const redirectResponse = NextResponse.redirect(loginUrl)
  // Clear a stale / expired token so the login page starts fresh
  if (token) {
    redirectResponse.cookies.delete(JWT_ACCESS_KEY)
  }
  return redirectResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/checkout/:path*',
    '/admin/:path*',
    // Also run on public routes so tenant header is injected for all page loads
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
