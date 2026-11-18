/**
 * Phase 0 — Platform Homepage hero PUT in real (non-mock) mode must report
 * backend failures instead of silently writing to the per-process store.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/require-platform-superuser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/require-platform-superuser')>()
  return { ...actual, requirePlatformSuperuser: vi.fn(async () => null) }
})

import { PUT } from '@/app/api/platform/homepage/hero/route'
import {
  getPlatformHomepageHero,
  resetPlatformHomepageHeroForTests,
} from '@/lib/platform-homepage-store'

const HERO_BODY = {
  backgroundImages: [{ id: 'new-1', src: 'https://cdn.example/new.jpg', order: 0, enabled: true }],
  slideshowIntervalMs: 8000,
  slideshowTransitionMs: 500,
}

function putRequest(): NextRequest {
  return new NextRequest('http://localhost/api/platform/homepage/hero/', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer real-token' },
    body: JSON.stringify(HERO_BODY),
  })
}

describe('Platform hero PUT — real mode upstream handling', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
    resetPlatformHomepageHeroForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    resetPlatformHomepageHeroForTests()
  })

  it('returns 502 and leaves the store untouched when the backend errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const before = getPlatformHomepageHero()
    const res = await PUT(putRequest())
    expect(res.status).toBe(502)
    expect(getPlatformHomepageHero()).toEqual(before)
  })

  it('returns 502 when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    const res = await PUT(putRequest())
    expect(res.status).toBe(502)
    expect(getPlatformHomepageHero().backgroundImages[0]?.id).not.toBe('new-1')
  })

  it('passes backend validation errors through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
    const res = await PUT(putRequest())
    expect(res.status).toBe(400)
  })

  it('caches and returns the backend copy on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(HERO_BODY)))
    const res = await PUT(putRequest())
    expect(res.status).toBe(200)
    expect(getPlatformHomepageHero().backgroundImages[0].id).toBe('new-1')
  })
})
