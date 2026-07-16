'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Star, ThumbsUp, ChevronDown, ChevronUp, BadgeCheck, MessageSquare, Camera } from 'lucide-react'
import { cn } from '@/utils'
import type { BusinessReview } from '@/types/business-review'

interface ReviewCardProps {
  review: BusinessReview
  onMarkHelpful?: (id: string) => void
  onReply?: (id: string) => void
  showModActions?: boolean
  className?: string
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const t = useTranslations('reviewCard')
  const cls = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <div className="flex gap-0.5" aria-label={t('starsOutOf5', { rating })} role="img">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={cn(cls, i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300')}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

function Avatar({ name, avatar }: { name: string; avatar?: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    )
  }
  return (
    <div
      className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold shrink-0"
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

const VISIT_TYPE_KEYS: Record<NonNullable<BusinessReview['visitType']>, string> = {
  dine_in: 'dineIn',
  takeaway: 'takeaway',
  delivery: 'delivery',
}

export function ReviewCard({ review, onMarkHelpful, onReply, showModActions = false, className }: ReviewCardProps) {
  const t = useTranslations('reviewCard')
  const [expanded, setExpanded] = useState(false)
  const TRUNCATE_AT = 220
  const shouldTruncate = review.comment.length > TRUNCATE_AT

  const visibleComment = shouldTruncate && !expanded
    ? `${review.comment.slice(0, TRUNCATE_AT)}…`
    : review.comment

  const dateStr = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
    new Date(review.created_at),
  )

  return (
    <article
      className={cn(
        'p-4 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-soft)] flex flex-col gap-3',
        review.pinned && 'border-[var(--accent)]/40',
        className,
      )}
      aria-label={t('reviewByNameStars', { name: review.customerName, rating: review.rating })}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar name={review.customerName} avatar={review.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-[var(--fg)]">{review.customerName}</span>
            {review.verifiedVisit && (
              <span
                className="inline-flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                title={t('verifiedVisit')}
              >
                <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                {t('verified')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <StarRow rating={review.rating} />
            <span className="text-xs text-[var(--fg-muted)]">{dateStr}</span>
            {review.visitType && (
              <span className="text-xs text-[var(--fg-muted)]">· {t(`visitTypes.${VISIT_TYPE_KEYS[review.visitType]}`)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <p className="text-sm font-semibold text-[var(--fg)]">{review.title}</p>
      )}

      {/* Comment */}
      <div>
        <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{visibleComment}</p>
        {shouldTruncate && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 inline-flex items-center gap-0.5 text-xs text-[var(--accent)] hover:underline"
            aria-expanded={expanded}
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" aria-hidden="true" />{t('showLess')}</>
            ) : (
              <><ChevronDown className="w-3 h-3" aria-hidden="true" />{t('readMore')}</>
            )}
          </button>
        )}
      </div>

      {/* Photo thumbnails */}
      {(review.images?.length ?? 0) > 0 && (
        <div className="flex gap-2 flex-wrap" role="list" aria-label={t('reviewPhotosAria')}>
          {review.images!.map((src, i) => (
            <div key={src} role="listitem">
              <img
                src={src}
                alt={t('reviewPhotoAlt', { index: i + 1 })}
                className="w-16 h-16 rounded-xl object-cover border border-[var(--border)]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Owner reply */}
      {review.ownerReply && (
        <div className="bg-[var(--bg-secondary)] rounded-xl p-3 border-l-2 border-[var(--accent)]">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" aria-hidden="true" />
            <span className="text-xs font-semibold text-[var(--fg)]">{review.ownerReply.authorName}</span>
            <span className="text-xs text-[var(--fg-muted)]">·</span>
            <span className="text-xs text-[var(--fg-muted)]">
              {new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(
                new Date(review.ownerReply.created_at),
              )}
            </span>
          </div>
          <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{review.ownerReply.text}</p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-1 border-t border-[var(--border)]">
        {onMarkHelpful && (
          <button
            type="button"
            onClick={() => onMarkHelpful(review.id)}
            className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
            aria-label={t('markHelpfulAria', { count: review.helpfulCount })}
          >
            <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('helpfulCount', { count: review.helpfulCount })}</span>
          </button>
        )}

        {!onMarkHelpful && review.helpfulCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
            <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
            {t('helpfulSuffix', { count: review.helpfulCount })}
          </span>
        )}

        {review.images && review.images.length > 0 && !onMarkHelpful && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            {t('photosCount', { count: review.images.length })}
          </span>
        )}

        {onReply && !review.ownerReply && (
          <button
            type="button"
            onClick={() => onReply(review.id)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            {t('reply')}
          </button>
        )}
      </div>
    </article>
  )
}
