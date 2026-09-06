import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NextRequest } from 'next/server'
import { platformConfigurationRegistry } from '@/config'
import { ADMIN_WEBSITE_ROUTES, getAdminNav } from '@/modules/registry'
import { PLATFORM_HOMEPAGE_ADMIN_HREF, PLATFORM_HOMEPAGE_MODULE_ID } from '@/lib/platform-homepage'
import {
  getPlatformHomepageHero,
  resetPlatformHomepageHeroForTests,
  setPlatformHomepageHero,
} from '@/lib/platform-homepage-store'
import { GET, PUT } from '@/app/api/platform/homepage/hero/route'
import { POST as POST_MEDIA } from '@/app/api/platform/homepage/hero/media/route'

const dir = dirname(fileURLToPath(import.meta.url))

function src(rel: string): string {
  return readFileSync(join(dir, '..', rel), 'utf-8')
}

function jsonRequest(method: string, cookie?: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/platform/homepage/hero/', {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('Platform Homepage ownership isolation', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
    resetPlatformHomepageHeroForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetPlatformHomepageHeroForTests()
  })

  it('registers platform.homepage in the Platform Administration registry', () => {
    const mod = platformConfigurationRegistry.getModule(PLATFORM_HOMEPAGE_MODULE_ID)
    expect(mod).toBeDefined()
    expect(mod?.group).toBe('Platform')
    expect(mod?.platformPermission).toBe('platform.homepage.manage')
  })

  it('does not put Platform Homepage on the tenant Website Builder routes or admin nav', () => {
    expect(ADMIN_WEBSITE_ROUTES).toEqual(['/console/website'])
    expect(ADMIN_WEBSITE_ROUTES).not.toContain('/console/homepage')
    const nav = getAdminNav(['restaurant'])
    expect(nav.some((item) => item.href === '/console/homepage')).toBe(false)
    expect(nav.some((item) => item.href === '/console/website')).toBe(true)
  })

  it('does not inject Platform Homepage into tenant console nav', () => {
    const hooks = src('hooks/index.ts')
    const block = hooks.slice(hooks.indexOf('export function useAdminModuleNav'), hooks.indexOf('// ── Auth Hooks'))
    expect(block).not.toContain('/console/homepage')
    expect(block).toContain('alignedTenant')
  })

  it('keeps the editor under platform-admin, not tenant console', () => {
    expect(PLATFORM_HOMEPAGE_ADMIN_HREF).toBe('/platform-admin/platform.homepage')
    expect(src('config/index.ts')).toContain("import './modules/platform-homepage'")
    expect(src('config/modules/platform-homepage.ts')).toContain("id: 'platform.homepage'")
    expect(src('platform-admin/modules/platform.ts')).not.toContain("id: 'platform.homepage'")
    expect(src('app/platform-admin/[moduleId]/page.tsx')).toContain('PlatformHomepageHeroEditor')
    expect(src('app/console/homepage/page.tsx')).toContain('PLATFORM_HOMEPAGE_ADMIN_HREF')
    expect(src('app/console/homepage/page.tsx')).toContain('AccessDenied')
    expect(src('app/console/homepage/page.tsx')).not.toContain('HeroBackgroundGallery')
  })

  it('website builder never writes the platform homepage store', () => {
    expect(src('services/website-builder.service.ts')).not.toContain('platformHomepage')
    expect(src('services/website-builder.service.ts')).not.toContain('PLATFORM_HOMEPAGE')
    expect(src('lib/platform-homepage-store.ts')).not.toContain('websiteBuilder')
    expect(src('services/platform-homepage.service.ts')).not.toContain('tenantService')
    expect(src('services/platform-homepage.service.ts')).toContain('/api/platform/homepage/hero/')
  })

  it('public / reads Platform CMS; tenant pages do not', () => {
    expect(src('app/page.tsx')).toContain('PlatformHeroBackground')
    expect(src('components/home/PlatformHeroBackground.tsx')).toContain('usePlatformHomepageHero')
    expect(src('app/[tenantSlug]/TenantHomepageClient.tsx')).not.toContain('usePlatformHomepageHero')
    expect(src('app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx')).not.toContain('usePlatformHomepageHero')
  })

  it('GET hero is public', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.backgroundImages)).toBe(true)
  })

  it('PUT without a session is 401', async () => {
    const res = await PUT(jsonRequest('PUT', undefined, {
      backgroundImages: [],
      slideshowIntervalMs: 7000,
      slideshowTransitionMs: 900,
    }))
    expect(res.status).toBe(401)
  })

  it('PUT as tenant owner is 403 and does not mutate the store', async () => {
    const before = getPlatformHomepageHero()
    const res = await PUT(jsonRequest(
      'PUT',
      'mock_session_email=owner%40samoon.com',
      {
        backgroundImages: [{ id: 'tenant-attack', src: 'https://evil.example/x.jpg', order: 0, enabled: true }],
        slideshowIntervalMs: 7000,
        slideshowTransitionMs: 900,
      },
    ))
    expect(res.status).toBe(403)
    expect(getPlatformHomepageHero()).toEqual(before)
  })

  it('PUT as tenant admin is 403', async () => {
    const res = await PUT(jsonRequest(
      'PUT',
      'mock_session_email=admin%40samoon.com',
      { backgroundImages: [], slideshowIntervalMs: 7000, slideshowTransitionMs: 900 },
    ))
    expect(res.status).toBe(403)
  })

  it('PUT as platform superuser updates only the platform store', async () => {
    const res = await PUT(jsonRequest(
      'PUT',
      'mock_session_email=platform%40samoon.com',
      {
        backgroundImages: [
          { id: 'cms-1', src: 'https://cdn.example/platform.jpg', order: 0, enabled: true, altText: 'Dining' },
        ],
        slideshowIntervalMs: 8000,
        slideshowTransitionMs: 500,
        headline: 'tenant must not land here',
      },
    ))
    expect(res.status).toBe(200)
    const saved = await res.json()
    expect(saved.backgroundImages).toHaveLength(1)
    expect(saved.backgroundImages[0].src).toBe('https://cdn.example/platform.jpg')
    expect(saved.slideshowIntervalMs).toBe(8000)
    expect(saved).not.toHaveProperty('headline')
    expect(getPlatformHomepageHero().backgroundImages[0].id).toBe('cms-1')
  })

  it('strips tenant-style fields and does not merge websiteBuilder hero', () => {
    const saved = setPlatformHomepageHero({
      backgroundImages: [{ id: 'a', src: 'https://cdn.example/a.jpg', order: 0, enabled: true }],
      slideshowIntervalMs: 7000,
      slideshowTransitionMs: 900,
    } as never)
    expect(Object.keys(saved).sort()).toEqual([
      'backgroundImages',
      'slideshowIntervalMs',
      'slideshowTransitionMs',
    ])
  })

  it('media upload as tenant owner is 403', async () => {
    const req = new NextRequest('http://localhost/api/platform/homepage/hero/media/', {
      method: 'POST',
      headers: { cookie: 'mock_session_email=owner%40samoon.com' },
    })
    const res = await POST_MEDIA(req)
    expect(res.status).toBe(403)
  })
})
