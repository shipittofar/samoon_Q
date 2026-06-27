// Business-level reviews — distinct from menu-item Review type in src/types/index.ts

export type ReviewStatus = 'published' | 'pending' | 'hidden' | 'spam' | 'deleted' | 'rejected'

export interface OwnerReply {
  id: string
  text: string
  authorName: string
  createdAt: string
  updatedAt?: string
}

export interface BusinessReview {
  id: string
  tenantId: string
  branchId?: string
  customerId?: string
  customerName: string
  avatar?: string
  rating: number
  title?: string
  comment: string
  images?: string[]
  visitDate?: string
  visitType?: 'dine_in' | 'takeaway' | 'delivery'
  createdAt: string
  updatedAt: string
  ownerReply?: OwnerReply
  helpfulCount: number
  verifiedVisit: boolean
  status: ReviewStatus
  language?: string
  pinned?: boolean
}

export interface RatingDistribution {
  star: number
  count: number
  percentage: number
}

export interface RatingBreakdownData {
  average: number
  total: number
  distribution: RatingDistribution[]
  recentAverage?: number
  weightedAverage?: number
}

export interface BusinessReviewFilters {
  sort: 'newest' | 'highest' | 'lowest' | 'most_helpful'
  verified: boolean
  withPhotos: boolean
  branchId?: string
  language?: string
  rating?: number
}

export const DEFAULT_REVIEW_FILTERS: BusinessReviewFilters = {
  sort: 'newest',
  verified: false,
  withPhotos: false,
}

export interface BusinessReviewsResponse {
  reviews: BusinessReview[]
  total: number
  breakdown: RatingBreakdownData
}

export interface CreateBusinessReviewPayload {
  tenantId: string
  branchId?: string
  rating: number
  title?: string
  comment: string
  images?: string[]
  visitDate?: string
  visitType?: BusinessReview['visitType']
  language?: string
}

export interface ReviewAnalytics {
  averageRating: number
  totalReviews: number
  reviewsThisMonth: number
  trend: 'up' | 'down' | 'stable'
  trendDelta: number
  replyRate: number
  avgReplyTimeHours: number
  breakdown: RatingDistribution[]
  topKeywords: { word: string; count: number }[]
  monthlyAverages: { month: string; average: number; count: number }[]
}
