/**
 * Browser side: saves platform-level configuration changes to Django
 * (PUT /api/platform/config/, platform superusers only) and applies the
 * server's answer locally, so the Studio, this tab and — after their next
 * page load — every other visitor see the same values.
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

export function platformConfigPersistenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK !== 'true'
}

/**
 * Sends the persisted (platform-owned, non-secret) subset of `changes` in one
 * all-or-nothing request. A value equal to the field's default is sent as a
 * reset, so the field follows future default changes again. Throws on
 * failure — nothing was saved then, and nothing should be applied locally.
 */
export async function savePlatformConfigChanges(changes: PlatformConfigChange[], reason?: string): Promise<void> {
  if (!platformConfigPersistenceEnabled()) return
  const payload = changes
    .filter((c) => configurationService.isPersistedField(configurationService.getField(c.fieldId)))
    .map((c) => {
      const field = configurationService.getField(c.fieldId)!
      return JSON.stringify(c.value) === JSON.stringify(field.default)
        ? { fieldId: c.fieldId, reset: true }
        : { fieldId: c.fieldId, value: c.value }
    })
  if (payload.length === 0) return
  const { data } = await api.put<{ overrides?: Record<string, unknown> }>(ENDPOINTS.PLATFORM_CONFIG.OVERRIDES, {
    changes: payload,
    reason: reason ?? '',
  })
  if (data?.overrides) configurationService.hydratePlatformOverrides(data.overrides)
}
