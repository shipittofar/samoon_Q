/**
 * Collection Fields — P9.2 / Phase K (Framework Improvement)
 *
 * Pure, generic helpers for `type: 'collection'` fields — "one schema, many
 * entities" (see types.ts's `ConfigCollectionMeta` doc comment for why this
 * exists instead of registering thousands of individual fields). Nothing
 * here references Countries, or any other specific module; Countries is
 * simply the first consumer, per this phase's mandate that framework
 * improvements benefit every future module equally.
 */
import type { ConfigFieldDefinition } from './types'

export interface ConfigCollectionEntry {
  entityId: string
  values: Record<string, unknown>
}

export type ConfigCollectionValue = Record<string, Record<string, unknown>>

function getSchema(field: ConfigFieldDefinition): ConfigFieldDefinition[] {
  return field.collection?.schema ?? []
}

/** The default value for every property, keyed by property id — the base every entity's stored patch is merged onto. */
function getEntityDefaults(field: ConfigFieldDefinition): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const prop of getSchema(field)) defaults[prop.id] = prop.default
  return defaults
}

function asCollectionValue(value: unknown): ConfigCollectionValue {
  return (value ?? {}) as ConfigCollectionValue
}

/**
 * Every entity in the collection, each with its stored values merged onto
 * the schema defaults. Iterates `field.collection.entityIds` when the module
 * declares a fixed roster (e.g. Countries' 176 ISO codes) so an entity with
 * no stored override still appears — falls back to the stored value's own
 * keys for an ad-hoc collection with no fixed roster.
 */
function getCollectionEntries(field: ConfigFieldDefinition, resolvedValue: unknown): ConfigCollectionEntry[] {
  const record = asCollectionValue(resolvedValue)
  const defaults = getEntityDefaults(field)
  const roster = field.collection?.entityIds ?? Object.keys(record)
  const ids = Array.from(new Set([...roster, ...Object.keys(record)]))
  return ids.map((entityId) => ({ entityId, values: { ...defaults, ...(record[entityId] ?? {}) } }))
}

/** One entity's values merged onto the schema defaults — safe even if the entity has no stored overrides yet. */
function getEntityValues(field: ConfigFieldDefinition, resolvedValue: unknown, entityId: string): Record<string, unknown> {
  const record = asCollectionValue(resolvedValue)
  return { ...getEntityDefaults(field), ...(record[entityId] ?? {}) }
}

/** Returns a new collection value with `patch` shallow-merged onto one entity — never mutates `current`. */
function buildMergedCollectionValue(current: unknown, entityId: string, patch: Record<string, unknown>): ConfigCollectionValue {
  const record = { ...asCollectionValue(current) }
  record[entityId] = { ...(record[entityId] ?? {}), ...patch }
  return record
}

/**
 * Returns a new collection value with one entity's stored overrides cleared
 * back to the schema defaults — or, called without an `entityId`, clears
 * every entity's stored overrides (the whole field resets to an empty
 * blob, since `getCollectionEntries`/`getEntityValues` already merge schema
 * defaults onto whatever is stored).
 */
function resetEntityToDefault(field: ConfigFieldDefinition, current: unknown): ConfigCollectionValue
function resetEntityToDefault(field: ConfigFieldDefinition, current: unknown, entityId: string): ConfigCollectionValue
function resetEntityToDefault(field: ConfigFieldDefinition, current: unknown, entityId?: string): ConfigCollectionValue {
  if (entityId === undefined) return {}
  const record = { ...asCollectionValue(current) }
  const defaults = getEntityDefaults(field)
  record[entityId] = { ...defaults }
  return record
}

function getEntityLabel(field: ConfigFieldDefinition, entityId: string): string {
  return field.collection?.getEntityLabel?.(entityId) ?? entityId
}

/** Generic property-equality filter — works for any collection's entity values, not just Countries'. `undefined` filter values are ignored (no constraint). */
export type ConfigCollectionFilterValue = string | number | boolean | undefined

function matchesFilters(values: Record<string, unknown>, filters: Record<string, ConfigCollectionFilterValue>): boolean {
  for (const [propertyId, expected] of Object.entries(filters)) {
    if (expected === undefined) continue
    if (values[propertyId] !== expected) return false
  }
  return true
}

export const configCollection = {
  getSchema,
  getEntityDefaults,
  getCollectionEntries,
  getEntityValues,
  buildMergedCollectionValue,
  resetEntityToDefault,
  getEntityLabel,
  matchesFilters,
}
