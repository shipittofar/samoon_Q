/**
 * Backend-driven checkout option discovery.
 *
 * Availability, defaults, wire values, and UI requirements are derived from
 * `branch.checkout` — never from frontend enums, allow-lists, or name inference.
 *
 * Presentation uses generic humanization so new backend keys render without code changes.
 */

import type { ElementType } from 'react'
import { CreditCard, ShoppingBag } from 'lucide-react'
import { humanizeWireValue } from '@/lib/humanize'
import type {
  BranchCheckout,
  BranchCheckoutOrderTypeConfig,
  BranchCheckoutPaymentMethodConfig,
} from '@/types/branch'
import type { AddressCapabilities } from '@/types/address'

const RESERVED_ORDER_TYPE_KEYS = new Set(['default'])
const RESERVED_PAYMENT_KEYS = new Set(['default'])

/** camelCase config key → snake_case wire value sent to order API. */
export function checkoutConfigKeyToWire(configKey: string): string {
  return configKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/** snake_case wire value → camelCase config key in branch.checkout. */
export function wireToCheckoutConfigKey(wireValue: string): string {
  return wireValue.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

export interface CheckoutOrderTypeOption {
  configKey: string
  wireType: string
  requiresDeliveryAddress: boolean
  requiresTableNumber: boolean
  fulfillmentMode?: string
}

export interface CheckoutPaymentOption {
  configKey: string
  wireMethod: string
  requiresPaymentIntent: boolean
}

function isOrderTypeConfigObject(value: unknown): value is BranchCheckoutOrderTypeConfig {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPaymentConfigObject(value: unknown): value is BranchCheckoutPaymentMethodConfig {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isOrderTypeConfigEnabled(value: unknown): boolean {
  if (value === true) return true
  if (isOrderTypeConfigObject(value)) return value.enabled === true
  return false
}

export function isPaymentConfigEnabled(value: unknown): boolean {
  if (value === true) return true
  if (isPaymentConfigObject(value)) return value.enabled === true
  return false
}

function orderTypeConfigRequiresDeliveryAddress(value: unknown): boolean {
  if (!isOrderTypeConfigObject(value)) return false
  return value.requiresDeliveryAddress === true || value.requires_delivery_address === true
}

function orderTypeConfigRequiresTableNumber(value: unknown): boolean {
  if (!isOrderTypeConfigObject(value)) return false
  return value.requiresTableNumber === true || value.requires_table_number === true
}

function orderTypeConfigFulfillmentMode(value: unknown): string | undefined {
  if (!isOrderTypeConfigObject(value)) return undefined
  const mode = value.fulfillmentMode ?? value.fulfillment_mode
  return typeof mode === 'string' ? mode : undefined
}

export function paymentConfigRequiresPaymentIntent(value: unknown): boolean {
  if (!isPaymentConfigObject(value)) return false
  if (value.requiresPaymentIntent === true || value.requires_payment_intent === true) return true
  const flow = typeof value.flow === 'string' ? value.flow.toLowerCase() : ''
  if (flow === 'payment_intent' || flow === 'stripe_payment_intent') return true
  const action = typeof value.payment_action === 'string' ? value.payment_action.toLowerCase() : ''
  if (action === 'payment_intent' || action === 'create_payment_intent') return true
  return false
}

export function getCheckoutOrderTypeOptions(
  checkout: BranchCheckout | undefined,
): CheckoutOrderTypeOption[] {
  if (!checkout?.orderingEnabled) return []

  const options: CheckoutOrderTypeOption[] = []
  for (const [configKey, value] of Object.entries(checkout.orderTypes)) {
    if (RESERVED_ORDER_TYPE_KEYS.has(configKey) || !isOrderTypeConfigEnabled(value)) continue
    options.push({
      configKey,
      wireType: checkoutConfigKeyToWire(configKey),
      requiresDeliveryAddress: orderTypeConfigRequiresDeliveryAddress(value),
      requiresTableNumber: orderTypeConfigRequiresTableNumber(value),
      fulfillmentMode: orderTypeConfigFulfillmentMode(value),
    })
  }
  return options
}

export function getCheckoutPaymentOptions(
  checkout: BranchCheckout | undefined,
): CheckoutPaymentOption[] {
  if (!checkout?.orderingEnabled) return []

  const options: CheckoutPaymentOption[] = []
  for (const [configKey, value] of Object.entries(checkout.payments)) {
    if (RESERVED_PAYMENT_KEYS.has(configKey) || !isPaymentConfigEnabled(value)) continue
    options.push({
      configKey,
      wireMethod: checkoutConfigKeyToWire(configKey),
      requiresPaymentIntent: paymentConfigRequiresPaymentIntent(value),
    })
  }
  return options
}

export function findCheckoutPaymentOption(
  checkout: BranchCheckout | undefined,
  wireMethod: string,
): CheckoutPaymentOption | undefined {
  return getCheckoutPaymentOptions(checkout).find((o) => o.wireMethod === wireMethod)
}

export function findCheckoutOrderTypeOption(
  checkout: BranchCheckout | undefined,
  wireType: string,
): CheckoutOrderTypeOption | undefined {
  return getCheckoutOrderTypeOptions(checkout).find((o) => o.wireType === wireType)
}

export function resolveCheckoutOrderWireType(
  checkout: BranchCheckout | undefined,
  paramWireType: string | null,
): string {
  const available = getCheckoutOrderTypeOptions(checkout)
  const wireTypes = available.map((o) => o.wireType)

  if (paramWireType && wireTypes.includes(paramWireType)) {
    return paramWireType
  }

  const defaultKey = checkout?.orderTypes.default
  if (defaultKey) {
    if (wireTypes.includes(defaultKey)) return defaultKey
    const defaultWire = checkoutConfigKeyToWire(defaultKey)
    if (wireTypes.includes(defaultWire)) return defaultWire
    const match = available.find((o) => o.configKey === defaultKey)
    if (match && wireTypes.includes(match.wireType)) return match.wireType
  }

  return wireTypes[0] ?? ''
}

export function resolveCheckoutPaymentWireMethod(
  checkout: BranchCheckout | undefined,
): string {
  const available = getCheckoutPaymentOptions(checkout)
  const wireMethods = available.map((o) => o.wireMethod)

  const defaultKey = checkout?.payments.default
  if (defaultKey) {
    const fromDefault = checkoutConfigKeyToWire(defaultKey)
    if (wireMethods.includes(fromDefault)) return fromDefault
    const match = available.find((o) => o.configKey === defaultKey)
    if (match && wireMethods.includes(match.wireMethod)) return match.wireMethod
  }

  return wireMethods[0] ?? ''
}

function capabilityKeyToDeliveryKey(
  capKey: string,
  delivery: Record<string, unknown>,
): string | null {
  const candidates = [
    wireToCheckoutConfigKey(capKey),
    wireToCheckoutConfigKey(capKey.replace(/_delivery$/, '')),
  ]
  for (const key of candidates) {
    if (key in delivery) return key
  }
  return null
}

/** Filters serviceability capabilities using branch.checkout.delivery flags. */
export function filterDeliveryCapabilities(
  capabilities: AddressCapabilities | null | undefined,
  checkout: BranchCheckout | undefined,
): AddressCapabilities | null {
  if (!capabilities) return null

  const delivery = checkout?.delivery
  if (!delivery) return capabilities

  const deliveryRecord = delivery as Record<string, unknown>
  const result = { ...capabilities }
  for (const capKey of Object.keys(capabilities) as (keyof AddressCapabilities)[]) {
    const deliveryKey = capabilityKeyToDeliveryKey(capKey, deliveryRecord)
    if (!deliveryKey) continue
    if (delivery[deliveryKey] !== true) {
      result[capKey] = false
    }
  }
  return result
}

export function humanizeCheckoutConfigKey(key: string): string {
  return humanizeWireValue(key)
}

export function humanizeOrderWireType(wireType: string): string {
  if (!wireType) return ''
  return humanizeWireValue(wireToCheckoutConfigKey(wireType))
}

export function humanizePaymentWireMethod(wireMethod: string): string {
  if (!wireMethod) return ''
  return humanizeWireValue(wireToCheckoutConfigKey(wireMethod))
}

export function getCheckoutOrderTypeIcon(): ElementType {
  return ShoppingBag
}

export function getCheckoutPaymentIcon(): ElementType {
  return CreditCard
}

export function getCheckoutOrderTypeConfigKeyLabel(configKey: string): string {
  return humanizeCheckoutConfigKey(configKey)
}

export function getCheckoutPaymentConfigKeyLabel(configKey: string): string {
  return humanizeCheckoutConfigKey(configKey)
}

export function getCheckoutOrderTypeConfigKeys(
  orderTypes: Record<string, unknown> | undefined,
): string[] {
  if (!orderTypes) return []
  return Object.keys(orderTypes).filter((key) => !RESERVED_ORDER_TYPE_KEYS.has(key))
}

export function getCheckoutPaymentConfigKeys(
  payments: Record<string, unknown> | undefined,
): string[] {
  if (!payments) return []
  return Object.keys(payments).filter((key) => !RESERVED_PAYMENT_KEYS.has(key))
}

export function getCheckoutDeliveryConfigKeys(
  delivery: Record<string, unknown> | undefined,
): string[] {
  if (!delivery) return []
  return Object.keys(delivery).filter((key) => key !== 'radius' && key !== 'minimumOrder')
}

export function getCheckoutDeliveryOptionLabel(configKey: string): string {
  return humanizeCheckoutConfigKey(configKey)
}

export function getCheckoutOrderTypeLabel(wireType: string): string {
  return humanizeOrderWireType(wireType)
}

export function getCheckoutOrderTypeDesc(_wireType: string): string {
  return ''
}
