'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { LiveOrder } from '@/types/realtime-operations'
import { useKitchenStatus } from '@/hooks'

const COLUMNS: { key: keyof ReturnType<typeof useOrderColumns>; labelKey: string }[] = [
  { key: 'pending', labelKey: 'statusPending' },
  { key: 'preparing', labelKey: 'statusPreparing' },
  { key: 'ready', labelKey: 'statusReady' },
  { key: 'delayed', labelKey: 'delayed' },
  { key: 'priority', labelKey: 'priority' },
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
  const t = useTranslations('console')
  const elapsed = order.preparingAt
    ? Math.round((Date.now() - new Date(order.preparingAt).getTime()) / 60_000)
    : null

  return (
    <article
      role="article"
      aria-label={order.slaBreached ? t('orderSlaBreachedAria', { number: order.orderNumber }) : t('orderNumberAria', { number: order.orderNumber })}
      className={`bg-[var(--card)] rounded shadow p-3 mb-2 text-sm ${order.slaBreached ? 'border-l-4 border-[var(--danger)]' : ''}`}
    >
      <div className="flex justify-between font-bold text-base">
        <span>#{order.orderNumber}</span>
        {order.tableNumber && <span className="text-[var(--fg-muted)]"aria-label={t('tableNumberLabel', { number: order.tableNumber })}>T{order.tableNumber}</span>}
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
        <div className="mt-1 text-xs text-[var(--warning-text)] bg-[var(--warning-subtle)] rounded px-2 py-1">
          {order.items
            .filter((it) => it.notes)
            .map((it, i) => <div key={i}>{it.name}: {it.notes}</div>)}
        </div>
      )}
      <div className="flex justify-between mt-2 text-xs text-[var(--fg-muted)]">
        {elapsed !== null && <span>{t('minutesElapsed', { minutes: elapsed })}</span>}
        <span>{t('minutesTarget', { minutes: order.estimatedPrepMinutes })}</span>
      </div>
      {order.slaBreached && (
        <div role="alert"className="text-xs font-bold text-[var(--danger-text)] mt-1">{t('slaBreached')}</div>
      )}
    </article>
  )
}

interface KitchenDisplayProps {
  branchId: string
  tenantId: string
}

export function KitchenDisplay({ branchId, tenantId }: KitchenDisplayProps) {
  const t = useTranslations('console')
  const { data, isLoading, isError } = useKitchenStatus(branchId, tenantId)
  const cols = useOrderColumns(branchId, tenantId)

  if (isLoading) return <div className="text-sm text-[var(--fg-muted)] p-4">{t('loadingKitchenQueue')}</div>
  if (isError) return <div className="text-sm text-[var(--danger-text)] p-4">{t('failedToLoadKitchenStatus')}</div>

  return (
    <div>
      <div className="flex gap-4 mb-4 text-sm">
        <span className="bg-[var(--card-hover)] rounded px-3 py-1">
          {t('queueDepthLabel', { depth: data?.queueDepth ?? 0 })}
        </span>
        <span className="bg-[var(--card-hover)] rounded px-3 py-1">
          {t('avgPrepLabel', { minutes: data?.averagePrepMinutes ?? 0 })}
        </span>
        <span className={`rounded px-3 py-1 ${(data?.capacityPercent ?? 0) > 80 ? 'bg-[var(--danger-subtle)] text-[var(--danger-text)]' : 'bg-[var(--card-hover)]'}`}>
          {t('capacityLabel', { percent: data?.capacityPercent ?? 0 })}
        </span>
      </div>
      <div className="overflow-x-auto"role="region"aria-label={t('kitchenOrderColumnsAria')}>
        <div className="flex gap-3 min-w-max"role="list">
          {COLUMNS.map(({ key, labelKey }) => {
            const orders = cols[key] as LiveOrder[]
            const label = t(labelKey)
            return (
              <div
                key={key}
                role="listitem"
                aria-label={t('columnOrdersCountAria', { column: label, count: orders.length })}
                className={`w-52 flex-shrink-0 border-t-4 ${COLUMN_COLOR[key]} bg-[var(--card-hover)] rounded p-2`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                  <span className="text-xs bg-[var(--card)] border rounded-full px-2"aria-hidden="true">{orders.length}</span>
                </div>
                {orders.length === 0 ? (
                  <div className="text-xs text-[var(--fg-subtle)] italic"aria-label={t('noOrdersAria')}>{t('empty')}</div>
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
