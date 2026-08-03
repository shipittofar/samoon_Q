// ============================================================
// P10.9 — Registration Flow: country_code/phone_number Split
//
// Backend contract change: POST /auth/register/ now expects
// { country_code, phone_number, first_name, last_name, email } — with
// phone_number stripped of its country prefix and country_code sent
// separately, never concatenated. Password/confirm_password are
// temporarily NOT part of this flow (commented out, not deleted, per
// the task's explicit "keep the code structure clean" instruction).
//
// This file proves:
//   - RegisterData/authService.register() accept the new shape without
//     requiring password/confirm_password.
//   - useRegister() hydrates user (and tenantRoles, if present) after a
//     successful registration, mirroring useLogin()/useVerifyOTP().
//   - complete-profile/page.tsx's payload-construction source no longer
//     sends password/confirm_password, sends country_code and a
//     phone_number stripped of the dial code, and never hardcodes a
//     country code.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { authService } from '@/services/auth.service'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { useRegister } from '@/hooks'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.samoon.test')

vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const completeProfileSrc = readFileSync(
  join(__dirname, '..', 'app', 'complete-profile', 'page.tsx'),
  'utf-8',
)

beforeEach(() => {
  vi.useFakeTimers()
  useAuthStore.getState().setUser(null)
  useRbacStore.getState()._resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('P10.9 — authService.register() accepts country_code/phone_number, no password required', () => {
  it('registers successfully with only country_code, phone_number, first_name, last_name, email', async () => {
    const promise = authService.register({
      email: 'new-phone-user@phone_number.samoon.local',
      country_code: '+1',
      phone_number: '4255552222',
      first_name: 'Ali',
      last_name: 'Bami',
    })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.user.first_name).toBe('Ali')
    expect(result.user.last_name).toBe('Bami')
    expect(result.tokens.access).toBeTruthy()
    expect(result.p7Roles).toEqual([])
  })
})

describe('P10.9 — useRegister() hydrates session after successful registration', () => {
  it('hydrates user via establishAuthenticatedSession (getMe after register)', async () => {
    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: {
        id: 'reg-1',
        email: 'hydrate-test@phone_number.samoon.local',
        first_name: 'Jane',
        last_name: 'Doe',
        accountType: 'customer',
        is_verified: true,
        created_at: new Date().toISOString(),
      },
      memberships: [],
    })

    const { result } = renderHook(() => useRegister(), { wrapper })
    const mutatePromise = result.current.mutateAsync({
      email: 'hydrate-test@phone_number.samoon.local',
      country_code: '+44',
      phone_number: '7911123456',
      first_name: 'Jane',
      last_name: 'Doe',
    })
    await vi.runAllTimersAsync()
    await mutatePromise

    expect(getMeSpy).toHaveBeenCalled()
    expect(useAuthStore.getState().user?.first_name).toBe('Jane')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('does not throw and leaves tenantRoles empty for a brand-new customer (p7Roles: [])', async () => {
    const { result } = renderHook(() => useRegister(), { wrapper })
    const mutatePromise = result.current.mutateAsync({
      email: 'hydrate-test-2@phone_number.samoon.local',
      country_code: '+61',
      phone_number: '412345678',
      first_name: 'Sam',
      last_name: 'Lee',
    })
    await vi.runAllTimersAsync()
    await expect(mutatePromise).resolves.not.toThrow()

    const tenantId = useTenantStore.getState().tenant?.id ?? ''
    expect(useRbacStore.getState().getRolesForTenant(tenantId)).toEqual([])
  })
})

describe('P10.9 — complete-profile/page.tsx sends country_code and a stripped phone_number, never a hardcoded country code', () => {
  it('constructs the register() payload with country_code: dialCode', () => {
    expect(completeProfileSrc).toContain('country_code: dialCode')
  })

  it('strips the dial code prefix off phone_number before sending it', () => {
    expect(completeProfileSrc).toContain('phone_number.slice(dialCode.length)')
  })

  it('never concatenates dialCode + phone_number into a single field', () => {
    expect(completeProfileSrc).not.toMatch(/phone_number:\s*`?\$?\{?dialCode\}?\$?\{?phone_number\}?/)
    expect(completeProfileSrc).not.toContain('dialCode + phone_number')
  })

  it('does not hardcode a literal country code (e.g. "+1") anywhere in the payload construction', () => {
    const onSubmitStart = completeProfileSrc.indexOf('const onSubmit')
    const onSubmitBody = completeProfileSrc.slice(onSubmitStart, onSubmitStart + 1200)
    expect(onSubmitBody).not.toMatch(/country_code:\s*['"`]\+\d/)
  })
})

describe('P10.9 — password/confirm_password are commented out, not sent, in the phone-OTP flow', () => {
  it('the register() call inside complete-profile does not pass an active password field', () => {
    const onSubmitStart = completeProfileSrc.indexOf('const onSubmit')
    const onSubmitBody = completeProfileSrc.slice(onSubmitStart, onSubmitStart + 1200)
    // Only commented-out references (prefixed with //) may remain.
    const activePasswordLine = onSubmitBody
      .split('\n')
      .find((line) => /\bpassword\s*:/.test(line) && !line.trim().startsWith('//'))
    expect(activePasswordLine).toBeUndefined()
  })

  it('still contains a commented-out password line so it can be re-enabled later', () => {
    expect(completeProfileSrc).toMatch(/\/\/\s*password:/)
  })
})
