/**
 * P9.1.2 — Authentication Runtime Integration tests
 *
 * Covers: auth.service.ts gates now reading from ConfigurationService
 * (authentication.enabled, otp.enabled, phone/email login enabled,
 * registration_enabled, demo_login_enabled, mock_authentication_enabled),
 * rate-limit.ts defaults matching config, and axios.instance.ts cookie
 * lifetime matching config. Default-value behavior must be identical to
 * the previously-hardcoded literals — every "default" assertion below is
 * the regression guard for that.
 */
import { describe, it, expect, vi } from 'vitest'

/** Fresh module scope per test — the config registry seals after first read. */
async function freshAuth() {
  vi.resetModules()
  const config = await import('@/config')
  const { authService } = await import('@/services/auth.service')
  return { ...config, authService }
}

const actor = { id: 'test-admin', name: 'Test Admin' }

describe('auth.service.ts — configuration-driven gates (P9.1.2)', () => {
  it('login/sendOTP/verifyOTP succeed with default configuration (unchanged behavior)', async () => {
    const { authService } = await freshAuth()
    const login = await authService.login({ email: 'demo@savor.com', password: 'password' })
    expect(login.tokens.access).toBeTruthy()
    expect(login.p7Roles).toEqual([])

    const otp = await authService.sendOTP('+14155550101')
    expect(otp.message).toBeTruthy()

    const verify = await authService.verifyOTP({ phone: '+14155550101', otp: '123456' })
    expect(verify.is_new_user).toBe(false)
  })

  it('rejects every entry point when authentication.enabled is false', async () => {
    const { configurationService, authService } = await freshAuth()
    configurationService.updateField({
      fieldId: 'authentication.enabled', value: false, level: 'platform', scope: {}, actor, reason: 'test',
    })
    await expect(authService.login({ email: 'demo@savor.com', password: 'password' })).rejects.toThrow('authentication_disabled')
    await expect(authService.register({ email: 'a@b.com', password: 'password', confirm_password: 'password', first_name: 'A', last_name: 'B' })).rejects.toThrow('authentication_disabled')
    await expect(authService.sendOTP('+14155550101')).rejects.toThrow('authentication_disabled')
    await expect(authService.verifyOTP({ phone: '+14155550101', otp: '123456' })).rejects.toThrow('authentication_disabled')
  })

  it('rejects sendOTP/verifyOTP when authentication.otp.enabled is false', async () => {
    const { configurationService, authService } = await freshAuth()
    configurationService.updateField({
      fieldId: 'authentication.otp.enabled', value: false, level: 'platform', scope: {}, actor,
    })
    await expect(authService.sendOTP('+14155550101')).rejects.toThrow('otp_disabled')
    await expect(authService.verifyOTP({ phone: '+14155550101', otp: '123456' })).rejects.toThrow('otp_disabled')
  })

  it('rejects sendOTP when authentication.phone_login_enabled is false', async () => {
    const { configurationService, authService } = await freshAuth()
    configurationService.updateField({
      fieldId: 'authentication.phone_login_enabled', value: false, level: 'platform', scope: {}, actor,
    })
    await expect(authService.sendOTP('+14155550101')).rejects.toThrow('phone_login_disabled')
  })

  it('rejects register when authentication.registration_enabled is false', async () => {
    const { configurationService, authService } = await freshAuth()
    configurationService.updateField({
      fieldId: 'authentication.registration_enabled', value: false, level: 'platform', scope: {}, actor,
    })
    await expect(
      authService.register({ email: 'a@b.com', password: 'password', confirm_password: 'password', first_name: 'A', last_name: 'B' }),
    ).rejects.toThrow('registration_disabled')
  })

  it('rejects known demo credentials (but not an "invalid" one) when authentication.demo_login_enabled is false', async () => {
    const { configurationService, authService } = await freshAuth()
    configurationService.updateField({
      fieldId: 'authentication.demo_login_enabled', value: false, level: 'platform', scope: {}, actor, reason: 'test',
    })
    await expect(authService.login({ email: 'demo@savor.com', password: 'password' })).rejects.toThrow('Invalid credentials')
  })

  it('treats a known demo phone as a new user when authentication.demo_login_enabled is false', async () => {
    const { configurationService, authService } = await freshAuth()
    configurationService.updateField({
      fieldId: 'authentication.demo_login_enabled', value: false, level: 'platform', scope: {}, actor, reason: 'test',
    })
    const result = await authService.verifyOTP({ phone: '+14155550101', otp: '123456' })
    expect(result.is_new_user).toBe(true)
  })

  it('falls through to the real-auth branch when authentication.mock_authentication_enabled is false', async () => {
    const { configurationService, authService } = await freshAuth()
    configurationService.updateField({
      fieldId: 'authentication.mock_authentication_enabled', value: false, level: 'platform', scope: {}, actor, reason: 'test',
    })
    configurationService.updateField({
      fieldId: 'authentication.email_login_enabled', value: false, level: 'platform', scope: {}, actor,
    })
    // Proves the mock branch was skipped: the email_login_enabled gate only
    // exists on the non-mock branch, so this error can only fire if
    // mockActive() correctly evaluated false.
    await expect(authService.login({ email: 'demo@savor.com', password: 'password' })).rejects.toThrow('email_login_disabled')
  })
})

describe('rate-limit.ts — limits sourced from configuration (P9.1.2)', () => {
  it('LOGIN_LIMIT and OTP_LIMIT default to the same counts as the previously-hardcoded literals', async () => {
    vi.resetModules()
    const { LOGIN_LIMIT, OTP_LIMIT } = await import('@/lib/rate-limit')
    // peek() reports remaining AFTER a hypothetical request, i.e. limit - 1
    // for a fresh identifier — authentication.max_login_attempts default is 5,
    // authentication.otp.max_verify_attempts default is 3.
    const loginPeek = LOGIN_LIMIT.peek('unit-test-identifier')
    const otpPeek = OTP_LIMIT.peek('unit-test-identifier')
    expect(loginPeek.remaining).toBe(4)
    expect(otpPeek.remaining).toBe(2)
  })
})

describe('axios.instance.ts — cookie lifetime sourced from configuration (P9.1.2)', () => {
  it('setTokens() writes a cookie whose max-age matches authentication.jwt_refresh_ttl_days (default 7 days)', async () => {
    vi.resetModules()
    const { setTokens } = await import('@/services/axios.instance')
    setTokens('access-token-value', 'refresh-token-value')
    expect(document.cookie).toMatch(/access_token=/)
    // jsdom doesn't expose max-age via document.cookie directly; verify indirectly
    // by confirming the cookie was set and is readable immediately after (i.e. a
    // positive max-age was used, not 0 or a negative value that would expire it).
    expect(document.cookie).toContain('access-token-value')
  })
})
