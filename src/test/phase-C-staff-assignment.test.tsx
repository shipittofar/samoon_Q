// ============================================================
// Phase C — Staff Management assignment flow (D2)
// ============================================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import en from '@/i18n/locales/en.json'
import { getPermissionsForRole } from '@/services/permission.service'
import { requiresAssignmentLocations } from '@/components/admin/AssignmentFormFields'
import { StaffInviteModal } from '@/components/admin/StaffInviteModal'

vi.mock('@/services/axios.instance', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  const mockRoles = [
    { id: 'owner', name: 'Owner', slug: 'owner', permissions: [] },
    { id: 'admin', name: 'Admin', slug: 'admin', permissions: [] },
    { id: 'cashier', name: 'Cashier', slug: 'cashier', permissions: [] },
    { id: 'waiter', name: 'Waiter', slug: 'waiter', permissions: [] },
  ]
  return {
    ...actual,
    useTenantRoles: () => ({ data: mockRoles, isLoading: false }),
    useAdminBranches: () => ({
      data: [
        { id: 'branch-1', name: 'Branch 1' },
        { id: 'branch-2', name: 'Branch 2' },
      ],
      isLoading: false,
    }),
  }
})

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

describe('Phase C — staffService.inviteStaff() persists D2 assignment fields', () => {
  it('the created invite carries role_id and location_ids', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'new.cashier@test.com',
      firstName: 'New',
      lastName: 'Cashier',
      role_id: 'cashier',
      location_ids: ['branch-1'],
      all_locations: false,
      mode: 'manage',
    })
    expect(invite.role).toBe('cashier')
    expect(invite.locationIds).toEqual(['branch-1'])
  })

  it('tenant-wide invite omits location ids', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'owner-invite@test.com',
      role_id: 'admin',
      location_ids: [],
      all_locations: true,
      mode: 'manage',
    })
    expect(invite.allLocations).toBe(true)
    expect(invite.locationIds).toBeUndefined()
  })
})

describe('Phase C — accepting an invite carries locations onto the created StaffMember', () => {
  it('the returned StaffMember includes the locations the invite granted', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'accept-branches@test.com',
      role_id: 'waiter',
      location_ids: ['branch-1', 'branch-2'],
      all_locations: false,
      mode: 'manage',
    })
    const member = await staffService.acceptInvite(invite.id)
    expect(member.roles).toContain('waiter')
    expect(member.locationIds).toEqual(['branch-1', 'branch-2'])
  })
})

describe('Phase C — staffService.updateStaffRoles() mock-only legacy path', () => {
  it('updates roles in mock mode', async () => {
    const { staffService } = await freshStaffService()
    const updated = await staffService.updateStaffRoles('staff-waiter-01', {
      roles: ['cashier', 'kitchen'],
      branchIds: ['branch-1'],
    })
    expect(updated.roles).toEqual(['cashier', 'kitchen'])
    expect(updated.branchIds).toEqual(['branch-1'])
  })
})

describe('Phase C — multiple roles union permissions via mock getPermissionsForRole()', () => {
  it('cashier alone does not grant menu.view; waiter alone does not grant payments.refund', () => {
    expect(getPermissionsForRole(['cashier'])).not.toContain('menu.view')
    expect(getPermissionsForRole(['waiter'])).not.toContain('payments.refund')
  })

  it('["cashier","waiter"] together grant the union of both role sets', () => {
    const union = getPermissionsForRole(['cashier', 'waiter'])
    expect(union).toContain('payments.refund')
    expect(union).toContain('menu.view')
    expect(union).toContain('orders.view')
  })
})

describe('Phase C — StaffInviteModal validation', () => {
  it('requiresAssignmentLocations() is true when tenant-wide is off and no locations selected', () => {
    expect(requiresAssignmentLocations(false, [])).toBe(true)
    expect(requiresAssignmentLocations(true, [])).toBe(false)
    expect(requiresAssignmentLocations(false, ['branch-1'])).toBe(false)
  })

  it('submitting with no email/role shows validation errors and does not submit', async () => {
    const user = userEvent.setup()
    render(withProviders(<StaffInviteModal tenantId="tenant-samoon-01" open onClose={() => {}} />))

    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(await screen.findByText('Email is required')).toBeTruthy()
    expect(screen.getByText('Select at least one role')).toBeTruthy()
  })

  it('selecting a role with no location shows the location-required error', async () => {
    const user = userEvent.setup()
    render(withProviders(<StaffInviteModal tenantId="tenant-samoon-01" open onClose={() => {}} />))

    await user.type(screen.getByLabelText('Email'), 'valid@test.com')
    const roleSelect = screen.getByLabelText('Roles')
    await user.selectOptions(roleSelect, 'cashier')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(await screen.findByText('Select at least one branch for the selected role(s)')).toBeTruthy()
  })

  it('tenant-wide submission closes the modal on success', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(withProviders(<StaffInviteModal tenantId="tenant-samoon-01" open onClose={onClose} />))

    await user.type(screen.getByLabelText('Email'), 'valid.owner@test.com')
    await user.click(screen.getByLabelText(/All locations/i))
    const roleSelect = screen.getByLabelText('Roles')
    await user.selectOptions(roleSelect, 'owner')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 })
    expect(screen.queryByText('Email is required')).toBeNull()
  })
})

describe('Phase C — InviteStaffPayload D2 shape', () => {
  it('invite with assignment fields works in mock mode', async () => {
    const { staffService } = await freshStaffService()
    const invite = await staffService.inviteStaff('tenant-samoon-01', {
      email: 'legacy@test.com',
      role_id: 'waiter',
      location_ids: [],
      all_locations: true,
      mode: 'read',
    })
    expect(invite.email).toBe('legacy@test.com')
    expect(invite.mode).toBe('read')
  })
})
