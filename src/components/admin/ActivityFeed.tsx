'use client'

import Link from 'next/link'
import type { OperationsEvent, OperationsScope, OperationsEventPriority } from '@/types/realtime-operations'
import { useOperationsStream } from '@/hooks'

const PRIORITY_BADGE: Record<OperationsEventPriority, string> = {
  low: 'bg-blue-100 text-blue-700',
  normal: 'bg-gray-100 text-gray-600',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-800 font-semibold',
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  LIVE_ORDER_CREATED: 'Order Created',
  LIVE_ORDER_UPDATED: 'Order Updated',
  LIVE_ORDER_CANCELLED: 'Order Cancelled',
  LIVE_RESERVATION_CREATED: 'Reservation Created',
  LIVE_RESERVATION_UPDATED: 'Reservation Updated',
  LIVE_RESERVATION_CANCELLED: 'Reservation Cancelled',
  LIVE_RESERVATION_CHECKED_IN: 'Guest Checked In',
  STAFF_STATUS_CHANGED: 'Staff Status Changed',
  STAFF_PRESENCE_UPDATED: 'Staff Presence Updated',
  BRANCH_STATUS_CHANGED: 'Branch Status Changed',
  BRANCH_HEALTH_UPDATED: 'Branch Health Updated',
  LIVE_NOTIFICATION: 'Notification',
  LIVE_AUDIT_EVENT: 'Audit Event',
  SLA_ALERT_RAISED: 'SLA Alert Raised',
  SLA_ALERT_RESOLVED: 'SLA Alert Resolved',
  KITCHEN_QUEUE_UPDATED: 'Kitchen Queue Updated',
  METRICS_UPDATED: 'Metrics Updated',
  SYSTEM_ALERT: 'System Alert',
}

function resolveDeepLink(event: OperationsEvent): string | null {
  const payload = event.payload
  switch (event.type) {
    case 'LIVE_ORDER_CREATED':
    case 'LIVE_ORDER_UPDATED':
    case 'LIVE_ORDER_CANCELLED':
      if (payload.orderId) return `/admin/orders/${payload.orderId}`
      break
    case 'LIVE_RESERVATION_CREATED':
    case 'LIVE_RESERVATION_UPDATED':
    case 'LIVE_RESERVATION_CANCELLED':
    case 'LIVE_RESERVATION_CHECKED_IN':
      if (payload.reservationId) return `/admin/reservations/${payload.reservationId}`
      break
    case 'STAFF_STATUS_CHANGED':
    case 'STAFF_PRESENCE_UPDATED':
      if (payload.userId) return `/admin/staff/${payload.userId}`
      break
    case 'BRANCH_STATUS_CHANGED':
    case 'BRANCH_HEALTH_UPDATED':
      if (event.scope.branchId) return `/admin/branches/${event.scope.branchId}`
      break
    case 'LIVE_AUDIT_EVENT':
      if (payload.auditId) return `/admin/audit-logs/${payload.auditId}`
      break
    case 'LIVE_NOTIFICATION':
      if (payload.notificationId) return `/admin/notifications/${payload.notificationId}`
      break
  }
  return null
}

interface ActivityItemProps {
  event: OperationsEvent
}

function ActivityItem({ event }: ActivityItemProps) {
  const occurred = new Date(event.occurredAt)
  const minutesAgo = Math.round((Date.now() - occurred.getTime()) / 60_000)
  const timeStr =
    minutesAgo < 1
      ? 'Just now'
      : minutesAgo < 60
      ? `${minutesAgo}m ago`
      : occurred.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const deepLink = resolveDeepLink(event)
  const label = EVENT_TYPE_LABEL[event.type] ?? event.type

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
      <div className="flex-shrink-0 mt-0.5">
        <span className={`text-xs rounded px-1.5 py-0.5 ${PRIORITY_BADGE[event.priority]}`}>
          {event.priority}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {deepLink ? (
            <Link href={deepLink} className="text-xs text-blue-600 hover:underline">
              View →
            </Link>
          ) : null}
        </div>
        {event.actor && (
          <div className="text-xs text-gray-500">
            by {event.actor.name}
          </div>
        )}
        {event.scope.branchId && (
          <div className="text-xs text-gray-400">Branch: {event.scope.branchId}</div>
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
  const { data: events = [], isLoading, isError } = useOperationsStream(scope, limit)

  if (isLoading) return <div className="text-sm text-gray-500 p-4">Loading activity…</div>
  if (isError) return <div className="text-sm text-red-500 p-4">Failed to load activity feed.</div>

  const sorted = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )

  if (sorted.length === 0) {
    return <div className="text-sm text-gray-400 italic p-4 text-center">No recent activity</div>
  }

  return (
    <div className="divide-y divide-gray-100">
      {sorted.map((event) => (
        <ActivityItem key={event.id} event={event} />
      ))}
    </div>
  )
}
