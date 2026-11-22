/**
 * Browser side of persisted configuration:
 *   - platform-level fields: PUT /platform/config/ (platform superusers);
 *   - tenant-level fields:   GET/PUT /tenants/<id>/config/ (settings.manage
 *     on that business — owners, settings managers, superusers).
 * The server's answer is applied locally, so the Studio, this tab and every
 * other visitor (after their next load) see the same values.
 *
 * Mock mode has no backend: nothing is sent and callers keep the old
 * in-memory behaviour.
 */
import api from '@/services/axios.instance'
import { ENDPOINTS } from '@/services/endpoints'
import { configurationService } from './service'

export interface PlatformConfigChange {
  fieldId: string
  value: unknown
}

type ChangePayload = { fieldId: string; value: unknown } | { fieldId: string; reset: true }

export function platformConfigPersistenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK !== 'true'
}

/** A value equal to the field's default is sent as a reset, so it follows future default changes. */
function toPayload(change: PlatformConfigChange): ChangePayload {
  const field = configurationService.getField(change.fieldId)!
  return JSON.stringify(change.value) === JSON.stringify(field.default)
    ? { fieldId: change.fieldId, reset: true }
    : { fieldId: change.fieldId, value: change.value }
}

/**
 * Saves `changes` where each field lives: tenant-level ones to the given
 * business, platform-level ones platform-wide; branch/user-level fields and
 * secrets are not sent. Each request is all-or-nothing; tenant values go
 * first. Throws on failure — callers then apply nothing locally.
 */
export async function saveConfigChanges(
  changes: PlatformConfigChange[],
  reason?: string,
  { tenantId }: { tenantId?: string | null } = {},
): Promise<void> {
  if (!platformConfigPersistenceEnabled()) return
  const byLevel = { platform: [] as ChangePayload[], tenant: [] as ChangePayload[] }
  for (const change of changes) {
    const level = configurationService.persistedLevel(configurationService.getField(change.fieldId))
    if (level) byLevel[level].push(toPayload(change))
  }

  if (byLevel.tenant.length > 0) {
    if (!tenantId) throw new Error('Select a business before changing its settings.')
    const { data } = await api.put<{ overrides?: Record<string, unknown> }>(ENDPOINTS.PLATFORM_CONFIG.TENANT(tenantId), {
      changes: byLevel.tenant,
      reason: reason ?? '',
    })
    if (data?.overrides) configurationService.hydrateTenantOverrides(tenantId, data.overrides)
  }
  if (byLevel.platform.length > 0) {
    const { data } = await api.put<{ overrides?: Record<string, unknown> }>(ENDPOINTS.PLATFORM_CONFIG.OVERRIDES, {
      changes: byLevel.platform,
      reason: reason ?? '',
    })
    if (data?.overrides) configurationService.hydratePlatformOverrides(data.overrides)
  }
}

/** Platform-level only (kept for existing callers). */
export async function savePlatformConfigChanges(changes: PlatformConfigChange[], reason?: string): Promise<void> {
  const platformOnly = changes.filter(
    (c) => configurationService.persistedLevel(configurationService.getField(c.fieldId)) === 'platform',
  )
  await saveConfigChanges(platformOnly, reason)
}

const TENANT_TTL_MS = 30_000
const tenantLoads = new Map<string, { at: number; promise: Promise<void> }>()

/**
 * Loads one business's saved tenant-level values into the configuration
 * service (deduplicated; refreshed after 30s). Failures are swallowed: the
 * Studio then shows defaults, as before persistence existed.
 */
export function loadTenantConfigOverrides(tenantId: string | null | undefined, { force = false } = {}): Promise<void> {
  if (!tenantId || !platformConfigPersistenceEnabled()) return Promise.resolve()
  const cached = tenantLoads.get(tenantId)
  if (!force && cached && Date.now() - cached.at < TENANT_TTL_MS) return cached.promise
  const promise = api
    .get<{ overrides?: Record<string, unknown> }>(ENDPOINTS.PLATFORM_CONFIG.TENANT(tenantId))
    .then(({ data }) => {
      configurationService.hydrateTenantOverrides(tenantId, data?.overrides ?? {})
    })
    .catch(() => {
      tenantLoads.delete(tenantId)
    })
  tenantLoads.set(tenantId, { at: Date.now(), promise })
  return promise
}

/** Test-only. */
export function __resetTenantConfigLoadsForTests(): void {
  tenantLoads.clear()
}
