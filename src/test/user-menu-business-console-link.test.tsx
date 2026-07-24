import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { useAuthStore } from '@/stores'
import type { User } from '@/types'
import { UserMenuBusinessConsoleLink } from '@/components/layout/UserMenuBusinessConsoleLink'
import { renderWithIntl } from '@/test/test-utils'

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

describe('UserMenuBusinessConsoleLink', () => {
  it('renders for business accounts', () => {
    useAuthStore.setState({ user: userWith('business'), isAuthenticated: true, isLoading: false })
    renderWithIntl(<UserMenuBusinessConsoleLink />)
    expect(screen.getByRole('link', { name: /business console/i })).toHaveAttribute('href', '/console')
  })

  it('renders nothing for customer accounts', () => {
    useAuthStore.setState({ user: userWith('customer'), isAuthenticated: true, isLoading: false })
    const { container } = renderWithIntl(<UserMenuBusinessConsoleLink />)
    expect(container).toBeEmptyDOMElement()
  })
})
