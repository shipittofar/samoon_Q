import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { useAuthStore } from '@/stores'
import type { User } from '@/types'
import { POST_LOGIN_REDIRECT_EVENT, type PostLoginRedirectDetail } from '@/lib/post-auth-navigation'
import { INTENDED_AUTH_REDIRECT_KEY } from '@/utils/auth-redirect'
import { PostLoginRedirectHandler } from '@/providers/PostLoginRedirectHandler'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn(), prefetch: vi.fn() }),
}))

function userWith(accountType: User['accountType']): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    first_name: 'Test',
    last_name: 'User',
    accountType,
    is_verified: true,
    created_at: new Date().toISOString(),
  }
}

describe('PostLoginRedirectHandler', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    sessionStorage.removeItem(INTENDED_AUTH_REDIRECT_KEY)
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true, sessionCheckFailed: false })
  })

  it('redirects business accounts to /console after post-login event', async () => {
    const businessUser = userWith('business')
    useAuthStore.setState({ user: businessUser, isAuthenticated: true, isLoading: false })

    render(<PostLoginRedirectHandler><div /></PostLoginRedirectHandler>)

    window.dispatchEvent(
      new CustomEvent(POST_LOGIN_REDIRECT_EVENT, { detail: { user: businessUser, p7Roles: ['owner'] } }),
    )

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/console')
    })
  })

  it('redirects customer accounts to /dashboard after post-login event', async () => {
    const customerUser = userWith('customer')
    useAuthStore.setState({ user: customerUser, isAuthenticated: true, isLoading: false })

    render(<PostLoginRedirectHandler><div /></PostLoginRedirectHandler>)

    window.dispatchEvent(
      new CustomEvent(POST_LOGIN_REDIRECT_EVENT, { detail: { user: customerUser } }),
    )

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('redirects to stored checkout intent instead of dashboard', async () => {
    const customerUser = userWith('customer')
    sessionStorage.setItem(INTENDED_AUTH_REDIRECT_KEY, '/checkout?orderType=pickup')

    render(<PostLoginRedirectHandler><div /></PostLoginRedirectHandler>)

    window.dispatchEvent(
      new CustomEvent(POST_LOGIN_REDIRECT_EVENT, { detail: { user: customerUser } }),
    )

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/checkout?orderType=pickup')
    })
  })

  it('does not redirect when accountType is missing from event payload', async () => {
    const userWithoutType = { ...userWith('customer'), accountType: undefined } as unknown as User

    render(<PostLoginRedirectHandler><div /></PostLoginRedirectHandler>)

    window.dispatchEvent(
      new CustomEvent(POST_LOGIN_REDIRECT_EVENT, { detail: { user: userWithoutType } }),
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
