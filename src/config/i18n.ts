/**
 * Configuration Field Text Resolution — P9.5.4 Phase B/C, extended P9.5.7D.1
 *
 * `ConfigFieldDefinition.title`/`.description` (and the equivalent
 * `ConfigModuleDefinition.name`/`.description`/`.group` and
 * `ConfigSectionDefinition.title`/`.description`) are plain `string`
 * fields (`src/config/types.ts`) — changing that shape to a dedicated
 * "translation key" type would touch the schema every module file
 * depends on. Instead, this module resolves display text through a
 * lookup that costs nothing when a module hasn't been migrated: the
 * `configFields` locale namespace stores an optional override key per
 * translation id, and a definition whose id has no such key simply
 * renders its existing literal string exactly as it always has.
 * Migrating a module to translation keys is then only ever additive —
 * author the key in en/fa/ar and the already-deployed rendering
 * components pick it up automatically, with zero further code change.
 *
 * P9.5.7D.1 — Stable Translation IDs
 * ===================================
 * The original mechanism keyed every lookup off a bare `id: string`
 * (`${id}.${kind}`). That's exactly right for module/section/top-level-
 * field ids, which `PlatformConfigurationRegistry.register()` already
 * enforces as globally unique (Rule 3) — but it silently breaks for two
 * categories of object that were never covered by that uniqueness
 * check:
 *
 * 1. Collection item schemas (`ConfigCollectionMeta.schema`, P9.2) —
 *    e.g. Countries' `COUNTRY_SCHEMA`, Languages' `LANGUAGE_SCHEMA`.
 *    These are ordinary `ConfigFieldDefinition[]` arrays authored with
 *    `defineField()`, but they are deliberately *never* passed to
 *    `platformConfigurationRegistry.register()` individually (see the
 *    doc comment on `ConfigCollectionMeta` in `types.ts`) — they exist
 *    purely so the existing field-rendering components can render one
 *    property per entity, generically. Because they skip registration,
 *    their `id`s (short, human-authored — `'enabled'`, `'status'`,
 *    `'region'`, `'notes'`) are never checked for uniqueness *across*
 *    different collections. Two unrelated collections both having a
 *    boolean field literally called `'enabled'` is completely
 *    reasonable data modeling — but a flat `${id}.${kind}` lookup key
 *    would resolve both through the exact same translation, silently
 *    mistranslating whichever one authored second.
 *
 * 2. `ConfigFieldOption` (`select`/`radio`/`*_picker` option lists) —
 *    these never had an id *at all*, only a `value` and a `label`; there
 *    was no id to build a lookup key from in the first place, so no
 *    module's option labels were ever translatable.
 *
 * The fix is `id`/`kind` becoming `idPath: string | string[]` — an
 * ordered list of scope segments joined with `.` — plus two additive,
 * backward-compatible changes:
 *   - `ConfigFieldOption.id?: string` (types.ts) — an optional stable id,
 *     independent of `value`. `getConfigOptionId()` below derives a
 *     deterministic fallback id from `value` when `id` is omitted, so
 *     every existing option array keeps compiling and rendering
 *     unchanged.
 *   - Callers building a scoped id for a collection schema property pass
 *     `[collectionFieldId, 'schema', propertyId]` instead of a bare
 *     `propertyId` — namespacing every property under the collection
 *     field that owns it, the same way `registerAdminModule()` already
 *     namespaces bare module-field ids under their module id
 *     (`register-module.ts:54`). Every existing single-string call site
 *     (`resolveConfigText(t, field.id, 'title', ...)`) is unaffected —
 *     a bare string is just a one-segment path.
 */

import type { ConfigFieldOption } from './types'

export interface ConfigTextTranslator {
  has(key: string): boolean
  (key: string, values?: Record<string, string | number>): string
}

export type ConfigTextKind = 'title' | 'description' | 'name' | 'group' | 'label'

/** Joins a scoped id path into the dotted key segment `resolveConfigText` looks up under. A bare string is a one-segment path — fully backward compatible with every pre-P9.5.7D.1 call site. */
function joinIdPath(idPath: string | string[]): string {
  return Array.isArray(idPath) ? idPath.join('.') : idPath
}

/**
 * Resolves one piece of display text for a config id path (module id,
 * section id, field id, or a scoped `[collectionFieldId, 'schema',
 * propertyId]` / `[fieldId, 'options', optionId]` path) through the
 * `configFields` namespace, falling back to the literal string already
 * stored on the definition when no translation has been authored.
 */
export function resolveConfigText(
  t: ConfigTextTranslator,
  idPath: string | string[],
  kind: ConfigTextKind,
  fallback: string | undefined,
): string | undefined {
  const key = `${joinIdPath(idPath)}.${kind}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- t.has()'s key type is namespace-scoped by next-intl's generated types; this helper is deliberately generic over any dotted id.
  if (t.has(key as any)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return t(key as any)
  }
  return fallback
}

/**
 * Derives a stable, deterministic translation-key segment for one
 * `ConfigFieldOption` — its own `id` when the module author set one,
 * otherwise a slug of `value` (sanitized to safe key characters, e.g.
 * `'North America'` → `'North_America'`). Same option, same derived id,
 * every time — no registry, no runtime state, no risk of drifting from
 * what a translation file author sees when reading the option's
 * `value` in source.
 */
export function getConfigOptionId(option: ConfigFieldOption): string {
  if (option.id) return option.id
  return String(option.value).replace(/[^a-zA-Z0-9_]+/g, '_')
}

/**
 * Resolves one `ConfigFieldOption`'s `label` (or `description`) through
 * the `configFields` namespace, scoped under the field/property that
 * owns the option list — `${scopeId}.options.${optionId}.${kind}` —
 * falling back to the option's own literal text when untranslated.
 * `scopeId` is the *field's own* id path for a top-level module field,
 * or the collection-scoped `[collectionFieldId, 'schema', propertyId]`
 * path for a collection-schema property — see `ConfigurationFieldControl`'s
 * `optionScopeId` prop.
 */
export function resolveConfigOptionText(
  t: ConfigTextTranslator,
  scopeId: string | string[],
  option: ConfigFieldOption,
  kind: 'label' | 'description',
  fallback: string | undefined,
): string | undefined {
  const base = Array.isArray(scopeId) ? scopeId : [scopeId]
  return resolveConfigText(t, [...base, 'options', getConfigOptionId(option)], kind, fallback)
}
