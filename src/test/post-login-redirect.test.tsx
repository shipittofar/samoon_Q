import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { useAuthStore } from '@/stores'
import type { User } from '@/types'
import { POST_LOGIN_REDIRECT_EVENT } from '@/lib/post-auth-navigation'
import { PostLoginRedirectHandler } from '@/providers/PostLoginRedirectHandler'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('@/services/auth.service', () => ({
  authService: {
    getMe: vi.fn(),
  },
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
})
