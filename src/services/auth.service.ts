import api, { clearTokens, setTokens } from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { DEMO_PHONE_TO_EMAIL } from '@/utils/auth-redirect'
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
  MOCK_PLATFORM_ADMIN_USER,
} from '@/lib/mock-data'
import { MOCK_DELAY } from '@/constants'
import { configurationService } from '@/config'
import type { AuthTokens, LoginCredentials, OTPVerifyData, RegisterData, SendOTPRequest, VerifyOTPRequest, User } from '@/types'
import type { Role } from '@/types/rbac'
import type { AuthSessionRbacPayload } from '@/types/ownership'

/**
 * P10.8 — verifyOTP()'s result is a discriminated union, matching the
 * backend contract exactly: `is_new_user: true` means registration is
 * NOT complete — there is no user/tokens/roles yet, and the frontend
 * must not treat this as a login. `is_new_user: false` is a real login
 * and always carries `user`/`tokens` (roles/ownership/staffAssignments
 * optional, same as login()/getMe()). Narrowing on `is_new_user` gives
 * every consumer compile-time safety against accidentally reading
 * `.user`/`.tokens` off the new-user branch. See
 * docs/P10.8_OTP_AUTH_FLOW_SPLIT.md.
 */
export type VerifyOTPResult =
  | { is_new_user: true }
  | ({ is_new_user: false; user: User; tokens: AuthTokens; p7Roles?: Role[] } & AuthSessionRbacPayload)

const USE_MOCK_ENV = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── P9.1.2 — Configuration-driven runtime flags ──────────────────────────────
// Resolved fresh on every call (cheap, in-memory reads) rather than frozen at
// module load, so a Platform Administrator's change takes effect immediately.
// This plain service module has no tenant-context threading today (unlike the
// React hooks in src/hooks/index.ts, which read useTenantStore) — every field
// below is platform-locked in src/config/modules/authentication.ts specifically
// because it's a platform-wide master switch, so resolving at platform scope
// ({}) is correct, not a shortcut. See docs/P9.1.2_RUNTIME_INTEGRATION.md.
function authFlag(fieldId: string): boolean {
  return configurationService.resolveField(fieldId, {}).value as boolean
}

function isAuthenticationEnabled(): boolean {
  return authFlag('authentication.enabled')
}

/** Mock branch runs only when both the build-time env flag AND the configuration switch allow it. */
function mockActive(): boolean {
  return USE_MOCK_ENV && authFlag('authentication.mock_authentication_enabled')
}

/** Known demo credentials are honored only when this resolves true (see field description). */
function demoLoginEnabled(): boolean {
  return authFlag('authentication.demo_login_enabled')
}

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
 * Staff/console/owner credentials give access to /console/* routes.
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
  // P8.9.1 — Platform Admin: cross-tenant management (owner P7 role grants full platform access)
  'platform@savor.com':  { user: MOCK_PLATFORM_ADMIN_USER, p7Roles: ['owner'] },
}

export const authService = {
  async login(
    credentials: LoginCredentials,
  ): Promise<{ user: User; tokens: AuthTokens; p7Roles?: Role[] } & AuthSessionRbacPayload> {
    if (!isAuthenticationEnabled()) throw new Error('authentication_disabled')

    if (mockActive()) {
      await delay(MOCK_DELAY)
      // P3.5 — Only known demo credentials are accepted in mock mode.
      // Any other email/password combination must be rejected so the mock
      // login cannot be used as an authentication bypass.
      // P9.1.2 — demoLoginEnabled() lets a Platform Administrator disable the
      // demo-credential shortcut without disabling mock mode entirely.
      const entry = demoLoginEnabled() ? MOCK_CREDENTIALS[credentials.email] : undefined
      if (!entry || credentials.password !== 'password') {
        throw new Error('Invalid credentials')
      }
      const tokens: AuthTokens = { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN }
      setTokens(tokens.access, tokens.refresh)
      if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_SESSION_KEY, credentials.email)
      return { user: entry.user, tokens, p7Roles: entry.p7Roles }
    }

    if (!authFlag('authentication.email_login_enabled')) throw new Error('email_login_disabled')

    // P10.7 — widened from `{ user, tokens }` so a real backend can
    // optionally return `p7Roles`/`ownership`/`staffAssignments` on login,
    // matching what mock mode has always returned. All three fields are
    // optional — a backend that doesn't send them yet behaves exactly as
    // before (see docs/P10.7_RBAC_SESSION_HYDRATION_IMPLEMENTATION.md).
    const { data } = await api.post<{ user: User; tokens: AuthTokens; p7Roles?: Role[] } & AuthSessionRbacPayload>(
      ENDPOINTS.AUTH.LOGIN,
      credentials,
    )
    setTokens(data.tokens.access, data.tokens.refresh)
    return data
  },

  // P10.9 — register() now optionally returns p7Roles/ownership/
  // staffAssignments too, matching login()/verifyOTP()'s contract, so
  // useRegister() can hydrate RBAC state the same way after a successful
  // registration (a brand-new customer typically has none, but the
  // shape is consistent either way).
  async register(
    data: RegisterData,
  ): Promise<{ user: User; tokens: AuthTokens; p7Roles?: Role[] } & AuthSessionRbacPayload> {
    if (!isAuthenticationEnabled()) throw new Error('authentication_disabled')
    if (!authFlag('authentication.registration_enabled')) throw new Error('registration_disabled')

    if (mockActive()) {
      await delay(MOCK_DELAY)
      const tokens: AuthTokens = { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN }
      setTokens(tokens.access, tokens.refresh)
      return {
        user: { ...MOCK_USER, email: data.email, first_name: data.first_name, last_name: data.last_name },
        tokens,
        p7Roles: [],
      }
    }

    // P10.9 — data.country_code/data.phone_number are sent exactly as
    // the caller built them (never concatenated here) — see
    // src/app/complete-profile/page.tsx for the phone-OTP registration
    // flow's payload construction.
    const { data: res } = await api.post<{ user: User; tokens: AuthTokens; p7Roles?: Role[] } & AuthSessionRbacPayload>(
      ENDPOINTS.AUTH.REGISTER,
      data,
    )
    setTokens(res.tokens.access, res.tokens.refresh)
    return res
  },

  async logout(): Promise<void> {
    try {
      if (!mockActive()) await api.post(ENDPOINTS.AUTH.LOGOUT)
    } finally {
      clearTokens()
      if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY)
    }
  },

  // P10.7 Phase A — widened from `Promise<User>` so session restore
  // (AuthBootstrapper) can rehydrate `tenantRoles` the same way login()
  // does, instead of relying entirely on useRbacStore's own localStorage
  // persistence (docs/P10.5.5_RBAC_REAL_MODE_SECURITY.md §3,
  // docs/P10.6_RBAC_REAL_BACKEND_MIGRATION_PLAN.md §3). `User`'s own
  // fields are unchanged and still directly readable (`user.id` etc.) —
  // this is a structural widening (`User & {...}`), not a breaking
  // reshape, so every existing consumer that reads `getMe()`'s result as
  // a plain `User` keeps working unmodified.
  async getMe(): Promise<User & AuthSessionRbacPayload & { tenantRoles?: Role[] }> {
    if (mockActive()) {
      await delay(300)
      if (typeof localStorage !== 'undefined') {
        const email = localStorage.getItem(MOCK_SESSION_KEY)
        if (email && MOCK_CREDENTIALS[email]) {
          const entry = MOCK_CREDENTIALS[email]
          return { ...entry.user, tenantRoles: entry.p7Roles }
        }
      }
      return { ...MOCK_USER, tenantRoles: [] }
    }
    // Real mode: `tenantRoles`/`ownership`/`staffAssignments` are all
    // optional — a backend that doesn't send them yet returns exactly
    // what it always has (`User`), and this call behaves identically to
    // before this phase.
    const { data } = await api.get<User & AuthSessionRbacPayload & { tenantRoles?: Role[] }>(ENDPOINTS.AUTH.ME)
    return data
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    if (mockActive()) {
      await delay(MOCK_DELAY)
      return { message: 'Password reset email sent.' }
    }
    const { data } = await api.post<{ message: string }>(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email })
    return data
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    if (mockActive()) {
      await delay(MOCK_DELAY)
      return { message: 'Password reset successfully.' }
    }
    const { data } = await api.post<{ message: string }>(ENDPOINTS.AUTH.RESET_PASSWORD, {
      token,
      password,
    })
    return data
  },

  async sendOTP(payload: SendOTPRequest): Promise<{ message: string }> {
    if (!isAuthenticationEnabled()) throw new Error('authentication_disabled')
    if (!authFlag('authentication.otp.enabled')) throw new Error('otp_disabled')
    if (!authFlag('authentication.phone_login_enabled')) throw new Error('phone_login_disabled')
  
    if (mockActive()) {
      await delay(MOCK_DELAY)
      return { message: 'OTP sent to your phone_number.' }
    }
  
    const { data } = await api.post<{ message: string }>(
      ENDPOINTS.AUTH.SEND_OTP,
      {
        country_code: payload.dialCode,
        phone_number: payload.phone_number.replace(payload.dialCode, ''),
      },
    )
  
    return data
  },


  // async sendOTP(phone_number: string): Promise<{ message: string }> {
  //   if (!isAuthenticationEnabled()) throw new Error('authentication_disabled')
  //   if (!authFlag('authentication.otp.enabled')) throw new Error('otp_disabled')
  //   if (!authFlag('authentication.phone_login_enabled')) throw new Error('phone_login_disabled')

  //   if (mockActive()) {
  //     await delay(MOCK_DELAY)
  //     return { message: 'OTP sent to your phone_number.' }
  //   }
  //   const { data } = await api.post<{ message: string }>(ENDPOINTS.AUTH.SEND_OTP, { phone_number })
  //   return data
  // },

  /**
   * P8.9.2 — Extended mock: resolves phone_number → demo user.
   * Returns { user, tokens, p7Roles, is_new_user }.
   * Code '000000' is always rejected (for UX error-state demo).
   * Any other 6-digit code succeeds.
   */
  async verifyOTP(payload: VerifyOTPRequest): Promise<VerifyOTPResult> {
    if (!isAuthenticationEnabled()) throw new Error('authentication_disabled')
    if (!authFlag('authentication.otp.enabled')) throw new Error('otp_disabled')

    if (mockActive()) {
      await delay(MOCK_DELAY)

      // Reserved "always wrong" code for UX testing
      if (payload.otp === '000000') {
        throw new Error('otp_invalid')
      }

      // Look up demo phone_number → email → MOCK_CREDENTIALS entry
      // P9.1.2 — gated by demoLoginEnabled() so disabling demo login forces
      // every phone_number down the "unknown → new user" path below.
      const email = demoLoginEnabled() ? DEMO_PHONE_TO_EMAIL[payload.phone_number] : undefined
      if (email && MOCK_CREDENTIALS[email]) {
        const entry = MOCK_CREDENTIALS[email]
        const tokens: AuthTokens = { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN }
        // P10.8 — tokens/session are only ever established for an
        // existing user (is_new_user: false). A new user's registration
        // is not complete — see the branch below.
        setTokens(tokens.access, tokens.refresh)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(MOCK_SESSION_KEY, email)
        }
        return { user: entry.user, tokens, p7Roles: entry.p7Roles, is_new_user: false }
      }

      // P10.8 — unknown phone_number = new user. Registration is NOT
      // complete: no tokens are minted, nothing is persisted to
      // localStorage/axios. /complete-profile (via useRegister())
      // establishes the real session once the user finishes providing
      // their profile.
      return { is_new_user: true }
    }

    // P10.8 — country_code always comes from the dial code the user
    // actually selected (payload.dialCode, threaded through from the
    // PhoneInput on the login page) — never a hardcoded value.
    const { data } = await api.post<VerifyOTPResult>(
      ENDPOINTS.AUTH.VERIFY_OTP,
      {
        country_code: payload.dialCode,
        phone_number: payload.phone_number.slice(payload.dialCode.length),
        code: payload.otp,
      },
    )
    // P10.8 — tokens are only persisted for an existing user; a new
    // user's registration is not complete yet, and the backend contract
    // for that case carries no tokens at all (see VerifyOTPResult).
    if (!data.is_new_user) {
      setTokens(data.tokens.access, data.tokens.refresh)
    }
    return data
  },

  async changePassword(old_password: string, new_password: string): Promise<void> {
    if (mockActive()) {
      await delay(MOCK_DELAY)
      return
    }
    await api.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, { old_password, new_password })
  },
}
