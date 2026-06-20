import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL, CSRF_COOKIE, CSRF_HEADER, JWT_ACCESS_KEY, JWT_REFRESH_KEY } from '@/constants'

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

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(JWT_ACCESS_KEY, access)
  localStorage.setItem(JWT_REFRESH_KEY, refresh)
  // Mirror access token to a cookie so Next.js middleware (Edge runtime) can read it.
  // Not HttpOnly — deliberately set from JS to enable middleware auth checks.
  const maxAge = 60 * 60 * 24 * 7 // 7 days
  document.cookie = `${JWT_ACCESS_KEY}=${encodeURIComponent(access)}; path=/; max-age=${maxAge}; SameSite=Strict`
}

export function clearTokens() {
  localStorage.removeItem(JWT_ACCESS_KEY)
  localStorage.removeItem(JWT_REFRESH_KEY)
  // Expire the auth cookie so middleware immediately treats the session as unauthenticated.
  document.cookie = `${JWT_ACCESS_KEY}=; path=/; max-age=0; SameSite=Strict`
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
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // Django CSRF for session auth (POST/PUT/DELETE/PATCH)
    const csrfSafe = /^(GET|HEAD|OPTIONS|TRACE)$/i.test(config.method || '')
    if (!csrfSafe) {
      const csrf = getCookie(CSRF_COOKIE)
      if (csrf) config.headers[CSRF_HEADER] = csrf
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
  (response) => response,
  async (error: AxiosError) => {
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
