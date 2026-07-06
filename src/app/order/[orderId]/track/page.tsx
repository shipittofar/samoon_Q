'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Package } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { OrderTracker } from '@/components/order/OrderTracker'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { useOrder } from '@/hooks'

const STATUS_BADGE_MAP: Record<string, 'success' | 'warning' | 'info' | 'purple' | 'danger' | 'secondary'> = {
  delivered: 'success', pending: 'warning', accepted: 'info',
  preparing: 'purple', ready: 'success', cancelled: 'danger',
}

export default function OrderTrackPage({ params }: { params: Promise<{ orderId: string }> }) {
  const t = useTranslations('orderDetail')
  const tOrder = useTranslations('order')
  const { orderId } = use(params)
  const { data: order, isLoading } = useOrder(orderId)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="pt-24 max-w-lg mx-auto px-4 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Header />
        <div className="text-center pt-24">
          <Package className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">{t('orderNotFound')}</h2>
          <Link href="/dashboard/orders"><Button>{t('myOrders')}</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-lg mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-6 pt-4">
            <Link href={`/order/${orderId}`}>
              <Button variant="ghost" size="icon-sm" aria-label={t('backToOrderDetailsAria')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)] truncate">
                {t('trackingNumber', { number: order.order_number })}
              </h1>
            </div>
            <Badge variant={STATUS_BADGE_MAP[order.status] || 'secondary'} className="capitalize shrink-0">
              {order.status && STATUS_BADGE_MAP[order.status] ? tOrder(`status.${order.status}`) : order.status?.replace('_', ' ')}
            </Badge>
          </div>

          {order.status === 'cancelled' ? (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-8 text-center">
              <Package className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="font-semibold text-[var(--fg)]">{t('orderCancelled')}</p>
              <p className="text-sm text-[var(--fg-muted)] mt-1">{t('orderCancelledDesc')}</p>
              <Link href="/menu" className="mt-4 inline-block">
                <Button size="sm">{t('orderAgain')}</Button>
              </Link>
            </div>
          ) : (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <OrderTracker
                orderId={order.id}
                initialStatus={order.status}
                useMockSimulation={order.status !== 'delivered'}
              />
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <Link href={`/order/${orderId}`} className="flex-1">
              <Button variant="secondary" className="w-full">{t('viewFullOrder')}</Button>
            </Link>
            <Link href="/dashboard/orders" className="flex-1">
              <Button variant="outline" className="w-full">{t('allOrders')}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
