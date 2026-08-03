import { describe, it, expect } from 'vitest'
import {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  checkoutConfigKeyToWire,
  filterDeliveryCapabilities,
  getCheckoutPaymentConfigKeyLabel,
  getCheckoutOrderTypeConfigKeyLabel,
  getCheckoutDeliveryOptionLabel,
  humanizePaymentWireMethod,
  humanizeOrderWireType,
  isPaymentConfigEnabled,
  paymentConfigRequiresPaymentIntent,
  isOrderTypeConfigEnabled,
  getCheckoutPaymentConfigKeys,
  getCheckoutOrderTypeConfigKeys,
} from '@/lib/checkout-options'
import { EMPTY_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

describe('checkout-options — backend-driven discovery', () => {
  it('discovers enabled order types dynamically from checkout.orderTypes', () => {
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: {
        delivery: { enabled: true, requiresDeliveryAddress: true },
        driveThrough: true,
        curbside: { enabled: true, fulfillmentMode: 'pickup' },
        default: 'driveThrough',
      },
    }
    const options = getCheckoutOrderTypeOptions(checkout)
    expect(options.map((o) => o.wireType)).toEqual(['delivery', 'drive_through', 'curbside'])
    expect(options.find((o) => o.configKey === 'delivery')?.requiresDeliveryAddress).toBe(true)
    expect(options.find((o) => o.configKey === 'curbside')?.fulfillmentMode).toBe('pickup')
  })

  it('maps camelCase config keys to snake_case wire values', () => {
    expect(checkoutConfigKeyToWire('dineIn')).toBe('dine_in')
    expect(checkoutConfigKeyToWire('driveThrough')).toBe('drive_through')
    expect(checkoutConfigKeyToWire('lockerPickup')).toBe('locker_pickup')
  })

  it('resolveCheckoutOrderWireType uses backend default without frontend enum', () => {
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: {
        driveThrough: true,
        curbside: true,
        default: 'driveThrough',
      },
    }
    expect(resolveCheckoutOrderWireType(checkout, null)).toBe('drive_through')
    expect(resolveCheckoutOrderWireType(checkout, 'invalid')).toBe('drive_through')
  })

  it('discovers payment methods dynamically including new keys', () => {
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      orderingEnabled: true,
      payments: {
        applePay: true,
        googlePay: true,
        crypto: true,
        bankTransfer: true,
        venmo: true,
        payLater: true,
        futurePayment: true,
        default: 'applePay',
      },
    }
    const options = getCheckoutPaymentOptions(checkout)
    expect(options.map((o) => o.configKey)).toEqual([
      'applePay',
      'googlePay',
      'crypto',
      'bankTransfer',
      'venmo',
      'payLater',
      'futurePayment',
    ])
    expect(options.every((o) => o.requiresPaymentIntent === false)).toBe(true)
  })

  it('reads requiresPaymentIntent from backend payment metadata objects', () => {
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      orderingEnabled: true,
      payments: {
        card: { enabled: true, requiresPaymentIntent: true },
        applePay: { enabled: true, requires_payment_intent: true },
        cash: true,
        default: 'card',
      },
    }
    const options = getCheckoutPaymentOptions(checkout)
    expect(options.find((o) => o.configKey === 'card')?.requiresPaymentIntent).toBe(true)
    expect(options.find((o) => o.configKey === 'applePay')?.requiresPaymentIntent).toBe(true)
    expect(options.find((o) => o.configKey === 'cash')?.requiresPaymentIntent).toBe(false)
    expect(paymentConfigRequiresPaymentIntent({ enabled: true, flow: 'stripe_payment_intent' })).toBe(true)
  })

  it('filterDeliveryCapabilities respects checkout.delivery flags for mapped keys', () => {
    const filtered = filterDeliveryCapabilities(
      {
        cash_on_delivery: true,
        scheduled_delivery: true,
        same_day: true,
        contactless_delivery: true,
      },
      {
        ...EMPTY_BRANCH_CHECKOUT,
        delivery: {
          radius: null,
          minimumOrder: null,
          scheduled: false,
          contactless: false,
          robotDelivery: true,
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

  it('humanizes config keys without allow-list', () => {
    expect(getCheckoutPaymentConfigKeyLabel('applePay')).toBe('Apple Pay')
    expect(getCheckoutOrderTypeConfigKeyLabel('driveThrough')).toBe('Drive Through')
    expect(getCheckoutOrderTypeConfigKeyLabel('lockerPickup')).toBe('Locker Pickup')
    expect(getCheckoutDeliveryOptionLabel('robotDelivery')).toBe('Robot Delivery')
    expect(getCheckoutDeliveryOptionLabel('newFutureFlag')).toBe('New Future Flag')
  })

  it('humanizeOrderWireType and humanizePaymentWireMethod work for unknown values', () => {
    expect(humanizeOrderWireType('robot_delivery')).toBe('Robot Delivery')
    expect(humanizeOrderWireType('drive_through')).toBe('Drive Through')
    expect(humanizePaymentWireMethod('future_payment')).toBe('Future Payment')
    expect(humanizePaymentWireMethod('new_future_method')).toBe('New Future Method')
  })

  it('getCheckoutPaymentConfigKeys and getCheckoutOrderTypeConfigKeys return backend keys only', () => {
    expect(
      getCheckoutPaymentConfigKeys({
        applePay: true,
        futurePayment: true,
        default: 'applePay',
      }),
    ).toEqual(['applePay', 'futurePayment'])
    expect(
      getCheckoutOrderTypeConfigKeys({
        driveThrough: true,
        curbside: true,
        default: 'driveThrough',
      }),
    ).toEqual(['driveThrough', 'curbside'])
  })

  it('isOrderTypeConfigEnabled and isPaymentConfigEnabled support objects', () => {
    expect(isOrderTypeConfigEnabled({ enabled: true })).toBe(true)
    expect(isPaymentConfigEnabled({ enabled: true })).toBe(true)
  })
})
