/**
 * ConfigurationService — P9.0 / Phase E
 *
 * The single facade every consumer (hooks today, Console UI tomorrow, and the
 * real backend's equivalent service later) talks to. Nothing outside this
 * file touches the registry, resolver, validator, cache, audit log, or
 * version manager directly — that keeps this the one place resolution order,
 * permission checks, and audit recording are guaranteed to happen together.
 *
 * Pure architecture / no UI logic (Rule/Phase E requirement).
 */
import { platformConfigurationRegistry } from './registry'
import { configurationResolver } from './resolver'
import { configurationValidator } from './validator'
import { configurationCache } from './cache'
import { configurationAudit } from './audit'
import { configurationVersionManager } from './version-manager'
import { CONFIG_INHERITANCE_CHAIN } from './types'
import type {
  ConfigFieldDefinition,
  ConfigModuleDefinition,
  ConfigResolutionScope,
  ConfigValueLayer,
  ResolvedConfigValue,
} from './types'

export interface ConfigActor {
  id: string
  name: string
}

/**
 * Per-field override storage. `platform` is a single value; `tenant` /
 * `branch` / `user` are maps keyed by the scope id at that level, since many
 * tenants/branches/users may each hold their own override of the same field
 * (Rule 4 — inheritance is per-scope, not global).
 */
interface FieldOverrides {
  platform?: unknown
  tenant?: Record<string, unknown>
  branch?: Record<string, unknown>
  user?: Record<string, unknown>
}

export interface ConfigOverrideStore {
  [fieldId: string]: FieldOverrides
}

/**
 * In-memory override store standing in for the future backend table
 * (`platform_configuration_overrides`, see BACKEND_API_CONTRACT.md).
 * Swapping this for real persistence only requires changing layersFor/
 * updateField below — every other function in this file is storage-agnostic.
 */
let overrideStore: ConfigOverrideStore = {}

function getModules(): ConfigModuleDefinition[] {
  return platformConfigurationRegistry.getModules()
}

function getModule(id: string): ConfigModuleDefinition | undefined {
  return platformConfigurationRegistry.getModule(id)
}

function getField(fieldId: string): ConfigFieldDefinition | undefined {
  return platformConfigurationRegistry.getField(fieldId)
}

function scopeIdForLevel(level: 'tenant' | 'branch' | 'user', scope: ConfigResolutionScope): string {
  const id = level === 'tenant' ? scope.tenantId : level === 'branch' ? scope.branchId : scope.userId
  if (!id) throw new Error(`[ConfigurationService] scope.${level}Id is required to write a "${level}"-level override`)
  return id
}

function layersFor(fieldId: string, scope: ConfigResolutionScope): ConfigValueLayer {
  const stored = overrideStore[fieldId] ?? {}
  return {
    platform: stored.platform,
    tenant: scope.tenantId ? stored.tenant?.[scope.tenantId] : undefined,
    branch: scope.branchId ? stored.branch?.[scope.branchId] : undefined,
    user: scope.userId ? stored.user?.[scope.userId] : undefined,
  }
}

function resolveField(fieldId: string, scope: ConfigResolutionScope = {}): ResolvedConfigValue {
  const cached = configurationCache.get(fieldId, scope)
  if (cached) return cached

  const field = platformConfigurationRegistry.getField(fieldId)
  if (!field) throw new Error(`[ConfigurationService] unknown field "${fieldId}"`)

  const resolved = configurationResolver.resolveField(field, layersFor(fieldId, scope))
  configurationCache.set(fieldId, scope, resolved)
  return resolved
}

function resolveModule(moduleId: string, scope: ConfigResolutionScope = {}): Record<string, ResolvedConfigValue> {
  const mod = platformConfigurationRegistry.getModule(moduleId)
  if (!mod) throw new Error(`[ConfigurationService] unknown module "${moduleId}"`)
  const result: Record<string, ResolvedConfigValue> = {}
  for (const section of mod.sections) {
    for (const field of section.fields) {
      result[field.id] = resolveField(field.id, scope)
    }
  }
  return result
}

/**
 * Writes a value at the given inheritance level, validates it, records the
 * audit entry, and invalidates the cache. Returns the newly resolved value.
 * Rejects writes to fields whose owner level forbids the target level via
 * `canOverride` (Rule 4).
 */
function updateField(input: {
  fieldId: string
  value: unknown
  level: 'platform' | 'tenant' | 'branch' | 'user'
  scope: ConfigResolutionScope
  actor: ConfigActor
  reason?: string
}): ResolvedConfigValue {
  const field = platformConfigurationRegistry.getField(input.fieldId)
  if (!field) throw new Error(`[ConfigurationService] unknown field "${input.fieldId}"`)

  // P9.0.1 Phase A hardening: the original check only compared input.level to
  // field.inheritance.level by equality, so it silently allowed writes ABOVE
  // the owning level too (e.g. a 'platform'-level write to a field owned at
  // 'tenant') as long as it wasn't exactly equal — direction was never
  // actually verified. Compare chain indices so both directions are guarded.
  const ownerIndex = CONFIG_INHERITANCE_CHAIN.indexOf(field.inheritance.level)
  const targetIndex = CONFIG_INHERITANCE_CHAIN.indexOf(input.level)
  if (targetIndex < ownerIndex) {
    throw new Error(
      `[ConfigurationService] field "${input.fieldId}" cannot be written at "${input.level}" — above its owning level "${field.inheritance.level}"`,
    )
  }
  if (targetIndex > ownerIndex && (!field.inheritance.canOverride || field.inheritance.mode === 'locked')) {
    throw new Error(
      `[ConfigurationService] field "${input.fieldId}" cannot be overridden at "${input.level}" (locked at "${field.inheritance.level}")`,
    )
  }

  const validation = configurationValidator.validate(field, input.value)
  if (!validation.valid) {
    throw new Error(
      `[ConfigurationService] validation failed for "${input.fieldId}": ${validation.errors.map((e) => e.message).join('; ')}`,
    )
  }

  if (field.audit.requireReason && !input.reason) {
    throw new Error(`[ConfigurationService] field "${input.fieldId}" requires a reason for changes`)
  }

  const previous = resolveField(input.fieldId, input.scope)

  const stored = overrideStore[input.fieldId] ?? {}
  const nextStored: FieldOverrides =
    input.level === 'platform'
      ? { ...stored, platform: input.value }
      : {
          ...stored,
          [input.level]: {
            ...stored[input.level],
            [scopeIdForLevel(input.level, input.scope)]: input.value,
          },
        }
  overrideStore = { ...overrideStore, [input.fieldId]: nextStored }

  configurationCache.invalidateField(input.fieldId)

  if (field.audit.trackHistory) {
    configurationAudit.record({
      fieldId: input.fieldId,
      scope: input.scope,
      level: input.level,
      actorId: input.actor.id,
      actorName: input.actor.name,
      reason: input.reason,
      previousValue: previous.value,
      newValue: input.value,
    })
  }

  return resolveField(input.fieldId, input.scope)
}

/**
 * Exposes the raw per-level override layers behind a field's resolved value
 * — e.g. an Inspector's Inheritance tab showing "Platform: X, Tenant:
 * (none), Branch: Y" needs each level individually, not just which one won.
 * Read-only; storage-agnostic like every other function here.
 */
function getFieldLayers(fieldId: string, scope: ConfigResolutionScope = {}): ConfigValueLayer {
  return layersFor(fieldId, scope)
}

function canView(field: ConfigFieldDefinition, userPermissions: readonly string[]): boolean {
  return userPermissions.includes(field.permissions.view)
}

function canEdit(field: ConfigFieldDefinition, userPermissions: readonly string[]): boolean {
  return userPermissions.includes(field.permissions.edit)
}

/**
 * Fields whose platform value is stored in Django (GET/PUT /platform/config/).
 * Platform-owned only (tenant/branch/user layers stay in this process), and
 * never secrets: platform configuration must not hold credentials.
 */
function isPersistedField(field: ConfigFieldDefinition | undefined): field is ConfigFieldDefinition {
  return Boolean(field) && field!.inheritance.level === 'platform' && field!.type !== 'secret' && field!.type !== 'password'
}

/** Field ids whose platform layer came from the server (so a server-side reset clears them). */
let serverPlatformFieldIds = new Set<string>()
let lastHydratedJson = ''
const hydrationListeners = new Set<() => void>()

/**
 * Replaces the platform layer with the overrides saved in Django. Idempotent
 * (same payload → no-op), so it is safe to call on every render. Unknown or
 * non-persisted field ids are ignored.
 */
function hydratePlatformOverrides(overrides: Record<string, unknown>): void {
  const json = JSON.stringify(overrides ?? {})
  if (json === lastHydratedJson) return
  lastHydratedJson = json

  const next: ConfigOverrideStore = { ...overrideStore }
  const nextServerIds = new Set<string>()
  for (const [fieldId, value] of Object.entries(overrides ?? {})) {
    if (!isPersistedField(getField(fieldId))) continue
    next[fieldId] = { ...next[fieldId], platform: value }
    nextServerIds.add(fieldId)
  }
  for (const fieldId of serverPlatformFieldIds) {
    if (nextServerIds.has(fieldId) || !next[fieldId]) continue
    const { platform: _dropped, ...rest } = next[fieldId]
    void _dropped
    next[fieldId] = rest
  }
  overrideStore = next
  serverPlatformFieldIds = nextServerIds
  configurationCache.clear()
  hydrationListeners.forEach((fn) => fn())
}

/** Notified after server overrides are (re)applied; returns an unsubscribe. */
function onPlatformOverridesHydrated(listener: () => void): () => void {
  hydrationListeners.add(listener)
  return () => {
    hydrationListeners.delete(listener)
  }
}

function __resetForTests(): void {
  overrideStore = {}
  serverPlatformFieldIds = new Set()
  lastHydratedJson = ''
  configurationCache.clear()
  configurationAudit.__resetForTests()
  configurationVersionManager.__resetForTests()
}

export const configurationService = {
  getModules,
  getModule,
  getField,
  resolveField,
  resolveModule,
  updateField,
  getFieldLayers,
  canView,
  canEdit,
  isPersistedField,
  hydratePlatformOverrides,
  onPlatformOverridesHydrated,
  __resetForTests,
}
