/**
 * ConfigurationResolver — P9.0 / Phase E
 *
 * Applies Rule 4 (Configuration Inheritance): every field resolves through
 *   Platform → Tenant → Branch → User
 * honoring each field's declared canOverride / mode / fallback.
 */
import { platformConfigurationRegistry } from './registry'
import {
  CONFIG_INHERITANCE_CHAIN,
  type ConfigFieldDefinition,
  type ConfigInheritanceLevel,
  type ConfigValueLayer,
  type ResolvedConfigValue,
} from './types'

function mergeValue(base: unknown, override: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(override)) return [...base, ...override]
  if (isPlainObject(base) && isPlainObject(override)) return { ...base, ...override }
  return override
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Resolves the effective value for a single field given per-level layers.
 * `layers` may omit any level to mean "no override present at that level".
 */
function resolveField<T = unknown>(
  field: ConfigFieldDefinition<T>,
  layers: ConfigValueLayer,
): ResolvedConfigValue<T> {
  const { level: ownerLevel, canOverride, mode, fallback } = field.inheritance
  const ownerIndex = CONFIG_INHERITANCE_CHAIN.indexOf(ownerLevel)

  let value: unknown = field.default
  let resolvedFrom: ConfigInheritanceLevel = 'platform'
  let overrideBlocked = false

  for (const level of CONFIG_INHERITANCE_CHAIN) {
    const levelIndex = CONFIG_INHERITANCE_CHAIN.indexOf(level)
    const candidate = layers[level]
    if (candidate === undefined) continue

    // Levels above the owner level always seed the base value.
    if (levelIndex <= ownerIndex) {
      value = candidate
      resolvedFrom = level
      continue
    }

    // Levels below the owner level are overrides — gated by canOverride/locked.
    if (!canOverride || mode === 'locked') {
      overrideBlocked = true
      continue
    }

    value = mode === 'merge' ? mergeValue(value, candidate) : candidate
    resolvedFrom = level
  }

  if (value === undefined) {
    value = fallback === 'default' ? field.default : value
  }

  return { fieldId: field.id, value: value as T, resolvedFrom, overrideBlocked }
}

/** Resolves every registered field given per-level override maps keyed by field id. */
function resolveAll(layersByField: Record<string, ConfigValueLayer>): Record<string, ResolvedConfigValue> {
  const result: Record<string, ResolvedConfigValue> = {}
  for (const field of platformConfigurationRegistry.getAllFields()) {
    result[field.id] = resolveField(field, layersByField[field.id] ?? {})
  }
  return result
}

export const configurationResolver = {
  resolveField,
  resolveAll,
}
