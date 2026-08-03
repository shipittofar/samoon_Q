import { describe, it, expect } from 'vitest'
import {
  resolveEffectiveMinimumOrder,
  isBelowMinimumOrder,
  isDeliveryBlockedByServiceability,
  filterDeliveryCapabilities,
  isBranchOrderingEnabled,
  resolveCheckoutOrderWireType,
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentConfigKeys,
  EMPTY_BRANCH_CHECKOUT,
} from '@/lib/branch-checkout'
import {
  checkoutConfigKeyToWire,
  resolveCheckoutPaymentWireMethod,
} from '@/lib/checkout-options'
import { branchToFormInput } from '@/types/branch-form'
import type { Branch } from '@/types/branch'

describe('branch-checkout behavioral helpers', () => {
  it('maps config keys to wire values via generic conversion', () => {
    expect(checkoutConfigKeyToWire('cashOnDelivery')).toBe('cash_on_delivery')
    expect(checkoutConfigKeyToWire('applePay')).toBe('apple_pay')
    expect(checkoutConfigKeyToWire('driveThrough')).toBe('drive_through')
  })

  it('resolveCheckoutPaymentWireMethod honors backend default config key', () => {
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      orderingEnabled: true,
      payments: {
        applePay: true,
        googlePay: true,
        default: 'applePay',
      },
    }
    expect(resolveCheckoutPaymentWireMethod(checkout)).toBe('apple_pay')
  })

  it('resolveEffectiveMinimumOrder prefers serviceability minimum_order', () => {
    expect(
      resolveEffectiveMinimumOrder({ deliverable: true, minimum_order: 25 }, EMPTY_BRANCH_CHECKOUT),
    ).toBe(25)
    expect(
      resolveEffectiveMinimumOrder(null, {
        ...EMPTY_BRANCH_CHECKOUT,
        delivery: { ...EMPTY_BRANCH_CHECKOUT.delivery, minimumOrder: '15.00' },
      }),
    ).toBe(15)
  })

  it('isBelowMinimumOrder blocks when subtotal is under minimum', () => {
    expect(isBelowMinimumOrder(10, 15)).toBe(true)
    expect(isBelowMinimumOrder(20, 15)).toBe(false)
    expect(isBelowMinimumOrder(10, null)).toBe(false)
  })

  it('isDeliveryBlockedByServiceability uses backend requiresDeliveryAddress metadata', () => {
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: {
        delivery: { enabled: true, requiresDeliveryAddress: true },
        pickup: { enabled: true, fulfillmentMode: 'pickup' },
        default: 'delivery',
      },
    }
    expect(
      isDeliveryBlockedByServiceability('delivery', { deliverable: false }, false, true, checkout),
    ).toBe(true)
    expect(
      isDeliveryBlockedByServiceability('pickup', { deliverable: false }, false, true, checkout),
    ).toBe(false)
  })

  it('filterDeliveryCapabilities removes options disabled in branch checkout', () => {
    const capabilities = {
      cash_on_delivery: true,
      scheduled_delivery: true,
      same_day: true,
      contactless_delivery: true,
    }
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      delivery: {
        ...EMPTY_BRANCH_CHECKOUT.delivery,
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
    expect(isBranchOrderingEnabled({ ...EMPTY_BRANCH_CHECKOUT, orderingEnabled: false })).toBe(false)
    expect(isBranchOrderingEnabled({ ...EMPTY_BRANCH_CHECKOUT, orderingEnabled: true })).toBe(true)
  })

  it('resolveCheckoutOrderWireType honors backend default', () => {
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
  })

  it('getCheckoutOrderTypeOptions skips disabled types', () => {
    const checkout = {
      ...EMPTY_BRANCH_CHECKOUT,
      orderingEnabled: true,
      orderTypes: {
        delivery: false,
        lockerPickup: true,
        default: 'lockerPickup',
      },
    }
    expect(getCheckoutOrderTypeOptions(checkout).map((o) => o.wireType)).toEqual(['locker_pickup'])
  })

  it('branchToFormInput does not inject DEFAULT keys missing from API checkout', () => {
    const branch = {
      id: 'b1',
      tenantId: 't1',
      name: 'Test',
      slug: 'test',
      status: 'active' as const,
      type: 'physical' as const,
      location: { address: '1 Main', city: 'NYC', country: 'US' },
      contact: {},
      businessHours: [],
      checkout: {
        orderingEnabled: true,
        orderTypes: {
          driveThrough: true,
          curbside: true,
          default: 'driveThrough',
        },
        payments: {
          futurePayment: true,
          default: 'futurePayment',
        },
        delivery: EMPTY_BRANCH_CHECKOUT.delivery,
      },
      marketplaceVisible: true,
      reservationsEnabled: false,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    } satisfies Branch

    const form = branchToFormInput(branch)
    expect(getCheckoutPaymentConfigKeys(form.checkout.payments)).toEqual(['futurePayment'])
  })

  it('EMPTY_BRANCH_CHECKOUT does not seed payment or order types', () => {
    expect(getCheckoutPaymentConfigKeys(EMPTY_BRANCH_CHECKOUT.payments)).toEqual([])
    expect(EMPTY_BRANCH_CHECKOUT.payments.default).toBeNull()
    expect(EMPTY_BRANCH_CHECKOUT.orderTypes.default).toBeNull()
  })
})
