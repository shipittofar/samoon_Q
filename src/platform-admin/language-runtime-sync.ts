/**
 * Language Admin -> Runtime Sync — P9.5.6 (Audit gap #2)
 *
 * The Platform Administration language collection (30 entries,
 * `platform.languages.registry`) and the actual request-time locale engine
 * (`src/i18n/runtime.ts`, driven by the small `languages.supported` /
 * `languages.default` / `languages.rtl_locales` fields) are two separate
 * systems today — see docs/P9.5.6_LANGUAGE_ADMIN_AUDIT.md, gap #2.
 * Toggling a language `enabled` in the admin collection currently has no
 * runtime effect.
 *
 * This module computes what those three runtime fields SHOULD be, derived
 * from the admin collection's current state — but does not call
 * `configurationService.updateField()` itself, and nothing imports/invokes
 * it automatically. `languages.supported`/`languages.default` are
 * tenant-overridable (`canOverride: true`); auto-applying this derivation
 * on every read would silently override that per-tenant capability, a real
 * runtime-behavior change this phase's validation explicitly forbids. An
 * explicit, admin-triggered "Sync to Runtime" action (deferred to P9.5.7 —
 * see the Final Report) would call `computeRuntimeSyncPlan()` and then
 * write each field via the ordinary `configurationService.updateField()`
 * path, exactly like any manual field edit — no new persistence mechanism.
 */
import type { ConfigCollectionValue } from '@/config/collection'

export interface LanguageRuntimeSyncPlan {
  /** Codes that should populate `languages.supported`. */
  supported: string[]
  /** Code that should populate `languages.default`, or undefined if no entity has `default: true`. */
  defaultLocale: string | undefined
  /** Codes that should populate `languages.rtl_locales`. */
  rtlLocales: string[]
}

/**
 * Pure derivation — a language is "supported" when `enabled`; RTL when
 * `enabled && rtl`; the default is whichever single enabled entity has
 * `default: true` (if more than one does, `validateLanguageCollection()`
 * already flags that as an error upstream — this function just picks the
 * first and lets the caller surface the validation error separately rather
 * than throwing here).
 */
export function computeRuntimeSyncPlan(entries: ConfigCollectionValue): LanguageRuntimeSyncPlan {
  const codes = Object.keys(entries)
  const enabledCodes = codes.filter((code) => Boolean(entries[code]?.enabled))
  const rtlLocales = enabledCodes.filter((code) => Boolean(entries[code]?.rtl))
  const defaultLocale = enabledCodes.find((code) => Boolean(entries[code]?.default))

  return {
    supported: enabledCodes,
    defaultLocale,
    rtlLocales,
  }
}
