import api, { clearTokens, setTokens } from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_USER } from '@/lib/mock-data'
import { MOCK_DELAY } from '@/constants'
import type { AuthTokens, LoginCredentials, OTPVerifyData, RegisterData, User } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Structurally valid JWTs (header.payload.signature) with exp=9999999999 (year 2286).
// Required so middleware's isValidJWT() check passes in mock/demo mode.
// The signature segment is intentionally fake — mock mode never contacts the backend.
export const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock_signature'
export const MOCK_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrLXJlZnJlc2giLCJleHAiOjk5OTk5OTk5OTl9.mock_signature'

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    if (USE_MOCK) {
      await delay(MOCK_DELAY)
      // P3.5 — Only the demo credentials are accepted in mock mode.
      // Any other email/password combination must be rejected so the mock
      // login cannot be used as an authentication bypass.
      if (credentials.email !== 'demo@savor.com' || credentials.password !== 'password') {
        throw new Error('Invalid credentials')
      }
      const tokens: AuthTokens = { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN }
      setTokens(tokens.access, tokens.refresh)
      return { user: MOCK_USER, tokens }
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
    }
  },

  async getMe(): Promise<User> {
    if (USE_MOCK) {
      await delay(300)
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
