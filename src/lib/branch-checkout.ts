import type {
  BranchCheckout,
  BranchCheckoutDelivery,
  BranchCheckoutOrderTypes,
  BranchCheckoutPayments,
} from '@/types/branch'
import type { ServiceabilityResult } from '@/types/address'
import {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  resolveCheckoutPaymentWireMethod,
  filterDeliveryCapabilities,
  findCheckoutOrderTypeOption,
  findCheckoutPaymentOption,
  checkoutConfigKeyToWire,
} from '@/lib/checkout-options'

export {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  resolveCheckoutPaymentWireMethod,
  filterDeliveryCapabilities,
  findCheckoutOrderTypeOption,
  findCheckoutPaymentOption,
  checkoutConfigKeyToWire,
  wireToCheckoutConfigKey,
  humanizeCheckoutConfigKey,
  humanizeOrderWireType,
  humanizePaymentWireMethod,
  isOrderTypeConfigEnabled,
  isPaymentConfigEnabled,
  paymentConfigRequiresPaymentIntent,
  getCheckoutOrderTypeLabel,
  getCheckoutOrderTypeDesc,
  getCheckoutOrderTypeIcon,
  getCheckoutPaymentIcon,
  getCheckoutPaymentConfigKeyLabel,
  getCheckoutOrderTypeConfigKeyLabel,
  getCheckoutPaymentConfigKeys,
  getCheckoutOrderTypeConfigKeys,
  getCheckoutDeliveryConfigKeys,
  getCheckoutDeliveryOptionLabel,
} from '@/lib/checkout-options'
export type { CheckoutOrderTypeOption, CheckoutPaymentOption } from '@/lib/checkout-options'

/** Empty checkout shell — no invented business flags. Used for forms only. */
export const EMPTY_BRANCH_CHECKOUT: BranchCheckout = {
  orderingEnabled: false,
  orderTypes: { default: null },
  payments: { default: null },
  delivery: {
    radius: null,
    minimumOrder: null,
  },
}

/** @deprecated Use EMPTY_BRANCH_CHECKOUT */
export const DEFAULT_BRANCH_CHECKOUT = EMPTY_BRANCH_CHECKOUT

export interface BuildBranchCheckoutOptions {
  orderingEnabled?: boolean
  orderTypes?: BranchCheckoutOrderTypes
  payments?: BranchCheckoutPayments
  delivery?: BranchCheckoutDelivery
}

/** Builds checkout config for mocks — passes through explicit options only. */
export function buildBranchCheckout(options: BuildBranchCheckoutOptions = {}): BranchCheckout {
  return {
    orderingEnabled: options.orderingEnabled ?? false,
    orderTypes: options.orderTypes ?? { default: null },
    payments: options.payments ?? { default: null },
    delivery: options.delivery ?? { radius: null, minimumOrder: null },
  }
}

/** Replaces checkout sections when provided — does not merge with frontend defaults. */
export function mergeBranchCheckout(
  base: BranchCheckout,
  patch?: Partial<BranchCheckout>,
): BranchCheckout {
  if (!patch) return base
  return {
    orderingEnabled: patch.orderingEnabled ?? base.orderingEnabled,
    orderTypes: patch.orderTypes ?? base.orderTypes,
    payments: patch.payments ?? base.payments,
    delivery: patch.delivery ?? base.delivery,
  }
}

/** ISO 4217 currency for display/payment — branch field is authoritative. */
export function resolveBranchCurrencyCode(currency?: string | null): string {
  const code = currency?.trim().toUpperCase()
  return code && code.length === 3 ? code : 'USD'
}

/** Stripe/API currency codes are lowercase ISO 4217. */
export function resolvePaymentCurrencyCode(currency?: string | null): string {
  return resolveBranchCurrencyCode(currency).toLowerCase()
}

export function resolveEffectiveMinimumOrder(
  serviceability: ServiceabilityResult | null | undefined,
  checkout: BranchCheckout | undefined,
): number | null {
  if (serviceability?.minimum_order != null) {
    return serviceability.minimum_order
  }
  return parseMinimumOrderAmount(checkout?.delivery.minimumOrder)
}

export function isBelowMinimumOrder(subtotal: number, minimum: number | null): boolean {
  return minimum != null && subtotal < minimum
}

export function isDeliveryBlockedByServiceability(
  orderWireType: string,
  serviceability: ServiceabilityResult | null | undefined,
  serviceabilityLoading: boolean,
  hasAddress: boolean,
  checkout?: BranchCheckout,
): boolean {
  const option = findCheckoutOrderTypeOption(checkout, orderWireType)
  if (!option?.requiresDeliveryAddress || !hasAddress) return false
  if (serviceabilityLoading) return true
  if (!serviceability) return true
  return !serviceability.deliverable
}

export function parseMinimumOrderAmount(minimumOrder: string | null | undefined): number | null {
  if (minimumOrder == null || minimumOrder === '') return null
  const parsed = Number.parseFloat(String(minimumOrder))
  return Number.isFinite(parsed) ? parsed : null
}

export function isBranchOrderingEnabled(checkout: BranchCheckout | undefined): boolean {
  return checkout?.orderingEnabled === true
}

export function hasVisibleDeliveryCapabilities(
  capabilities: import('@/types/address').AddressCapabilities | null | undefined,
  checkout: BranchCheckout | undefined,
): boolean {
  const filtered = filterDeliveryCapabilities(capabilities, checkout)
  if (!filtered) return false
  return Object.values(filtered).some(Boolean)
}
