/**
 * Configuration Console — pure UI helpers (P9.1.3)
 *
 * No React here — every function is a pure transform over
 * ConfigFieldDefinition / ResolvedConfigValue so it can be unit-tested
 * without mounting a component, and reused by any future module's Console
 * page (Countries, Themes, Payments, …) without duplicating this logic.
 */
import type {
  ConfigFieldCondition,
  ConfigFieldDefinition,
  ConfigUIControlType,
  ResolvedConfigValue,
} from '@/config'
import { configCollection, type ConfigCollectionEntry, type ConfigCollectionFilterValue } from '@/config'

// ── Phase C — control inference ───────────────────────────────────────────────

/**
 * Resolves which control to render: `field.uiControl` if the module author
 * set one, otherwise a sensible default purely from `field.type` (see the
 * mapping table in docs/P9.1.2.1_CONFIGURATION_METADATA.md §2).
 */
export function resolveUiControl(field: ConfigFieldDefinition): ConfigUIControlType {
  if (field.uiControl) return field.uiControl
  switch (field.type) {
    case 'string': return 'text'
    case 'number': return 'number'
    case 'boolean': return 'switch'
    case 'select': return 'radio'
    case 'multi-select': return 'checkbox'
    case 'color': return 'color_picker'
    case 'font': return 'font_selector'
    case 'json':
    case 'object':
    case 'array': return 'json_editor'
    case 'password':
    case 'secret': return 'secret_input'
    case 'country': return 'country_selector'
    case 'language': return 'language_selector'
    case 'feature_flag': return 'switch'
    case 'permission': return 'radio'
    default: return 'text'
  }
}

// ── Phase F — dependency engine ───────────────────────────────────────────────

/** Evaluates one condition against the currently-resolved value of the field it references. */
export function evaluateCondition(
  condition: ConfigFieldCondition | undefined,
  resolvedValues: Record<string, ResolvedConfigValue>,
): boolean {
  if (!condition) return false
  const actual = resolvedValues[condition.fieldId]?.value
  if (condition.equals !== undefined) return actual === condition.equals
  if (condition.notEquals !== undefined) return actual !== condition.notEquals
  if (condition.in) return condition.in.includes(actual)
  return false
}

/** False hides the field entirely — the Console never renders a row for it. */
export function isFieldVisible(
  field: ConfigFieldDefinition,
  resolvedValues: Record<string, ResolvedConfigValue>,
): boolean {
  const hiddenWhen = field.dependency?.hiddenWhen
  if (hiddenWhen && evaluateCondition(hiddenWhen, resolvedValues)) return false
  return true
}

/** False renders the field's control disabled (but still visible), with a reason tooltip. */
export function isFieldEnabled(
  field: ConfigFieldDefinition,
  resolvedValues: Record<string, ResolvedConfigValue>,
): boolean {
  const enabledWhen = field.dependency?.enabledWhen
  if (!enabledWhen) return true
  return evaluateCondition(enabledWhen, resolvedValues)
}

// ── Phase G — search ──────────────────────────────────────────────────────────

/**
 * Joins any set of searchable text fragments into one lowercase haystack.
 * Shared by plain-field search and collection-entry search (Phase E, P9.2) so
 * "match a free-text query against a bag of strings" is defined exactly once.
 */
export function buildSearchHaystack(parts: Array<string | undefined | null>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
}

/**
 * Matches a field against a free-text query across every Phase G search
 * surface. `resolvedTitle`/`resolvedDescription` (P9.5.4 Phase E) let a
 * caller pass the already-localized display text (via
 * `resolveConfigText()`) so search matches translated content when a
 * module has been migrated to `configFields` keys — this pure helper has
 * no access to `useTranslations()` itself, so resolution happens at the
 * call site and is threaded through here; omitting them falls back to the
 * field's own literal `title`/`description`, unchanged from every prior
 * phase.
 */
export function matchesSearch(
  field: ConfigFieldDefinition,
  query: string,
  resolvedTitle?: string,
  resolvedDescription?: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = buildSearchHaystack([
    field.display?.displayName,
    resolvedTitle ?? field.title,
    resolvedDescription ?? field.description,
    field.helpText,
    field.category,
    field.display?.subcategory,
    field.display?.group,
    ...(field.display?.tags ?? []),
    ...(field.search?.keywords ?? []),
    ...(field.search?.aliases ?? []),
  ])
  return haystack.includes(q)
}

/**
 * Matches one collection entry (e.g. a country) against a free-text query —
 * the collection-field analogue of `matchesSearch`, reusing the same
 * haystack builder so search behaves identically whether the searchable
 * unit is a top-level field or a row inside a `'collection'` field. Any
 * schema property carrying `search.keywords`/`search.aliases` contributes
 * those too, so per-property search metadata (e.g. a country's ISO code
 * aliases) is picked up generically, with no per-module search code.
 */
export function matchesCollectionEntrySearch(
  field: ConfigFieldDefinition,
  entry: ConfigCollectionEntry,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const schema = configCollection.getSchema(field)
  const propertyParts = schema.flatMap((prop) => [
    String(entry.values[prop.id] ?? ''),
    ...(prop.search?.keywords ?? []),
    ...(prop.search?.aliases ?? []),
  ])
  const haystack = buildSearchHaystack([
    entry.entityId,
    configCollection.getEntityLabel(field, entry.entityId),
    ...(field.collection?.getEntitySearchTerms?.(entry.entityId) ?? []),
    ...propertyParts,
  ])
  return haystack.includes(q)
}

// ── Phase F — generic filter engine ───────────────────────────────────────────

/** One selectable filter option, derived from a collection's own schema — never hand-authored per module. */
export interface ConfigCollectionFilterOption {
  propertyId: string
  label: string
  value: ConfigCollectionFilterValue
}

/**
 * Derives the available filter options for a collection field straight from
 * its schema: every `boolean` property becomes an Enabled/Disabled pair,
 * every `select` property with `validation.options` becomes one option per
 * choice. This is the Phase F "generic filtering engine" — Countries is the
 * first consumer, but any future collection (Branches, Tenants, …) gets
 * working filters for free just by declaring its schema.
 */
export function deriveCollectionFilterOptions(field: ConfigFieldDefinition): ConfigCollectionFilterOption[] {
  const options: ConfigCollectionFilterOption[] = []
  for (const prop of configCollection.getSchema(field)) {
    const label = prop.display?.displayName ?? prop.title
    if (prop.type === 'boolean') {
      options.push({ propertyId: prop.id, label: `${label}: Enabled`, value: true })
      options.push({ propertyId: prop.id, label: `${label}: Disabled`, value: false })
      continue
    }
    if (prop.type === 'select') {
      for (const opt of prop.options ?? []) {
        options.push({ propertyId: prop.id, label: `${label}: ${opt.label}`, value: opt.value as ConfigCollectionFilterValue })
      }
    }
  }
  return options
}

/** Re-exported for convenience so Console pages only need one import site for entry-level filtering. */
export const matchesCollectionEntryFilters = configCollection.matchesFilters

// ── Phase H — configuration state ─────────────────────────────────────────────

export type ConfigFieldState = 'default' | 'modified' | 'tenant_override' | 'branch_override' | 'user_override'

/**
 * A field resolved at platform scope with no override present reports
 * `resolvedFrom: 'platform'` identically to one explicitly overridden AT
 * platform level (ConfigurationResolver has no separate signal for "never
 * touched" vs. "touched at the owning level") — so "modified" is derived by
 * comparing the resolved value to `field.default` directly, not by reading
 * `resolvedFrom` alone. `resolvedFrom` is only decisive for descendant
 * levels (tenant/branch/user), where its presence unambiguously means an
 * override exists at that level.
 */
export function deriveFieldState(field: ConfigFieldDefinition, resolved: ResolvedConfigValue): ConfigFieldState {
  if (resolved.resolvedFrom === 'tenant') return 'tenant_override'
  if (resolved.resolvedFrom === 'branch') return 'branch_override'
  if (resolved.resolvedFrom === 'user') return 'user_override'
  const isDefault = JSON.stringify(resolved.value) === JSON.stringify(field.default)
  return isDefault ? 'default' : 'modified'
}

export const CONFIG_FIELD_STATE_LABEL: Record<ConfigFieldState, string> = {
  default: 'Default',
  modified: 'Modified',
  tenant_override: 'Tenant Override',
  branch_override: 'Branch Override',
  user_override: 'User Override',
}
