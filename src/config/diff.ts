/**
 * Configuration Diff Engine — P9.0.1 / Phase F
 *
 * Pure comparison model over resolved values across the inheritance chain
 * (Platform → Tenant → Branch → User). No UI, no I/O — a future Console
 * "inheritance visualization" panel and diff view call these functions with
 * already-resolved values; this module only computes the comparison.
 *
 * See docs/P9.0.1_ARCHITECTURE_HARDENING.md §F for the full design writeup,
 * including how this composes with ConfigurationVersionManager snapshots for
 * a "compare release A to release B" view.
 */
import { CONFIG_INHERITANCE_CHAIN } from './types'
import type { ConfigInheritanceLevel, ConfigResolutionScope } from './types'
import { configurationService } from './service'

export interface ConfigLevelDiffEntry {
  level: ConfigInheritanceLevel
  /** True when this level has its own explicit value (vs. inheriting the resolved ancestor value). */
  hasOwnValue: boolean
  value: unknown
}

export interface ConfigFieldDiff {
  fieldId: string
  levels: ConfigLevelDiffEntry[]
  /** True when every level that has an explicit value agrees with every other. */
  identical: boolean
}

/**
 * Compares a single field's resolved value at each of up to four scopes
 * (platform / the given tenant / the given branch / the given user). Scopes
 * that are omitted from `scope` are skipped — e.g. pass only `tenantId` to
 * compare Platform vs. that one Tenant.
 */
function diffField(fieldId: string, scope: ConfigResolutionScope): ConfigFieldDiff {
  const levels: ConfigLevelDiffEntry[] = []
  const scopesToCheck: Array<{ level: ConfigInheritanceLevel; scope: ConfigResolutionScope }> = [
    { level: 'platform', scope: {} },
  ]
  if (scope.tenantId) scopesToCheck.push({ level: 'tenant', scope: { tenantId: scope.tenantId } })
  if (scope.branchId) scopesToCheck.push({ level: 'branch', scope: { tenantId: scope.tenantId, branchId: scope.branchId } })
  if (scope.userId) scopesToCheck.push({ level: 'user', scope })

  for (const { level, scope: levelScope } of scopesToCheck) {
    const resolved = configurationService.resolveField(fieldId, levelScope)
    levels.push({ level, hasOwnValue: resolved.resolvedFrom === level, value: resolved.value })
  }

  const values = levels.map((l) => JSON.stringify(l.value))
  const identical = values.every((v) => v === values[0])

  return { fieldId, levels, identical }
}

/** Diffs every field in a module for the given scope — the "module inheritance view." */
function diffModule(moduleId: string, scope: ConfigResolutionScope): ConfigFieldDiff[] {
  const mod = configurationService.getModule(moduleId)
  if (!mod) throw new Error(`[ConfigurationDiff] unknown module "${moduleId}"`)
  return mod.sections.flatMap((section) => section.fields.map((field) => diffField(field.id, scope)))
}

/**
 * Diffs the same field across two independent scopes (e.g. "Tenant A vs.
 * Tenant B") rather than up the inheritance chain — the "compare two
 * tenants" view distinct from the "compare a tenant to the platform" view.
 */
function diffFieldAcrossScopes(
  fieldId: string,
  scopeA: ConfigResolutionScope,
  scopeB: ConfigResolutionScope,
): { fieldId: string; a: unknown; b: unknown; identical: boolean } {
  const a = configurationService.resolveField(fieldId, scopeA).value
  const b = configurationService.resolveField(fieldId, scopeB).value
  return { fieldId, a, b, identical: JSON.stringify(a) === JSON.stringify(b) }
}

export const configurationDiff = {
  diffField,
  diffModule,
  diffFieldAcrossScopes,
  /** Re-exported for consumers that want to render level order without importing types.ts directly. */
  levelOrder: CONFIG_INHERITANCE_CHAIN,
}
