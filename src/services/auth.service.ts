import api, { clearTokens, setTokens } from './axios.instance'
import { ENDPOINTS } from './endpoints'
import {
  MOCK_USER,
  MOCK_ADMIN_USER,
  MOCK_STAFF_USER,
  MOCK_OWNER_USER,
  MOCK_CASHIER_USER,
  MOCK_KITCHEN_USER,
  MOCK_MARKETING_USER,
  MOCK_SUPPORT_USER,
  MOCK_MULTI_ROLE_USER,
} from '@/lib/mock-data'
import { MOCK_DELAY } from '@/constants'
import type { AuthTokens, LoginCredentials, OTPVerifyData, RegisterData, User } from '@/types'
import type { Role } from '@/types/rbac'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const MOCK_SESSION_KEY = 'mock_session_email'

// Structurally valid JWTs (header.payload.signature) with exp=9999999999 (year 2286).
// Required so middleware's isValidJWT() check passes in mock/demo mode.
// The signature segment is intentionally fake — mock mode never contacts the backend.
export const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock_signature'
export const MOCK_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrLXJlZnJlc2giLCJleHAiOjk5OTk5OTk5OTl9.mock_signature'

/**
 * P8.4.3 — Mock demo credential registry.
 *
 * Maps accepted email → { user, p7Roles } for mock mode login.
 * All passwords are 'password'. The demo@savor.com credential is the
 * original customer demo preserved for backward compat + security tests.
 * Staff/admin/owner credentials give access to /admin/* routes.
 *
 * p7Roles are the P7 tenant-scoped roles seeded into useRbacStore by
 * useLogin() on successful mock login. They cover all PermissionGuard checks.
 */
export const MOCK_CREDENTIALS: Record<string, { user: User; p7Roles: Role[] }> = {
  'demo@savor.com':      { user: MOCK_USER,           p7Roles: [] },
  'staff@savor.com':     { user: MOCK_STAFF_USER,     p7Roles: ['manager'] },
  'cashier@savor.com':   { user: MOCK_CASHIER_USER,   p7Roles: ['cashier'] },
  'kitchen@savor.com':   { user: MOCK_KITCHEN_USER,   p7Roles: ['kitchen'] },
  'marketing@savor.com': { user: MOCK_MARKETING_USER, p7Roles: ['marketing'] },
  'support@savor.com':   { user: MOCK_SUPPORT_USER,   p7Roles: ['support'] },
  'admin@savor.com':     { user: MOCK_ADMIN_USER,     p7Roles: ['admin'] },
  'owner@savor.com':     { user: MOCK_OWNER_USER,     p7Roles: ['owner'] },
  // P8.5 — Multi-role demo: Cashier + Kitchen combined (orders + kitchen display + payments)
  'multirole@savor.com': { user: MOCK_MULTI_ROLE_USER, p7Roles: ['cashier', 'kitchen'] },
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens; p7Roles?: Role[] }> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      // P3.5 — Only known demo credentials are accepted in mock mode.
      // Any other email/password combination must be rejected so the mock
      // login cannot be used as an authentication bypass.
      const entry = MOCK_CREDENTIALS[credentials.email]
      if (!entry || credentials.password !== 'password') {
        throw new Error('Invalid credentials')
      }
      const tokens: AuthTokens = { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN }
      setTokens(tokens.access, tokens.refresh)
      if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_SESSION_KEY, credentials.email)
      return { user: entry.user, tokens, p7Roles: entry.p7Roles }
    }

    const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
      ENDPOINTS.AUTH.LOGIN,
      credentials,
    )
    setTokens(data.tokens.access, data.tokens.refresh)
    return data
  },

  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      const tokens: AuthTokens = { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN }
      setTokens(tokens.access, tokens.refresh)
      return { user: { ...MOCK_USER, email: data.email, first_name: data.first_name, last_name: data.last_name }, tokens }
    }

    const { data: res } = await api.post<{ user: User; tokens: AuthTokens }>(
      ENDPOINTS.AUTH.REGISTER,
      data,
    )
    setTokens(res.tokens.access, res.tokens.refresh)
    return res
  },

  async logout(): Promise<void> {
    try {
      if (!USE_MOCK) await api.post(ENDPOINTS.AUTH.LOGOUT)
    } finally {
      clearTokens()
      if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY)
    }
  },

  async getMe(): Promise<User> {
    if (USE_MOCK) {
      await delay(300)
      if (typeof localStorage !== 'undefined') {
        const email = localStorage.getItem(MOCK_SESSION_KEY)
        if (email && MOCK_CREDENTIALS[email]) return MOCK_CREDENTIALS[email].user
      }
      return MOCK_USER
    }
    const { data } = await api.get<User>(ENDPOINTS.AUTH.ME)
    return data
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      return { message: 'Password reset email sent.' }
    }
    const { data } = await api.post<{ message: string }>(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email })
    return data
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      return { message: 'Password reset successfully.' }
    }
    const { data } = await api.post<{ message: string }>(ENDPOINTS.AUTH.RESET_PASSWORD, {
      token,
      password,
    })
    return data
  },

  async sendOTP(phone: string): Promise<{ message: string }> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      return { message: 'OTP sent to your phone.' }
    }
    const { data } = await api.post<{ message: string }>(ENDPOINTS.AUTH.SEND_OTP, { phone })
    return data
  },

  async verifyOTP(payload: OTPVerifyData): Promise<{ user: User; tokens: AuthTokens }> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      const tokens: AuthTokens = { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN }
      setTokens(tokens.access, tokens.refresh)
      return { user: MOCK_USER, tokens }
    }
    const { data } = await api.post<{ user: User; tokens: AuthTokens }>(
      ENDPOINTS.AUTH.VERIFY_OTP,
      payload,
    )
    setTokens(data.tokens.access, data.tokens.refresh)
    return data
  },

  async changePassword(old_password: string, new_password: string): Promise<void> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      return
    }
    await api.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, { old_password, new_password })
  },
}
