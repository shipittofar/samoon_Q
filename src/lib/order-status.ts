import { AxiosError } from 'axios'
import {
  CheckCircle,
  ChefHat,
  Clock,
  Package,
  Truck,
  UtensilsCrossed,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { Order, OrderStatus, OrderType } from '@/types'
import { ORDER_STATUS_LABELS } from '@/constants'

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
  served: {
    labelKey: 'served',
    icon: UtensilsCrossed,
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

/** Backend console-orders statuses not in the canonical OrderStatus union. */
const BACKEND_ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  confirmed: {
    labelKey: 'confirmed',
    icon: CheckCircle,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    badge: 'info',
  },
  processing: {
    labelKey: 'processing',
    icon: ChefHat,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    badge: 'purple',
  },
  completed: {
    labelKey: 'completed',
    icon: Truck,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    badge: 'success',
  },
  rejected: {
    labelKey: 'rejected',
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'danger',
  },
}

/** Map backend alias statuses onto canonical workflow statuses. */
export const BACKEND_ORDER_STATUS_ALIASES: Partial<Record<string, OrderStatus>> = {
  confirmed: 'accepted',
  processing: 'preparing',
  completed: 'delivered',
  rejected: 'cancelled',
}

export function resolveOrderStatus(status: string, orderType?: OrderType): OrderStatus {
  if (status in ORDER_STATUS_CONFIG) return status as OrderStatus
  if (orderType === 'dine_in' && status === 'completed') return 'served'
  return BACKEND_ORDER_STATUS_ALIASES[status] ?? 'pending'
}

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  if (status in ORDER_STATUS_CONFIG) return ORDER_STATUS_CONFIG[status as OrderStatus]
  if (status in BACKEND_ORDER_STATUS_META) return BACKEND_ORDER_STATUS_META[status]
  return ORDER_STATUS_CONFIG.pending
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

const DINE_IN_STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'served',
}

/** Dine-in orders complete at served — not delivered or picked_up. */
export function usesDineInFulfillment(order: Pick<Order, 'order_type'>): boolean {
  return order.order_type === 'dine_in'
}

/** Pickup orders complete at picked_up instead of delivered. */
export function usesPickupFulfillment(order: Pick<Order, 'order_type'>): boolean {
  return order.order_type === 'pickup'
}

export function getNextOrderStatus(order: OrderStatusContext): OrderStatus | undefined {
  const resolved = resolveOrderStatus(order.status, order.order_type)
  const nextMap = usesDineInFulfillment(order)
    ? DINE_IN_STATUS_NEXT
    : usesPickupFulfillment(order)
      ? PICKUP_STATUS_NEXT
      : DELIVERY_STATUS_NEXT
  return nextMap[resolved]
}

/** Defensive guard when callers pass an explicit status instead of getNextOrderStatus(). */
export function resolveStatusUpdate(
  order: OrderStatusContext | undefined,
  status: OrderStatus,
): OrderStatus {
  if (!order) return status
  if (status === 'delivered' && usesDineInFulfillment(order)) return 'served'
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

export const DINE_IN_TRACKER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'served',
]

export function getTrackerStatusOrder(order?: OrderStatusContext): OrderStatus[] {
  if (order && usesDineInFulfillment(order)) return DINE_IN_TRACKER_STATUSES
  if (order && usesPickupFulfillment(order)) return PICKUP_TRACKER_STATUSES
  return DELIVERY_TRACKER_STATUSES
}

/** Terminal statuses per order type — no further customer/admin progression. */
export function getTerminalOrderStatuses(order?: OrderStatusContext): OrderStatus[] {
  if (order && usesDineInFulfillment(order)) return ['served']
  if (order && usesPickupFulfillment(order)) return ['picked_up']
  return ['delivered']
}

export function isTerminalOrderStatus(order: OrderStatusContext): boolean {
  const resolved = resolveOrderStatus(order.status, order.order_type)
  return getTerminalOrderStatuses(order).includes(resolved)
}

export function getOrderStatusBadgeVariant(status: OrderStatus): OrderStatusBadgeVariant {
  return getOrderStatusMeta(status).badge
}

/** `order.status.*` i18n suffix — always resolves aliases to a defined label key. */
export function getOrderStatusLabelKey(status: string): string {
  return getOrderStatusMeta(status).labelKey
}

/** Scoped `useTranslations('order')` — resolves `status.<labelKey>` with a safe fallback. */
export type OrderStatusTranslator = {
  has: (key: string) => boolean
  (key: string): string
}

/** Translate an order status label via `order.status.*`, never emitting MISSING_MESSAGE. */
export function translateOrderStatusLabel(tOrder: OrderStatusTranslator, labelKey: string): string {
  const key = `status.${labelKey}`
  if (tOrder.has(key)) return tOrder(key)
  return ORDER_STATUS_LABELS[labelKey] ?? labelKey.replace(/_/g, ' ')
}
