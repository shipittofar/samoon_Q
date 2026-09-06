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

async function tryUpstreamPut(
  request: NextRequest,
  hero: ReturnType<typeof normalizePlatformHomepageHero>,
): Promise<ReturnType<typeof normalizePlatformHomepageHero> | null> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return null
  const token = readBearerToken(request)
  if (!token) return null
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
    if (!res.ok) return null
    const data: unknown = await res.json()
    return normalizePlatformHomepageHero(data)
  } catch {
    return null
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
  const upstream = await tryUpstreamPut(request, hero)
  const saved = setPlatformHomepageHero(upstream ?? hero)
  return NextResponse.json(saved)
}
