/**
 * Business verticals — Phase 1 (docs/BUSINESS_SERVICES_ROADMAP.md).
 *
 * A vertical describes WHAT a business sells and how its catalog is worded
 * and shaped — independent of the module registry, which describes which
 * routes / capabilities / admin screens a business type activates.
 *
 * `family` groups verticals that share wording and behaviour:
 *   - food    — the original restaurant/cafe/bar menus (cart + ordering)
 *   - service — appointment-style businesses (salon, clinic): items are
 *               services with a duration; no cart.
 */
import type { BusinessType } from '@/types'

export type BusinessFamily = 'food' | 'service'

/** What a catalog entry is. Food menus only use `product`. */
export type CatalogItemKind = 'product' | 'service' | 'package'

export const CATALOG_ITEM_KINDS: readonly CatalogItemKind[] = ['product', 'service', 'package']

export type CatalogAttributeValue = string | number | boolean

/** Vertical-specific fields stored on `MenuItem.attributes`. */
export type CatalogItemAttributes = Record<string, CatalogAttributeValue>

export type CatalogAttributeType = 'number' | 'text' | 'boolean' | 'select'

export interface CatalogAttributeDefinition {
  /** Key under `MenuItem.attributes`. snake_case, stable — part of the API contract. */
  key: string
  type: CatalogAttributeType
  /** Allowed values for `select`; labels live at `verticals.attributeOptions.<key>.<value>`. */
  options?: readonly string[]
  /** Item kinds this field applies to. Omitted → all kinds of the vertical. */
  appliesTo?: readonly CatalogItemKind[]
  /** Inclusive numeric bounds for `number`. */
  min?: number
  max?: number
  required?: boolean
  /** Surface this value on public item cards (e.g. duration). */
  showOnCard?: boolean
}

export interface VerticalDefinition {
  key: BusinessType
  family: BusinessFamily
  emoji: string
  /** Item kinds an owner may choose from; first entry is the default. */
  itemKinds: readonly [CatalogItemKind, ...CatalogItemKind[]]
  attributes: readonly CatalogAttributeDefinition[]
  /** Show the legacy food fields (calories, preparation time). */
  usesFoodFields: boolean
  /** Items can be added to a cart and ordered online. */
  supportsCart: boolean
  /**
   * Phase L1 — service area used when a branch hasn't configured one:
   * the mode it gets and the radius it is shown within ("near me").
   */
  defaultServiceArea: { mode: 'delivery' | 'on_site' | 'visit_only'; radiusKm: number }
}
