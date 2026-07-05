/**
 * P4.3 — Reviews Feature tests
 *
 * Verifies reviewService mock behaviour, hook wiring (source audit),
 * and UI source structure for FoodDetailModal, FoodCard, and orders page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Source structure audits ───────────────────────────────────────────────────

describe('review.service.ts — source structure', () => {
  const src = () => readSrc('services/review.service.ts')

  it('exports reviewService', () => {
    expect(src()).toContain('export const reviewService')
  })

  it('exports CreateReviewPayload type', () => {
    expect(src()).toContain('export interface CreateReviewPayload')
  })

  it('exports ReviewsResponse type', () => {
    expect(src()).toContain('export interface ReviewsResponse')
  })

  it('has getItemReviews method', () => {
    expect(src()).toContain('getItemReviews')
  })

  it('has createReview method', () => {
    expect(src()).toContain('createReview')
  })

  it('uses USE_MOCK pattern', () => {
    expect(src()).toContain('USE_MOCK')
    expect(src()).toContain('if (USE_MOCK)')
  })

  it('uses ENDPOINTS.REVIEWS.ITEM_REVIEWS', () => {
    expect(src()).toContain('ENDPOINTS.REVIEWS.ITEM_REVIEWS')
  })

  it('uses ENDPOINTS.REVIEWS.CREATE', () => {
    expect(src()).toContain('ENDPOINTS.REVIEWS.CREATE')
  })

  it('ReviewsResponse has average_rating', () => {
    expect(src()).toContain('average_rating')
  })

  it('ReviewsResponse has results and count', () => {
    expect(src()).toContain('results: Review[]')
    expect(src()).toContain('count: number')
  })
})

describe('hooks/index.ts — P4.3 hooks', () => {
  const src = () => readSrc('hooks/index.ts')

  it('imports reviewService', () => {
    expect(src()).toContain("from '@/services/review.service'")
    expect(src()).toContain('reviewService')
  })

  it('imports CreateReviewPayload type', () => {
    expect(src()).toContain('CreateReviewPayload')
  })

  it('exports useItemReviews hook', () => {
    expect(src()).toContain('export function useItemReviews')
  })

  it('exports useCreateReview hook', () => {
    expect(src()).toContain('export function useCreateReview')
  })

  it('useItemReviews uses queryKey with reviews', () => {
    expect(src()).toContain("queryKey: ['reviews'")
  })

  it('useItemReviews is enabled only when itemId truthy', () => {
    expect(src()).toContain('enabled: Boolean(itemId)')
  })

  it('useCreateReview invalidates reviews query on success', () => {
    expect(src()).toContain("queryKey: ['reviews', itemId]")
    expect(src()).toContain('invalidateQueries')
  })
})

describe('FoodDetailModal.tsx — P4.3 reviews UI', () => {
  const src = () => readSrc('components/menu/FoodDetailModal.tsx')

  it('imports useItemReviews and useCreateReview', () => {
    expect(src()).toContain('useItemReviews')
    expect(src()).toContain('useCreateReview')
  })

  it('renders reviews toggle button', () => {
    expect(src()).toContain('Reviews')
    expect(src()).toContain('showReviews')
  })

  it('renders review submission form', () => {
    // P9.5.2: localized via t('writeReview') instead of a literal string.
    expect(src()).toContain("t('writeReview')")
    expect(src()).toContain('reviewComment')
    expect(src()).toContain('reviewRating')
  })

  it('renders star rating selector for review', () => {
    expect(src()).toContain('setReviewRating')
  })

  it('calls handleSubmitReview on submit', () => {
    expect(src()).toContain('handleSubmitReview')
    expect(src()).toContain('submitReview')
  })

  it('shows average_rating from reviewsData', () => {
    expect(src()).toContain('average_rating')
    expect(src()).toContain('reviewsData')
  })

  it('renders individual review items', () => {
    expect(src()).toContain('review.user.first_name')
    expect(src()).toContain('review.comment')
  })

  it('shows empty state when no reviews', () => {
    // P9.5.2: localized via t('noReviewsYet') instead of a literal string.
    expect(src()).toContain("t('noReviewsYet')")
  })

  it('uses RatingStars for review display', () => {
    expect(src()).toContain('RatingStars')
  })
})

describe('FoodCard.tsx — P4.3 rating_count display', () => {
  const src = () => readSrc('components/menu/FoodCard.tsx')

  it('renders rating_count alongside rating', () => {
    expect(src()).toContain('rating_count')
  })
})

describe('dashboard/orders/page.tsx — P4.3 Write a Review', () => {
  const src = () => readSrc('app/dashboard/orders/page.tsx')

  it('imports useCreateReview', () => {
    expect(src()).toContain('useCreateReview')
  })

  it('has WriteReviewButton component', () => {
    expect(src()).toContain('WriteReviewButton')
  })

  it('Write a Review is conditional on delivered status', () => {
    expect(src()).toContain("order.status === 'delivered'")
  })

  it('passes orderId and itemId to WriteReviewButton', () => {
    expect(src()).toContain('orderId={order.id}')
    expect(src()).toContain('itemId={order.items[0].menu_item.id}')
  })

  it('guards against missing items before rendering WriteReviewButton', () => {
    expect(src()).toContain('order.items?.[0]?.menu_item?.id')
  })
})

// ── reviewService unit tests ──────────────────────────────────────────────────

describe('reviewService — mock mode (P4.3)', () => {
  let reviewService: typeof import('@/services/review.service').reviewService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/review.service')
    reviewService = mod.reviewService
    mod.reviewService._resetMockStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('getItemReviews returns results array', async () => {
    const p = reviewService.getItemReviews('item-1')
    await vi.runAllTimersAsync()
    const res = await p
    expect(Array.isArray(res.results)).toBe(true)
    expect(res.results.length).toBeGreaterThan(0)
  })

  it('getItemReviews returns count matching results length', async () => {
    const p = reviewService.getItemReviews('item-2')
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.count).toBe(res.results.length)
  })

  it('getItemReviews returns average_rating between 1 and 5', async () => {
    const p = reviewService.getItemReviews('item-3')
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.average_rating).toBeGreaterThanOrEqual(1)
    expect(res.average_rating).toBeLessThanOrEqual(5)
  })

  it('createReview returns review with correct rating', async () => {
    const p = reviewService.createReview('item-1', { rating: 4, comment: 'Great!' })
    await vi.runAllTimersAsync()
    const review = await p
    expect(review.rating).toBe(4)
    expect(review.comment).toBe('Great!')
  })

  it('createReview stores review in mock store for subsequent getItemReviews', async () => {
    const p1 = reviewService.createReview('item-x', { rating: 5 })
    await vi.runAllTimersAsync()
    await p1

    const p2 = reviewService.getItemReviews('item-x')
    await vi.runAllTimersAsync()
    const res = await p2
    expect(res.results.some((r) => r.rating === 5 && r.menu_item_id === 'item-x')).toBe(true)
  })

  it('createReview sets menu_item_id on returned review', async () => {
    const p = reviewService.createReview('item-99', { rating: 3 })
    await vi.runAllTimersAsync()
    const review = await p
    expect(review.menu_item_id).toBe('item-99')
  })

  it('createReview with order_id sets it on review', async () => {
    const p = reviewService.createReview('item-1', { rating: 5, order_id: 'order-abc' })
    await vi.runAllTimersAsync()
    const review = await p
    expect(review.order_id).toBe('order-abc')
  })

  it('createReview without comment returns review with undefined comment', async () => {
    const p = reviewService.createReview('item-1', { rating: 4 })
    await vi.runAllTimersAsync()
    const review = await p
    expect(review.comment).toBeUndefined()
  })

  it('getItemReviews returns id and created_at on each review', async () => {
    const p = reviewService.getItemReviews('item-1')
    await vi.runAllTimersAsync()
    const res = await p
    for (const r of res.results) {
      expect(r.id).toBeTruthy()
      expect(r.created_at).toBeTruthy()
    }
  })

  it('each review has a user with first_name', async () => {
    const p = reviewService.getItemReviews('item-1')
    await vi.runAllTimersAsync()
    const res = await p
    for (const r of res.results) {
      expect(r.user).toBeDefined()
      expect(typeof r.user.first_name).toBe('string')
    }
  })

  it('_resetMockStore clears submitted reviews', async () => {
    const p1 = reviewService.createReview('item-z', { rating: 2 })
    await vi.runAllTimersAsync()
    await p1
    reviewService._resetMockStore()

    const p2 = reviewService.getItemReviews('item-z')
    await vi.runAllTimersAsync()
    const res = await p2
    expect(res.results.every((r) => r.rating !== 2 || r.menu_item_id !== 'item-z')).toBe(true)
  })
})
