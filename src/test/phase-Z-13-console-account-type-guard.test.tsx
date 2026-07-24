// Phase Z.13 — accountType blocks Console route access for customers
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { useAuthStore } from '@/stores'
import type { User } from '@/types'
import {
  mayAccessConsoleByAccountType,
  shouldSkipConsoleRouteWork,
} from '@/lib/console-account-access'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/console',
  useSearchParams: () => new URLSearchParams(),
}))

import { ConsoleAccountTypeGuard } from '@/components/auth/ConsoleAccountTypeGuard'

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

describe('console-account-access helpers', () => {
  it('allows business accounts', () => {
    expect(mayAccessConsoleByAccountType(userWith('business'))).toBe(true)
  })

  it('denies customer accounts', () => {
    expect(mayAccessConsoleByAccountType(userWith('customer'))).toBe(false)
  })

  it('does not skip console work when user is absent (auth layer handles that)', () => {
    expect(shouldSkipConsoleRouteWork('/console', null)).toBe(false)
  })

  it('skips console work for customers on /console routes', () => {
    expect(shouldSkipConsoleRouteWork('/console/orders', userWith('customer'))).toBe(true)
  })

  it('does not skip console work for business accounts', () => {
    expect(shouldSkipConsoleRouteWork('/console', userWith('business'))).toBe(false)
  })

  it('does not skip work on non-console routes for customers', () => {
    expect(shouldSkipConsoleRouteWork('/dashboard', userWith('customer'))).toBe(false)
  })
})

describe('ConsoleAccountTypeGuard', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true, sessionCheckFailed: false })
  })

  it('redirects customer accounts to /dashboard and renders nothing', () => {
    useAuthStore.setState({ user: userWith('customer'), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })

    render(
      <ConsoleAccountTypeGuard>
        <div>Console Shell</div>
      </ConsoleAccountTypeGuard>,
    )

    expect(screen.queryByText('Console Shell')).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('renders children for business accounts', () => {
    useAuthStore.setState({ user: userWith('business'), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })

    render(
      <ConsoleAccountTypeGuard>
        <div>Console Shell</div>
      </ConsoleAccountTypeGuard>,
    )

    expect(screen.getByText('Console Shell')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('waits while auth is loading', () => {
    useAuthStore.setState({ user: userWith('customer'), isAuthenticated: true, isLoading: true, sessionCheckFailed: false })

    render(
      <ConsoleAccountTypeGuard>
        <div>Console Shell</div>
      </ConsoleAccountTypeGuard>,
    )

    expect(screen.queryByText('Console Shell')).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
