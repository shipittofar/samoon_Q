import { describe, it, expect } from 'vitest'
import {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  checkoutConfigKeyToWire,
  filterDeliveryCapabilities,
} from '@/lib/checkout-options'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

describe('checkout-options — backend-driven discovery', () => {
  it('discovers enabled order types dynamically from checkout.orderTypes', () => {
    const checkout = {
      ...DEFAULT_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: {
        delivery: true,
        pickup: false,
        dineIn: true,
        driveThrough: true,
        default: 'drive_through',
      },
    }
    const options = getCheckoutOrderTypeOptions(checkout)
    expect(options.map((o) => o.wireType)).toEqual(['delivery', 'dine_in', 'drive_through'])
  })

  it('maps camelCase config keys to snake_case wire values', () => {
    expect(checkoutConfigKeyToWire('dineIn')).toBe('dine_in')
    expect(checkoutConfigKeyToWire('driveThrough')).toBe('drive_through')
  })

  it('resolveCheckoutOrderWireType uses backend default without frontend enum', () => {
    const checkout = {
      ...DEFAULT_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: {
        delivery: false,
        pickup: true,
        dineIn: false,
        default: 'pickup',
      },
    }
    expect(resolveCheckoutOrderWireType(checkout, null)).toBe('pickup')
    expect(resolveCheckoutOrderWireType(checkout, 'invalid')).toBe('pickup')
  })

  it('discovers payment methods dynamically including new keys', () => {
    const checkout = {
      ...DEFAULT_BRANCH_CHECKOUT,
      orderingEnabled: true,
      payments: {
        cash: false,
        cashOnDelivery: false,
        card: true,
        online: false,
        wallet: false,
        applePay: true,
        default: 'apple_pay',
      },
    }
    const options = getCheckoutPaymentOptions(checkout, 'pickup')
    expect(options.map((o) => o.wireMethod)).toEqual(['card', 'apple_pay'])
  })

  it('filterDeliveryCapabilities respects checkout.delivery flags', () => {
    const filtered = filterDeliveryCapabilities(
      {
        cash_on_delivery: true,
        scheduled_delivery: true,
        same_day: true,
        contactless_delivery: true,
      },
      {
        ...DEFAULT_BRANCH_CHECKOUT,
        delivery: {
          ...DEFAULT_BRANCH_CHECKOUT.delivery,
          scheduled: false,
          contactless: false,
        },
      },
    )
    expect(filtered).toEqual({
      cash_on_delivery: true,
      scheduled_delivery: false,
      same_day: true,
      contactless_delivery: false,
    })
  })
})
