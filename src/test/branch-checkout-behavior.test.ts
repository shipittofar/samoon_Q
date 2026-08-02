import { describe, it, expect } from 'vitest'
import {
  mapPaymentConfigKeyToMethod,
  resolveInitialPaymentMethod,
  resolveEffectiveMinimumOrder,
  isBelowMinimumOrder,
  isDeliveryBlockedByServiceability,
  filterDeliveryCapabilities,
  isBranchOrderingEnabled,
  resolveCheckoutOrderWireType,
  getCheckoutOrderTypeOptions,
  DEFAULT_BRANCH_CHECKOUT,
} from '@/lib/branch-checkout'

describe('branch-checkout behavioral helpers', () => {
  it('maps cashOnDelivery config key to cash payment method', () => {
    expect(mapPaymentConfigKeyToMethod('cashOnDelivery')).toBe('cash')
    expect(mapPaymentConfigKeyToMethod('card')).toBe('card')
    expect(mapPaymentConfigKeyToMethod('invalid')).toBeNull()
  })

  it('resolveInitialPaymentMethod honors cashOnDelivery default', () => {
    const checkout = {
      ...DEFAULT_BRANCH_CHECKOUT,
      orderTypes: { ...DEFAULT_BRANCH_CHECKOUT.orderTypes, delivery: true },
      payments: {
        ...DEFAULT_BRANCH_CHECKOUT.payments,
        card: false,
        online: false,
        cash: false,
        cashOnDelivery: true,
        default: 'cashOnDelivery',
      },
    }
    expect(resolveInitialPaymentMethod(checkout, 'delivery')).toBe('cash')
  })

  it('resolveEffectiveMinimumOrder prefers serviceability minimum_order', () => {
    expect(
      resolveEffectiveMinimumOrder({ deliverable: true, minimum_order: 25 }, DEFAULT_BRANCH_CHECKOUT),
    ).toBe(25)
    expect(
      resolveEffectiveMinimumOrder(null, {
        ...DEFAULT_BRANCH_CHECKOUT,
        delivery: { ...DEFAULT_BRANCH_CHECKOUT.delivery, minimumOrder: '15.00' },
      }),
    ).toBe(15)
  })

  it('isBelowMinimumOrder blocks when subtotal is under minimum', () => {
    expect(isBelowMinimumOrder(10, 15)).toBe(true)
    expect(isBelowMinimumOrder(20, 15)).toBe(false)
    expect(isBelowMinimumOrder(10, null)).toBe(false)
  })

  it('isDeliveryBlockedByServiceability is authoritative when address present', () => {
    const checkout = {
      ...DEFAULT_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: { ...DEFAULT_BRANCH_CHECKOUT.orderTypes, delivery: true },
    }
    expect(
      isDeliveryBlockedByServiceability('delivery', { deliverable: false }, false, true, checkout),
    ).toBe(true)
    expect(
      isDeliveryBlockedByServiceability('delivery', { deliverable: true }, false, true, checkout),
    ).toBe(false)
    expect(
      isDeliveryBlockedByServiceability('pickup', { deliverable: false }, false, true, checkout),
    ).toBe(false)
    expect(
      isDeliveryBlockedByServiceability('delivery', null, true, true, checkout),
    ).toBe(true)
  })

  it('filterDeliveryCapabilities removes options disabled in branch checkout', () => {
    const capabilities = {
      cash_on_delivery: true,
      scheduled_delivery: true,
      same_day: true,
      contactless_delivery: true,
    }
    const checkout = {
      ...DEFAULT_BRANCH_CHECKOUT,
      delivery: {
        ...DEFAULT_BRANCH_CHECKOUT.delivery,
        scheduled: false,
        contactless: false,
      },
    }
    expect(filterDeliveryCapabilities(capabilities, checkout)).toEqual({
      cash_on_delivery: true,
      scheduled_delivery: false,
      same_day: true,
      contactless_delivery: false,
    })
  })

  it('isBranchOrderingEnabled requires explicit backend true', () => {
    expect(isBranchOrderingEnabled(undefined)).toBe(false)
    expect(isBranchOrderingEnabled({ ...DEFAULT_BRANCH_CHECKOUT, orderingEnabled: false })).toBe(false)
    expect(isBranchOrderingEnabled({ ...DEFAULT_BRANCH_CHECKOUT, orderingEnabled: true })).toBe(true)
  })

  it('resolveCheckoutOrderWireType honors backend default', () => {
    const checkout = {
      ...DEFAULT_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: {
        delivery: true,
        pickup: true,
        dineIn: false,
        default: 'pickup',
      },
    }
    expect(resolveCheckoutOrderWireType(checkout, null)).toBe('pickup')
  })

  it('getCheckoutOrderTypeOptions skips disabled types', () => {
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
    expect(getCheckoutOrderTypeOptions(checkout).map((o) => o.wireType)).toEqual(['pickup'])
  })
})
