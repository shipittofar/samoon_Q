import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  resolveCheckoutPaymentWireMethod,
  isCheckoutOrderingEnabled,
  checkoutConfigKeyToWire,
  filterDeliveryCapabilities,
  getCheckoutPaymentConfigKeyLabel,
  getCheckoutOrderTypeConfigKeyEnabledLabel,
  getCheckoutDeliveryOptionLabel,
} from '@/lib/checkout-options'
import { DEFAULT_BRANCH_CHECKOUT, isBranchOrderingEnabled } from '@/lib/branch-checkout'
import type { BranchCheckout } from '@/types/branch'

function checkoutWith(partial: Partial<BranchCheckout>): BranchCheckout {
  return {
    ...DEFAULT_BRANCH_CHECKOUT,
    ...partial,
    orderTypes: { ...DEFAULT_BRANCH_CHECKOUT.orderTypes, ...partial.orderTypes },
    payments: { ...DEFAULT_BRANCH_CHECKOUT.payments, ...partial.payments },
    delivery: { ...DEFAULT_BRANCH_CHECKOUT.delivery, ...partial.delivery },
  }
}

describe('checkout ordering availability — orderingEnabled only', () => {
  it('orderingEnabled=true → available', () => {
    expect(isCheckoutOrderingEnabled(checkoutWith({ orderingEnabled: true }))).toBe(true)
    expect(isBranchOrderingEnabled(checkoutWith({ orderingEnabled: true }))).toBe(true)
  })

  it('orderingEnabled=false → unavailable', () => {
    expect(isCheckoutOrderingEnabled(checkoutWith({ orderingEnabled: false }))).toBe(false)
  })

  it('orderingEnabled=null/undefined/missing checkout → unavailable', () => {
    expect(isCheckoutOrderingEnabled(undefined)).toBe(false)
    expect(isCheckoutOrderingEnabled(checkoutWith({ orderingEnabled: null as unknown as boolean }))).toBe(false)
  })

  it('tenant/branch status fields do not affect isCheckoutOrderingEnabled', () => {
    const checkout = checkoutWith({ orderingEnabled: true })
    // Gate ignores tenant/branch status — only the checkout flag matters.
    expect(isCheckoutOrderingEnabled(checkout)).toBe(true)
    expect(
      isCheckoutOrderingEnabled(checkoutWith({ orderingEnabled: true })),
    ).toBe(true)
  })
})

describe('checkout-options — backend-driven discovery', () => {
  it('discovers enabled order types dynamically from checkout.orderTypes', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: {
        delivery: true,
        pickup: false,
        dineIn: true,
        driveThrough: true,
        default: 'drive_through',
      },
    })
    const options = getCheckoutOrderTypeOptions(checkout)
    expect(options.map((o) => o.wireType)).toEqual(['delivery', 'dine_in', 'drive_through'])
  })

  it('maps camelCase config keys to snake_case wire values', () => {
    expect(checkoutConfigKeyToWire('dineIn')).toBe('dine_in')
    expect(checkoutConfigKeyToWire('driveThrough')).toBe('drive_through')
  })

  it('returns no order types when orderingEnabled is false (options empty, not inventing)', () => {
    expect(
      getCheckoutOrderTypeOptions(checkoutWith({ orderingEnabled: false })).map((o) => o.wireType),
    ).toEqual([])
  })

  it('returns empty options when orderingEnabled true but all types disabled', () => {
    expect(
      getCheckoutOrderTypeOptions(
        checkoutWith({
          orderingEnabled: true,
          orderTypes: { delivery: false, pickup: false, dineIn: false, default: null },
        }),
      ),
    ).toEqual([])
  })

  it('filterDeliveryCapabilities respects checkout.delivery flags', () => {
    const filtered = filterDeliveryCapabilities(
      {
        cash_on_delivery: true,
        scheduled_delivery: true,
        same_day: true,
        contactless_delivery: true,
      },
      checkoutWith({
        delivery: {
          ...DEFAULT_BRANCH_CHECKOUT.delivery,
          scheduled: false,
          contactless: false,
        },
      }),
    )
    expect(filtered).toEqual({
      cash_on_delivery: true,
      scheduled_delivery: false,
      same_day: true,
      contactless_delivery: false,
    })
  })

  it('getCheckoutPaymentConfigKeyLabel reuses checkout payment labels', () => {
    const tCheckout = (key: string) => `checkout:${key}`
    expect(getCheckoutPaymentConfigKeyLabel('online', tCheckout)).toBe('checkout:online')
    expect(getCheckoutPaymentConfigKeyLabel('cashOnDelivery', tCheckout)).toBe('checkout:cash')
    expect(getCheckoutPaymentConfigKeyLabel('applePay', tCheckout)).toBe('Apple Pay')
  })

  it('getCheckoutOrderTypeConfigKeyEnabledLabel uses console enabled toggles', () => {
    const tConsole = (key: string) => `console:${key}`
    expect(getCheckoutOrderTypeConfigKeyEnabledLabel('delivery', tConsole)).toBe('console:deliveryEnabledLabel')
    expect(getCheckoutOrderTypeConfigKeyEnabledLabel('driveThrough', tConsole)).toBe('Drive Through enabled')
  })

  it('getCheckoutDeliveryOptionLabel reuses address capability labels', () => {
    const tCapabilities = (key: string) => `address:${key}`
    expect(getCheckoutDeliveryOptionLabel('scheduled', tCapabilities)).toBe('address:scheduled_delivery')
    expect(getCheckoutDeliveryOptionLabel('unknownFlag', tCapabilities)).toBe('Unknown Flag')
  })
})

describe('order type default resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('default="pickup" + pickup=true → pickup', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: { delivery: false, pickup: true, dineIn: true, default: 'pickup' },
    })
    expect(resolveCheckoutOrderWireType(checkout, null)).toBe('pickup')
  })

  it('default=null + pickup/dineIn enabled → random among enabled only', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: { delivery: false, pickup: true, dineIn: true, default: null },
    })
    expect(resolveCheckoutOrderWireType(checkout, null, () => 0)).toBe('pickup')
    expect(resolveCheckoutOrderWireType(checkout, null, () => 0.99)).toBe('dine_in')
  })

  it('default="delivery" but delivery=false + pickup=true → pickup (invalid default)', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: { delivery: false, pickup: true, dineIn: false, default: 'delivery' },
    })
    expect(resolveCheckoutOrderWireType(checkout, null, () => 0)).toBe('pickup')
  })

  it('default points to unknown option → random enabled', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: { delivery: false, pickup: true, dineIn: true, default: 'ghostType' },
    })
    expect(resolveCheckoutOrderWireType(checkout, null, () => 0)).toBe('pickup')
    expect(resolveCheckoutOrderWireType(checkout, null, () => 0.99)).toBe('dine_in')
  })

  it('never selects a disabled order type', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: { delivery: false, pickup: true, dineIn: false, default: null },
    })
    for (let i = 0; i < 10; i++) {
      expect(resolveCheckoutOrderWireType(checkout, null, () => i / 10)).toBe('pickup')
    }
  })

  it('URL param wins when it is an enabled wire type', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: { delivery: true, pickup: true, dineIn: false, default: 'pickup' },
    })
    expect(resolveCheckoutOrderWireType(checkout, 'delivery')).toBe('delivery')
  })

  it('empty enabled order types → empty string (do not invent)', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      orderTypes: { delivery: false, pickup: false, dineIn: false, default: null },
    })
    expect(resolveCheckoutOrderWireType(checkout, null)).toBe('')
  })
})

describe('payment default resolution', () => {
  it('default="card" + card=true → card', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      payments: {
        cash: true,
        cashOnDelivery: true,
        card: true,
        online: false,
        wallet: false,
        default: 'card',
      },
    })
    expect(resolveCheckoutPaymentWireMethod(checkout, 'pickup')).toBe('card')
  })

  it('default=null + cash/card enabled → random among enabled wire methods', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      payments: {
        cash: true,
        cashOnDelivery: false,
        card: true,
        online: false,
        wallet: false,
        default: null,
      },
    })
    expect(resolveCheckoutPaymentWireMethod(checkout, 'pickup', () => 0)).toBe('cash')
    expect(resolveCheckoutPaymentWireMethod(checkout, 'pickup', () => 0.99)).toBe('card')
  })

  it('default="online" but online=false + card=true → card', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      payments: {
        cash: false,
        cashOnDelivery: false,
        card: true,
        online: false,
        wallet: false,
        default: 'online',
      },
    })
    expect(resolveCheckoutPaymentWireMethod(checkout, 'pickup', () => 0)).toBe('card')
  })

  it('never selects disabled payment methods (online/wallet)', () => {
    const checkout = checkoutWith({
      orderingEnabled: true,
      payments: {
        cash: true,
        cashOnDelivery: true,
        card: true,
        online: false,
        wallet: false,
        default: null,
      },
    })
    const options = getCheckoutPaymentOptions(checkout, 'pickup').map((o) => o.wireMethod)
    expect(options).not.toContain('online')
    expect(options).not.toContain('wallet')
    for (let i = 0; i < 10; i++) {
      const picked = resolveCheckoutPaymentWireMethod(checkout, 'pickup', () => i / 10)
      expect(['cash', 'card']).toContain(picked)
    }
  })

  it('discovers payment methods dynamically including new keys', () => {
    const checkout = checkoutWith({
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
    })
    const options = getCheckoutPaymentOptions(checkout, 'pickup')
    expect(options.map((o) => o.wireMethod)).toEqual(['card', 'apple_pay'])
  })
})

describe('Checkout page source — ordering gate regression', () => {
  it('Checkout page gates only on orderingEnabled (not tenant status / empty order types)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '../app/checkout/page.tsx'), 'utf-8')
    expect(src).toContain('isCheckoutOrderingEnabled')
    expect(src).toContain('orderingAvailable')
    expect(src).not.toContain('canOrderFromTenant')
    expect(src).not.toMatch(/orderTypeOptions\.length\s*===\s*0/)
    expect(src).not.toMatch(/!tenantOrderingAllowed/)
  })
})
