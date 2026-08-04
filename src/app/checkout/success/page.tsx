'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Package, ArrowRight, Home, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui'
import { OrderTracker } from '@/components/order/OrderTracker'
import { useOrder } from '@/hooks'
import { resolveOrderBranchMenuUrl } from '@/utils/navigation-intelligence'
import { isTerminalOrderStatus, resolveOrderStatus } from '@/lib/order-status'
import confetti from 'canvas-confetti'

function SuccessLoading() {
  const tCommon = useTranslations('common')

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden p-6 space-y-6">
        <div className="flex flex-col items-center gap-3 py-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <p className="text-center text-sm text-[var(--fg-muted)]">{tCommon('loading')}</p>
      </div>
    </div>
  )
}

function SuccessError({
  onRetry,
  message,
}: {
  onRetry?: () => void
  message: string
}) {
  const tCommon = useTranslations('common')

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div
        className="max-w-lg w-full bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl p-8 text-center"
        role="alert"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 text-red-500 mx-auto mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)] mb-2">
          {message}
        </h2>
        {onRetry && (
          <Button
            variant="secondary"
            className="mt-4"
            onClick={onRetry}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            {tCommon('retry')}
          </Button>
        )}
        <Link href="/discover" className="mt-4 inline-block text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          {tCommon('back')}
        </Link>
      </div>
    </div>
  )
}

function SuccessContent() {
  const t = useTranslations('checkoutResult')
  const tOrderDetail = useTranslations('orderDetail')
  const params = useSearchParams()
  const orderId = params.get('orderId') || ''
  const { data: order, isLoading, isError, refetch } = useOrder(orderId)

  useEffect(() => {
    if (!order) return
    const fire = () => {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fb923c', '#fdba74', '#fff7ed'],
      })
    }
    const timer = setTimeout(fire, 300)
    return () => clearTimeout(timer)
  }, [order])

  if (!orderId) {
    return (
      <SuccessError message={tOrderDetail('orderNotFound')} />
    )
  }

  if (isLoading) {
    return <SuccessLoading />
  }

  if (isError || !order) {
    return (
      <SuccessError
        message={tOrderDetail('orderNotFound')}
        onRetry={() => refetch()}
      />
    )
  }

  const menuHref = resolveOrderBranchMenuUrl(order)
  const resolvedStatus = resolveOrderStatus(order.status, order.order_type)
  const trackerActive = !isTerminalOrderStatus(order) && resolvedStatus !== 'cancelled'

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden"
        >
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
              className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4"
            >
              <CheckCircle2 className="h-10 w-10 text-white" />
            </motion.div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-white mb-1">
              {t('orderConfirmed')}
            </h1>
            <p className="text-white/80 text-sm">{t('orderConfirmedDesc')}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="text-center bg-[var(--card-hover)] rounded-2xl p-4">
              <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wider mb-1">
                {t('orderNumberLabel')}
              </p>
              <p className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">
                {order.order_number}
              </p>
            </div>

            {resolvedStatus !== 'cancelled' && (
              <div>
                <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" /> {t('liveOrderTracking')}
                </h2>
                <OrderTracker
                  orderId={order.id}
                  initialStatus={resolvedStatus}
                  orderType={order.order_type}
                  initialEstimatedTime={order.estimated_time}
                  useMockSimulation={trackerActive}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Link href={`/order/${order.id}`}>
                <Button variant="secondary" className="w-full" leftIcon={<Package className="h-4 w-4" />}>
                  {t('trackOrder')}
                </Button>
              </Link>
              <Link href={menuHref}>
                <Button className="w-full" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  {t('orderMore')}
                </Button>
              </Link>
            </div>
            <Link
              href="/discover"
              className="flex items-center justify-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              <Home className="h-3.5 w-3.5" /> {t('backToHome')}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessLoading />}>
      <SuccessContent />
    </Suspense>
  )
}
