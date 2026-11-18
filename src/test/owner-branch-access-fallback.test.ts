/**
 * Owner branch-access fallback (restored after commit 58d1121 removed it).
 *
 * Missing/malformed branchAccess must never widen access — except for Owner,
 * who already holds every permission; restricting Owner because the backend
 * omitted branchAccess only breaks Owner. Explicit backend values win.
 */
import { describe, it, expect } from 'vitest'
import { normalizeWireMembership } from '@/lib/auth-me-normalizer'
import { resolveBranchAccess } from '@/services/permission.service'

describe('resolveBranchAccess — owner fallback', () => {
  it('owner with no explicit branchAccess gets all branches', () => {
    expect(resolveBranchAccess(undefined, ['owner'])).toEqual({ scope: 'all' })
  })

  it('non-owner with no explicit branchAccess gets no branches', () => {
    expect(resolveBranchAccess(undefined, ['manager'])).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('an explicit selected scope is respected even for owner', () => {
    expect(resolveBranchAccess({ scope: 'selected', branchIds: ['b-1'] }, ['owner']))
      .toEqual({ scope: 'selected', branchIds: ['b-1'] })
  })
})

describe('normalizeWireMembership — missing branchAccess from /auth/me', () => {
  it('owner without branch_access resolves to all branches', () => {
    const m = normalizeWireMembership({ tenant_id: 't-1', roles: ['owner'] })
    expect(m?.branchAccess).toEqual({ scope: 'all' })
  })

  it('non-owner without branch_access resolves to no branches', () => {
    const m = normalizeWireMembership({ tenant_id: 't-1', roles: ['cashier'] })
    expect(m?.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('an explicit branch_access is taken as-is for owner', () => {
    const m = normalizeWireMembership({
      tenant_id: 't-1',
      roles: ['owner'],
      branch_access: { scope: 'selected', branch_ids: ['b-2'] },
    })
    expect(m?.branchAccess).toEqual({ scope: 'selected', branchIds: ['b-2'] })
  })
})
