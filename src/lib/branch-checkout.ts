import type {
  BranchCheckout,
  BranchCheckoutDelivery,
  BranchCheckoutOrderTypes,
  BranchCheckoutPayments,
} from '@/types/branch'
import type { OrderType, PaymentMethod } from '@/types'
import type { ServiceabilityResult } from '@/types/address'
import {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  resolveCheckoutPaymentWireMethod,
  filterDeliveryCapabilities,
  findCheckoutOrderTypeOption,
  isCheckoutOrderingEnabled,
} from '@/lib/checkout-options'

export {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  resolveCheckoutPaymentWireMethod,
  filterDeliveryCapabilities,
  findCheckoutOrderTypeOption,
  checkoutConfigKeyToWire,
  wireToCheckoutConfigKey,
  getCheckoutOrderTypeLabel,
  getCheckoutOrderTypeDesc,
  getCheckoutOrderTypeIcon,
  getCheckoutPaymentLabel,
  getCheckoutPaymentDesc,
  getCheckoutPaymentIcon,
  getCheckoutPaymentConfigKeyLabel,
  getCheckoutOrderTypeConfigKeyEnabledLabel,
  getCheckoutDeliveryOptionLabel,
  isCheckoutOrderingEnabled,
  pickRandomCheckoutOption,
} from '@/lib/checkout-options'
export type { CheckoutOrderTypeOption, CheckoutPaymentOption, CheckoutRandomFn } from '@/lib/checkout-options'

/** Console/form seed only — never used for runtime storefront availability. */
export const DEFAULT_BRANCH_CHECKOUT: BranchCheckout = {
  orderingEnabled: true,
  orderTypes: {
    delivery: false,
    pickup: true,
    dineIn: false,
    default: 'pickup',
  },
  payments: {
    cash: true,
    cashOnDelivery: true,
    card: true,
    online: true,
    wallet: false,
    default: 'card',
  },
  delivery: {
    radius: null,
    minimumOrder: null,
    sameDay: true,
    scheduled: true,
    contactless: true,
  },
}

export interface BuildBranchCheckoutOptions {
  orderingEnabled?: boolean
  delivery?: boolean
  pickup?: boolean
  dineIn?: boolean
  defaultOrderType?: string | null
  radius?: number | null
  minimumOrder?: string | null
  sameDay?: boolean
  scheduled?: boolean
  contactless?: boolean
  cash?: boolean
  cashOnDelivery?: boolean
  card?: boolean
  online?: boolean
  wallet?: boolean
  defaultPayment?: string | null
}

/** Builds a full checkout config with sensible defaults (console forms only). */
export function buildBranchCheckout(options: BuildBranchCheckoutOptions = {}): BranchCheckout {
  const orderTypes: BranchCheckoutOrderTypes = {
    delivery: options.delivery ?? DEFAULT_BRANCH_CHECKOUT.orderTypes.delivery,
    pickup: options.pickup ?? DEFAULT_BRANCH_CHECKOUT.orderTypes.pickup,
    dineIn: options.dineIn ?? DEFAULT_BRANCH_CHECKOUT.orderTypes.dineIn,
    default: options.defaultOrderType ?? DEFAULT_BRANCH_CHECKOUT.orderTypes.default,
  }

  const payments: BranchCheckoutPayments = {
    cash: options.cash ?? DEFAULT_BRANCH_CHECKOUT.payments.cash,
    cashOnDelivery: options.cashOnDelivery ?? DEFAULT_BRANCH_CHECKOUT.payments.cashOnDelivery,
    card: options.card ?? DEFAULT_BRANCH_CHECKOUT.payments.card,
    online: options.online ?? DEFAULT_BRANCH_CHECKOUT.payments.online,
    wallet: options.wallet ?? DEFAULT_BRANCH_CHECKOUT.payments.wallet,
    default: options.defaultPayment ?? DEFAULT_BRANCH_CHECKOUT.payments.default,
  }

  const delivery: BranchCheckoutDelivery = {
    radius: options.radius !== undefined ? options.radius : DEFAULT_BRANCH_CHECKOUT.delivery.radius,
    minimumOrder: options.minimumOrder !== undefined ? options.minimumOrder : DEFAULT_BRANCH_CHECKOUT.delivery.minimumOrder,
    sameDay: options.sameDay ?? DEFAULT_BRANCH_CHECKOUT.delivery.sameDay,
    scheduled: options.scheduled ?? DEFAULT_BRANCH_CHECKOUT.delivery.scheduled,
    contactless: options.contactless ?? DEFAULT_BRANCH_CHECKOUT.delivery.contactless,
  }

  return {
    orderingEnabled: options.orderingEnabled ?? DEFAULT_BRANCH_CHECKOUT.orderingEnabled,
    orderTypes,
    payments,
    delivery,
  }
}

export function mergeBranchCheckout(
  base: BranchCheckout,
  patch?: Partial<BranchCheckout>,
): BranchCheckout {
  if (!patch) return base
  return {
    orderingEnabled: patch.orderingEnabled ?? base.orderingEnabled,
    orderTypes: { ...base.orderTypes, ...patch.orderTypes },
    payments: { ...base.payments, ...patch.payments },
    delivery: { ...base.delivery, ...patch.delivery },
  }
}

/** @deprecated Use getCheckoutOrderTypeOptions — returns wire types for backward compatibility. */
export function getAvailableOrderTypes(checkout: BranchCheckout | undefined): OrderType[] {
  return getCheckoutOrderTypeOptions(checkout).map((o) => o.wireType as OrderType)
}

/** @deprecated Use resolveCheckoutOrderWireType */
export function resolveInitialOrderType(
  checkout: BranchCheckout | undefined,
  paramOrderType: OrderType | null,
  _validTypes?: Set<OrderType>,
): OrderType {
  return resolveCheckoutOrderWireType(checkout, paramOrderType) as OrderType
}

/** @deprecated Use getCheckoutPaymentOptions */
export function getAvailablePaymentMethods(
  checkout: BranchCheckout | undefined,
  orderType?: OrderType,
): PaymentMethod[] {
  return getCheckoutPaymentOptions(checkout, orderType).map((o) => o.wireMethod as PaymentMethod)
}

/** @deprecated Use resolveCheckoutPaymentWireMethod */
export function mapPaymentConfigKeyToMethod(configKey: string | null | undefined): PaymentMethod | null {
  if (!configKey) return null
  if (configKey === 'cashOnDelivery') return 'cash'
  const known = new Set<PaymentMethod>(['cash', 'card', 'online', 'wallet'])
  if (known.has(configKey as PaymentMethod)) return configKey as PaymentMethod
  return null
}

/** @deprecated Use resolveCheckoutPaymentWireMethod */
export function resolveInitialPaymentMethod(
  checkout: BranchCheckout | undefined,
  orderType?: OrderType,
): PaymentMethod {
  return resolveCheckoutPaymentWireMethod(checkout, orderType) as PaymentMethod
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

/**
 * Minimum order: serviceability response is authoritative when present;
 * otherwise fall back to branch checkout config.
 */
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

/** Serviceability API is authoritative for delivery eligibility. */
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
  const parsed = Number.parseFloat(minimumOrder)
  return Number.isFinite(parsed) ? parsed : null
}

/** True only when backend explicitly enables ordering for this branch. */
export function isBranchOrderingEnabled(checkout: BranchCheckout | undefined): boolean {
  return isCheckoutOrderingEnabled(checkout)
}

/** @deprecated Use filterDeliveryCapabilities from checkout-options */
export function hasVisibleDeliveryCapabilities(
  capabilities: import('@/types/address').AddressCapabilities | null | undefined,
  checkout: BranchCheckout | undefined,
): boolean {
  const filtered = filterDeliveryCapabilities(capabilities, checkout)
  if (!filtered) return false
  return Object.values(filtered).some(Boolean)
}
