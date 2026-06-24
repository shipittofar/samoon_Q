'use client'

import { useState } from 'react'
import type { LiveOrder } from '@/types/realtime-operations'
import { useKitchenStatus } from '@/hooks'

const COLUMNS: { key: keyof ReturnType<typeof useOrderColumns>; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'delayed', label: 'Delayed' },
  { key: 'priority', label: 'Priority' },
]

function useOrderColumns(branchId: string, tenantId: string) {
  const { data } = useKitchenStatus(branchId, tenantId)
  return {
    pending: data?.pendingOrders ?? [],
    preparing: data?.preparingOrders ?? [],
    ready: data?.readyOrders ?? [],
    delayed: data?.delayedOrders ?? [],
    priority: data?.priorityOrders ?? [],
    averagePrepMinutes: data?.averagePrepMinutes ?? 0,
    queueDepth: data?.queueDepth ?? 0,
    capacityPercent: data?.capacityPercent ?? 0,
  }
}

const COLUMN_COLOR: Record<string, string> = {
  pending: 'border-t-yellow-400',
  preparing: 'border-t-orange-400',
  ready: 'border-t-green-500',
  delayed: 'border-t-red-500',
  priority: 'border-t-purple-500',
}

interface KitchenCardProps {
  order: LiveOrder
}

function KitchenCard({ order }: KitchenCardProps) {
  const elapsed = order.preparingAt
    ? Math.round((Date.now() - new Date(order.preparingAt).getTime()) / 60_000)
    : null

  return (
    <article
      role="article"
      aria-label={`Order ${order.orderNumber}${order.slaBreached ? ', SLA breached' : ''}`}
      className={`bg-white rounded shadow p-3 mb-2 text-sm ${order.slaBreached ? 'border-l-4 border-red-500' : ''}`}
    >
      <div className="flex justify-between font-bold text-base">
        <span>#{order.orderNumber}</span>
        {order.tableNumber && <span className="text-gray-500" aria-label={`Table ${order.tableNumber}`}>T{order.tableNumber}</span>}
      </div>
      <div className="mt-1 space-y-0.5">
        {order.items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <span className="font-semibold">{it.quantity}×</span>
            <span className="truncate">{it.name}</span>
          </div>
        ))}
      </div>
      {order.items.some((it) => it.notes) && (
        <div className="mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
          {order.items
            .filter((it) => it.notes)
            .map((it, i) => <div key={i}>{it.name}: {it.notes}</div>)}
        </div>
      )}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        {elapsed !== null && <span>{elapsed}m elapsed</span>}
        <span>~{order.estimatedPrepMinutes}m target</span>
      </div>
      {order.slaBreached && (
        <div role="alert" className="text-xs font-bold text-red-600 mt-1">SLA BREACHED</div>
      )}
    </article>
  )
}

interface KitchenDisplayProps {
  branchId: string
  tenantId: string
}

export function KitchenDisplay({ branchId, tenantId }: KitchenDisplayProps) {
  const { data, isLoading, isError } = useKitchenStatus(branchId, tenantId)
  const cols = useOrderColumns(branchId, tenantId)

  if (isLoading) return <div className="text-sm text-gray-500 p-4">Loading kitchen queue…</div>
  if (isError) return <div className="text-sm text-red-500 p-4">Failed to load kitchen status.</div>

  return (
    <div>
      <div className="flex gap-4 mb-4 text-sm">
        <span className="bg-gray-100 rounded px-3 py-1">
          Queue: <strong>{data?.queueDepth ?? 0}</strong>
        </span>
        <span className="bg-gray-100 rounded px-3 py-1">
          Avg prep: <strong>{data?.averagePrepMinutes ?? 0}m</strong>
        </span>
        <span className={`rounded px-3 py-1 ${(data?.capacityPercent ?? 0) > 80 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
          Capacity: <strong>{data?.capacityPercent ?? 0}%</strong>
        </span>
      </div>
      <div className="overflow-x-auto" role="region" aria-label="Kitchen order columns">
        <div className="flex gap-3 min-w-max" role="list">
          {COLUMNS.map(({ key, label }) => {
            const orders = cols[key] as LiveOrder[]
            return (
              <div
                key={key}
                role="listitem"
                aria-label={`${label} column, ${orders.length} order${orders.length !== 1 ? 's' : ''}`}
                className={`w-52 flex-shrink-0 border-t-4 ${COLUMN_COLOR[key]} bg-gray-50 rounded p-2`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                  <span className="text-xs bg-white border rounded-full px-2" aria-hidden="true">{orders.length}</span>
                </div>
                {orders.length === 0 ? (
                  <div className="text-xs text-gray-400 italic" aria-label="No orders">Empty</div>
                ) : (
                  orders.map((o) => <KitchenCard key={o.id} order={o} />)
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
