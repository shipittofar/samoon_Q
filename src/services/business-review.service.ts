import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type {
  BusinessReview,
  BusinessReviewsResponse,
  CreateBusinessReviewPayload,
  OwnerReply,
  RatingBreakdownData,
  RatingDistribution,
  ReviewAnalytics,
  ReviewStatus,
  BusinessReviewFilters,
} from '@/types/business-review'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

function buildBreakdown(reviews: BusinessReview[]): RatingBreakdownData {
  const counts = [0, 0, 0, 0, 0]
  reviews.forEach((r) => { counts[r.rating - 1]++ })
  const total = reviews.length
  const distribution: RatingDistribution[] = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: counts[star - 1],
    percentage: total > 0 ? Math.round((counts[star - 1] / total) * 100) : 0,
  }))
  const average = total > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
    : 0
  return { average, total, distribution }
}

function applyFilters(reviews: BusinessReview[], filters: Partial<BusinessReviewFilters>): BusinessReview[] {
  let result = reviews.filter((r) => r.status === 'published')

  if (filters.branchId) result = result.filter((r) => r.branchId === filters.branchId)
  if (filters.verified) result = result.filter((r) => r.verifiedVisit)
  if (filters.withPhotos) result = result.filter((r) => (r.images?.length ?? 0) > 0)
  if (filters.language) result = result.filter((r) => r.language === filters.language)
  if (filters.rating != null) result = result.filter((r) => r.rating === filters.rating)

  switch (filters.sort) {
    case 'highest': return result.sort((a, b) => b.rating - a.rating)
    case 'lowest': return result.sort((a, b) => a.rating - b.rating)
    case 'most_helpful': return result.sort((a, b) => b.helpfulCount - a.helpfulCount)
    default: return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

// ── Mock store ────────────────────────────────────────────────────────────────

const MOCK_STORE: Record<string, BusinessReview[]> = {
  'tenant-samoon-01': [
    {
      id: 'br-samoon-1',
      tenantId: 'tenant-samoon-01',
      branchId: 'branch-samoon-main',
      customerName: 'Sarah M.',
      rating: 5,
      title: 'Outstanding fine dining experience',
      comment: 'Absolutely outstanding experience from start to finish. The food was incredible, service impeccable, and the ambience perfect for a special occasion. The Mediterranean tasting menu is a must-try.',
      visitDate: '2025-12-15',
      visitType: 'dine_in',
      createdAt: '2025-12-16T10:00:00.000Z',
      updatedAt: '2025-12-16T10:00:00.000Z',
      helpfulCount: 42,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
      pinned: true,
      ownerReply: {
        id: 'reply-samoon-1',
        text: 'Thank you so much, Sarah! We are delighted you enjoyed your evening with us. We look forward to welcoming you back.',
        authorName: 'The Samoon Team',
        createdAt: '2025-12-17T09:00:00.000Z',
      },
    },
    {
      id: 'br-samoon-2',
      tenantId: 'tenant-samoon-01',
      branchId: 'branch-samoon-main',
      customerName: 'James K.',
      rating: 5,
      title: 'Best meal of the year',
      comment: 'Best meal I have had all year. Everything on the menu is thoughtfully crafted. Will be coming back with the whole family next time.',
      visitDate: '2025-11-20',
      visitType: 'dine_in',
      createdAt: '2025-11-21T14:00:00.000Z',
      updatedAt: '2025-11-21T14:00:00.000Z',
      helpfulCount: 28,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
    {
      id: 'br-samoon-3',
      tenantId: 'tenant-samoon-01',
      branchId: 'branch-samoon-uptown',
      customerName: 'Aisha T.',
      rating: 4,
      comment: 'Great food and friendly staff. A couple of dishes were slow to arrive but the quality made it worthwhile. Highly recommend the signature dishes.',
      visitDate: '2025-10-05',
      visitType: 'dine_in',
      createdAt: '2025-10-06T08:00:00.000Z',
      updatedAt: '2025-10-06T08:00:00.000Z',
      helpfulCount: 15,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
    {
      id: 'br-samoon-4',
      tenantId: 'tenant-samoon-01',
      customerName: 'Marco R.',
      rating: 5,
      comment: 'The truffle pasta alone is worth the trip. Superb wine selection and knowledgeable sommelier. A true gem in the city.',
      visitDate: '2025-09-30',
      visitType: 'dine_in',
      createdAt: '2025-10-01T11:00:00.000Z',
      updatedAt: '2025-10-01T11:00:00.000Z',
      helpfulCount: 19,
      verifiedVisit: false,
      status: 'published',
      language: 'en',
    },
    {
      id: 'br-samoon-5',
      tenantId: 'tenant-samoon-01',
      customerName: 'Priya L.',
      rating: 3,
      comment: 'Food was good but the noise level was quite high for a fine dining experience. Would try again on a quieter night.',
      visitDate: '2025-09-10',
      visitType: 'dine_in',
      createdAt: '2025-09-11T16:00:00.000Z',
      updatedAt: '2025-09-11T16:00:00.000Z',
      helpfulCount: 8,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
  ],
  'tenant-brew-cafe-01': [
    {
      id: 'br-brew-1',
      tenantId: 'tenant-brew-cafe-01',
      customerName: 'Oliver H.',
      rating: 5,
      title: 'Best coffee in the neighbourhood',
      comment: 'Hands down the best flat white in the area. The baristas really know their craft and the beans are sourced ethically. My go-to morning spot.',
      visitDate: '2025-12-10',
      visitType: 'dine_in',
      createdAt: '2025-12-11T07:30:00.000Z',
      updatedAt: '2025-12-11T07:30:00.000Z',
      helpfulCount: 31,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
      pinned: true,
    },
    {
      id: 'br-brew-2',
      tenantId: 'tenant-brew-cafe-01',
      customerName: 'Emma S.',
      rating: 4,
      comment: 'Lovely relaxed atmosphere perfect for working remotely. Coffee and pastries are consistently excellent. Can get a bit busy on weekends.',
      visitDate: '2025-11-15',
      visitType: 'dine_in',
      createdAt: '2025-11-16T10:00:00.000Z',
      updatedAt: '2025-11-16T10:00:00.000Z',
      helpfulCount: 12,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
    {
      id: 'br-brew-3',
      tenantId: 'tenant-brew-cafe-01',
      customerName: 'Luca B.',
      rating: 5,
      comment: 'The seasonal pour-over menu is exceptional. Staff are friendly and passionate about coffee. Highly recommended.',
      visitDate: '2025-10-20',
      visitType: 'dine_in',
      createdAt: '2025-10-21T09:00:00.000Z',
      updatedAt: '2025-10-21T09:00:00.000Z',
      helpfulCount: 9,
      verifiedVisit: false,
      status: 'published',
      language: 'en',
    },
  ],
  'tenant-oak-bar-01': [
    {
      id: 'br-oak-1',
      tenantId: 'tenant-oak-bar-01',
      customerName: 'Alex D.',
      rating: 5,
      title: 'Incredible cocktail menu',
      comment: 'The mixologists here are artists. Every cocktail is a masterpiece. The oak-smoked Old Fashioned is legendary. Perfect spot for a sophisticated night out.',
      visitDate: '2025-12-01',
      visitType: 'dine_in',
      createdAt: '2025-12-02T23:00:00.000Z',
      updatedAt: '2025-12-02T23:00:00.000Z',
      helpfulCount: 25,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
    {
      id: 'br-oak-2',
      tenantId: 'tenant-oak-bar-01',
      customerName: 'Natasha V.',
      rating: 4,
      comment: 'Great whisky selection and knowledgeable staff. Ambience is dark and cosy. Prices are on the high side but quality justifies it.',
      visitDate: '2025-11-08',
      visitType: 'dine_in',
      createdAt: '2025-11-09T20:00:00.000Z',
      updatedAt: '2025-11-09T20:00:00.000Z',
      helpfulCount: 14,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
  ],
  'tenant-food-court-01': [
    {
      id: 'br-fc-1',
      tenantId: 'tenant-food-court-01',
      customerName: 'Diana W.',
      rating: 4,
      comment: 'Great variety of options under one roof. Clean, well-organised, and plenty of seating. The Vietnamese and Thai stalls are excellent.',
      visitDate: '2025-12-05',
      visitType: 'dine_in',
      createdAt: '2025-12-06T13:00:00.000Z',
      updatedAt: '2025-12-06T13:00:00.000Z',
      helpfulCount: 20,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
    {
      id: 'br-fc-2',
      tenantId: 'tenant-food-court-01',
      customerName: 'Tom N.',
      rating: 3,
      comment: 'Decent options but can get very crowded during lunch. Prices are reasonable. Better suited for a quick meal than a leisurely dining experience.',
      visitDate: '2025-11-25',
      visitType: 'dine_in',
      createdAt: '2025-11-26T12:00:00.000Z',
      updatedAt: '2025-11-26T12:00:00.000Z',
      helpfulCount: 7,
      verifiedVisit: false,
      status: 'published',
      language: 'en',
    },
  ],
  'tenant-wheels-01': [
    {
      id: 'br-wh-1',
      tenantId: 'tenant-wheels-01',
      customerName: 'Chloe F.',
      rating: 5,
      comment: 'Best street food in the park! The fish tacos are incredible and the craft beers pair perfectly. Love the outdoor vibe.',
      visitDate: '2025-11-30',
      visitType: 'takeaway',
      createdAt: '2025-12-01T14:00:00.000Z',
      updatedAt: '2025-12-01T14:00:00.000Z',
      helpfulCount: 16,
      verifiedVisit: true,
      status: 'published',
      language: 'en',
    },
    {
      id: 'br-wh-2',
      tenantId: 'tenant-wheels-01',
      customerName: 'Ryan M.',
      rating: 4,
      comment: 'Casual and fun. Queue moves quickly, food is fresh and tasty. Great for groups. Only wish they had more non-beer drink options.',
      visitDate: '2025-11-10',
      visitType: 'takeaway',
      createdAt: '2025-11-11T16:00:00.000Z',
      updatedAt: '2025-11-11T16:00:00.000Z',
      helpfulCount: 10,
      verifiedVisit: false,
      status: 'published',
      language: 'en',
    },
  ],
}

let nextId = 1000

// ── Service ───────────────────────────────────────────────────────────────────

export const businessReviewService = {
  async getBusinessReviews(
    tenantId: string,
    filters: Partial<BusinessReviewFilters> = {},
  ): Promise<BusinessReviewsResponse> {
    if (USE_MOCK) {
      await delay()
      const all = MOCK_STORE[tenantId] ?? []
      const reviews = applyFilters(all, filters)
      return { reviews, total: reviews.length, breakdown: buildBreakdown(all.filter((r) => r.status === 'published')) }
    }
    const params = new URLSearchParams()
    if (filters.sort) params.set('sort', filters.sort)
    if (filters.verified) params.set('verified', 'true')
    if (filters.withPhotos) params.set('with_photos', 'true')
    if (filters.branchId) params.set('branch_id', filters.branchId)
    if (filters.language) params.set('language', filters.language)
    if (filters.rating != null) params.set('rating', String(filters.rating))
    const { data } = await api.get<BusinessReviewsResponse>(
      `${ENDPOINTS.BUSINESS_REVIEWS.LIST(tenantId)}?${params}`,
    )
    return data
  },

  async getRatingBreakdown(tenantId: string, branchId?: string): Promise<RatingBreakdownData> {
    if (USE_MOCK) {
      await delay(150)
      const all = (MOCK_STORE[tenantId] ?? []).filter(
        (r) => r.status === 'published' && (!branchId || r.branchId === branchId),
      )
      return buildBreakdown(all)
    }
    const url = branchId
      ? ENDPOINTS.BUSINESS_REVIEWS.BRANCH_RATING(tenantId, branchId)
      : ENDPOINTS.BUSINESS_REVIEWS.RATING(tenantId)
    const { data } = await api.get<RatingBreakdownData>(url)
    return data
  },

  async createReview(payload: CreateBusinessReviewPayload): Promise<BusinessReview> {
    if (USE_MOCK) {
      await delay()
      const review: BusinessReview = {
        id: `br-mock-${++nextId}`,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
        customerName: 'You',
        rating: payload.rating,
        title: payload.title,
        comment: payload.comment,
        images: payload.images,
        visitDate: payload.visitDate,
        visitType: payload.visitType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        helpfulCount: 0,
        verifiedVisit: false,
        status: 'pending',
        language: payload.language ?? 'en',
      }
      if (!MOCK_STORE[payload.tenantId]) MOCK_STORE[payload.tenantId] = []
      MOCK_STORE[payload.tenantId].push(review)
      return review
    }
    const { data } = await api.post<BusinessReview>(
      ENDPOINTS.BUSINESS_REVIEWS.CREATE(payload.tenantId),
      payload,
    )
    return data
  },

  async replyToReview(reviewId: string, tenantId: string, text: string): Promise<BusinessReview> {
    if (USE_MOCK) {
      await delay()
      const all = MOCK_STORE[tenantId] ?? []
      const review = all.find((r) => r.id === reviewId)
      if (!review) throw new Error('Review not found')
      review.ownerReply = {
        id: `reply-${Date.now()}`,
        text,
        authorName: 'Business Owner',
        createdAt: new Date().toISOString(),
      }
      review.updatedAt = new Date().toISOString()
      return review
    }
    const { data } = await api.post<BusinessReview>(
      ENDPOINTS.BUSINESS_REVIEWS.REPLY(tenantId, reviewId),
      { text },
    )
    return data
  },

  async editReply(reviewId: string, tenantId: string, text: string): Promise<BusinessReview> {
    if (USE_MOCK) {
      await delay()
      const review = (MOCK_STORE[tenantId] ?? []).find((r) => r.id === reviewId)
      if (!review?.ownerReply) throw new Error('Reply not found')
      review.ownerReply.text = text
      review.ownerReply.updatedAt = new Date().toISOString()
      review.updatedAt = new Date().toISOString()
      return review
    }
    const { data } = await api.patch<BusinessReview>(
      ENDPOINTS.BUSINESS_REVIEWS.REPLY(tenantId, reviewId),
      { text },
    )
    return data
  },

  async deleteReply(reviewId: string, tenantId: string): Promise<BusinessReview> {
    if (USE_MOCK) {
      await delay()
      const review = (MOCK_STORE[tenantId] ?? []).find((r) => r.id === reviewId)
      if (!review) throw new Error('Review not found')
      review.ownerReply = undefined
      review.updatedAt = new Date().toISOString()
      return review
    }
    const { data } = await api.delete<BusinessReview>(
      ENDPOINTS.BUSINESS_REVIEWS.REPLY(tenantId, reviewId),
    )
    return data
  },

  async markHelpful(reviewId: string, tenantId: string): Promise<{ helpfulCount: number }> {
    if (USE_MOCK) {
      await delay(100)
      const review = (MOCK_STORE[tenantId] ?? []).find((r) => r.id === reviewId)
      if (!review) throw new Error('Review not found')
      review.helpfulCount++
      return { helpfulCount: review.helpfulCount }
    }
    const { data } = await api.post<{ helpfulCount: number }>(
      ENDPOINTS.BUSINESS_REVIEWS.HELPFUL(tenantId, reviewId),
    )
    return data
  },

  async moderateReview(reviewId: string, tenantId: string, status: ReviewStatus): Promise<BusinessReview> {
    if (USE_MOCK) {
      await delay()
      const review = (MOCK_STORE[tenantId] ?? []).find((r) => r.id === reviewId)
      if (!review) throw new Error('Review not found')
      review.status = status
      review.updatedAt = new Date().toISOString()
      return review
    }
    const { data } = await api.patch<BusinessReview>(
      ENDPOINTS.BUSINESS_REVIEWS.MODERATE(tenantId, reviewId),
      { status },
    )
    return data
  },

  async getReviewAnalytics(tenantId: string): Promise<ReviewAnalytics> {
    if (USE_MOCK) {
      await delay()
      const all = (MOCK_STORE[tenantId] ?? []).filter((r) => r.status === 'published')
      const breakdown = buildBreakdown(all)
      return {
        averageRating: breakdown.average,
        totalReviews: breakdown.total,
        reviewsThisMonth: Math.ceil(breakdown.total * 0.3),
        trend: 'up',
        trendDelta: 0.2,
        replyRate: all.filter((r) => r.ownerReply).length / Math.max(all.length, 1),
        avgReplyTimeHours: 18,
        breakdown: breakdown.distribution,
        topKeywords: [
          { word: 'excellent', count: 12 },
          { word: 'staff', count: 9 },
          { word: 'atmosphere', count: 7 },
          { word: 'quality', count: 6 },
          { word: 'recommend', count: 5 },
        ],
        monthlyAverages: [
          { month: 'Sep 2025', average: 4.5, count: Math.ceil(breakdown.total * 0.15) },
          { month: 'Oct 2025', average: 4.6, count: Math.ceil(breakdown.total * 0.2) },
          { month: 'Nov 2025', average: 4.7, count: Math.ceil(breakdown.total * 0.3) },
          { month: 'Dec 2025', average: breakdown.average, count: Math.ceil(breakdown.total * 0.35) },
        ],
      }
    }
    const { data } = await api.get<ReviewAnalytics>(ENDPOINTS.BUSINESS_REVIEWS.ANALYTICS(tenantId))
    return data
  },

  _resetMockStore() {
    Object.keys(MOCK_STORE).forEach((k) => {
      // restore to initial seeded state by filtering out dynamically added reviews
      MOCK_STORE[k] = MOCK_STORE[k].filter((r) => !r.id.startsWith('br-mock-'))
    })
    nextId = 1000
  },
}
