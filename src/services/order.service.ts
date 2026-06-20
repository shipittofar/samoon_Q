import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_ORDERS } from '@/lib/mock-data'
import type { Order, OrderType, PaymentMethod, PaginatedResponse } from '@/types'
import type { CartItem } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms))

export interface CreateOrderPayload {
  branch_id: string
  items: { menu_item_id: string; quantity: number; notes?: string; extras: string[] }[]
  order_type: OrderType
  payment_method: PaymentMethod
  delivery_address?: {
    street: string
    city: string
    state?: string
    zip?: string
    lat?: number
    lng?: number
  }
  table_number?: number
  discount_code?: string
  notes?: string
}

let mockOrderCounter = 3902

export const orderService = {
  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    if (USE_MOCK) {
      await delay(1200)
      const order: Partial<Order> = {
        id: `ord-${Date.now()}`,
        order_number: `#${mockOrderCounter++}`,
        status: 'pending',
        order_type: payload.order_type,
        payment_method: payload.payment_method,
        payment_status: 'paid',
        branch_id: payload.branch_id,
        notes: payload.notes,
        table_number: payload.table_number,
        subtotal: 0,
        discount_amount: 0,
        tax: 0,
        service_charge: 0,
        total: Math.random() * 80 + 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status_history: [{ status: 'pending', timestamp: new Date().toISOString() }],
        items: [],
      }
      return order as Order
    }
    const { data } = await api.post<Order>(ENDPOINTS.ORDERS.CREATE, payload)
    return data
  },

  async getOrders(page = 1): Promise<PaginatedResponse<Order>> {
    if (USE_MOCK) {
      await delay(600)
      return { count: MOCK_ORDERS.length, next: null, previous: null, results: MOCK_ORDERS as Order[] }
    }
    const { data } = await api.get<PaginatedResponse<Order>>(ENDPOINTS.ORDERS.LIST, {
      params: { page },
    })
    return data
  },

  async getOrder(id: string): Promise<Order> {
    if (USE_MOCK) {
      await delay(400)
      const order = MOCK_ORDERS.find((o) => o.id === id)
      if (!order) throw new Error('Order not found')
      return order as Order
    }
    const { data } = await api.get<Order>(ENDPOINTS.ORDERS.DETAIL(id))
    return data
  },

  async cancelOrder(id: string): Promise<Order> {
    if (USE_MOCK) {
      await delay(600)
      const order = MOCK_ORDERS.find((o) => o.id === id)
      return { ...order, status: 'cancelled' } as Order
    }
    const { data } = await api.post<Order>(ENDPOINTS.ORDERS.CANCEL(id))
    return data
  },

  async validateDiscountCode(code: string, subtotal: number): Promise<{
    valid: boolean
    discount_type: 'percent' | 'fixed'
    discount_value: number
    discount_amount: number
    message?: string
  }> {
    if (USE_MOCK) {
      await delay(600)
      if (code.toUpperCase() === 'SAVE10') {
        return { valid: true, discount_type: 'percent', discount_value: 10, discount_amount: subtotal * 0.1 }
      }
      if (code.toUpperCase() === 'WEEKEND20') {
        return { valid: true, discount_type: 'percent', discount_value: 20, discount_amount: subtotal * 0.2 }
      }
      if (code.toUpperCase() === 'FIRST5') {
        return { valid: true, discount_type: 'fixed', discount_value: 5, discount_amount: 5 }
      }
      return { valid: false, discount_type: 'percent', discount_value: 0, discount_amount: 0, message: 'Invalid discount code' }
    }
    const { data } = await api.post(ENDPOINTS.ORDERS.VALIDATE_DISCOUNT, { code, subtotal })
    return data
  },

  fromCartItems(items: CartItem[]): CreateOrderPayload['items'] {
    return items.map((ci) => ({
      menu_item_id: ci.menu_item.id,
      quantity: ci.quantity,
      notes: ci.notes,
      extras: ci.extras.map((e) => e.id),
    }))
  },
}
