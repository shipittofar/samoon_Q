'use client'

import { useTranslations } from 'next-intl'
import type { LiveOrder, OperationsScope } from '@/types/realtime-operations'
import { useLiveOrders } from '@/hooks'

const STATUS_COLUMNS: LiveOrder['status'][] = ['pending', 'accepted', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']

const STATUS_COLOR: Record<LiveOrder['status'], string> = {
  pending: 'bg-[var(--warning-subtle)] border-[var(--warning-border)]',
  accepted: 'bg-[var(--info-subtle)] border-[var(--info-border)]',
  preparing: 'bg-[var(--accent-subtle)] border-[var(--accent-border)]/40',
  ready: 'bg-[var(--success-subtle)] border-[var(--success-border)]',
  delivering: 'bg-[var(--chart-5)]/10 border-[var(--chart-5)]/30',
  delivered: 'bg-[var(--card-hover)] border-[var(--border)]',
  cancelled: 'bg-[var(--danger-subtle)] border-[var(--danger-border)]',
}

interface OrderCardProps {
  order: LiveOrder
}

function OrderCard({ order }: OrderCardProps) {
  const t = useTranslations('console')
  return (
    <div
      className={`rounded border p-3 mb-2 text-sm ${STATUS_COLOR[order.status]} ${order.slaBreached ? 'ring-2 ring-[var(--danger)]' : ''}`}
    >
      <div className="flex justify-between font-semibold mb-1">
        <span>#{order.orderNumber}</span>
        {order.tableNumber && <span className="text-[var(--fg-muted)]">T{order.tableNumber}</span>}
      </div>
      {order.customerName && (
        <div className="text-[var(--fg-muted)] truncate">{order.customerName}</div>
      )}
      <div className="text-[var(--fg-secondary)] mt-1">
        {order.items.map((it, i) => (
          <div key={i} className="truncate">
            {it.quantity}× {it.name}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-[var(--fg-muted)]">
        <span>{order.currency} {order.totalAmount.toFixed(2)}</span>
        <span>{order.estimatedPrepMinutes}m</span>
      </div>
      {order.slaBreached && (
        <div className="mt-1 text-xs font-semibold text-[var(--danger-text)]">{t('slaBreached')}</div>
      )}
      {order.isDelayed && !order.slaBreached && (
        <div className="mt-1 text-xs font-semibold text-[var(--accent-text)]">{t('delayed')}</div>
      )}
    </div>
  )
}

interface LiveOrderQueueProps {
  scope: OperationsScope
  visibleStatuses?: LiveOrder['status'][]
}

export function LiveOrderQueue({ scope, visibleStatuses = STATUS_COLUMNS }: LiveOrderQueueProps) {
  const t = useTranslations('console')
  const tOrder = useTranslations('order')
  const { data: orders = [], isLoading, isError } = useLiveOrders(scope)

  if (isLoading) return <div className="text-sm text-[var(--fg-muted)] p-4">{t('loadingOrders')}</div>
  if (isError) return <div className="text-sm text-[var(--danger-text)] p-4">{t('failedToLoadOrders')}</div>

  const byStatus = (status: LiveOrder['status']) => orders.filter((o) => o.status === status)

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {visibleStatuses.map((status) => {
          const col = byStatus(status)
          return (
            <div key={status} className="w-48 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  {status === 'delivering' ? t('statusDelivering') : tOrder(`status.${status}`)}
                </span>
                <span className="text-xs bg-[var(--border)] rounded-full px-2 py-0.5">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.length === 0 ? (
                  <div className="text-xs text-[var(--fg-subtle)] italic">{t('empty')}</div>
                ) : (
                  col.map((o) => <OrderCard key={o.id} order={o} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
