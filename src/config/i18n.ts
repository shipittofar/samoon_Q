/**
 * Configuration Field Text Resolution — P9.5.4 Phase B/C
 *
 * `ConfigFieldDefinition.title`/`.description` (and the equivalent
 * `ConfigModuleDefinition.name`/`.description`/`.group` and
 * `ConfigSectionDefinition.title`/`.description`) are plain `string`
 * fields (`src/config/types.ts`) — changing that shape to a dedicated
 * "translation key" type would touch the schema every module file
 * depends on, which this phase's constraints forbid ("never change
 * architecture").
 *
 * Instead, this module resolves display text through a lookup that costs
 * nothing when a module hasn't been migrated: the `configFields` locale
 * namespace stores an optional override key per `${id}.${kind}`; a field
 * whose id has no such key simply renders its existing literal string
 * exactly as it always has. Migrating a module to translation keys is
 * then only ever additive — author the `configFields.<id>.title` entry
 * in en/fa/ar and the already-deployed rendering components (
 * ConfigurationFieldRow, ConfigurationEntityDrawer, ConfigurationInspector,
 * ConfigurationModulePage, ConfigurationStudioNav) pick it up automatically,
 * with zero further code change — the "every future feature becomes
 * localization-ready automatically" requirement, satisfied without a
 * second localization mechanism or a schema migration.
 */

export interface ConfigTextTranslator {
  has(key: string): boolean
  (key: string, values?: Record<string, string | number>): string
}

export type ConfigTextKind = 'title' | 'description' | 'name' | 'group'

/**
 * Resolves one piece of display text for a config id (module id, section
 * id, or field id) through the `configFields` namespace, falling back to
 * the literal string already stored on the definition when no
 * translation has been authored.
 */
export function resolveConfigText(
  t: ConfigTextTranslator,
  id: string,
  kind: ConfigTextKind,
  fallback: string | undefined,
): string | undefined {
  const key = `${id}.${kind}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- t.has()'s key type is namespace-scoped by next-intl's generated types; this helper is deliberately generic over any dotted id.
  if (t.has(key as any)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return t(key as any)
  }
  return fallback
}
