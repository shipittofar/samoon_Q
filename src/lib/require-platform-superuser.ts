import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, JWT_ACCESS_KEY } from '@/constants'
import { ENDPOINTS } from '@/services/endpoints'
import { MOCK_CREDENTIALS, MOCK_SESSION_KEY } from '@/services/auth.service'
import { normalizeGetMeResponse } from '@/lib/auth-me-normalizer'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'

/** Compact cookie written when the JWT cannot fit (see axios.instance). */
const ACCESS_TOKEN_COOKIE_SENTINEL = '1'

function mockAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === 'true'
}

export function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim()
    if (token) return token
  }
  const cookie = request.cookies.get(JWT_ACCESS_KEY)?.value
  if (!cookie || cookie === ACCESS_TOKEN_COOKIE_SENTINEL) return null
  try {
    return decodeURIComponent(cookie)
  } catch {
    return cookie
  }
}

/**
 * Platform Homepage mutations: Django `is_superuser` only.
 * Tenant owner/admin JWTs and tenant RBAC are never sufficient.
 * Returns an error response, or null when the actor is a platform superuser.
 */
export async function requirePlatformSuperuser(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (mockAuthEnabled()) {
    const email = request.cookies.get(MOCK_SESSION_KEY)?.value
    if (!email) {
      return NextResponse.json({ detail: 'Authentication required' }, { status: 401 })
    }
    const user = MOCK_CREDENTIALS[email]?.user
    if (!isPlatformSuperuser(user)) {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
    }
    return null
  }

  const token = readBearerToken(request)
  if (!token) {
    return NextResponse.json({ detail: 'Authentication required' }, { status: 401 })
  }

  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.AUTH.ME}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ detail: 'Authentication required' }, { status: res.status })
    }
    if (!res.ok) {
      return NextResponse.json({ detail: 'Authentication required' }, { status: 401 })
    }
    const me = normalizeGetMeResponse(await res.json())
    if (!isPlatformSuperuser(me.user)) {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
    }
    return null
  } catch {
    return NextResponse.json({ detail: 'Authentication required' }, { status: 401 })
  }
}
