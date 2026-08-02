/**
 * Backend-driven checkout option discovery.
 *
 * Availability, defaults, and wire values are derived exclusively from
 * `branch.checkout` — never from frontend capability enums.
 *
 * Presentation (labels/icons) uses i18n with graceful fallbacks so new
 * backend keys (e.g. driveThrough) render without code changes.
 */

import type { ElementType } from 'react'
import {
  Package,
  UtensilsCrossed,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  ShoppingBag,
} from 'lucide-react'
import type { BranchCheckout } from '@/types/branch'
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
  /** Key in branch.checkout.orderTypes (e.g. dineIn). */
  configKey: string
  /** Value sent as order_type on the order API (e.g. dine_in). */
  wireType: string
  requiresDeliveryAddress: boolean
  requiresTableNumber: boolean
}

export interface CheckoutPaymentOption {
  /** Key in branch.checkout.payments (e.g. cashOnDelivery). */
  configKey: string
  /** Value sent as payment_method on the order API (e.g. cash). */
  wireMethod: string
}

function isEnabledFlag(value: unknown): value is true {
  return value === true
}

/** Discovers enabled order types from branch.checkout.orderTypes. */
export function getCheckoutOrderTypeOptions(
  checkout: BranchCheckout | undefined,
): CheckoutOrderTypeOption[] {
  if (!checkout?.orderingEnabled) return []

  const options: CheckoutOrderTypeOption[] = []
  for (const [configKey, value] of Object.entries(checkout.orderTypes)) {
    if (RESERVED_ORDER_TYPE_KEYS.has(configKey) || !isEnabledFlag(value)) continue
    const wireType = checkoutConfigKeyToWire(configKey)
    options.push({
      configKey,
      wireType,
      requiresDeliveryAddress: configKey === 'delivery',
      requiresTableNumber: wireType === 'dine_in',
    })
  }
  return options
}

function resolvePaymentWireMethod(
  configKey: string,
  orderWireType: string | undefined,
): string | null {
  if (configKey === 'cashOnDelivery') {
    return orderWireType === 'delivery' ? 'cash' : null
  }
  if (configKey === 'cash') return 'cash'
  return checkoutConfigKeyToWire(configKey)
}

/** Discovers enabled payment methods from branch.checkout.payments. */
export function getCheckoutPaymentOptions(
  checkout: BranchCheckout | undefined,
  orderWireType?: string,
): CheckoutPaymentOption[] {
  if (!checkout?.orderingEnabled) return []

  const options: CheckoutPaymentOption[] = []
  const seenWire = new Set<string>()

  for (const [configKey, value] of Object.entries(checkout.payments)) {
    if (RESERVED_PAYMENT_KEYS.has(configKey) || !isEnabledFlag(value)) continue
    const wireMethod = resolvePaymentWireMethod(configKey, orderWireType)
    if (!wireMethod || seenWire.has(wireMethod)) continue
    seenWire.add(wireMethod)
    options.push({ configKey, wireMethod })
  }

  return options
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

  const backendDefault = checkout?.orderTypes.default
  if (backendDefault) {
    if (wireTypes.includes(backendDefault)) return backendDefault
    const defaultWire = checkoutConfigKeyToWire(backendDefault)
    if (wireTypes.includes(defaultWire)) return defaultWire
  }

  return wireTypes[0] ?? ''
}

export function resolveCheckoutPaymentWireMethod(
  checkout: BranchCheckout | undefined,
  orderWireType?: string,
): string {
  const available = getCheckoutPaymentOptions(checkout, orderWireType)
  const wireMethods = available.map((o) => o.wireMethod)

  const defaultKey = checkout?.payments.default
  if (defaultKey) {
    const fromDefault = resolvePaymentWireMethod(defaultKey, orderWireType)
    if (fromDefault && wireMethods.includes(fromDefault)) return fromDefault
    const defaultWire = checkoutConfigKeyToWire(defaultKey)
    if (wireMethods.includes(defaultWire)) return defaultWire
  }

  return wireMethods[0] ?? ''
}

/** Maps serviceability capability keys → branch.checkout.delivery keys. */
const SERVICEABILITY_TO_DELIVERY_KEY: Partial<Record<keyof AddressCapabilities, string>> = {
  scheduled_delivery: 'scheduled',
  same_day: 'sameDay',
  contactless_delivery: 'contactless',
}

export function filterDeliveryCapabilities(
  capabilities: AddressCapabilities | null | undefined,
  checkout: BranchCheckout | undefined,
): AddressCapabilities | null {
  if (!capabilities) return null

  const delivery = checkout?.delivery
  if (!delivery) return capabilities

  const result = { ...capabilities }
  for (const key of Object.keys(capabilities) as (keyof AddressCapabilities)[]) {
    const deliveryKey = SERVICEABILITY_TO_DELIVERY_KEY[key]
    if (!deliveryKey) continue
    if (delivery[deliveryKey] !== true) {
      result[key] = false
    }
  }
  return result
}

// ── Presentation (labels/icons only — never used for availability) ─────────

const ORDER_TYPE_ICONS: Record<string, ElementType> = {
  delivery: Package,
  pickup: UtensilsCrossed,
  dine_in: UtensilsCrossed,
}

const PAYMENT_ICONS: Record<string, ElementType> = {
  card: CreditCard,
  cash: Banknote,
  online: Smartphone,
  wallet: Wallet,
}

function humanizeWireValue(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function humanizeConfigKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

type TranslateFn = (key: string) => string

/** Maps wire types to existing checkout i18n keys (presentation only). */
const LEGACY_ORDER_TYPE_I18N: Record<string, { label: string; desc?: string }> = {
  delivery: { label: 'delivery', desc: 'deliveryDesc' },
  pickup: { label: 'pickup', desc: 'pickupDesc' },
  dine_in: { label: 'dineIn', desc: 'dineInDesc' },
}

const LEGACY_PAYMENT_I18N: Record<string, { label: string; desc?: string }> = {
  card: { label: 'card', desc: 'cardDesc' },
  cash: { label: 'cash', desc: 'cashDesc' },
  online: { label: 'online', desc: 'onlineDesc' },
  wallet: { label: 'wallet', desc: 'walletDesc' },
}

/** branch.checkout.payments config keys → checkout i18n label keys. */
const PAYMENT_CONFIG_KEY_I18N: Record<string, string> = {
  cash: 'cash',
  cashOnDelivery: 'cash',
  card: 'card',
  online: 'online',
  wallet: 'wallet',
}

/** branch.checkout.orderTypes config keys → console i18n enabled-toggle keys. */
const ORDER_TYPE_CONFIG_CONSOLE_ENABLED: Record<string, string> = {
  delivery: 'deliveryEnabledLabel',
  pickup: 'pickupEnabledLabel',
  dineIn: 'dineInEnabledLabel',
}

/** branch.checkout.delivery flags → address.capabilities i18n keys. */
const DELIVERY_CONFIG_CAPABILITY_KEY: Record<string, string> = {
  scheduled: 'scheduled_delivery',
  sameDay: 'same_day',
  contactless: 'contactless_delivery',
}

export function getCheckoutOrderTypeLabel(wireType: string, t: TranslateFn): string {
  const legacy = LEGACY_ORDER_TYPE_I18N[wireType]
  if (legacy) return t(legacy.label)
  return humanizeWireValue(wireType)
}

export function getCheckoutOrderTypeDesc(wireType: string, t: TranslateFn): string {
  const legacy = LEGACY_ORDER_TYPE_I18N[wireType]
  if (legacy?.desc) return t(legacy.desc)
  return ''
}

export function getCheckoutOrderTypeIcon(wireType: string): ElementType {
  return ORDER_TYPE_ICONS[wireType] ?? ShoppingBag
}

export function getCheckoutPaymentLabel(wireMethod: string, t: TranslateFn): string {
  const legacy = LEGACY_PAYMENT_I18N[wireMethod]
  if (legacy) return t(legacy.label)
  return humanizeWireValue(wireMethod)
}

export function getCheckoutPaymentDesc(wireMethod: string, t: TranslateFn): string {
  const legacy = LEGACY_PAYMENT_I18N[wireMethod]
  if (legacy?.desc) return t(legacy.desc)
  return ''
}

export function getCheckoutPaymentIcon(wireMethod: string): ElementType {
  return PAYMENT_ICONS[wireMethod] ?? CreditCard
}

/** Admin form: label for a branch.checkout.payments config key (reuses checkout namespace). */
export function getCheckoutPaymentConfigKeyLabel(configKey: string, tCheckout: TranslateFn): string {
  const checkoutKey = PAYMENT_CONFIG_KEY_I18N[configKey]
  if (checkoutKey) return tCheckout(checkoutKey)
  return humanizeConfigKey(configKey)
}

/** Admin form: enabled-toggle label for a branch.checkout.orderTypes config key. */
export function getCheckoutOrderTypeConfigKeyEnabledLabel(
  configKey: string,
  tConsole: TranslateFn,
): string {
  const consoleKey = ORDER_TYPE_CONFIG_CONSOLE_ENABLED[configKey]
  if (consoleKey) return tConsole(consoleKey)
  return `${humanizeConfigKey(configKey)} enabled`
}

/** Admin form: label for a branch.checkout.delivery capability flag (reuses address.capabilities). */
export function getCheckoutDeliveryOptionLabel(
  configKey: string,
  tAddressCapabilities: TranslateFn,
): string {
  const capabilityKey = DELIVERY_CONFIG_CAPABILITY_KEY[configKey]
  if (capabilityKey) return tAddressCapabilities(capabilityKey)
  return humanizeConfigKey(configKey)
}
