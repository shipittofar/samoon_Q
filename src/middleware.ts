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
 * Authentication middleware — Phase 3 (P3.1).
 *
 * Runs on the Edge runtime before every request matching the `config.matcher`.
 * Reads the `access_token` cookie (mirrored from localStorage by setTokens())
 * and redirects unauthenticated users to /login.
 *
 * Does NOT validate the JWT signature — signature validation happens at the
 * API layer. The cookie presence check is sufficient to gate the UI: even if
 * an attacker forges the cookie they receive no real data because the API will
 * reject their requests with 401 and the frontend will clear tokens.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  if (!isProtectedRoute(pathname)) return NextResponse.next()

  const token = request.cookies.get(JWT_ACCESS_KEY)?.value
  if (token) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/dashboard/:path*', '/checkout/:path*', '/admin/:path*'],
}
