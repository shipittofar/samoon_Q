'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Star, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useAdminCustomer, useAdminCustomerReviews } from '@/hooks'
import { formatDate } from '@/utils'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-[var(--border)]'}`}
        />
      ))}
    </div>
  )
}

function ReviewsContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: customer, isLoading: customerLoading, isError: customerError } = useAdminCustomer(id)
  const { data: reviews = [], isLoading: reviewsLoading } = useAdminCustomerReviews(id)

  if (customerLoading || reviewsLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-[var(--fg-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">{t('loadingReviews')}</span>
      </div>
    )
  }

  if (customerError || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-[var(--fg-muted)]">{t('customerNotFound')}</p>
        <Link href="/console/customers" className="text-sm text-blue-600 hover:underline">
          {t('backToCustomers')}
        </Link>
      </div>
    )
  }

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link
        href={`/console/customers/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {customer.first_name} {customer.last_name}
      </Link>

      {/* Customer summary */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-3">
          <Avatar firstName={customer.first_name} lastName={customer.last_name} size="md" />
          <div>
            <h1 className="text-lg font-bold text-[var(--fg)]">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-sm text-[var(--fg-muted)]">{customer.email}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs text-[var(--fg-muted)] mb-1">{t('totalReviews')}</p>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span className="text-xl font-bold text-[var(--fg)]">{reviews.length}</span>
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs text-[var(--fg-muted)] mb-1">{t('averageRating')}</p>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            <span className="text-xl font-bold text-[var(--fg)]">
              {reviews.length ? avgRating.toFixed(1) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--fg)]">{t('breadcrumbs.reviews')}</h2>
        {reviews.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 flex flex-col items-center gap-3 text-center">
            <MessageSquare className="h-8 w-8 text-[var(--fg-muted)]" />
            <p className="text-sm text-[var(--fg-muted)]">{t('noReviewsYet')}</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <StarRating rating={review.rating} />
                <span className="text-xs text-[var(--fg-muted)]">{formatDate(review.created_at)}</span>
              </div>
              {review.comment && (
                <p className="text-sm text-[var(--fg)]">{review.comment}</p>
              )}
              <p className="text-xs text-[var(--fg-muted)] font-mono">
                {t('itemLabel', { item: review.menu_item_id })}
                {review.order_id && ` · ${t('orderLabel', { order: review.order_id })}`}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function CustomerReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Customer Reviews">
      <PermissionGuard permission="customers.view" fallback={<AccessDenied />}>
        <div className="min-h-screen bg-[var(--bg)]">
          <div className="pt-16">
            <ReviewsContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
