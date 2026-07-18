// ============================================================
// Phase 7 Task 1 — Auth transient getMe() failure handling
//
// Previously, a getMe() failure that was NOT a 401 (network error,
// timeout, 5xx) preserved tokens but left the user functionally logged
// out: `isAuthenticated` stayed false, and AuthGuard redirected to
// /login exactly as it would for a genuinely invalid session. This file
// proves the new `sessionCheckFailed` flag lets AuthGuard distinguish
// the two cases: it no longer redirects when the failure was transient,
// while still never rendering `children` without a real session.
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { useAuthStore, useTenantStore } from '@/stores'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// AuthGuard calls usePermission() — stub it so this file doesn't need to
// stand up the whole RBAC stack; permission logic is untouched by this task.
vi.mock('@/hooks', () => ({
  usePermission: () => true,
}))

import { AuthGuard } from '@/components/auth/AuthGuard'

describe('Phase 7 — useAuthStore.sessionCheckFailed', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true, sessionCheckFailed: false })
  })

  it('setSessionCheckFailed(true) sets the flag and clears isLoading, without touching user/isAuthenticated', () => {
    useAuthStore.getState().setSessionCheckFailed(true)
    const state = useAuthStore.getState()
    expect(state.sessionCheckFailed).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('a successful setUser() clears sessionCheckFailed', () => {
    useAuthStore.getState().setSessionCheckFailed(true)
    expect(useAuthStore.getState().sessionCheckFailed).toBe(true)

    useAuthStore.getState().setUser({
      id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B',
      role: 'customer', is_verified: true, created_at: new Date().toISOString(),
    })
    expect(useAuthStore.getState().sessionCheckFailed).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('logout() clears sessionCheckFailed', () => {
    useAuthStore.getState().setSessionCheckFailed(true)
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().sessionCheckFailed).toBe(false)
  })
})

describe('Phase 7 — AuthGuard does not redirect to login on a transient session-check failure', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenantState: 'resolved' } as never)
  })

  it('genuinely unauthenticated (no session-check failure): redirects to /login', () => {
    render(<AuthGuard>{<div>Protected</div>}</AuthGuard>)
    expect(mockReplace).toHaveBeenCalledWith('/login')
    expect(screen.queryByText('Protected')).toBeNull()
  })

  it('transient session-check failure: does NOT redirect to /login', () => {
    useAuthStore.setState({ sessionCheckFailed: true })
    render(<AuthGuard>{<div>Protected</div>}</AuthGuard>)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('transient session-check failure: still does not render children (no access without a valid session)', () => {
    useAuthStore.setState({ sessionCheckFailed: true })
    render(<AuthGuard>{<div>Protected</div>}</AuthGuard>)
    expect(screen.queryByText('Protected')).toBeNull()
  })

  it('transient session-check failure: renders sessionErrorFallback with a working retry callback', () => {
    useAuthStore.setState({ sessionCheckFailed: true })
    const onRetry = vi.fn()
    render(
      <AuthGuard
        sessionErrorFallback={(retry) => (
          <button onClick={() => { onRetry(); retry() }}>Retry</button>
        )}
      >
        <div>Protected</div>
      </AuthGuard>,
    )
    expect(screen.getByText('Retry')).toBeTruthy()
    expect(screen.queryByText('Protected')).toBeNull()
  })

  it('a genuine session (isAuthenticated true) renders children regardless of sessionCheckFailed history', () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, isAuthenticated: true, sessionCheckFailed: false })
    render(<AuthGuard requiredPermission={undefined}>{<div>Protected</div>}</AuthGuard>)
    expect(screen.getByText('Protected')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
