/**
 * Vertical registry — the single source of truth for per-business-type
 * catalog shape (item kinds, attribute schema) and behaviour flags.
 * Wording lives in i18n under `verticals.*` (see useCatalogTerms()).
 *
 * Adding a vertical: add its BusinessType, an entry here, a module in
 * src/modules/registry.ts, a provisioning template, and i18n keys.
 */
import type { BusinessType } from '@/types'
import type {
  CatalogAttributeDefinition,
  CatalogAttributeValue,
  CatalogItemAttributes,
  CatalogItemKind,
  VerticalDefinition,
} from './types'

const FOOD_BASE = {
  family: 'food',
  itemKinds: ['product'],
  attributes: [],
  usesFoodFields: true,
  supportsCart: true,
} as const satisfies Omit<VerticalDefinition, 'key' | 'emoji'>

/** Shared by appointment-style service verticals. */
const SERVICE_ATTRIBUTES: readonly CatalogAttributeDefinition[] = [
  { key: 'duration_minutes', type: 'number', min: 5, max: 1440, appliesTo: ['service', 'package'], showOnCard: true },
  { key: 'price_is_starting', type: 'boolean', appliesTo: ['service', 'package'] },
  { key: 'requires_appointment', type: 'boolean', appliesTo: ['service', 'package'] },
]

export const VERTICALS: Readonly<Record<BusinessType, VerticalDefinition>> = Object.freeze({
  restaurant: { key: 'restaurant', emoji: '🍽️', ...FOOD_BASE },
  cafe: { key: 'cafe', emoji: '☕', ...FOOD_BASE },
  bar: { key: 'bar', emoji: '🍸', ...FOOD_BASE },
  food_court: { key: 'food_court', emoji: '🏬', ...FOOD_BASE },
  food_truck: { key: 'food_truck', emoji: '🚚', ...FOOD_BASE },
  mobile_cafe: { key: 'mobile_cafe', emoji: '🛺', ...FOOD_BASE },
  hotel: { key: 'hotel', emoji: '🏨', ...FOOD_BASE },
  other: { key: 'other', emoji: '🏪', ...FOOD_BASE },
  beauty_salon: {
    key: 'beauty_salon',
    family: 'service',
    emoji: '💇',
    itemKinds: ['service', 'package', 'product'],
    attributes: [
      ...SERVICE_ATTRIBUTES,
      { key: 'audience', type: 'select', options: ['all', 'women', 'men', 'kids'], appliesTo: ['service', 'package'] },
    ],
    usesFoodFields: false,
    supportsCart: false,
  },
  clinic: {
    key: 'clinic',
    family: 'service',
    emoji: '🩺',
    itemKinds: ['service', 'package'],
    attributes: [
      ...SERVICE_ATTRIBUTES,
      { key: 'consultation_mode', type: 'select', options: ['in_person', 'online', 'both'] },
      { key: 'preparation_notes', type: 'text' },
    ],
    usesFoodFields: false,
    supportsCart: false,
  },
})

/** The original single-vertical behaviour — used whenever nothing better is known. */
export const DEFAULT_VERTICAL: VerticalDefinition = VERTICALS.restaurant

export function isKnownVertical(key: string): key is BusinessType {
  return Object.prototype.hasOwnProperty.call(VERTICALS, key)
}

/**
 * Resolves a tenant's vertical from its `businessTypes` (module keys).
 * The first known type wins; unknown/empty → DEFAULT_VERTICAL, so every
 * existing food tenant behaves exactly as before.
 */
export function resolveVertical(businessTypes: readonly string[] | null | undefined): VerticalDefinition {
  for (const type of businessTypes ?? []) {
    if (isKnownVertical(type)) return VERTICALS[type]
  }
  return DEFAULT_VERTICAL
}

/** Attribute definitions that apply to `kind` within `vertical`. */
export function attributesForKind(
  vertical: VerticalDefinition,
  kind: CatalogItemKind,
): CatalogAttributeDefinition[] {
  return vertical.attributes.filter((a) => !a.appliesTo || a.appliesTo.includes(kind))
}

/** The item kind to assume when an item has none (legacy rows) or an invalid one. */
export function effectiveItemKind(vertical: VerticalDefinition, kind: string | null | undefined): CatalogItemKind {
  return kind && (vertical.itemKinds as readonly string[]).includes(kind)
    ? (kind as CatalogItemKind)
    : vertical.itemKinds[0]
}

/** Raw form values (strings from inputs, booleans from checkboxes). */
export type CatalogAttributeFormValues = Record<string, string | boolean>

/**
 * Converts raw form values into typed attributes for the API, keeping only
 * fields that apply to `kind`. Empty / invalid values are dropped rather
 * than sent as junk.
 */
export function serializeAttributes(
  vertical: VerticalDefinition,
  kind: CatalogItemKind,
  raw: CatalogAttributeFormValues,
): CatalogItemAttributes {
  const out: CatalogItemAttributes = {}
  for (const def of attributesForKind(vertical, kind)) {
    const value = raw[def.key]
    if (value === undefined) continue
    switch (def.type) {
      case 'boolean':
        if (typeof value === 'boolean') out[def.key] = value
        break
      case 'number': {
        if (typeof value !== 'string' || value.trim() === '') break
        const n = Number(value)
        if (!Number.isFinite(n)) break
        if (def.min !== undefined && n < def.min) break
        if (def.max !== undefined && n > def.max) break
        out[def.key] = n
        break
      }
      case 'select':
        if (typeof value === 'string' && def.options?.includes(value)) out[def.key] = value
        break
      case 'text':
        if (typeof value === 'string' && value.trim() !== '') out[def.key] = value.trim()
        break
    }
  }
  return out
}

/** Inverse of serializeAttributes() — typed attributes → form values. */
export function attributesToFormValues(attributes: CatalogItemAttributes | null | undefined): CatalogAttributeFormValues {
  const out: CatalogAttributeFormValues = {}
  for (const [key, value] of Object.entries(attributes ?? {})) {
    out[key] = typeof value === 'boolean' ? value : String(value as CatalogAttributeValue)
  }
  return out
}

/** Typed read of a numeric attribute (e.g. duration_minutes). */
export function numericAttribute(attributes: CatalogItemAttributes | null | undefined, key: string): number | undefined {
  const value = attributes?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
