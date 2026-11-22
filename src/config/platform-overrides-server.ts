/**
 * Server side: reads the platform configuration overrides saved in Django
 * (GET /api/platform/config/, public) for the root layout, which applies them
 * before rendering and hands them to <PlatformConfigHydrator> for the browser.
 *
 * Kept for a few seconds per server process so a page view does not cost a
 * backend round trip; on a backend error the last good copy is used (or no
 * overrides, i.e. the built-in defaults), so the site never fails to render
 * because of this.
 */
import { serverApiBaseUrl } from '@/constants'
import { ENDPOINTS } from '@/services/endpoints'

const TTL_MS = 10_000
const TIMEOUT_MS = 2_000

let cached: { at: number; overrides: Record<string, unknown> } | null = null
let inFlight: Promise<Record<string, unknown>> | null = null

async function load(): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${serverApiBaseUrl()}${ENDPOINTS.PLATFORM_CONFIG.OVERRIDES}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const body = (await res.json()) as { overrides?: unknown }
    const overrides =
      body.overrides && typeof body.overrides === 'object' && !Array.isArray(body.overrides)
        ? (body.overrides as Record<string, unknown>)
        : {}
    cached = { at: Date.now(), overrides }
    return overrides
  } finally {
    clearTimeout(timer)
  }
}

export async function getPlatformConfigOverrides(): Promise<Record<string, unknown>> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return {}
  if (cached && Date.now() - cached.at < TTL_MS) return cached.overrides
  if (!inFlight) {
    inFlight = load()
      .catch(() => cached?.overrides ?? {})
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/** Test-only. */
export function __resetPlatformConfigOverridesCacheForTests(): void {
  cached = null
  inFlight = null
}
