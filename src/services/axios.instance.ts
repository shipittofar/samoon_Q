import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL, CSRF_COOKIE, CSRF_HEADER, JWT_ACCESS_KEY, JWT_REFRESH_KEY } from '@/constants'
import { configurationService } from '@/config'
import { resolveTenantSlugForApi } from '@/lib/tenant-request-context'

// ── Cookie helpers ───────────────────────────────────────────────────────────
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[2]) : null
}

// ── Token helpers ────────────────────────────────────────────────────────────
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(JWT_ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(JWT_REFRESH_KEY)
}

/** Host-only session cookie for Edge middleware. Must stay in lockstep with localStorage. */
const ACCESS_TOKEN_COOKIE_ATTRS = 'path=/; SameSite=Strict'
const DEFAULT_REFRESH_TTL_DAYS = 7
/** Browsers typically cap cookies near 4KB; leave room for attributes. */
const MAX_ACCESS_TOKEN_COOKIE_CHARS = 3500
/**
 * Compact cookie value when the JWT cannot fit. Middleware treats a present
 * non-JWT cookie as an authenticated browser session (heuristic only).
 */
export const ACCESS_TOKEN_COOKIE_SENTINEL = '1'

function resolveAccessCookieMaxAgeSeconds(): number {
  try {
    const days = configurationService.resolveField('authentication.jwt_refresh_ttl_days', {}).value
    if (typeof days === 'number' && Number.isFinite(days) && days > 0) {
      return 60 * 60 * 24 * days
    }
  } catch {
    // Cookie write must never fail because the configuration registry is unavailable.
  }
  return 60 * 60 * 24 * DEFAULT_REFRESH_TTL_DAYS
}

/** Cookie payload written for middleware. Encodes the JWT when it fits. */
export function accessTokenCookieValue(access: string): string {
  const encoded = encodeURIComponent(access)
  if (encoded.length > MAX_ACCESS_TOKEN_COOKIE_CHARS) {
    return ACCESS_TOKEN_COOKIE_SENTINEL
  }
  return encoded
}

export function writeAccessTokenCookie(access: string): void {
  if (typeof document === 'undefined') return
  const maxAge = resolveAccessCookieMaxAgeSeconds()
  document.cookie = `${JWT_ACCESS_KEY}=${accessTokenCookieValue(access)}; ${ACCESS_TOKEN_COOKIE_ATTRS}; max-age=${maxAge}`
}

export function clearAccessTokenCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${JWT_ACCESS_KEY}=; ${ACCESS_TOKEN_COOKIE_ATTRS}; max-age=0`
}

/** Re-mirror localStorage → cookie so a new tab's later document requests see the session. */
export function syncAccessTokenCookieFromStorage(): void {
  const access = getAccessToken()
  if (access) writeAccessTokenCookie(access)
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(JWT_ACCESS_KEY, access)
  localStorage.setItem(JWT_REFRESH_KEY, refresh)
  // Mirror access token to a cookie so Next.js middleware (Edge runtime) can read it.
  // Not HttpOnly — deliberately set from JS to enable middleware auth checks.
  // Lifetime prefers authentication.jwt_refresh_ttl_days; falls back to 7 days
  // if the registry cannot be read so login cannot leave localStorage-only state.
  writeAccessTokenCookie(access)
}

export function clearTokens() {
  localStorage.removeItem(JWT_ACCESS_KEY)
  localStorage.removeItem(JWT_REFRESH_KEY)
  // Expire the auth cookie so middleware immediately treats the session as unauthenticated.
  clearAccessTokenCookie()
}

// ── Axios instance ───────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true, // send cookies for session auth
})

// ── Request interceptor: attach JWT or CSRF ──────────────────────────────────
const AXIOS_DEBUG =
  process.env.NEXT_PUBLIC_AXIOS_DEBUG === 'true' ||
  process.env.NODE_ENV === 'development'

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // Tenant context for Django — browser calls do not receive Next.js middleware headers.
    if (typeof window !== 'undefined' && !config.headers['X-Tenant-Slug']) {
      const tenantSlug = resolveTenantSlugForApi()
      if (tenantSlug) {
        config.headers['X-Tenant-Slug'] = tenantSlug
      }
    }

    // Django CSRF for session auth (POST/PUT/DELETE/PATCH)
    const csrfSafe = /^(GET|HEAD|OPTIONS|TRACE)$/i.test(config.method || '')
    if (!csrfSafe) {
      const csrf = getCookie(CSRF_COOKIE)
      if (csrf) config.headers[CSRF_HEADER] = csrf
    }

    if (AXIOS_DEBUG && typeof window !== 'undefined') {
      const base = config.baseURL ?? ''
      const path = config.url ?? ''
      const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
      console.debug('[axios:request]', config.method?.toUpperCase() ?? 'GET', url, {
        Authorization: config.headers['Authorization'] ? 'Bearer <present>' : undefined,
        'X-Tenant-Slug': config.headers['X-Tenant-Slug'],
        Accept: config.headers['Accept'],
        'Content-Type': config.headers['Content-Type'],
      })
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ── Token refresh queue ───────────────────────────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
api.interceptors.response.use(
  (response) => {
    if (AXIOS_DEBUG && typeof window !== 'undefined') {
      const cfg = response.config
      const path = cfg.url ?? ''
      console.debug('[axios:response]', cfg.method?.toUpperCase() ?? 'GET', path, response.status)
    }
    return response
  },
  async (error: AxiosError) => {
    if (AXIOS_DEBUG && typeof window !== 'undefined') {
      const cfg = error.config
      const path = cfg?.url ?? ''
      console.debug('[axios:error]', cfg?.method?.toUpperCase() ?? 'GET', path, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })
    }
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers['Authorization'] = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const refresh = getRefreshToken()
        if (!refresh) throw new Error('No refresh token')

        const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
        setTokens(data.access, data.refresh || refresh)
        processQueue(null, data.access)
        original.headers['Authorization'] = `Bearer ${data.access}`
        return api(original)
      } catch (err) {
        processQueue(err, null)
        clearTokens()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:logout'))
        }
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default api
