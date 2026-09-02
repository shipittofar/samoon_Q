/**
 * Canonical Tenant.settings contract — listing/branding/rollout configuration only.
 * Branch-owned fields must never be read from or written to this object.
 */

import type { AddressCapabilities } from '@/types/address'
import type { TenantSettings, TenantTheme } from '@/types'
import {
  pickTenantMarketplace,
  type TenantMarketplaceSettings,
} from '@/types/marketplace'

export const TENANT_SETTINGS_KEYS = [
  'theme',
  'featureFlags',
  'addressCapabilities',
  'marketplace',
  'contactEmail',
  'contactPhone',
  'notificationMatrix',
] as const

export type CanonicalTenantSettingsKey = (typeof TENANT_SETTINGS_KEYS)[number]

/** Keys that used to live on Tenant.settings and now belong to Branch / other APIs. */
export const DEPRECATED_TENANT_SETTINGS_KEYS = [
  'currency',
  'language',
  'timezone',
  'time_zone',
  'ordering',
  'features',
  'businessHours',
] as const

/** Mock-only persistence for website-builder fixtures (real mode uses dedicated website APIs). */
const MOCK_ONLY_SETTINGS_KEYS = ['websiteBuilder', 'branchOverrides'] as const

export type TenantContactFallback = {
  contactEmail?: string
  contactPhone?: string
}

export function pickTenantContact(settings?: TenantSettings): TenantContactFallback {
  return {
    contactEmail: typeof settings?.contactEmail === 'string' ? settings.contactEmail : undefined,
    contactPhone: typeof settings?.contactPhone === 'string' ? settings.contactPhone : undefined,
  }
}

/**
 * Public contact: Branch first, then Tenant.settings.contactPhone / contactEmail.
 */
export function resolvePublicContact(
  branch?: { phone_number?: string; email?: string },
  tenantContact?: TenantContactFallback,
): { phone_number?: string; email?: string } {
  return {
    phone_number: branch?.phone_number || tenantContact?.contactPhone,
    email: branch?.email || tenantContact?.contactEmail,
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickTheme(raw: unknown): TenantTheme | undefined {
  if (!isPlainObject(raw)) return undefined
  const theme: TenantTheme = {
    primaryColor: typeof raw.primaryColor === 'string' ? raw.primaryColor : raw.primaryColor === null ? null : undefined,
    accentHoverColor:
      typeof raw.accentHoverColor === 'string'
        ? raw.accentHoverColor
        : raw.accentHoverColor === null
          ? null
          : undefined,
    fontBody: typeof raw.fontBody === 'string' ? raw.fontBody : raw.fontBody === null ? null : undefined,
    fontsByLocale:
      isPlainObject(raw.fontsByLocale) || raw.fontsByLocale === null
        ? (raw.fontsByLocale as TenantTheme['fontsByLocale'])
        : undefined,
  }
  if (
    theme.primaryColor === undefined &&
    theme.accentHoverColor === undefined &&
    theme.fontBody === undefined &&
    theme.fontsByLocale === undefined
  ) {
    return undefined
  }
  return theme
}

function pickFeatureFlags(raw: unknown): Record<string, boolean> | undefined {
  if (!isPlainObject(raw)) return undefined
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function pickAddressCapabilities(raw: unknown): AddressCapabilities | undefined {
  if (!isPlainObject(raw)) return undefined
  return {
    cash_on_delivery: raw.cash_on_delivery === true,
    scheduled_delivery: raw.scheduled_delivery === true,
    same_day: raw.same_day === true,
    contactless_delivery: raw.contactless_delivery === true,
  }
}

function pickNotificationMatrix(raw: unknown): Record<string, Record<string, boolean>> | undefined {
  if (!isPlainObject(raw)) return undefined
  const out: Record<string, Record<string, boolean>> = {}
  for (const [event, channels] of Object.entries(raw)) {
    if (!isPlainObject(channels)) continue
    const row: Record<string, boolean> = {}
    for (const [channel, enabled] of Object.entries(channels)) {
      if (typeof enabled === 'boolean') row[channel] = enabled
    }
    out[event] = row
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function pickString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

/**
 * Strips deprecated Branch-owned keys and unknown settings from a tenant settings bag.
 * `allowMockExtras` keeps websiteBuilder for mock website-builder storage only.
 */
export function sanitizeTenantSettings(
  raw: unknown,
  options?: { allowMockExtras?: boolean },
): TenantSettings | undefined {
  if (!isPlainObject(raw)) return undefined

  const marketplace = pickTenantMarketplace(raw.marketplace as TenantMarketplaceSettings | undefined)
  const settings: TenantSettings = {}

  const theme = pickTheme(raw.theme)
  if (theme) settings.theme = theme

  const featureFlags = pickFeatureFlags(raw.featureFlags)
  if (featureFlags) settings.featureFlags = featureFlags

  const addressCapabilities = pickAddressCapabilities(raw.addressCapabilities)
  if (addressCapabilities) settings.addressCapabilities = addressCapabilities

  if (marketplace) settings.marketplace = marketplace

  const contactEmail = pickString(raw.contactEmail)
  if (contactEmail) settings.contactEmail = contactEmail

  const contactPhone = pickString(raw.contactPhone)
  if (contactPhone) settings.contactPhone = contactPhone

  const notificationMatrix = pickNotificationMatrix(raw.notificationMatrix)
  if (notificationMatrix) settings.notificationMatrix = notificationMatrix

  if (options?.allowMockExtras) {
    for (const key of MOCK_ONLY_SETTINGS_KEYS) {
      if (key in raw) (settings as Record<string, unknown>)[key] = raw[key]
    }
  }

  return Object.keys(settings).length > 0 ? settings : undefined
}

/** PATCH payload: only canonical keys; marketplace listing fields only. */
export function sanitizeTenantSettingsPatch(
  patch: Record<string, unknown>,
  options?: { allowMockExtras?: boolean },
): Record<string, unknown> {
  const sanitized = sanitizeTenantSettings(patch, options) ?? {}
  const out: Record<string, unknown> = { ...sanitized }
  return out
}
