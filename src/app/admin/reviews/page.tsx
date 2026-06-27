'use client'

import { useState } from 'react'
import {
  Star, MessageSquare, Flag, Eye, EyeOff, Trash2, TrendingUp,
  ThumbsUp, BadgeCheck, BarChart2, Loader2,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/utils'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ReviewCard } from '@/components/reviews/ReviewCard'
import { RatingBreakdown } from '@/components/reviews/RatingBreakdown'
import { useBusinessReviews, useReplyToReview, useModerateReview, useReviewAnalytics } from '@/hooks'
import { useTenantStore } from '@/stores'
import type { ReviewStatus, BusinessReview } from '@/types/business-review'

type Tab = 'published' | 'pending' | 'hidden' | 'spam' | 'analytics'

const STATUS_TABS: { value: Tab; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'pending', label: 'Pending' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'spam', label: 'Spam' },
  { value: 'analytics', label: 'Analytics' },
]

function ReplyModal({
  review,
  onSubmit,
  onClose,
}: {
  review: BusinessReview
  onSubmit: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(review.ownerReply?.text ?? '')
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reply to review"
    >
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-lg shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">Reply to review</h3>
        <p className="text-sm text-[var(--fg-muted)] mb-4">by {review.customerName} · {review.rating}★</p>
        <p className="text-sm text-[var(--fg-muted)] italic mb-4 line-clamp-3">{review.comment}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Write a thoughtful response…"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--fg)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] mb-4"
          aria-label="Reply text"
        />
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (text.trim()) { onSubmit(text.trim()); onClose() } }}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {review.ownerReply ? 'Update reply' : 'Post reply'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AnalyticsPanel({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useReviewAnalytics(tenantId)

  if (isLoading) return (
    <div className="flex items-center gap-2 py-10 text-[var(--fg-muted)]">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      <span>Loading analytics…</span>
    </div>
  )

  if (!data) return <p className="text-sm text-[var(--fg-muted)] py-10">No analytics data available.</p>

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Average Rating', value: `${data.averageRating.toFixed(1)} ★`, icon: Star, color: 'text-amber-400' },
          { label: 'Total Reviews', value: data.totalReviews.toLocaleString(), icon: MessageSquare, color: 'text-blue-500' },
          { label: 'Reply Rate', value: `${Math.round(data.replyRate * 100)}%`, icon: ThumbsUp, color: 'text-emerald-500' },
          { label: 'Avg Reply Time', value: `${data.avgReplyTimeHours}h`, icon: TrendingUp, color: 'text-purple-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
            <Icon className={cn('w-5 h-5 mb-2', color)} aria-hidden="true" />
            <p className="text-2xl font-bold text-[var(--fg)]">{value}</p>
            <p className="text-xs text-[var(--fg-muted)] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Trend indicator */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4 flex items-center gap-3">
        <TrendingUp className={cn('w-5 h-5', data.trend === 'up' ? 'text-emerald-500' : data.trend === 'down' ? 'text-red-500' : 'text-[var(--fg-muted)]')} aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-[var(--fg)]">
            {data.trend === 'up' ? 'Improving' : data.trend === 'down' ? 'Declining' : 'Stable'} trend
          </p>
          <p className="text-xs text-[var(--fg-muted)]">
            Rating {data.trend === 'up' ? '+' : data.trend === 'down' ? '-' : ''}{data.trendDelta.toFixed(1)} over the past 3 months
          </p>
        </div>
      </div>

      {/* Top keywords */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--fg-muted)]" aria-hidden="true" />
          Top keywords in reviews
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.topKeywords.map(({ word, count }) => (
            <span
              key={word}
              className="px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--fg-muted)]"
            >
              {word} <span className="text-[var(--fg)] font-semibold ml-1">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminReviewsPage() {
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const [activeTab, setActiveTab] = useState<Tab>('published')
  const [replyTarget, setReplyTarget] = useState<BusinessReview | null>(null)

  const { data, isLoading } = useBusinessReviews(tenantId, {})
  const moderateMutation = useModerateReview(tenantId)
  const replyMutation = useReplyToReview(tenantId)

  const allReviews = data?.reviews ?? []
  const filtered = allReviews.filter((r) => r.status === activeTab || activeTab === 'analytics')
  const breakdown = data?.breakdown

  function moderate(reviewId: string, status: ReviewStatus) {
    moderateMutation.mutate({ reviewId, status })
  }

  return (
    <PermissionGuard permission="reviews.view" fallback={<AccessDenied />}>
      <Header />
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Star className="w-6 h-6 text-amber-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-[var(--fg)]">Review Management</h1>
        </div>

        {/* Summary bar */}
        {breakdown && (
          <div className="mb-8">
            <RatingBreakdown breakdown={breakdown} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border)]" role="tablist">
          {STATUS_TABS.map(({ value, label }) => {
            const count = value === 'analytics' ? undefined : allReviews.filter((r) => r.status === value).length
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                onClick={() => setActiveTab(value)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-t',
                  activeTab === value
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
                )}
              >
                {label}
                {count !== undefined && (
                  <span className="ml-1.5 text-xs bg-[var(--bg-secondary)] rounded-full px-1.5 py-0.5">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {activeTab === 'analytics' ? (
          <AnalyticsPanel tenantId={tenantId} />
        ) : isLoading ? (
          <div className="flex items-center gap-2 py-10 text-[var(--fg-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Loading reviews…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)] py-10 text-center">
            No {activeTab} reviews.
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((review) => (
              <div key={review.id} className="relative">
                <ReviewCard
                  review={review}
                  onReply={(id) => setReplyTarget(allReviews.find((r) => r.id === id) ?? null)}
                  showModActions
                />
                {/* Moderation action bar */}
                <div className="mt-2 flex gap-2 flex-wrap">
                  {review.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => moderate(review.id, 'published')}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Approve
                    </button>
                  )}
                  {review.status !== 'hidden' && (
                    <button
                      type="button"
                      onClick={() => moderate(review.id, 'hidden')}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[var(--fg-muted)] text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      Hide
                    </button>
                  )}
                  {review.status !== 'spam' && (
                    <button
                      type="button"
                      onClick={() => moderate(review.id, 'spam')}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                      Mark spam
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => moderate(review.id, 'deleted')}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(review)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 transition-colors ml-auto"
                  >
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    {review.ownerReply ? 'Edit reply' : 'Reply'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {replyTarget && (
        <ReplyModal
          review={replyTarget}
          onSubmit={(text) => replyMutation.mutate({ reviewId: replyTarget.id, text })}
          onClose={() => setReplyTarget(null)}
        />
      )}
    </PermissionGuard>
  )
}
