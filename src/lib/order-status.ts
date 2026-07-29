import { AxiosError } from 'axios'
import {
  CheckCircle,
  ChefHat,
  Clock,
  Package,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { Order, OrderStatus } from '@/types'

export const PICKUP_DELIVERY_REJECTION_MESSAGE =
  'Only delivery orders can be marked as out for delivery.'

interface ApiErrorBody {
  status_code?: number
  code?: string
  message?: string
}

export type OrderStatusBadgeVariant =
  | 'warning'
  | 'info'
  | 'purple'
  | 'success'
  | 'danger'
  | 'secondary'

export interface OrderStatusMeta {
  labelKey: string
  icon: LucideIcon
  color: string
  bg: string
  badge: OrderStatusBadgeVariant
}

export type OrderStatusContext = Pick<Order, 'status' | 'order_type'>

export const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusMeta> = {
  pending: {
    labelKey: 'pending',
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    badge: 'warning',
  },
  accepted: {
    labelKey: 'accepted',
    icon: CheckCircle,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    badge: 'info',
  },
  preparing: {
    labelKey: 'preparing',
    icon: ChefHat,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    badge: 'purple',
  },
  ready: {
    labelKey: 'ready',
    icon: Package,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    badge: 'success',
  },
  delivered: {
    labelKey: 'delivered',
    icon: Truck,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    badge: 'success',
  },
  picked_up: {
    labelKey: 'picked_up',
    icon: Truck,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    badge: 'success',
  },
  cancelled: {
    labelKey: 'cancelled',
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'danger',
  },
}

const DELIVERY_STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

const PICKUP_STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'picked_up',
}

/** Single source of truth: whether an order completes via picked_up instead of delivered. */
export function usesPickupFulfillment(order: Pick<Order, 'order_type'>): boolean {
  return order.order_type === 'pickup'
}

export function getNextOrderStatus(order: OrderStatusContext): OrderStatus | undefined {
  const nextMap = usesPickupFulfillment(order) ? PICKUP_STATUS_NEXT : DELIVERY_STATUS_NEXT
  return nextMap[order.status]
}

/** Defensive guard when callers pass an explicit status instead of getNextOrderStatus(). */
export function resolveStatusUpdate(
  order: OrderStatusContext | undefined,
  status: OrderStatus,
): OrderStatus {
  if (!order) return status
  if (status === 'delivered' && usesPickupFulfillment(order)) return 'picked_up'
  return status
}

export function isPickupDeliveryRejectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const axiosError = error as AxiosError<ApiErrorBody>
  const body = axiosError.response?.data
  if (!body) return false
  return (
    axiosError.response?.status === 400 &&
    body.code === 'invalid_order_status_transition' &&
    body.message === PICKUP_DELIVERY_REJECTION_MESSAGE
  )
}

export const DELIVERY_TRACKER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'delivered',
]

export const PICKUP_TRACKER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
]

export function getTrackerStatusOrder(order?: OrderStatusContext): OrderStatus[] {
  return order && usesPickupFulfillment(order) ? PICKUP_TRACKER_STATUSES : DELIVERY_TRACKER_STATUSES
}

export function getOrderStatusBadgeVariant(status: OrderStatus): OrderStatusBadgeVariant {
  return ORDER_STATUS_CONFIG[status]?.badge ?? 'secondary'
}
