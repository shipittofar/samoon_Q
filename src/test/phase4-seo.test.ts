/**
 * Phase 4.4 — SSR Hydration & SEO tests (P4.4.1–P4.4.6)
 *
 * Covers:
 *   P4.4.1 — React Query hydration utilities (createServerQueryClient, dehydrateClient)
 *   P4.4.2 — Menu page SSR prefetch structure
 *   P4.4.3 — Homepage static data (no client fetches — confirmed static)
 *   P4.4.4 — SEO metadata exports
 *   P4.4.5 — Sitemap generation
 *   P4.4.6 — JSON-LD structured data generation
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const SRC = join(ROOT, 'src')

// ── P4.4.1 — React Query hydration utilities ──────────────────────────────────

describe('P4.4.1 — createServerQueryClient', () => {
  it('createServerQueryClient returns a QueryClient', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const qc = createServerQueryClient()
    expect(qc).toBeDefined()
    expect(typeof qc.prefetchQuery).toBe('function')
    expect(typeof qc.getQueryData).toBe('function')
  })

  it('each call returns a fresh independent instance', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const a = createServerQueryClient()
    const b = createServerQueryClient()
    expect(a).not.toBe(b)
  })

  it('server QueryClient has retry: false', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const qc = createServerQueryClient()
    const opts = qc.getDefaultOptions()
    expect(opts.queries?.retry).toBe(false)
  })

  it('server QueryClient has staleTime set', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const qc = createServerQueryClient()
    const opts = qc.getDefaultOptions()
    expect(typeof opts.queries?.staleTime).toBe('number')
    expect((opts.queries?.staleTime as number)).toBeGreaterThan(0)
  })
})

describe('P4.4.1 — dehydrateClient', () => {
  it('dehydrateClient returns a DehydratedState object', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const { dehydrateClient } = await import('@/lib/react-query/hydration')
    const qc = createServerQueryClient()
    const state = dehydrateClient(qc)
    expect(state).toBeDefined()
    expect(Array.isArray(state.queries)).toBe(true)
  })

  it('dehydrated state is empty when no queries have been prefetched', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const { dehydrateClient } = await import('@/lib/react-query/hydration')
    const qc = createServerQueryClient()
    const state = dehydrateClient(qc)
    expect(state.queries).toHaveLength(0)
  })

  it('dehydrated state contains queries after setQueryData', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const { dehydrateClient } = await import('@/lib/react-query/hydration')
    const qc = createServerQueryClient()
    qc.setQueryData(['test-key'], { value: 42 })
    const state = dehydrateClient(qc)
    expect(state.queries.length).toBeGreaterThan(0)
    const q = state.queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['test-key']))
    expect(q).toBeDefined()
  })

  it('dehydrated state is JSON-serialisable', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const { dehydrateClient } = await import('@/lib/react-query/hydration')
    const qc = createServerQueryClient()
    qc.setQueryData(['serialize-test'], { hello: 'world' })
    const state = dehydrateClient(qc)
    expect(() => JSON.stringify(state)).not.toThrow()
  })
})

describe('P4.4.1 — hydration module barrel exports', () => {
  it('exports HydrationBoundary', async () => {
    const mod = await import('@/lib/react-query/hydration')
    expect(mod.HydrationBoundary).toBeDefined()
  })

  it('index re-exports createServerQueryClient', async () => {
    const mod = await import('@/lib/react-query')
    expect(typeof mod.createServerQueryClient).toBe('function')
  })

  it('index re-exports dehydrateClient', async () => {
    const mod = await import('@/lib/react-query')
    expect(typeof mod.dehydrateClient).toBe('function')
  })

  it('index re-exports HydrationBoundary', async () => {
    const mod = await import('@/lib/react-query')
    expect(mod.HydrationBoundary).toBeDefined()
  })
})

// ── P4.4.2 — Menu Page SSR structure ─────────────────────────────────────────

describe('P4.4.2 — Menu page SSR prefetch', () => {
  it('menu/page.tsx is a server component (no "use client" directive)', () => {
    const src = readFileSync(join(SRC, 'app', 'menu', 'page.tsx'), 'utf-8')
    expect(src.trimStart()).not.toMatch(/^['"]use client['"]/)
  })

  // P-branch-menu: /menu has no [tenantSlug]/[branchSlug] segment, so the
  // server has no branch identity to scope a prefetch to (menus are
  // branch-scoped — see docs/BRANCH_MENU_ANALYSIS.md). Server-side
  // prefetching was removed rather than left in place with a cache key that
  // could never match the client's branch-scoped keys. See
  // docs/BRANCH_MENU_IMPLEMENTATION.md.
  it('menu/page.tsx no longer prefetches branch-scoped menu data server-side', () => {
    const src = readFileSync(join(SRC, 'app', 'menu', 'page.tsx'), 'utf-8')
    expect(src).not.toContain('prefetchQuery')
    expect(src).not.toContain('HydrationBoundary')
  })

  it('MenuContent client component exists', () => {
    expect(existsSync(join(SRC, 'components', 'menu', 'MenuContent.tsx'))).toBe(true)
  })

  it('MenuContent is a client component', () => {
    const src = readFileSync(join(SRC, 'components', 'menu', 'MenuContent.tsx'), 'utf-8')
    expect(src.trimStart()).toMatch(/^['"]use client['"]/)
  })

  it('MenuContent preserves useCategories and useMenuItems hooks', () => {
    const src = readFileSync(join(SRC, 'components', 'menu', 'MenuContent.tsx'), 'utf-8')
    expect(src).toContain('useCategories')
    expect(src).toContain('useMenuItems')
  })

})

// ── P4.4.3 — Homepage (static — no client fetches) ───────────────────────────

describe('P4.4.3 — Homepage static data audit', () => {
  it('homepage page.tsx does not import useQuery or useMenuItems', () => {
    const src = readFileSync(join(SRC, 'app', 'page.tsx'), 'utf-8')
    expect(src).not.toContain('useQuery')
    expect(src).not.toContain('useMenuItems')
  })

  it('homepage featured items are rendered via FeaturedSection component (P4.5)', () => {
    const src = readFileSync(join(SRC, 'app', 'page.tsx'), 'utf-8')
    expect(src).toContain('FeaturedSection')
    expect(src).not.toContain('prefetchQuery')
  })
})

// ── P4.4.4 — SEO Metadata ─────────────────────────────────────────────────────

describe('P4.4.4 — SEO metadata exports', () => {
  // P9.5.7A — the homepage now exports an async generateMetadata() that
  // delegates to getLocalizedPageMetadata() (src/lib/seo.ts, the same
  // helper the root layout already uses) instead of a literal `export const
  // metadata` object, so title/OpenGraph/Twitter/canonical are localized
  // per-locale. `getLocalizedPageMetadata` itself can't be invoked here —
  // next-intl/server resolves to its client stub under this vitest
  // environment and throws ("not supported in Client Components") — so
  // these assertions check the actual object construction in seo.ts (where
  // openGraph/twitter/alternates.canonical are genuinely built) plus that
  // page.tsx correctly delegates to it, rather than the pre-migration
  // pattern of grepping page.tsx for a literal inline object.
  it('homepage exports a generateMetadata function that delegates to getLocalizedPageMetadata', () => {
    const src = readFileSync(join(SRC, 'app', 'page.tsx'), 'utf-8')
    expect(src).toContain('export async function generateMetadata')
    expect(src).toContain('getLocalizedPageMetadata')
  })

  it('getLocalizedPageMetadata (src/lib/seo.ts) builds openGraph', () => {
    const src = readFileSync(join(SRC, 'lib', 'seo.ts'), 'utf-8')
    expect(src).toContain('openGraph')
  })

  it('getLocalizedPageMetadata (src/lib/seo.ts) builds a twitter summary_large_image card', () => {
    const src = readFileSync(join(SRC, 'lib', 'seo.ts'), 'utf-8')
    expect(src).toContain('twitter')
    expect(src).toContain('summary_large_image')
  })

  it('getLocalizedPageMetadata (src/lib/seo.ts) builds alternates.canonical', () => {
    const src = readFileSync(join(SRC, 'lib', 'seo.ts'), 'utf-8')
    expect(src).toContain('alternates')
    expect(src).toContain('canonical')
  })

  it('menu page exports metadata with title (P9.5.7A: localized via generateMetadata)', () => {
    const src = readFileSync(join(SRC, 'app', 'menu', 'page.tsx'), 'utf-8')
    expect(src).toContain('export async function generateMetadata')
    expect(src).toContain('getLocalizedPageMetadata')
  })

  it('menu metadata includes openGraph and twitter', () => {
    const src = readFileSync(join(SRC, 'app', 'menu', 'page.tsx'), 'utf-8')
    expect(src).toContain('openGraph')
    expect(src).toContain('twitter')
  })
})

// ── P4.4.5 — Sitemap ──────────────────────────────────────────────────────────

describe('P4.4.5 — Sitemap generation', () => {
  it('sitemap.ts exports a default function', async () => {
    const mod = await import('@/app/sitemap')
    expect(typeof mod.default).toBe('function')
  })

  it('sitemap returns an array', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(Array.isArray(result)).toBe(true)
  })

  it('sitemap includes homepage', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(result.some((r) => r.url.endsWith('.com') || r.url.endsWith('/'))).toBe(true)
  })

  it('sitemap includes /menu route', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(result.some((r) => r.url.includes('/menu'))).toBe(true)
  })

  it('sitemap includes /reservation route', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(result.some((r) => r.url.includes('/reservation'))).toBe(true)
  })

  it('sitemap entries have priority values', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(result.every((r) => typeof r.priority === 'number')).toBe(true)
  })

  it('sitemap entries have lastModified dates', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(result.every((r) => r.lastModified instanceof Date)).toBe(true)
  })

  it('sitemap does not include /dashboard (auth-gated)', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(result.every((r) => !r.url.includes('/dashboard'))).toBe(true)
  })

  it('sitemap has more than 5 entries', async () => {
    const mod = await import('@/app/sitemap')
    const result = mod.default()
    expect(result.length).toBeGreaterThan(5)
  })
})

// ── P4.4.6 — JSON-LD Structured Data ─────────────────────────────────────────

describe('P4.4.6 — JSON-LD generation', () => {
  it('buildRestaurantJsonLd returns a schema.org Restaurant object', async () => {
    const { buildRestaurantJsonLd } = await import('@/lib/json-ld')
    const ld = buildRestaurantJsonLd({ name: 'Test', url: 'https://test.com' })
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toContain('Restaurant')
    expect(ld['name']).toBe('Test')
    expect(ld['url']).toBe('https://test.com')
  })

  it('buildRestaurantJsonLd includes address when provided', async () => {
    const { buildRestaurantJsonLd } = await import('@/lib/json-ld')
    const ld = buildRestaurantJsonLd({
      name: 'Test',
      url: 'https://test.com',
      address: { streetAddress: '123 Main St', addressLocality: 'New York' },
    })
    const addr = ld['address'] as Record<string, string>
    expect(addr['@type']).toBe('PostalAddress')
    expect(addr['streetAddress']).toBe('123 Main St')
  })

  it('buildMenuJsonLd returns a schema.org Menu object', async () => {
    const { buildMenuJsonLd } = await import('@/lib/json-ld')
    const ld = buildMenuJsonLd({ name: 'Test Menu', url: 'https://test.com/menu', restaurantName: 'Test' })
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Menu')
    expect(ld['name']).toBe('Test Menu')
  })

  it('buildMenuItemJsonLd returns a schema.org MenuItem', async () => {
    const { buildMenuItemJsonLd } = await import('@/lib/json-ld')
    const ld = buildMenuItemJsonLd({ name: 'Burger', price: 12.99 })
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('MenuItem')
    const offers = ld['offers'] as Record<string, string>
    expect(offers['price']).toBe('12.99')
    expect(offers['priceCurrency']).toBe('USD')
  })

  it('serializeJsonLd produces valid JSON', async () => {
    const { buildRestaurantJsonLd, serializeJsonLd } = await import('@/lib/json-ld')
    const ld = buildRestaurantJsonLd({ name: 'Test', url: 'https://test.com' })
    const serialized = serializeJsonLd(ld)
    expect(() => JSON.parse(serialized)).not.toThrow()
  })

  it('serializeJsonLd escapes </script> sequences', async () => {
    const { serializeJsonLd } = await import('@/lib/json-ld')
    const ld = { '@context': 'https://schema.org', value: '</script>' }
    const serialized = serializeJsonLd(ld)
    expect(serialized).not.toContain('</script>')
    expect(serialized).not.toContain('<')
    expect(serialized).toContain('\\u003c/script\\u003e')
    expect(JSON.parse(serialized).value).toBe('</script>')
  })

  it('serializeJsonLd escapes HTML comment openers, ampersands and line separators', async () => {
    const { serializeJsonLd } = await import('@/lib/json-ld')
    const ld = { name: '<!-- x & y -->', sep: 'a\u2028b' }
    const serialized = serializeJsonLd(ld)
    expect(serialized).not.toMatch(/[<>&\u2028]/)
    expect(JSON.parse(serialized)).toEqual(ld)
  })

  it('DEFAULT_RESTAURANT_JSON_LD is exported and has correct type', async () => {
    const { DEFAULT_RESTAURANT_JSON_LD } = await import('@/lib/json-ld')
    expect(DEFAULT_RESTAURANT_JSON_LD['@type']).toContain('Restaurant')
    expect(DEFAULT_RESTAURANT_JSON_LD['name']).toBe('Samoon')
    // Cuisine is Branch-owned — default sample must not inject servesCuisine
    expect(DEFAULT_RESTAURANT_JSON_LD).not.toHaveProperty('servesCuisine')
  })

  it('DEFAULT_MENU_JSON_LD is exported and references /menu', async () => {
    const { DEFAULT_MENU_JSON_LD } = await import('@/lib/json-ld')
    expect(DEFAULT_MENU_JSON_LD['@type']).toBe('Menu')
    expect((DEFAULT_MENU_JSON_LD['url'] as string)).toContain('/menu')
  })

  it('homepage includes JSON-LD script tag', () => {
    const src = readFileSync(join(SRC, 'app', 'page.tsx'), 'utf-8')
    expect(src).toContain('application/ld+json')
    // P8.8.1 — homepage uses platform WebSite schema, not restaurant schema
    expect(src).toContain('DEFAULT_PLATFORM_JSON_LD')
  })

  it('menu page includes JSON-LD script tag', () => {
    const src = readFileSync(join(SRC, 'app', 'menu', 'page.tsx'), 'utf-8')
    expect(src).toContain('application/ld+json')
    expect(src).toContain('DEFAULT_MENU_JSON_LD')
  })
})
