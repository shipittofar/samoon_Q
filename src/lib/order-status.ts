import { AxiosError } from 'axios'
import { humanizeWireValue } from '@/lib/humanize'
import type { Order, OrderStatusTimelineEntry } from '@/types'

interface ApiErrorBody {
  status_code?: number
  code?: string
  message?: string
}

export function getOrderStatusLabel(
  order: Pick<Order, 'status' | 'status_label'>,
): string {
  return order.status_label ?? humanizeWireValue(order.status)
}

export function getPaymentStatusLabel(
  order: Pick<Order, 'payment_status' | 'payment_status_label'>,
): string {
  return order.payment_status_label ?? humanizeWireValue(order.payment_status)
}

export function getReservationStatusLabel(
  reservation: { status: string; status_label?: string },
): string {
  return reservation.status_label ?? humanizeWireValue(reservation.status)
}

export function normalizeAllowedTransitions(
  transitions: Order['allowed_transitions'],
): Array<{ status: string; label: string }> {
  if (!transitions?.length) return []
  return transitions.map((entry) => {
    if (typeof entry === 'string') {
      return { status: entry, label: humanizeWireValue(entry) }
    }
    return {
      status: entry.status,
      label: entry.label ?? humanizeWireValue(entry.status),
    }
  })
}

export function getOrderStatusTimeline(order: Order): OrderStatusTimelineEntry[] {
  if (order.status_timeline?.length) return order.status_timeline
  if (order.status_history?.length) {
    return order.status_history.map((entry) => ({
      status: entry.status,
      label: entry.status_label ?? humanizeWireValue(entry.status),
      timestamp: entry.timestamp,
      description: entry.note,
      completed: true,
    }))
  }
  return []
}

export function isInvalidOrderStatusTransitionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const axiosError = error as AxiosError<ApiErrorBody>
  const body = axiosError.response?.data
  if (!body) return false
  return (
    axiosError.response?.status === 400 &&
    body.code === 'invalid_order_status_transition'
  )
}

/** @deprecated Use isInvalidOrderStatusTransitionError */
export function isPickupDeliveryRejectionError(error: unknown): boolean {
  return isInvalidOrderStatusTransitionError(error)
}
