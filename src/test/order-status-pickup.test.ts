import { describe, it, expect } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import {
  getNextOrderStatus,
  getOrderStatusMeta,
  getTerminalOrderStatuses,
  getTrackerStatusOrder,
  isPickupDeliveryRejectionError,
  isTerminalOrderStatus,
  PICKUP_DELIVERY_REJECTION_MESSAGE,
  resolveOrderStatus,
  resolveStatusUpdate,
  usesDineInFulfillment,
  usesPickupFulfillment,
} from '@/lib/order-status'
import type { Order } from '@/types'

function makePickupRejectionError(): AxiosError {
  return new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    {
      status: 400,
      data: {
        status_code: 400,
        code: 'invalid_order_status_transition',
        message: PICKUP_DELIVERY_REJECTION_MESSAGE,
      },
    } as AxiosResponse,
  )
}

const baseOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'ord-1',
  order_number: '#1001',
  branch_id: 'branch-1',
  items: [],
  order_type: 'delivery',
  status: 'ready',
  payment_method: 'card',
  payment_status: 'paid',
  subtotal: 10,
  discount_amount: 0,
  tax: 1,
  service_charge: 0,
  total: 11,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  status_history: [],
  ...overrides,
})

describe('order-status pickup workflow', () => {
  it('uses order_type as the pickup fulfillment signal', () => {
    expect(usesPickupFulfillment(baseOrder())).toBe(false)
    expect(usesPickupFulfillment(baseOrder({ order_type: 'pickup' }))).toBe(true)
    expect(usesPickupFulfillment(baseOrder({ order_type: 'delivery' }))).toBe(false)
    expect(usesPickupFulfillment(baseOrder({ order_type: 'dine_in' }))).toBe(false)
  })

  it('uses order_type as the dine-in fulfillment signal', () => {
    expect(usesDineInFulfillment(baseOrder())).toBe(false)
    expect(usesDineInFulfillment(baseOrder({ order_type: 'dine_in' }))).toBe(true)
    expect(usesDineInFulfillment(baseOrder({ order_type: 'pickup' }))).toBe(false)
  })

  it('calculates next status from order_type', () => {
    expect(getNextOrderStatus(baseOrder())).toBe('delivered')
    expect(getNextOrderStatus(baseOrder({ order_type: 'pickup' }))).toBe('picked_up')
    expect(getNextOrderStatus(baseOrder({ order_type: 'dine_in' }))).toBe('served')
  })

  it('defines dine-in tracker ending at served', () => {
    const dineIn = baseOrder({ order_type: 'dine_in' })
    expect(getTrackerStatusOrder(dineIn)).toEqual([
      'pending',
      'accepted',
      'preparing',
      'ready',
      'served',
    ])
    expect(getTerminalOrderStatuses(dineIn)).toEqual(['served'])
    expect(isTerminalOrderStatus({ ...dineIn, status: 'served' })).toBe(true)
    expect(isTerminalOrderStatus({ ...dineIn, status: 'delivered' })).toBe(false)
    expect(getNextOrderStatus({ ...dineIn, status: 'served' })).toBeUndefined()
  })

  it('calculates next status from backend alias statuses', () => {
    expect(getNextOrderStatus(baseOrder({ status: 'confirmed' as Order['status'] }))).toBe('preparing')
    expect(getNextOrderStatus(baseOrder({ status: 'processing' as Order['status'] }))).toBe('ready')
  })

  it('resolves delivered to terminal status per order type', () => {
    expect(resolveStatusUpdate(baseOrder(), 'delivered')).toBe('delivered')
    expect(resolveStatusUpdate(baseOrder({ order_type: 'pickup' }), 'delivered')).toBe('picked_up')
    expect(resolveStatusUpdate(baseOrder({ order_type: 'dine_in' }), 'delivered')).toBe('served')
  })

  it('detects the exact pickup delivery rejection error', () => {
    expect(isPickupDeliveryRejectionError(makePickupRejectionError())).toBe(true)
    expect(isPickupDeliveryRejectionError(new Error('nope'))).toBe(false)
  })

  it('resolves backend alias statuses for workflow logic', () => {
    expect(resolveOrderStatus('confirmed')).toBe('accepted')
    expect(resolveOrderStatus('processing')).toBe('preparing')
    expect(resolveOrderStatus('completed')).toBe('delivered')
    expect(resolveOrderStatus('completed', 'dine_in')).toBe('served')
    expect(resolveOrderStatus('rejected')).toBe('cancelled')
    expect(resolveOrderStatus('unknown-status')).toBe('pending')
  })

  it('returns display metadata for backend alias statuses', () => {
    expect(getOrderStatusMeta('confirmed').labelKey).toBe('confirmed')
    expect(getOrderStatusMeta('processing').badge).toBe('purple')
    expect(getOrderStatusMeta('completed').badge).toBe('success')
    expect(getOrderStatusMeta('rejected').badge).toBe('danger')
  })

  it('falls back to pending metadata for unknown statuses', () => {
    expect(getOrderStatusMeta('totally-unknown').labelKey).toBe('pending')
    expect(getOrderStatusMeta('totally-unknown').badge).toBe('warning')
  })
})
