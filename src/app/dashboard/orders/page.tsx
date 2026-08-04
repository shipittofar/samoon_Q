'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Package, ArrowRight, RefreshCw, Search, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useOrders, useCreateReview } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import { getOrderStatusLabelKey } from '@/lib/order-status'

const STATUS_BADGE_MAP: Record<string, 'success' | 'warning' | 'info' | 'purple' | 'danger' | 'secondary'> = {
  delivered: 'success',
  picked_up: 'success',
  served: 'success',
  pending: 'warning',
  accepted: 'info',
  preparing: 'purple',
  ready: 'success',
  cancelled: 'danger',
}

function WriteReviewButton({ orderId, itemId }: { orderId: string; itemId: string }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const { mutate, isPending, isSuccess } = useCreateReview(itemId)
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')

  if (isSuccess) {
    return <span className="text-xs text-emerald-600 font-medium">{t('reviewSubmitted')}</span>
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={(e) => { e.preventDefault(); setOpen(true) }}
          className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
        >
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {t('writeAReview')}
        </button>
      ) : (
        <div className="mt-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--card-hover)] space-y-2" onClick={(e) => e.preventDefault()}>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)} className={`text-lg ${s <= rating ? 'text-amber-400' : 'text-[var(--border-strong)]'}`}>★</button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('shareYourExperiencePlaceholder')}
            rows={2}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-1 focus:ring-orange-500/40 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => mutate({ rating, comment: comment || undefined, order_id: orderId })}
              disabled={isPending}
              className="text-xs px-3 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium"
            >
              {isPending ? t('submittingEllipsis') : tCommon('submit')}
            </button>
            <button onClick={() => setOpen(false)} className="text-xs px-3 py-1 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card)] transition-colors">
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OrdersPage() {
  const { data, isLoading, refetch } = useOrders()
  const [search, setSearch] = useState('')
  const t = useTranslations('dashboard')
  const tOrder = useTranslations('order')
  const orders = (data?.results || []).filter((o) =>
    !search || o.order_number?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('myOrders')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{t('totalOrdersCount', { count: data?.count || 0 })}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>{t('refresh')}</Button>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchByOrderNumberPlaceholder')}
          className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 flex gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <Package className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h3 className="font-semibold text-[var(--fg)] mb-2">{t('noOrdersYet')}</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-4">{t('startOrderingFromMenu')}</p>
          <Link href="/menu"><Button>{t('orderNow')}</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md transition-all group">
                <Link href={`/order/${order.id}`} className="block">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[var(--fg)]">{order.order_number}</p>
                        <Badge variant={STATUS_BADGE_MAP[order.status] || 'secondary'} className="capitalize text-xs">
                          {tOrder(`status.${getOrderStatusLabelKey(order.status)}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--fg-muted)]">
                        {formatDate(order.created_at)} · {order.order_type?.replace('_', ' ')} · {formatCurrency(order.total)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--fg-subtle)] group-hover:text-orange-500 transition-colors shrink-0" />
                  </div>
                </Link>
                {order.status === 'delivered' && order.items?.[0]?.menu_item?.id && (
                  <WriteReviewButton orderId={order.id} itemId={order.items[0].menu_item.id} />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
