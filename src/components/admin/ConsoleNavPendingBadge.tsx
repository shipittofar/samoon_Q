'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import { usePendingOrdersCount, usePendingReservationsCount } from '@/hooks/console-realtime'

export function ConsoleNavPendingBadge({ href }: { href: string }) {
  if (href === '/console/orders') return <OrdersPendingBadge />
  if (href === '/console/reservations') return <ReservationsPendingBadge />
  return null
}

function OrdersPendingBadge() {
  const query = usePendingOrdersCount()
  const t = useTranslations('console')
  return <CountBadge count={query.data?.count} isSuccess={query.isSuccess} label={t('pendingOrdersCountAria')} />
}

function ReservationsPendingBadge() {
  const query = usePendingReservationsCount()
  const t = useTranslations('console')
  return (
    <CountBadge
      count={query.data?.count}
      isSuccess={query.isSuccess}
      label={t('pendingReservationsCountAria')}
    />
  )
}

export function CountBadge({
  count,
  isSuccess,
  label,
}: {
  count: number | undefined
  isSuccess: boolean
  label: string
}) {
  if (!isSuccess || count == null || count <= 0) return null

  return (
    <span
      className={cn(
        'ms-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full',
        'bg-[var(--danger)] px-1.5 text-[10px] font-semibold leading-none text-[var(--danger-fg)]',
        '',
      )}
      aria-label={`${label}: ${count}`}
    >
      {count}
    </span>
  )
}
