/**
 * P4.5 — Home Page Dynamic Featured Items tests
 *
 * Covers: service, hook, component source structure, loading/empty/error states,
 * mock mode, and regression coverage for all completed Phase 4 items.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Source-structure: homepage ────────────────────────────────────────────────

describe('app/page.tsx — no hardcoded FEATURED array', () => {
  const src = () => readSrc('app/page.tsx')

  it('does not contain the FEATURED constant', () =>
    expect(src()).not.toContain('const FEATURED'))

  it('does not contain hardcoded Wagyu Smash Burger', () =>
    expect(src()).not.toContain('Wagyu Smash Burger'))

  it('does not contain hardcoded Truffle Mushroom Pizza', () =>
    expect(src()).not.toContain('Truffle Mushroom Pizza'))

  it('does not contain hardcoded dollar-string prices ($24.99)', () =>
    expect(src()).not.toContain("'$24.99'"))

  it('imports FeaturedSection', () =>
    expect(src()).toContain('FeaturedSection'))

  it('renders <FeaturedSection />', () =>
    expect(src()).toContain('<FeaturedSection />'))

  it('still contains CATEGORIES (unchanged)', () =>
    expect(src()).toContain('const CATEGORIES'))

  it('still contains STATS (unchanged)', () =>
    expect(src()).toContain('const STATS'))

  it('still exports metadata (P9.5.7A: generateMetadata(), localized via getLocalizedPageMetadata)', () =>
    expect(src()).toContain('export async function generateMetadata'))
})

// ── Source-structure: FeaturedSection component ───────────────────────────────

describe('components/home/FeaturedSection.tsx — structure', () => {
  const src = () => readSrc('components/home/FeaturedSection.tsx')

  it('is a use client component', () =>
    expect(src()).toContain("'use client'"))

  it('exports FeaturedSection', () =>
    expect(src()).toContain('export function FeaturedSection'))

  it('uses useFeaturedItems hook', () =>
    expect(src()).toContain('useFeaturedItems'))

  it('imports useFeaturedItems from @/hooks', () =>
    expect(src()).toContain("from '@/hooks'"))

  it('handles isLoading state', () =>
    expect(src()).toContain('isLoading'))

  it('renders skeleton cards during loading', () =>
    expect(src()).toContain('FeaturedCardSkeleton'))

  it('handles isError state', () =>
    expect(src()).toContain('isError'))

  it('shows error message linking to /menu', () =>
    expect(src()).toContain("href=\"/menu\""))

  it('handles empty items array', () =>
    expect(src()).toContain('items.length === 0'))

  it('shows empty state message (P9.5.7A: localized via home.noFeaturedDishesAvailable)', () =>
    expect(src()).toContain("t('noFeaturedDishesAvailable')"))

  it('renders FeaturedCard for each item', () =>
    expect(src()).toContain('FeaturedCard'))

  it('links "See all" to /menu?featured=true', () =>
    expect(src()).toContain('/menu?featured=true'))

  it('preserves section heading (P9.5.7A: localized via home.featuredDishes)', () =>
    expect(src()).toContain("t('featuredDishes')"))

  it('preserves "Handpicked" label (P9.5.7A: localized via home.handpicked)', () =>
    expect(src()).toContain("t('handpicked')"))

  it('uses formatCurrency for prices', () =>
    expect(src()).toContain('formatCurrency'))

  it('displays item rating', () =>
    expect(src()).toContain('rating'))

  it('displays preparation_time', () =>
    expect(src()).toContain('preparation_time'))

  it('slices to max 8 items', () =>
    expect(src()).toContain('slice(0, 8)'))
})

// ── menuService.getFeatured — mock mode ───────────────────────────────────────

describe('menuService.getFeatured — mock mode', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('returns an array of MenuItem', async () => {
    const { menuService } = await import('@/services/menu.service')
    const p = menuService.getFeatured('main')
    await vi.runAllTimersAsync()
    const items = await p
    expect(Array.isArray(items)).toBe(true)
  })

  it('returns only items with is_featured=true', async () => {
    const { menuService } = await import('@/services/menu.service')
    const p = menuService.getFeatured('main')
    await vi.runAllTimersAsync()
    const items = await p
    expect(items.every((i) => i.is_featured === true)).toBe(true)
  })

  it('returns at least one featured item', async () => {
    const { menuService } = await import('@/services/menu.service')
    const p = menuService.getFeatured('main')
    await vi.runAllTimersAsync()
    const items = await p
    expect(items.length).toBeGreaterThan(0)
  })

  it('each item has id, name, image, price, rating, preparation_time', async () => {
    const { menuService } = await import('@/services/menu.service')
    const p = menuService.getFeatured('main')
    await vi.runAllTimersAsync()
    const items = await p
    for (const item of items) {
      expect(item.id).toBeTruthy()
      expect(item.name).toBeTruthy()
      expect(item.image).toBeTruthy()
      expect(typeof item.price).toBe('number')
      expect(typeof item.rating).toBe('number')
      expect(typeof item.preparation_time).toBe('number')
    }
  })

  it('uses ENDPOINTS.MENU.FEATURED in real mode (endpoint exists)', () => {
    const src = readSrc('services/menu.service.ts')
    expect(src).toContain('ENDPOINTS.MENU.FEATURED')
  })
})

// ── useFeaturedItems hook — source audit ──────────────────────────────────────

describe('hooks/index.ts — useFeaturedItems', () => {
  const src = () => readSrc('hooks/index.ts')

  it('exports useFeaturedItems', () =>
    expect(src()).toContain('export function useFeaturedItems'))

  it('queries with key featured-items', () =>
    expect(src()).toContain("'featured-items'"))

  it('calls menuService.getFeatured', () =>
    expect(src()).toContain('menuService.getFeatured'))

  it('has staleTime set', () =>
    expect(src()).toContain('staleTime'))
})

// ── Regression: all prior Phase 4 items ──────────────────────────────────────

describe('Regression: P4.1 payment service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('createPaymentIntent still returns client_secret', async () => {
    const { paymentService } = await import('@/services/payment.service')
    const p = paymentService.createPaymentIntent({ amount: 30, branch_id: '1' })
    await vi.runAllTimersAsync()
    expect((await p).client_secret).toBeTruthy()
  })
})

describe('Regression: P4.3 review service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('getItemReviews still returns results', async () => {
    const { reviewService } = await import('@/services/review.service')
    reviewService._resetMockStore()
    const p = reviewService.getItemReviews('item-1')
    await vi.runAllTimersAsync()
    expect((await p).results.length).toBeGreaterThan(0)
  })
})

describe('Regression: P4.6 calendar utilities', () => {
  afterEach(() => vi.resetModules())

  it('generateIcs still produces valid ICS', async () => {
    const { generateIcs } = await import('@/lib/calendar')
    const ics = generateIcs({ title: 'Test', date: '2025-07-01', time: '19:00' })
    expect(ics).toContain('BEGIN:VCALENDAR')
  })
})

describe('Regression: P4.7 avatar upload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') })
  })
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); vi.unstubAllGlobals() })

  it('uploadAvatar still works', async () => {
    const { userService } = await import('@/services/combined.service')
    const file = new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' })
    const p = userService.uploadAvatar(file)
    await vi.runAllTimersAsync()
    expect((await p).avatar_url).toBeTruthy()
  })
})

describe('Regression: P4.8 locale store writes cookie', () => {
  afterEach(() => vi.resetModules())

  it('setLocale writes NEXT_LOCALE cookie', () => {
    const src = readSrc('stores/index.ts')
    expect(src).toContain('NEXT_LOCALE=')
    expect(src).toContain('document.cookie')
  })
})
