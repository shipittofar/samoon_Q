export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000/ws'
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Savor'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const JWT_ACCESS_KEY = 'access_token'
export const JWT_REFRESH_KEY = 'refresh_token'
export const CSRF_HEADER = 'X-CSRFToken'
export const CSRF_COOKIE = 'csrftoken'

export const DEFAULT_LOCALE = 'en'
export const SUPPORTED_LOCALES = ['en', 'fa', 'ar'] as const
export const RTL_LOCALES = ['fa', 'ar'] as const

export const THEME_KEY = 'savor-theme'
export const CART_KEY = 'savor-cart'
export const BRANCH_KEY = 'savor-branch'
export const LANG_KEY = 'savor-lang'
export const TENANT_KEY = 'savor-tenant'

export const STALE_TIME = 1000 * 60 * 5       // 5 minutes
export const CACHE_TIME = 1000 * 60 * 30      // 30 minutes

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'amber',
  accepted: 'blue',
  preparing: 'purple',
  ready: 'green',
  delivered: 'emerald',
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
