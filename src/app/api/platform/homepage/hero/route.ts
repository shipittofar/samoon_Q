import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/constants'
import { ENDPOINTS } from '@/services/endpoints'
import {
  getPlatformHomepageHero,
  normalizePlatformHomepageHero,
  setPlatformHomepageHero,
} from '@/lib/platform-homepage-store'
import { readBearerToken, requirePlatformSuperuser } from '@/lib/require-platform-superuser'

async function tryUpstreamGet(): Promise<ReturnType<typeof normalizePlatformHomepageHero> | null> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return null
  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.PLATFORM_HOMEPAGE.HERO}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data: unknown = await res.json()
    return normalizePlatformHomepageHero(data)
  } catch {
    return null
  }
}

type UpstreamPutResult =
  | { ok: true; hero: ReturnType<typeof normalizePlatformHomepageHero> }
  | { ok: false; status: number; detail: string }

/**
 * Persists the hero to Django. Real mode only — the backend is the source of
 * truth. A failure is reported to the caller instead of being masked by a
 * local in-memory write: that memory is per-process and lost on restart, so
 * "saving" there would tell the admin it worked when it did not.
 */
async function upstreamPut(
  request: NextRequest,
  hero: ReturnType<typeof normalizePlatformHomepageHero>,
): Promise<UpstreamPutResult> {
  const token = readBearerToken(request)
  if (!token) return { ok: false, status: 401, detail: 'Authentication required' }
  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.PLATFORM_HOMEPAGE.HERO}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hero),
      cache: 'no-store',
    })
    if (!res.ok) {
      // Pass client errors (validation/auth) through; anything else is a bad gateway.
      const status = res.status >= 400 && res.status < 500 ? res.status : 502
      return { ok: false, status, detail: `Upstream save failed (${res.status})` }
    }
    const data: unknown = await res.json()
    return { ok: true, hero: normalizePlatformHomepageHero(data) }
  } catch {
    return { ok: false, status: 502, detail: 'Upstream unavailable' }
  }
}

/** Public read — the marketplace `/` hero. No auth. */
export async function GET() {
  const upstream = await tryUpstreamGet()
  if (upstream) {
    setPlatformHomepageHero(upstream)
    return NextResponse.json(upstream)
  }
  return NextResponse.json(getPlatformHomepageHero())
}

/** Platform Super Admin only. Tenant JWTs receive 401/403. */
export async function PUT(request: NextRequest) {
  const denied = await requirePlatformSuperuser(request)
  if (denied) return denied

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
  }

  const hero = normalizePlatformHomepageHero(body)

  // Mock mode has no backend: the in-process store is the only store.
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
    return NextResponse.json(setPlatformHomepageHero(hero))
  }

  const upstream = await upstreamPut(request, hero)
  if (!upstream.ok) {
    return NextResponse.json({ detail: upstream.detail }, { status: upstream.status })
  }
  // Cache the backend's canonical copy for subsequent public GETs.
  return NextResponse.json(setPlatformHomepageHero(upstream.hero))
}
