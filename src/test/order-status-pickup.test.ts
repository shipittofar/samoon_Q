import { describe, it, expect } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import {
  getNextOrderStatus,
  isPickupDeliveryRejectionError,
  PICKUP_DELIVERY_REJECTION_MESSAGE,
  resolveStatusUpdate,
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
  it('uses order_type as the only pickup fulfillment signal', () => {
    expect(usesPickupFulfillment(baseOrder())).toBe(false)
    expect(usesPickupFulfillment(baseOrder({ order_type: 'pickup' }))).toBe(true)
    expect(usesPickupFulfillment(baseOrder({ order_type: 'delivery' }))).toBe(false)
    expect(usesPickupFulfillment(baseOrder({ order_type: 'dine_in' }))).toBe(false)
  })

  it('calculates next status from order_type', () => {
    expect(getNextOrderStatus(baseOrder())).toBe('delivered')
    expect(getNextOrderStatus(baseOrder({ order_type: 'pickup' }))).toBe('picked_up')
  })

  it('resolves delivered to picked_up only for pickup orders', () => {
    expect(resolveStatusUpdate(baseOrder(), 'delivered')).toBe('delivered')
    expect(resolveStatusUpdate(baseOrder({ order_type: 'pickup' }), 'delivered')).toBe('picked_up')
  })

  it('detects the exact pickup delivery rejection error', () => {
    expect(isPickupDeliveryRejectionError(makePickupRejectionError())).toBe(true)
    expect(isPickupDeliveryRejectionError(new Error('nope'))).toBe(false)
  })
})
