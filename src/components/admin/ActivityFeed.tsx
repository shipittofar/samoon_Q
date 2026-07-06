'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { OperationsEvent, OperationsScope, OperationsEventPriority } from '@/types/realtime-operations'
import { useOperationsStream } from '@/hooks'

const PRIORITY_BADGE: Record<OperationsEventPriority, string> = {
  low: 'bg-blue-100 text-blue-700',
  normal: 'bg-gray-100 text-gray-600',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-800 font-semibold',
}

const PRIORITY_KEY: Record<OperationsEventPriority, string> = {
  low: 'priorityLow',
  normal: 'priorityNormal',
  high: 'priorityHigh',
  critical: 'priorityCritical',
}

const EVENT_TYPE_KEY: Record<string, string> = {
  LIVE_ORDER_CREATED: 'orderCreated',
  LIVE_ORDER_UPDATED: 'orderUpdated',
  LIVE_ORDER_CANCELLED: 'orderCancelledEvent',
  LIVE_RESERVATION_CREATED: 'reservationCreated',
  LIVE_RESERVATION_UPDATED: 'reservationUpdated',
  LIVE_RESERVATION_CANCELLED: 'reservationCancelledEvent',
  LIVE_RESERVATION_CHECKED_IN: 'guestCheckedIn',
  STAFF_STATUS_CHANGED: 'staffStatusChanged',
  STAFF_PRESENCE_UPDATED: 'staffPresenceUpdated',
  BRANCH_STATUS_CHANGED: 'branchStatusChanged',
  BRANCH_HEALTH_UPDATED: 'branchHealthUpdated',
  LIVE_NOTIFICATION: 'notificationEvent',
  LIVE_AUDIT_EVENT: 'auditEvent',
  SLA_ALERT_RAISED: 'slaAlertRaised',
  SLA_ALERT_RESOLVED: 'slaAlertResolved',
  KITCHEN_QUEUE_UPDATED: 'kitchenQueueUpdated',
  METRICS_UPDATED: 'metricsUpdated',
  SYSTEM_ALERT: 'systemAlert',
}

function resolveDeepLink(event: OperationsEvent): string | null {
  const payload = event.payload
  switch (event.type) {
    case 'LIVE_ORDER_CREATED':
    case 'LIVE_ORDER_UPDATED':
    case 'LIVE_ORDER_CANCELLED':
      if (payload.orderId) return `/console/orders/${payload.orderId}`
      break
    case 'LIVE_RESERVATION_CREATED':
    case 'LIVE_RESERVATION_UPDATED':
    case 'LIVE_RESERVATION_CANCELLED':
    case 'LIVE_RESERVATION_CHECKED_IN':
      if (payload.reservationId) return `/console/reservations/${payload.reservationId}`
      break
    case 'STAFF_STATUS_CHANGED':
    case 'STAFF_PRESENCE_UPDATED':
      if (payload.userId) return `/console/staff/${payload.userId}`
      break
    case 'BRANCH_STATUS_CHANGED':
    case 'BRANCH_HEALTH_UPDATED':
      if (event.scope.branchId) return `/console/branches/${event.scope.branchId}`
      break
    case 'LIVE_AUDIT_EVENT':
      if (payload.auditId) return `/console/audit-logs/${payload.auditId}`
      break
    case 'LIVE_NOTIFICATION':
      if (payload.notificationId) return `/console/notifications/${payload.notificationId}`
      break
  }
  return null
}

interface ActivityItemProps {
  event: OperationsEvent
}

function ActivityItem({ event }: ActivityItemProps) {
  const t = useTranslations('console')
  const tNotifications = useTranslations('notifications')
  const occurred = new Date(event.occurredAt)
  const minutesAgo = Math.round((Date.now() - occurred.getTime()) / 60_000)
  const timeStr =
    minutesAgo < 1
      ? t('justNow')
      : minutesAgo < 60
      ? t('minutesAgoShort', { minutes: minutesAgo })
      : occurred.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const deepLink = resolveDeepLink(event)
  const eventTypeKey = EVENT_TYPE_KEY[event.type]
  const label = eventTypeKey ? t(`eventTypes.${eventTypeKey}`) : event.type

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
      <div className="flex-shrink-0 mt-0.5">
        <span className={`text-xs rounded px-1.5 py-0.5 ${PRIORITY_BADGE[event.priority]}`}>
          {t(PRIORITY_KEY[event.priority])}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {deepLink ? (
            <Link href={deepLink} className="text-xs text-blue-600 hover:underline">
              {t('viewArrow')}
            </Link>
          ) : null}
        </div>
        {event.actor && (
          <div className="text-xs text-gray-500">
            {tNotifications('byActor', { name: event.actor.name })}
          </div>
        )}
        {event.scope.branchId && (
          <div className="text-xs text-gray-400">{t('branchIdLabel', { id: event.scope.branchId })}</div>
        )}
      </div>
      <div className="flex-shrink-0 text-xs text-gray-400">{timeStr}</div>
    </div>
  )
}

interface ActivityFeedProps {
  scope: OperationsScope
  limit?: number
}

export function ActivityFeed({ scope, limit = 50 }: ActivityFeedProps) {
  const t = useTranslations('console')
  const { data: events = [], isLoading, isError } = useOperationsStream(scope, limit)

  if (isLoading) return <div className="text-sm text-gray-500 p-4">{t('loadingActivity')}</div>
  if (isError) return <div className="text-sm text-red-500 p-4">{t('failedToLoadActivityFeed')}</div>

  const sorted = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )

  if (sorted.length === 0) {
    return <div className="text-sm text-gray-400 italic p-4 text-center">{t('noRecentActivity')}</div>
  }

  return (
    <div className="divide-y divide-gray-100">
      {sorted.map((event) => (
        <ActivityItem key={event.id} event={event} />
      ))}
    </div>
  )
}
