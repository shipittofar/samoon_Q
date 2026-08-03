import { describe, expect, it } from 'vitest'
import {
  getOrderStatusLabel,
  getPaymentStatusLabel,
  normalizeAllowedTransitions,
  getOrderStatusTimeline,
} from '@/lib/order-status'

describe('order-status — backend-driven display', () => {
  it('getOrderStatusLabel prefers backend label', () => {
    expect(getOrderStatusLabel({ status: 'robot_delivery', status_label: 'Robot Delivery' })).toBe(
      'Robot Delivery',
    )
  })

  it('getOrderStatusLabel humanizes unknown status', () => {
    expect(getOrderStatusLabel({ status: 'robot_delivery' })).toBe('Robot Delivery')
  })

  it('normalizeAllowedTransitions maps string entries', () => {
    expect(normalizeAllowedTransitions(['accepted', 'cancelled'])).toEqual([
      { status: 'accepted', label: 'Accepted' },
      { status: 'cancelled', label: 'Cancelled' },
    ])
  })

  it('getOrderStatusTimeline prefers status_timeline', () => {
    const timeline = getOrderStatusTimeline({
      id: '1',
      order_number: '1',
      branch_id: 'b',
      items: [],
      order_type: 'delivery',
      status: 'preparing',
      payment_method: 'card',
      payment_status: 'paid',
      subtotal: 10,
      discount_amount: 0,
      tax: 0,
      service_charge: 0,
      total: 10,
      created_at: '',
      updated_at: '',
      status_history: [],
      status_timeline: [
        { status: 'pending', label: 'Placed', completed: true },
        { status: 'preparing', label: 'Cooking', current: true },
      ],
    })
    expect(timeline).toHaveLength(2)
    expect(timeline[1].label).toBe('Cooking')
  })
})
