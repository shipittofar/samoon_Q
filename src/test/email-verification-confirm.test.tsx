import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, renderHook, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/locales/en.json'
import { authService } from '@/services/auth.service'
import type { GetMeResponse } from '@/services/auth.service'
import { useAuthStore } from '@/stores'
import { useConfirmEmailVerification } from '@/hooks'
import type { User } from '@/types'
import SettingsPage from '@/app/dashboard/settings/page'

vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

const CONFIRMED_EMAIL = 'user@example.com'

function phoneOnlyUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-phone-only',
    email: null,
    phone_number: '+15551212',
    first_name: 'Ada',
    last_name: 'Lovelace',
    accountType: 'customer',
    is_verified: false,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function confirmResponse(email = CONFIRMED_EMAIL): User {
  return {
    id: 'u-phone-only',
    email,
    phone_number: '+15551212',
    first_name: 'Ada',
    last_name: 'Lovelace',
    accountType: 'customer',
    is_verified: false,
    created_at: '2024-01-01T00:00:00Z',
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
}

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={en}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    )
  }
}

beforeEach(() => {
  useAuthStore.getState().setUser(phoneOnlyUser())
})

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().setUser(null)
})

describe('useConfirmEmailVerification — apply confirm email immediately', () => {
  it('sets authStore.user.email from the HTTP 200 User even when is_verified is false', async () => {
    vi.spyOn(authService, 'confirmEmailVerification').mockResolvedValue(confirmResponse())
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: phoneOnlyUser({ email: CONFIRMED_EMAIL, is_verified: false }),
    })

    const qc = makeQueryClient()
    const { result } = renderHook(() => useConfirmEmailVerification(), { wrapper: createWrapper(qc) })
    await result.current.mutateAsync({ email: CONFIRMED_EMAIL, code: '123456' })

    expect(useAuthStore.getState().user?.email).toBe(CONFIRMED_EMAIL)
    expect(useAuthStore.getState().user?.is_verified).toBe(false)
  })

  it('preserves existing identity fields and only updates email locally when /me is stale', async () => {
    vi.spyOn(authService, 'confirmEmailVerification').mockResolvedValue(confirmResponse())
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: phoneOnlyUser({ email: null, is_verified: false }),
    })

    const qc = makeQueryClient()
    const { result } = renderHook(() => useConfirmEmailVerification(), { wrapper: createWrapper(qc) })
    await result.current.mutateAsync({ email: CONFIRMED_EMAIL, code: '123456' })

    const user = useAuthStore.getState().user
    expect(user?.id).toBe('u-phone-only')
    expect(user?.first_name).toBe('Ada')
    expect(user?.last_name).toBe('Lovelace')
    expect(user?.phone_number).toBe('+15551212')
    expect(user?.accountType).toBe('customer')
    expect(user?.email).toBe(CONFIRMED_EMAIL)
    expect(user?.is_verified).toBe(false)
  })

  it('keeps the confirmed email when GET /auth/me fails after confirm 200', async () => {
    vi.spyOn(authService, 'confirmEmailVerification').mockResolvedValue(confirmResponse())
    vi.spyOn(authService, 'getMe').mockRejectedValue(new Error('me failed'))

    const qc = makeQueryClient()
    const { result } = renderHook(() => useConfirmEmailVerification(), { wrapper: createWrapper(qc) })

    await expect(
      result.current.mutateAsync({ email: CONFIRMED_EMAIL, code: '123456' }),
    ).resolves.toMatchObject({ email: CONFIRMED_EMAIL, is_verified: false })

    expect(useAuthStore.getState().user?.email).toBe(CONFIRMED_EMAIL)
    expect(useAuthStore.getState().user?.first_name).toBe('Ada')
    expect(useAuthStore.getState().user?.is_verified).toBe(false)
  })

  it('does not update email when confirm fails', async () => {
    vi.spyOn(authService, 'confirmEmailVerification').mockRejectedValue(new Error('otp_invalid'))
    const getMe = vi.spyOn(authService, 'getMe')

    const qc = makeQueryClient()
    const { result } = renderHook(() => useConfirmEmailVerification(), { wrapper: createWrapper(qc) })

    await expect(
      result.current.mutateAsync({ email: CONFIRMED_EMAIL, code: '000000' }),
    ).rejects.toThrow('otp_invalid')

    expect(getMe).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user?.email).toBeNull()
  })

  it('patches React Query [me] cache email without replacing unrelated user fields', async () => {
    const existing: GetMeResponse = { user: phoneOnlyUser() }
    vi.spyOn(authService, 'confirmEmailVerification').mockResolvedValue(confirmResponse())
    vi.spyOn(authService, 'getMe').mockRejectedValue(new Error('me failed'))

    const qc = makeQueryClient()
    qc.setQueryData(['me'], existing)

    const { result } = renderHook(() => useConfirmEmailVerification(), { wrapper: createWrapper(qc) })
    await result.current.mutateAsync({ email: CONFIRMED_EMAIL, code: '123456' })

    const cached = qc.getQueryData<GetMeResponse>(['me'])
    expect(cached?.user.email).toBe(CONFIRMED_EMAIL)
    expect(cached?.user.first_name).toBe('Ada')
    expect(cached?.user.is_verified).toBe(false)
  })
})

describe('Settings email card — confirmed UI uses email presence, not is_verified', () => {
  it('shows the green confirmed state after a 200 confirm with is_verified false', async () => {
    vi.spyOn(authService, 'confirmEmailVerification').mockResolvedValue(confirmResponse())
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: phoneOnlyUser({ email: CONFIRMED_EMAIL, is_verified: false }),
    })

    const qc = makeQueryClient()
    const Wrapper = createWrapper(qc)

    function Harness() {
      const confirm = useConfirmEmailVerification()
      return (
        <>
          <button
            type="button"
            onClick={() => confirm.mutate({ email: CONFIRMED_EMAIL, code: '123456' })}
          >
            run-confirm
          </button>
          <SettingsPage />
        </>
      )
    }

    const view = render(<Harness />, { wrapper: Wrapper })

    expect(screen.getByText('Not Verified')).toBeInTheDocument()
    expect(screen.getByText('Email not verified')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'run-confirm' }))

    await waitFor(() => {
      expect(useAuthStore.getState().user?.email).toBe(CONFIRMED_EMAIL)
    })
    await waitFor(() => {
      expect(screen.getByText('Email Verified')).toBeInTheDocument()
    })
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getAllByText(CONFIRMED_EMAIL).length).toBeGreaterThan(0)
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
    expect(useAuthStore.getState().user?.is_verified).toBe(false)

    view.unmount()
  })

  it('stays confirmed when confirm succeeds and GET /auth/me fails', async () => {
    vi.spyOn(authService, 'confirmEmailVerification').mockResolvedValue(confirmResponse())
    vi.spyOn(authService, 'getMe').mockRejectedValue(new Error('me failed'))

    const qc = makeQueryClient()
    const Wrapper = createWrapper(qc)

    function Harness() {
      const confirm = useConfirmEmailVerification()
      return (
        <>
          <button
            type="button"
            onClick={() => {
              void confirm.mutateAsync({ email: CONFIRMED_EMAIL, code: '123456' }).catch(() => {
                throw new Error('confirm should not reject when /me fails')
              })
            }}
          >
            run-confirm
          </button>
          <SettingsPage />
        </>
      )
    }

    render(<Harness />, { wrapper: Wrapper })
    await userEvent.click(screen.getByRole('button', { name: 'run-confirm' }))

    await waitFor(() => {
      expect(screen.getByText('Email Verified')).toBeInTheDocument()
    })
    expect(useAuthStore.getState().user?.email).toBe(CONFIRMED_EMAIL)
    expect(screen.queryByText('Email not verified')).not.toBeInTheDocument()
  })
})
