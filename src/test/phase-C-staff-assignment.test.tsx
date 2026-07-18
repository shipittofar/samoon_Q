// ============================================================
// Phase C — Staff Management assignment flow
//
// Replaces the previously-broken invite button
// (inviteStaff.mutate({ email: '', roles: ['waiter'] })) with a real
// invite form, and adds "Edit roles & branches" to the staff detail
// page. Both are wired to the existing useInviteStaff()/
// useUpdateStaffRoles() mutations — no new permission or branch-access
// logic is introduced. Permission union comes from the existing
// getPermissionsForRole(); branch union/visibility comes from the
// existing resolveBranchAccess()/BranchAccess model (Phase 9) — this
// file does not duplicate either.
// ============================================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import en from '@/i18n/locales/en.json'
import { getPermissionsForRole } from '@/services/permission.service'
import { requiresBranchSelection } from '@/components/admin/StaffRoleBranchFields'
import { StaffInviteModal } from '@/components/admin/StaffInviteModal'

vi.mock('@/services/axios.instance', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

process.env.NEXT_PUBLIC_USE_MOCK = 'true'

async function freshStaffService() {
  vi.resetModules()
  const mod = await import('@/services/staff.service')
  return mod
}

function withProviders(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>{node}</NextIntlClientProvider>
    </QueryClientProvider>
  )
}

// ── Service layer: branchIds persistence ───────────────────────────────────

describe('Phase C — staffService.inviteStaff() persists roles + branchIds', () => {
  it('the created invite carries both roles and branchIds', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'new.cashier@test.com',
      firstName: 'New',
      lastName: 'Cashier',
      roles: ['cashier'],
      branchIds: ['branch-1'],
    })
    expect(invite.roles).toEqual(['cashier'])
    expect(invite.branchIds).toEqual(['branch-1'])
  })

  it('multiple roles and multiple branches are both persisted on the invite', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'multi@test.com',
      roles: ['cashier', 'waiter'],
      branchIds: ['branch-1', 'branch-2'],
    })
    expect(invite.roles).toEqual(['cashier', 'waiter'])
    expect(invite.branchIds).toEqual(['branch-1', 'branch-2'])
  })

  it('omitting branchIds (e.g. an owner/admin invite) leaves the invite without a branchIds field', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'owner-invite@test.com',
      roles: ['admin'],
    })
    expect(invite.branchIds).toBeUndefined()
  })
})

describe('Phase C — accepting an invite carries branchIds onto the created StaffMember', () => {
  it('the returned StaffMember includes the branches the invite granted', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'accept-branches@test.com',
      roles: ['waiter'],
      branchIds: ['branch-1', 'branch-2'],
    })
    const member = await staffService.acceptInvite(invite.id)
    expect(member.roles).toEqual(['waiter'])
    expect(member.branchIds).toEqual(['branch-1', 'branch-2'])
  })
})

describe('Phase C — staffService.updateStaffRoles() persists roles + branchIds', () => {
  it('updates both roles and branchIds together', async () => {
    const { staffService } = await freshStaffService()
    const updated = await staffService.updateStaffRoles('staff-waiter-01', {
      roles: ['cashier', 'kitchen'],
      branchIds: ['branch-1'],
    })
    expect(updated.roles).toEqual(['cashier', 'kitchen'])
    expect(updated.branchIds).toEqual(['branch-1'])
  })

  it('multiple branch ids are all persisted (union of visibility)', async () => {
    const { staffService } = await freshStaffService()
    const updated = await staffService.updateStaffRoles('staff-waiter-01', {
      roles: ['manager'],
      branchIds: ['branch-1', 'branch-2', 'branch-3'],
    })
    expect(updated.branchIds).toEqual(['branch-1', 'branch-2', 'branch-3'])
  })

  it('omitting branchIds leaves the member\'s existing branch assignment untouched (backward compatible)', async () => {
    const { staffService } = await freshStaffService()
    await staffService.updateStaffRoles('staff-waiter-01', { roles: ['cashier'], branchIds: ['branch-9'] })
    const updatedAgain = await staffService.updateStaffRoles('staff-waiter-01', { roles: ['manager'] })
    expect(updatedAgain.roles).toEqual(['manager'])
    expect(updatedAgain.branchIds).toEqual(['branch-9'])
  })

  it('still rejects updates to a removed member (existing behavior unchanged)', async () => {
    const { staffService } = await freshStaffService()
    await expect(
      staffService.updateStaffRoles('staff-removed-01', { roles: ['waiter'], branchIds: ['branch-1'] }),
    ).rejects.toThrow()
  })
})

// ── Permission union (existing getPermissionsForRole(), not redesigned) ─────

describe('Phase C — multiple roles union permissions via the existing getPermissionsForRole()', () => {
  it('cashier alone does not grant menu.view; waiter alone does not grant payments.refund', () => {
    expect(getPermissionsForRole(['cashier'])).not.toContain('menu.view')
    expect(getPermissionsForRole(['waiter'])).not.toContain('payments.refund')
  })

  it('["cashier","waiter"] together grant the union of both role sets', () => {
    const union = getPermissionsForRole(['cashier', 'waiter'])
    expect(union).toContain('payments.refund') // cashier-only
    expect(union).toContain('menu.view') // waiter-only
    expect(union).toContain('orders.view') // shared by both
  })
})

// ── Invite form validation (StaffInviteModal) ────────────────────────────────

describe('Phase C — StaffInviteModal validation', () => {
  it('requiresBranchSelection() is false for owner/admin-only role sets', () => {
    expect(requiresBranchSelection(['owner'])).toBe(false)
    expect(requiresBranchSelection(['admin'])).toBe(false)
    expect(requiresBranchSelection(['owner', 'admin'])).toBe(false)
  })

  it('requiresBranchSelection() is true when any operational role is present', () => {
    expect(requiresBranchSelection(['cashier'])).toBe(true)
    expect(requiresBranchSelection(['owner', 'cashier'])).toBe(true)
    expect(requiresBranchSelection(['manager', 'waiter'])).toBe(true)
  })

  it('submitting with no email/roles shows validation errors and does not submit', async () => {
    const user = userEvent.setup()
    render(withProviders(<StaffInviteModal tenantId="tenant-samoon-01" open onClose={() => {}} />))

    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(await screen.findByText('Email is required')).toBeTruthy()
    expect(screen.getByText('Select at least one role')).toBeTruthy()
  })

  it('selecting an operational role with no branch shows the branch-required error', async () => {
    const user = userEvent.setup()
    render(withProviders(<StaffInviteModal tenantId="tenant-samoon-01" open onClose={() => {}} />))

    await user.type(screen.getByLabelText('Email'), 'valid@test.com')
    await user.click(screen.getByRole('checkbox', { name: /Cashier/i }))
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(await screen.findByText('Select at least one branch for the selected role(s)')).toBeTruthy()
  })

  it('a fully valid submission closes the modal (no validation errors block it)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(withProviders(<StaffInviteModal tenantId="tenant-samoon-01" open onClose={onClose} />))

    await user.type(screen.getByLabelText('Email'), 'valid.owner@test.com')
    await user.click(screen.getByRole('checkbox', { name: /Owner/i }))
    // Owner is tenant-wide — no branch selection required, so submission
    // should proceed straight to the mutation (mock service, resolves
    // after its own internal delay) and close on success.
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 })
    expect(screen.queryByText('Email is required')).toBeNull()
    expect(screen.queryByText('Select at least one role')).toBeNull()
  })
})

// ── Types: backward compatibility ────────────────────────────────────────────

describe('Phase C — InviteStaffPayload/UpdateStaffRolesPayload stay backward compatible', () => {
  it('a legacy invite call with no branchIds still type-checks and works', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'legacy@test.com',
      roles: ['waiter'],
    })
    expect(invite.email).toBe('legacy@test.com')
  })

  it('a legacy updateStaffRoles call with no branchIds still type-checks and works', async () => {
    const { staffService } = await freshStaffService()
    const updated = await staffService.updateStaffRoles('staff-cashier-01', { roles: ['support'] })
    expect(updated.roles).toEqual(['support'])
  })
})
