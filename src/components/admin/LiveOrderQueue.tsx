'use client'

import { useTranslations } from 'next-intl'
import type { LiveOrder, OperationsScope } from '@/types/realtime-operations'
import { useLiveOrders } from '@/hooks'

const STATUS_COLUMNS: LiveOrder['status'][] = ['pending', 'accepted', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']

const STATUS_COLOR: Record<LiveOrder['status'], string> = {
  pending: 'bg-yellow-50 border-yellow-200',
  accepted: 'bg-blue-50 border-blue-200',
  preparing: 'bg-orange-50 border-orange-200',
  ready: 'bg-green-50 border-green-200',
  delivering: 'bg-purple-50 border-purple-200',
  delivered: 'bg-gray-50 border-gray-200',
  cancelled: 'bg-red-50 border-red-200',
}

interface OrderCardProps {
  order: LiveOrder
}

function OrderCard({ order }: OrderCardProps) {
  const t = useTranslations('console')
  return (
    <div
      className={`rounded border p-3 mb-2 text-sm ${STATUS_COLOR[order.status]} ${order.slaBreached ? 'ring-2 ring-red-400' : ''}`}
    >
      <div className="flex justify-between font-semibold mb-1">
        <span>#{order.orderNumber}</span>
        {order.tableNumber && <span className="text-gray-600">T{order.tableNumber}</span>}
      </div>
      {order.customerName && (
        <div className="text-gray-600 truncate">{order.customerName}</div>
      )}
      <div className="text-gray-700 mt-1">
        {order.items.map((it, i) => (
          <div key={i} className="truncate">
            {it.quantity}× {it.name}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{order.currency} {order.totalAmount.toFixed(2)}</span>
        <span>{order.estimatedPrepMinutes}m</span>
      </div>
      {order.slaBreached && (
        <div className="mt-1 text-xs font-semibold text-red-600">{t('slaBreached')}</div>
      )}
      {order.isDelayed && !order.slaBreached && (
        <div className="mt-1 text-xs font-semibold text-orange-600">{t('delayed')}</div>
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

  if (isLoading) return <div className="text-sm text-gray-500 p-4">{t('loadingOrders')}</div>
  if (isError) return <div className="text-sm text-red-500 p-4">{t('failedToLoadOrders')}</div>

  const byStatus = (status: LiveOrder['status']) => orders.filter((o) => o.status === status)

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {visibleStatuses.map((status) => {
          const col = byStatus(status)
          return (
            <div key={status} className="w-48 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {status === 'delivering' ? t('statusDelivering') : tOrder(`status.${status}`)}
                </span>
                <span className="text-xs bg-gray-200 rounded-full px-2 py-0.5">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">{t('empty')}</div>
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
