import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type { Review } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 800) => new Promise<void>((r) => setTimeout(r, ms))

export interface CreateReviewPayload {
  rating: number
  comment?: string
  order_id?: string
}

export interface ReviewsResponse {
  results: Review[]
  count: number
  average_rating: number
}

const MOCK_USERS = [
  { id: 'u1', first_name: 'Alice', last_name: 'K.', email: 'alice@example.com', accountType: 'customer' as const, is_verified: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'u2', first_name: 'Bob', last_name: 'M.', email: 'bob@example.com', accountType: 'customer' as const, is_verified: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'u3', first_name: 'Carol', last_name: 'T.', email: 'carol@example.com', accountType: 'customer' as const, is_verified: true, created_at: '2024-01-01T00:00:00Z' },
]

const MOCK_COMMENTS = [
  'Absolutely delicious! Will order again.',
  'Good quality, fast preparation.',
  'Tasty but a bit salty for my preference.',
  'Perfect portion size and great flavor.',
  'Loved it — highly recommended!',
]

function makeMockReviews(itemId: string): Review[] {
  const seed = itemId.charCodeAt(itemId.length - 1) % 3
  return MOCK_USERS.slice(0, seed + 2).map((user, i) => ({
    id: `review-mock-${itemId}-${i}`,
    user,
    menu_item_id: itemId,
    rating: [5, 4, 4, 5, 3][i % 5],
    comment: MOCK_COMMENTS[(i + seed) % MOCK_COMMENTS.length],
    created_at: new Date(Date.now() - (i + 1) * 86_400_000 * 3).toISOString(),
  }))
}

let mockReviewStore: Record<string, Review[]> = {}

export const reviewService = {
  async getItemReviews(itemId: string): Promise<ReviewsResponse> {
    if (USE_MOCK) {
      await delay(500)
      const stored = mockReviewStore[itemId] ?? []
      const base = makeMockReviews(itemId)
      const all = [...stored, ...base]
      const avg = all.reduce((s, r) => s + r.rating, 0) / (all.length || 1)
      return { results: all, count: all.length, average_rating: Math.round(avg * 10) / 10 }
    }
    const { data } = await api.get<ReviewsResponse>(ENDPOINTS.REVIEWS.ITEM_REVIEWS(itemId))
    return data
  },

  async createReview(itemId: string, payload: CreateReviewPayload): Promise<Review> {
    if (USE_MOCK) {
      await delay(600)
      const review: Review = {
        id: `review-new-${Date.now()}`,
        user: { id: 'me', first_name: 'You', last_name: '', email: 'demo@samoon.com', accountType: 'customer' as const, is_verified: true, created_at: new Date().toISOString() },
        menu_item_id: itemId,
        rating: payload.rating,
        comment: payload.comment,
        order_id: payload.order_id,
        created_at: new Date().toISOString(),
      }
      mockReviewStore[itemId] = [review, ...(mockReviewStore[itemId] ?? [])]
      return review
    }
    const { data } = await api.post<Review>(ENDPOINTS.REVIEWS.CREATE, { menu_item_id: itemId, ...payload })
    return data
  },

  _resetMockStore() {
    mockReviewStore = {}
  },
}
