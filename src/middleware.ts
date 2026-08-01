import { NextRequest, NextResponse } from 'next/server'
import { JWT_ACCESS_KEY } from '@/constants'

/**
 * Protected route prefixes — any request matching these must carry a valid
 * auth cookie. Unauthenticated requests are redirected to /login with the
 * original destination preserved in `?redirect=` so the login page can
 * restore the user's intent after they authenticate.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/checkout', '/console'] as const

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
 * Lightweight JWT expiry check — Edge-runtime compatible (no Node.js crypto).
 * Full signature verification is delegated to the backend on every API
 * call; this is a fast heuristic gate only, meant to catch "obviously not
 * logged in" (no cookie at all) before rendering a protected route's
 * shell — never a security boundary.
 *
 * Root-cause fix (redirect-loop bug): this function used to return
 * `false` — "not logged in" — for anything it could not positively parse
 * as a 3-segment JWT with a numeric `exp` claim in seconds. That is wrong
 * for a PRESENT token: an opaque (non-JWT) access token, or a JWT whose
 * `exp` claim this parser doesn't recognize, is not proof the user is
 * logged out — it only proves this heuristic couldn't read it. Treating
 * "can't parse" the same as "invalid" caused a real, reproducible loop:
 * a genuinely valid access token that merely didn't match this parser's
 * assumptions got classified as invalid, middleware redirected to
 * `/login?redirect=...` AND deleted the cookie (see below) — but
 * `localStorage`'s copy of the same token was untouched, so the app's
 * own client-side auth state still read "authenticated" and kept sending
 * the user right back to the protected route, which middleware rejected
 * again on the now-cookie-less follow-up request. Every login attempt
 * reproduced the same bounce.
 *
 * Now: only a token this function can POSITIVELY PROVE is expired (a
 * well-formed JWT with a past numeric `exp`) is rejected here. A present
 * token this heuristic cannot parse is treated as possibly valid — the
 * backend's own 401 responses (handled by the axios interceptor +
 * AuthBootstrapper.clearSession(), src/providers/index.tsx) remain the
 * real authority and will still correctly log out a genuinely invalid
 * session the moment an actual API call is made.
 */
function isValidJWT(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return true
  try {
    // base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>
    const exp = payload['exp']
    if (typeof exp !== 'number') return true
    // exp is seconds; Date.now() is ms
    return exp * 1000 > Date.now()
  } catch {
    return true
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
  // Preserve query params (orderType, table, etc.) so checkout state survives auth.
  const returnPath = request.nextUrl.search
    ? `${pathname}${request.nextUrl.search}`
    : pathname
  loginUrl.searchParams.set('redirect', returnPath)
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
    '/console/:path*',
    // Also run on public routes so tenant header is injected for all page loads
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
