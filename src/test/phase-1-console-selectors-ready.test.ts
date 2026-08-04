import { describe, it, expect } from 'vitest'
import { isConsoleSelectorsReady } from '@/lib/console-workspace'

describe('isConsoleSelectorsReady', () => {
  const base = {
    sessionMemberships: [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' as const } }],
    workspacePhase: 'ready' as const,
    tenantState: 'resolved' as const,
    branchState: 'empty' as const,
    activeTenantId: 't1',
  }

  it('is false while session memberships are loading', () => {
    expect(isConsoleSelectorsReady({ ...base, sessionMemberships: null })).toBe(false)
  })

  it('is false while workspace is initializing', () => {
    expect(isConsoleSelectorsReady({ ...base, workspacePhase: 'initializing' })).toBe(false)
  })

  it('is false while tenant is loading', () => {
    expect(isConsoleSelectorsReady({ ...base, tenantState: 'loading' })).toBe(false)
  })

  it('is false while branches are loading', () => {
    expect(isConsoleSelectorsReady({ ...base, branchState: 'loading' })).toBe(false)
  })

  it('is true when workspace, tenant, and branches have settled', () => {
    expect(isConsoleSelectorsReady(base)).toBe(true)
    expect(isConsoleSelectorsReady({ ...base, branchState: 'ready' })).toBe(true)
    expect(isConsoleSelectorsReady({ ...base, branchState: 'error' })).toBe(true)
  })

  it('is true when boot finished without an active tenant pointer', () => {
    expect(
      isConsoleSelectorsReady({
        ...base,
        activeTenantId: null,
        tenantState: 'not_found',
        branchState: 'idle',
      }),
    ).toBe(true)
  })
})
