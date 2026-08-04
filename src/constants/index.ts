import type { Tenant } from '@/types'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000/ws'
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Samoon'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const JWT_ACCESS_KEY = 'access_token'
export const JWT_REFRESH_KEY = 'refresh_token'
export const CSRF_HEADER = 'X-CSRFToken'
export const CSRF_COOKIE = 'csrftoken'

export const THEME_KEY = 'samoon-theme'
export const CART_KEY = 'samoon-cart'
export const BRANCH_KEY = 'samoon-branch'
export const LANG_KEY = 'samoon-lang'
export const TENANT_KEY = 'samoon-tenant'
export const DINE_IN_KEY = 'samoon-dine-in'

/**
 * The tenant record for the literal `'default'` slug in mock mode — used when
 * no subdomain/env-var slug is configured at all (single-tenant local dev).
 *
 * IMPORTANT — this is NOT an error fallback. It must never be substituted in
 * place of a real tenant when a `GET /tenants/{slug}/` call fails for an
 * authenticated Console flow (404 / 403 / suspended / archived / network /
 * 5xx). Those failures are represented explicitly by `TenantLifecycle`
 * ('not_found' | 'forbidden' | 'error'), and `useTenantStore.tenant` stays
 * `null` in every one of those states — see src/stores/index.ts and
 * src/services/tenant.service.ts. The only legitimate uses of this constant
 * are: (1) the mock tenant fixture for slug `'default'`, and (2) tenant-less
 * public surfaces that were never meant to resolve a real tenant at all.
 */
export const DEFAULT_TENANT: Tenant = {
  id: 'default',
  name: APP_NAME,
  slug: 'default',
  businessTypes: ['restaurant'],
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
}

export const STALE_TIME = 1000 * 60 * 5       // 5 minutes
export const CACHE_TIME = 1000 * 60 * 30      // 30 minutes

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  picked_up: 'Picked up',
  served: 'Served',
  cancelled: 'Cancelled',
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'amber',
  accepted: 'blue',
  preparing: 'purple',
  ready: 'green',
  delivered: 'emerald',
  picked_up: 'emerald',
  served: 'emerald',
  cancelled: 'red',
}

export const CATEGORY_ICONS: Record<string, string> = {
  pizza: '🍕',
  burger: '🍔',
  pasta: '🍝',
  drinks: '🥤',
  desserts: '🍰',
  salads: '🥗',
  sushi: '🍱',
  chicken: '🍗',
  seafood: '🦞',
}

export const TAX_RATE = 0.09
export const SERVICE_CHARGE_RATE = 0.05

export const MOCK_DELAY = 800
