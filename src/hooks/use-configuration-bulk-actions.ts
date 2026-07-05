'use client'

/**
 * useConfigurationBulkActions — P9.2 Phase D (Framework Improvement)
 *
 * Generic bulk-operation engine for any `'collection'` field — Countries is
 * the first consumer ("select N countries, disable them all"), but nothing
 * here references Countries. It operates purely on `field.collection.schema`
 * conventions (an `enabled` boolean property and/or a `status` select
 * property, if the schema declares them) plus the existing
 * `configCollection` helpers, so a future Branches/Tenants collection field
 * gets working bulk actions for free just by declaring a matching schema —
 * per Phase K's mandate, this is a framework capability, not Countries code.
 *
 * Deliberately pure: it computes the next collection value but never calls
 * `configurationService.updateField()` itself. Persisting it is the caller's
 * job via the field's own `onChange` (the same prop `ConfigurationFieldRow`
 * already wires to `useConfigurationDraft`'s `setFieldDraft`), so a bulk
 * action becomes just another pending edit — it flows through the one
 * existing dirty/validate/save/audit pipeline instead of a second,
 * duplicate persistence path.
 */
import { useCallback, useState } from 'react'
import { configCollection } from '@/config'
import type { ConfigBulkActionKind, ConfigBulkActionResult, ConfigFieldDefinition } from '@/config'

const ENABLED_PROPERTY_ID = 'enabled'
const STATUS_PROPERTY_ID = 'status'
const PUBLISHED_STATUS_VALUE = 'published'
const ARCHIVED_STATUS_VALUE = 'archived'

export interface ConfigBulkActionComputation {
  result: ConfigBulkActionResult
  /** Present only when the action mutates the collection — `undefined` for read-only actions (export) or a rejected/failed action. */
  nextValue?: unknown
}

/** Shape one 'export' action produces and 'import' now accepts back — `[{ entityId, values }]`. */
interface ImportedEntry {
  entityId: string
  values: Record<string, unknown>
}

function parseImportPayload(raw: string): ImportedEntry[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  if (!parsed.every((e) => e && typeof e === 'object' && typeof (e as ImportedEntry).entityId === 'string' && typeof (e as ImportedEntry).values === 'object')) {
    return null
  }
  return parsed as ImportedEntry[]
}

export function useConfigurationBulkActions(field: ConfigFieldDefinition | undefined) {
  const [lastResult, setLastResult] = useState<ConfigBulkActionResult | null>(null)

  const hasSchemaProperty = useCallback((propertyId: string) => {
    if (!field) return false
    return configCollection.getSchema(field).some((prop) => prop.id === propertyId)
  }, [field])

  const computeBulkAction = useCallback((
    kind: ConfigBulkActionKind,
    currentValue: unknown,
    entityIds: string[],
    /**
     * Only meaningful for `kind === 'import'` — the raw JSON text an admin
     * pasted/uploaded, in the exact shape `'export'` produces (P9.5.6 Phase
     * G). Every other action ignores this parameter.
     */
    importPayload?: string,
  ): ConfigBulkActionComputation => {
    if (!field) {
      const result: ConfigBulkActionResult = { action: kind, affectedIds: [], ok: false, message: 'No collection field selected.' }
      setLastResult(result)
      return { result }
    }

    if (kind === 'export') {
      if (entityIds.length === 0) {
        const result: ConfigBulkActionResult = { action: kind, affectedIds: [], ok: false, message: 'Select at least one item first.' }
        setLastResult(result)
        return { result }
      }
      const entries = entityIds.map((entityId) => ({ entityId, values: configCollection.getEntityValues(field, currentValue, entityId) }))
      const result: ConfigBulkActionResult = { action: kind, affectedIds: entityIds, ok: true, message: JSON.stringify(entries, null, 2) }
      setLastResult(result)
      return { result }
    }

    if (kind === 'import') {
      const entries = importPayload ? parseImportPayload(importPayload) : null
      if (!entries) {
        const result: ConfigBulkActionResult = { action: kind, affectedIds: [], ok: false, message: 'Invalid import payload — expected JSON matching the Export format: [{ "entityId": "...", "values": { ... } }].' }
        setLastResult(result)
        return { result }
      }
      let nextValue = currentValue
      for (const entry of entries) {
        nextValue = configCollection.buildMergedCollectionValue(nextValue, entry.entityId, entry.values)
      }
      const affectedIds = entries.map((e) => e.entityId)
      const result: ConfigBulkActionResult = { action: kind, affectedIds, ok: true, message: `Imported ${affectedIds.length} ${affectedIds.length === 1 ? 'entry' : 'entries'}.` }
      setLastResult(result)
      return { result, nextValue }
    }

    if (entityIds.length === 0) {
      const result: ConfigBulkActionResult = { action: kind, affectedIds: [], ok: false, message: 'Select at least one item first.' }
      setLastResult(result)
      return { result }
    }

    let nextValue = currentValue
    for (const entityId of entityIds) {
      if (kind === 'reset') {
        nextValue = configCollection.resetEntityToDefault(field, nextValue, entityId)
        continue
      }
      const patch: Record<string, unknown> = {}
      if (kind === 'enable' && hasSchemaProperty(ENABLED_PROPERTY_ID)) patch[ENABLED_PROPERTY_ID] = true
      if (kind === 'disable' && hasSchemaProperty(ENABLED_PROPERTY_ID)) patch[ENABLED_PROPERTY_ID] = false
      if (kind === 'publish' && hasSchemaProperty(STATUS_PROPERTY_ID)) patch[STATUS_PROPERTY_ID] = PUBLISHED_STATUS_VALUE
      if (kind === 'archive' && hasSchemaProperty(STATUS_PROPERTY_ID)) patch[STATUS_PROPERTY_ID] = ARCHIVED_STATUS_VALUE
      nextValue = configCollection.buildMergedCollectionValue(nextValue, entityId, patch)
    }

    // P9.5.6 Phase H — a batch publish must not leave the collection in a
    // state its own cross-entity validator rejects (e.g. two languages both
    // marked default). Reject the whole batch rather than partially apply
    // it, and report exactly why.
    if (kind === 'publish' && field.collection?.validateEntries) {
      const errors = field.collection.validateEntries(nextValue as Record<string, Record<string, unknown>>)
      if (errors.length > 0) {
        const result: ConfigBulkActionResult = {
          action: kind,
          affectedIds: [],
          ok: false,
          message: `Publish rejected — resolving validation issues first: ${errors.map((e) => e.message).join(' ')}`,
        }
        setLastResult(result)
        return { result }
      }
    }

    const result: ConfigBulkActionResult = { action: kind, affectedIds: entityIds, ok: true }
    setLastResult(result)
    return { result, nextValue }
  }, [field, hasSchemaProperty])

  return { computeBulkAction, lastResult }
}
