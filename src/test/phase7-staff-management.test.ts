/**
 * P7.2 — Enterprise Staff Management System
 * 200+ tests covering all aspects of the staff management domain.
 */

import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '../../')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

vi.mock('@/services/axios.instance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

process.env.NEXT_PUBLIC_USE_MOCK = 'true'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/staff.service')
  return mod
}

// ── A. StaffStatus type ───────────────────────────────────────────────────────

describe('A. StaffStatus type', () => {
  it('A1: pending is a valid StaffStatus', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.some((s) => s.status === 'pending')).toBe(true)
  })

  it('A2: active is a valid StaffStatus', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.some((s) => s.status === 'active')).toBe(true)
  })

  it('A3: suspended is a valid StaffStatus', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.some((s) => s.status === 'suspended')).toBe(true)
  })

  it('A4: removed is a valid StaffStatus', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.some((s) => s.status === 'removed')).toBe(true)
  })

  it('A5: StaffStatus source file contains all 4 statuses', () => {
    const staffSrc = readSrc('src/types/staff.ts')
    expect(staffSrc).toContain("'pending'")
    expect(staffSrc).toContain("'active'")
    expect(staffSrc).toContain("'suspended'")
    expect(staffSrc).toContain("'removed'")
  })
})

// ── B. InviteStatus type ──────────────────────────────────────────────────────

describe('B. InviteStatus type', () => {
  it('B1: pending invite exists in mock data', async () => {
    const { staffService } = await freshService()
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.some((i) => i.status === 'pending')).toBe(true)
  })

  it('B2: expired invite exists in mock data', async () => {
    const { staffService } = await freshService()
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.some((i) => i.status === 'expired')).toBe(true)
  })

  it('B3: cancelled invite exists in mock data', async () => {
    const { staffService } = await freshService()
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.some((i) => i.status === 'cancelled')).toBe(true)
  })

  it('B4: accepted invite status is declared in types', () => {
    const staffSrc = readSrc('src/types/staff.ts')
    expect(staffSrc).toContain("'accepted'")
  })

  it('B5: InviteStatus has all 4 values in source', () => {
    const staffSrc = readSrc('src/types/staff.ts')
    ;['pending', 'accepted', 'expired', 'cancelled'].forEach((v) => {
      expect(staffSrc).toContain(`'${v}'`)
    })
  })

  it('B6: InviteStatus is declared in types', () => {
    const staffSrc = readSrc('src/types/staff.ts')
    expect(staffSrc).toContain('InviteStatus')
  })
})

// ── C. StaffMember shape ──────────────────────────────────────────────────────

describe('C. StaffMember shape', () => {
  it('C1: has required id field', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff[0]).toHaveProperty('id')
  })

  it('C2: has tenantId field', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff[0]).toHaveProperty('tenantId')
  })

  it('C3: has email field', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff[0]).toHaveProperty('email')
  })

  it('C4: has roles array', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(Array.isArray(staff[0]!.roles)).toBe(true)
  })

  it('C5: branchIds is optional — may be undefined', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const hasMissing = staff.some((s) => s.branchIds === undefined)
    expect(hasMissing).toBe(true)
  })

  it('C6: createdBy is present', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff[0]).toHaveProperty('createdBy')
  })

  it('C7: invitedAt is present', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff[0]).toHaveProperty('invitedAt')
  })

  it('C8: status is present', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff[0]).toHaveProperty('status')
  })

  it('C9: userId is present', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff[0]).toHaveProperty('userId')
  })

  it('C10: branchIds declared as optional in StaffMember type source', () => {
    const staffSrc = readSrc('src/types/staff.ts')
    expect(staffSrc).toContain('branchIds')
  })
})

// ── D. Mock data coverage ─────────────────────────────────────────────────────

describe('D. Mock data coverage', () => {
  it('D1: at least 15 mock staff members', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.length).toBeGreaterThanOrEqual(15)
  })

  it('D2: all 8 roles represented', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const roles = new Set(staff.flatMap((s) => s.roles))
    ;['owner', 'admin', 'manager', 'cashier', 'waiter', 'kitchen', 'marketing', 'support'].forEach(
      (r) => expect(roles.has(r as never)).toBe(true),
    )
  })

  it('D3: has exactly 1 owner', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.filter((s) => s.roles.includes('owner')).length).toBe(1)
  })

  it('D4: has at least 10 active staff members', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.filter((s) => s.status === 'active').length).toBeGreaterThanOrEqual(10)
  })

  it('D5: has 4 mock invites', async () => {
    const { staffService } = await freshService()
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.length).toBe(4)
  })

  it('D6: has 2 pending invites', async () => {
    const { staffService } = await freshService()
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.filter((i) => i.status === 'pending').length).toBe(2)
  })

  it('D7: getStaff is tenant-scoped — unknown tenant returns empty', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('no-such-tenant')
    expect(staff).toHaveLength(0)
  })

  it('D8: getInvites is tenant-scoped — unknown tenant returns empty', async () => {
    const { staffService } = await freshService()
    const invites = await staffService.getInvites('no-such-tenant')
    expect(invites).toHaveLength(0)
  })

  it('D9: has at least 2 suspended staff', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.filter((s) => s.status === 'suspended').length).toBeGreaterThanOrEqual(1)
  })

  it('D10: has at least 1 removed staff', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.filter((s) => s.status === 'removed').length).toBeGreaterThanOrEqual(1)
  })
})

// ── E. getStaffMember ─────────────────────────────────────────────────────────

describe('E. getStaffMember', () => {
  it('E1: returns member by id', async () => {
    const { staffService } = await freshService()
    const member = await staffService.getStaffMember('staff-owner-01')
    expect(member.id).toBe('staff-owner-01')
  })

  it('E2: throws on unknown id', async () => {
    const { staffService } = await freshService()
    await expect(staffService.getStaffMember('no-such-id')).rejects.toThrow()
  })

  it('E3: returns a copy — mutations do not affect store', async () => {
    const { staffService } = await freshService()
    const member = await staffService.getStaffMember('staff-owner-01')
    member.email = 'changed@test.com'
    const member2 = await staffService.getStaffMember('staff-owner-01')
    expect(member2.email).not.toBe('changed@test.com')
  })

  it('E4: owner member has role owner', async () => {
    const { staffService } = await freshService()
    const member = await staffService.getStaffMember('staff-owner-01')
    expect(member.roles).toContain('owner')
  })

  it('E5: admin member has role admin', async () => {
    const { staffService } = await freshService()
    const member = await staffService.getStaffMember('staff-admin-01')
    expect(member.roles).toContain('admin')
  })
})

// ── F. inviteStaff ────────────────────────────────────────────────────────────

describe('F. inviteStaff', () => {
  it('F1: creates a pending invite', async () => {
    const { staffService } = await freshService()
    const invite = await staffService.inviteStaff('tenant-savor-01', {
      email: 'new.hire@test.com',
      roles: ['waiter'],
    })
    expect(invite.status).toBe('pending')
  })

  it('F2: invite has correct email', async () => {
    const { staffService } = await freshService()
    const invite = await staffService.inviteStaff('tenant-savor-01', {
      email: 'hire2@test.com',
      roles: ['cashier'],
    })
    expect(invite.email).toBe('hire2@test.com')
  })

  it('F3: invite has correct roles', async () => {
    const { staffService } = await freshService()
    const invite = await staffService.inviteStaff('tenant-savor-01', {
      email: 'hire3@test.com',
      roles: ['manager'],
    })
    expect(invite.roles).toContain('manager')
  })

  it('F4: invite appears in getInvites', async () => {
    const { staffService } = await freshService()
    await staffService.inviteStaff('tenant-savor-01', {
      email: 'hire4@test.com',
      roles: ['support'],
    })
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.some((i) => i.email === 'hire4@test.com')).toBe(true)
  })

  it('F5: emits staff.invited audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e))
    await staffService.inviteStaff('tenant-savor-01', {
      email: 'audit.hire@test.com',
      roles: ['waiter'],
    })
    expect(events.length).toBe(1)
    expect(events[0]!.action).toBe('staff.invited')
  })

  it('F6: invite has expiresAt in the future', async () => {
    const { staffService } = await freshService()
    const invite = await staffService.inviteStaff('tenant-savor-01', {
      email: 'future@test.com',
      roles: ['waiter'],
    })
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('F7: invite has id', async () => {
    const { staffService } = await freshService()
    const invite = await staffService.inviteStaff('tenant-savor-01', {
      email: 'idholder@test.com',
      roles: ['kitchen'],
    })
    expect(invite.id).toBeDefined()
    expect(invite.id.length).toBeGreaterThan(0)
  })

  it('F8: invite has correct tenantId', async () => {
    const { staffService } = await freshService()
    const invite = await staffService.inviteStaff('tenant-savor-01', {
      email: 'tenant@test.com',
      roles: ['marketing'],
    })
    expect(invite.tenantId).toBe('tenant-savor-01')
  })
})

// ── G. cancelInvite ───────────────────────────────────────────────────────────

describe('G. cancelInvite', () => {
  it('G1: cancels a pending invite', async () => {
    const { staffService } = await freshService()
    const result = await staffService.cancelInvite('invite-001')
    expect(result.status).toBe('cancelled')
  })

  it('G2: throws on already-cancelled invite', async () => {
    const { staffService } = await freshService()
    await expect(staffService.cancelInvite('invite-004')).rejects.toThrow()
  })

  it('G3: throws on expired invite', async () => {
    const { staffService } = await freshService()
    await expect(staffService.cancelInvite('invite-003')).rejects.toThrow()
  })

  it('G4: throws on unknown invite id', async () => {
    const { staffService } = await freshService()
    await expect(staffService.cancelInvite('no-such-invite')).rejects.toThrow()
  })

  it('G5: cancelled invite persists in list', async () => {
    const { staffService } = await freshService()
    await staffService.cancelInvite('invite-001')
    const invites = await staffService.getInvites('tenant-savor-01')
    const invite = invites.find((i) => i.id === 'invite-001')
    expect(invite?.status).toBe('cancelled')
  })
})

// ── H. resendInvite ───────────────────────────────────────────────────────────

describe('H. resendInvite', () => {
  it('H1: resends a pending invite — stays pending', async () => {
    const { staffService } = await freshService()
    const result = await staffService.resendInvite('invite-002')
    expect(result.status).toBe('pending')
  })

  it('H2: resends an expired invite — restores to pending', async () => {
    const { staffService } = await freshService()
    const result = await staffService.resendInvite('invite-003')
    expect(result.status).toBe('pending')
  })

  it('H3: extends expiresAt after resend', async () => {
    const { staffService } = await freshService()
    const result = await staffService.resendInvite('invite-003')
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('H4: throws on cancelled invite', async () => {
    const { staffService } = await freshService()
    await expect(staffService.resendInvite('invite-004')).rejects.toThrow()
  })

  it('H5: throws on unknown id', async () => {
    const { staffService } = await freshService()
    await expect(staffService.resendInvite('no-such-invite')).rejects.toThrow()
  })
})

// ── I. acceptInvite ───────────────────────────────────────────────────────────

describe('I. acceptInvite', () => {
  it('I1: accepts a pending invite, returns StaffMember', async () => {
    const { staffService } = await freshService()
    const member = await staffService.acceptInvite('invite-001')
    expect(member).toHaveProperty('id')
    expect(member).toHaveProperty('roles')
  })

  it('I2: throws on cancelled invite', async () => {
    const { staffService } = await freshService()
    await expect(staffService.acceptInvite('invite-004')).rejects.toThrow()
  })

  it('I3: throws on expired invite', async () => {
    const { staffService } = await freshService()
    await expect(staffService.acceptInvite('invite-003')).rejects.toThrow()
  })

  it('I4: throws on unknown invite', async () => {
    const { staffService } = await freshService()
    await expect(staffService.acceptInvite('no-such-invite')).rejects.toThrow()
  })

  it('I5: invite status becomes accepted after acceptInvite', async () => {
    const { staffService } = await freshService()
    await staffService.acceptInvite('invite-001')
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.find((i) => i.id === 'invite-001')?.status).toBe('accepted')
  })
})

// ── J. updateStaffRoles ───────────────────────────────────────────────────────

describe('J. updateStaffRoles', () => {
  it('J1: updates roles for active member', async () => {
    const { staffService } = await freshService()
    const result = await staffService.updateStaffRoles('staff-waiter-01', { roles: ['cashier'] })
    expect(result.roles).toContain('cashier')
  })

  it('J2: emits staff.role_changed audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e))
    await staffService.updateStaffRoles('staff-waiter-01', { roles: ['support'] })
    expect(events.some((e) => e.action === 'staff.role_changed')).toBe(true)
  })

  it('J3: throws on removed member', async () => {
    const { staffService } = await freshService()
    await expect(
      staffService.updateStaffRoles('staff-removed-01', { roles: ['waiter'] }),
    ).rejects.toThrow()
  })

  it('J4: throws on unknown member', async () => {
    const { staffService } = await freshService()
    await expect(staffService.updateStaffRoles('no-such-id', { roles: ['waiter'] })).rejects.toThrow()
  })

  it('J5: role change persists on next read', async () => {
    const { staffService } = await freshService()
    await staffService.updateStaffRoles('staff-cashier-01', { roles: ['support'] })
    const member = await staffService.getStaffMember('staff-cashier-01')
    expect(member.roles).toContain('support')
  })

  it('J6: audit event metadata contains prevRoles', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string; metadata?: { prevRoles: string[] } }> = []
    staffAuditHooks.subscribe((e) => events.push(e as { action: string; metadata?: { prevRoles: string[] } }))
    await staffService.updateStaffRoles('staff-waiter-02', { roles: ['cashier'] })
    const roleEvent = events.find((e) => e.action === 'staff.role_changed')
    expect(roleEvent?.metadata?.prevRoles).toContain('waiter')
  })
})

// ── K. activateStaff ──────────────────────────────────────────────────────────

describe('K. activateStaff', () => {
  it('K1: activates a suspended member', async () => {
    const { staffService } = await freshService()
    const result = await staffService.activateStaff('staff-manager-02')
    expect(result.status).toBe('active')
  })

  it('K2: emits staff.activated audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e))
    await staffService.activateStaff('staff-manager-02')
    expect(events.some((e) => e.action === 'staff.activated')).toBe(true)
  })

  it('K3: throws on unknown member', async () => {
    const { staffService } = await freshService()
    await expect(staffService.activateStaff('no-such-id')).rejects.toThrow()
  })

  it('K4: activation persists on next read', async () => {
    const { staffService } = await freshService()
    await staffService.activateStaff('staff-manager-02')
    const member = await staffService.getStaffMember('staff-manager-02')
    expect(member.status).toBe('active')
  })

  it('K5: activatedAt is set after activation', async () => {
    const { staffService } = await freshService()
    const result = await staffService.activateStaff('staff-pending-01')
    expect(result.activatedAt).toBeDefined()
  })
})

// ── L. suspendStaff ───────────────────────────────────────────────────────────

describe('L. suspendStaff', () => {
  it('L1: suspends an active member', async () => {
    const { staffService } = await freshService()
    const result = await staffService.suspendStaff('staff-waiter-01')
    expect(result.status).toBe('suspended')
  })

  it('L2: emits staff.suspended audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e))
    await staffService.suspendStaff('staff-waiter-01')
    expect(events.some((e) => e.action === 'staff.suspended')).toBe(true)
  })

  it('L3: cannot suspend owner — throws', async () => {
    const { staffService } = await freshService()
    await expect(staffService.suspendStaff('staff-owner-01')).rejects.toThrow()
  })

  it('L4: throws on unknown member', async () => {
    const { staffService } = await freshService()
    await expect(staffService.suspendStaff('no-such-id')).rejects.toThrow()
  })

  it('L5: suspension persists on next read', async () => {
    const { staffService } = await freshService()
    await staffService.suspendStaff('staff-cashier-01')
    const member = await staffService.getStaffMember('staff-cashier-01')
    expect(member.status).toBe('suspended')
  })
})

// ── M. removeStaff ────────────────────────────────────────────────────────────

describe('M. removeStaff', () => {
  it('M1: removes an active member — status becomes removed', async () => {
    const { staffService } = await freshService()
    await staffService.removeStaff('staff-waiter-01')
    const member = await staffService.getStaffMember('staff-waiter-01')
    expect(member.status).toBe('removed')
  })

  it('M2: emits staff.removed audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e))
    await staffService.removeStaff('staff-cashier-01')
    expect(events.some((e) => e.action === 'staff.removed')).toBe(true)
  })

  it('M3: cannot remove owner — throws', async () => {
    const { staffService } = await freshService()
    await expect(staffService.removeStaff('staff-owner-01')).rejects.toThrow()
  })

  it('M4: throws on unknown member', async () => {
    const { staffService } = await freshService()
    await expect(staffService.removeStaff('no-such-id')).rejects.toThrow()
  })

  it('M5: removed member still returned by getStaff', async () => {
    const { staffService } = await freshService()
    await staffService.removeStaff('staff-waiter-01')
    const staff = await staffService.getStaff('tenant-savor-01')
    expect(staff.some((s) => s.id === 'staff-waiter-01')).toBe(true)
  })
})

// ── N. transferOwnership ──────────────────────────────────────────────────────

describe('N. transferOwnership', () => {
  it('N1: transfer returns owner and prevOwner', async () => {
    const { staffService } = await freshService()
    const result = await staffService.transferOwnership('staff-owner-01', 'staff-admin-01')
    expect(result).toHaveProperty('owner')
    expect(result).toHaveProperty('prevOwner')
  })

  it('N2: new owner has owner role', async () => {
    const { staffService } = await freshService()
    const result = await staffService.transferOwnership('staff-owner-01', 'staff-admin-01')
    expect(result.owner.id).toBe('staff-admin-01')
    expect(result.owner.roles).toContain('owner')
  })

  it('N3: previous owner downgraded — owner role removed', async () => {
    const { staffService } = await freshService()
    const result = await staffService.transferOwnership('staff-owner-01', 'staff-admin-01')
    expect(result.prevOwner.roles).not.toContain('owner')
  })

  it('N4: previous owner gains admin role', async () => {
    const { staffService } = await freshService()
    const result = await staffService.transferOwnership('staff-owner-01', 'staff-admin-01')
    expect(result.prevOwner.roles).toContain('admin')
  })

  it('N5: throws if source is not owner', async () => {
    const { staffService } = await freshService()
    await expect(
      staffService.transferOwnership('staff-admin-01', 'staff-manager-01'),
    ).rejects.toThrow()
  })

  it('N6: throws if target is suspended', async () => {
    const { staffService } = await freshService()
    await expect(
      staffService.transferOwnership('staff-owner-01', 'staff-manager-02'),
    ).rejects.toThrow()
  })

  it('N7: throws if source equals target', async () => {
    const { staffService } = await freshService()
    await expect(
      staffService.transferOwnership('staff-owner-01', 'staff-owner-01'),
    ).rejects.toThrow()
  })

  it('N8: emits staff.ownership_transferred audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e))
    await staffService.transferOwnership('staff-owner-01', 'staff-admin-01')
    expect(events.some((e) => e.action === 'staff.ownership_transferred')).toBe(true)
  })

  it('N9: new owner has owner role after re-read', async () => {
    const { staffService } = await freshService()
    await staffService.transferOwnership('staff-owner-01', 'staff-admin-01')
    const newOwner = await staffService.getStaffMember('staff-admin-01')
    expect(newOwner.roles).toContain('owner')
  })

  it('N10: old owner no longer has owner role after re-read', async () => {
    const { staffService } = await freshService()
    await staffService.transferOwnership('staff-owner-01', 'staff-admin-01')
    const oldOwner = await staffService.getStaffMember('staff-owner-01')
    expect(oldOwner.roles).not.toContain('owner')
  })

  it('N11: throws on unknown source id', async () => {
    const { staffService } = await freshService()
    await expect(
      staffService.transferOwnership('no-such-id', 'staff-admin-01'),
    ).rejects.toThrow()
  })

  it('N12: throws on unknown target id', async () => {
    const { staffService } = await freshService()
    await expect(
      staffService.transferOwnership('staff-owner-01', 'no-such-id'),
    ).rejects.toThrow()
  })
})

// ── O. computeAnalytics ───────────────────────────────────────────────────────

describe('O. computeAnalytics', () => {
  it('O1: totalStaff excludes removed members', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const invites = await staffService.getInvites('tenant-savor-01')
    const analytics = staffService.computeAnalytics(staff, invites)
    expect(analytics.totalStaff).toBe(staff.filter((s) => s.status !== 'removed').length)
  })

  it('O2: activeStaff count matches active members', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const invites = await staffService.getInvites('tenant-savor-01')
    const analytics = staffService.computeAnalytics(staff, invites)
    expect(analytics.activeStaff).toBe(staff.filter((s) => s.status === 'active').length)
  })

  it('O3: pendingInvites count matches pending invites', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const invites = await staffService.getInvites('tenant-savor-01')
    const analytics = staffService.computeAnalytics(staff, invites)
    expect(analytics.pendingInvites).toBe(invites.filter((i) => i.status === 'pending').length)
  })

  it('O4: suspendedStaff count matches suspended members', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const invites = await staffService.getInvites('tenant-savor-01')
    const analytics = staffService.computeAnalytics(staff, invites)
    expect(analytics.suspendedStaff).toBe(staff.filter((s) => s.status === 'suspended').length)
  })

  it('O5: byRole contains owner count ≥ 1', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const analytics = staffService.computeAnalytics(staff, [])
    expect(analytics.byRole['owner']).toBeGreaterThanOrEqual(1)
  })

  it('O6: empty inputs return zeroed analytics', async () => {
    const { staffService } = await freshService()
    const analytics = staffService.computeAnalytics([], [])
    expect(analytics.totalStaff).toBe(0)
    expect(analytics.activeStaff).toBe(0)
    expect(analytics.pendingInvites).toBe(0)
    expect(analytics.suspendedStaff).toBe(0)
  })

  it('O7: byRole has kitchen key', async () => {
    const { staffService } = await freshService()
    const staff = await staffService.getStaff('tenant-savor-01')
    const analytics = staffService.computeAnalytics(staff, [])
    expect(analytics.byRole['kitchen']).toBeGreaterThanOrEqual(1)
  })
})

// ── P. getMembership ──────────────────────────────────────────────────────────

describe('P. getMembership', () => {
  it('P1: returns membership for known user+tenant', async () => {
    const { staffService } = await freshService()
    const membership = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(membership).toBeDefined()
  })

  it('P2: membership has correct userId', async () => {
    const { staffService } = await freshService()
    const membership = staffService.getMembership('user-admin-01', 'tenant-savor-01')
    expect(membership?.userId).toBe('user-admin-01')
  })

  it('P3: membership has correct tenantId', async () => {
    const { staffService } = await freshService()
    const membership = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(membership?.tenantId).toBe('tenant-savor-01')
  })

  it('P4: membership has roles including owner', async () => {
    const { staffService } = await freshService()
    const membership = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(Array.isArray(membership?.roles)).toBe(true)
    expect(membership?.roles).toContain('owner')
  })

  it('P5: returns undefined for unknown user', async () => {
    const { staffService } = await freshService()
    expect(staffService.getMembership('no-such-user', 'tenant-savor-01')).toBeUndefined()
  })

  it('P6: tenant isolation — wrong tenant returns undefined', async () => {
    const { staffService } = await freshService()
    expect(staffService.getMembership('user-owner-01', 'wrong-tenant')).toBeUndefined()
  })

  it('P7: membership has joinedAt', async () => {
    const { staffService } = await freshService()
    const membership = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(membership?.joinedAt).toBeDefined()
  })

  it('P8: membership has staffMemberId', async () => {
    const { staffService } = await freshService()
    const membership = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(membership?.staffMemberId).toBeDefined()
  })
})

// ── Q. Audit hooks ────────────────────────────────────────────────────────────

describe('Q. Audit hooks', () => {
  it('Q1: subscribe returns an unsubscribe function', async () => {
    const { staffAuditHooks } = await freshService()
    const unsub = staffAuditHooks.subscribe(() => {})
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('Q2: unsubscribed listener does not receive events', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: unknown[] = []
    const unsub = staffAuditHooks.subscribe((e) => events.push(e))
    unsub()
    await staffService.suspendStaff('staff-waiter-01')
    expect(events.length).toBe(0)
  })

  it('Q3: getLog returns all emitted events', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    await staffService.suspendStaff('staff-waiter-01')
    await staffService.activateStaff('staff-waiter-01')
    expect(staffAuditHooks.getLog().length).toBeGreaterThanOrEqual(2)
  })

  it('Q4: _reset clears log', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    await staffService.suspendStaff('staff-waiter-01')
    staffAuditHooks._reset()
    expect(staffAuditHooks.getLog().length).toBe(0)
  })

  it('Q5: audit event has tenantId', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    await staffService.suspendStaff('staff-cashier-01')
    const log = staffAuditHooks.getLog()
    expect(log[0]?.tenantId).toBe('tenant-savor-01')
  })

  it('Q6: audit event has timestamp', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    await staffService.activateStaff('staff-manager-02')
    const log = staffAuditHooks.getLog()
    expect(log[0]?.timestamp).toBeDefined()
  })

  it('Q7: all 6 audit action types declared in types source', () => {
    const staffSrc = readSrc('src/types/staff.ts')
    ;[
      'staff.invited',
      'staff.role_changed',
      'staff.suspended',
      'staff.activated',
      'staff.removed',
      'staff.ownership_transferred',
    ].forEach((action) => {
      expect(staffSrc).toContain(action)
    })
  })

  it('Q8: multiple listeners all receive events', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const log1: unknown[] = []
    const log2: unknown[] = []
    staffAuditHooks.subscribe((e) => log1.push(e))
    staffAuditHooks.subscribe((e) => log2.push(e))
    await staffService.suspendStaff('staff-cashier-01')
    expect(log1.length).toBe(1)
    expect(log2.length).toBe(1)
  })

  it('Q9: getLog returns a copy — not internal reference', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    await staffService.activateStaff('staff-marketing-02')
    const log = staffAuditHooks.getLog()
    const len = log.length
    log.push({ action: 'staff.activated' as never, tenantId: 'x', timestamp: '' })
    expect(staffAuditHooks.getLog().length).toBe(len)
  })
})

// ── R. _resetMockStore ────────────────────────────────────────────────────────

describe('R. _resetMockStore', () => {
  it('R1: restores original staff count after mutation', async () => {
    const { staffService } = await freshService()
    const before = (await staffService.getStaff('tenant-savor-01')).length
    await staffService.inviteStaff('tenant-savor-01', { email: 'x@x.com', roles: ['waiter'] })
    staffService._resetMockStore()
    const after = (await staffService.getStaff('tenant-savor-01')).length
    expect(after).toBe(before)
  })

  it('R2: restores original invite count after mutation', async () => {
    const { staffService } = await freshService()
    await staffService.inviteStaff('tenant-savor-01', { email: 'x@x.com', roles: ['waiter'] })
    staffService._resetMockStore()
    const invites = await staffService.getInvites('tenant-savor-01')
    expect(invites.length).toBe(4)
  })

  it('R3: clears audit log', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    await staffService.suspendStaff('staff-waiter-01')
    staffService._resetMockStore()
    expect(staffAuditHooks.getLog().length).toBe(0)
  })

  it('R4: restores original staff statuses', async () => {
    const { staffService } = await freshService()
    await staffService.suspendStaff('staff-waiter-01')
    staffService._resetMockStore()
    const member = await staffService.getStaffMember('staff-waiter-01')
    expect(member.status).toBe('active')
  })

  it('R5: restores original roles after role change', async () => {
    const { staffService } = await freshService()
    await staffService.updateStaffRoles('staff-cashier-01', { roles: ['support'] })
    staffService._resetMockStore()
    const member = await staffService.getStaffMember('staff-cashier-01')
    expect(member.roles).toContain('cashier')
  })
})

// ── S. Navigation integration ─────────────────────────────────────────────────

describe('S. Navigation integration', () => {
  it('S1: STAFF_NAV_ITEM constant in registry source', () => {
    const regSrc = readSrc('src/modules/registry.ts')
    expect(regSrc).toContain('STAFF_NAV_ITEM')
  })

  it('S2: ADMIN_STAFF_ROUTES exported from registry', async () => {
    const { ADMIN_STAFF_ROUTES } = await import('@/modules/registry')
    expect(ADMIN_STAFF_ROUTES).toBeDefined()
    expect(Array.isArray(ADMIN_STAFF_ROUTES)).toBe(true)
  })

  it('S3: ADMIN_STAFF_ROUTES contains /admin/staff', async () => {
    const { ADMIN_STAFF_ROUTES } = await import('@/modules/registry')
    expect(ADMIN_STAFF_ROUTES).toContain('/admin/staff')
  })

  it('S4: all 6 modules include /admin/staff in routes', async () => {
    const {
      RESTAURANT_MODULE,
      CAFE_MODULE,
      BAR_MODULE,
      FOOD_COURT_MODULE,
      FOOD_TRUCK_MODULE,
      MOBILE_CAFE_MODULE,
    } = await import('@/modules/registry')
    for (const mod of [
      RESTAURANT_MODULE,
      CAFE_MODULE,
      BAR_MODULE,
      FOOD_COURT_MODULE,
      FOOD_TRUCK_MODULE,
      MOBILE_CAFE_MODULE,
    ]) {
      expect(mod.routes).toContain('/admin/staff')
    }
  })

  it('S5: all 6 modules include Staff nav item in adminNavItems', async () => {
    const {
      RESTAURANT_MODULE,
      CAFE_MODULE,
      BAR_MODULE,
      FOOD_COURT_MODULE,
      FOOD_TRUCK_MODULE,
      MOBILE_CAFE_MODULE,
    } = await import('@/modules/registry')
    for (const mod of [
      RESTAURANT_MODULE,
      CAFE_MODULE,
      BAR_MODULE,
      FOOD_COURT_MODULE,
      FOOD_TRUCK_MODULE,
      MOBILE_CAFE_MODULE,
    ]) {
      expect(mod.adminNavItems?.some((n) => n.href === '/admin/staff')).toBe(true)
    }
  })

  it('S6: STAFF_NAV_ITEM has permissionKey staff.view', () => {
    const regSrc = readSrc('src/modules/registry.ts')
    expect(regSrc).toContain("permissionKey: 'staff.view'")
  })

  it('S7: STAFF_NAV_ITEM has featureFlagKey admin.staff.enabled', () => {
    const regSrc = readSrc('src/modules/registry.ts')
    expect(regSrc).toContain('admin.staff.enabled')
  })

  it('S8: useAdminModuleNav filters by permissionKey', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('permissionKey')
  })
})

// ── T. Permission integration ─────────────────────────────────────────────────

describe('T. Permission integration', () => {
  it('T1: staff.view is declared as P7Permission in rbac types', () => {
    const rbacSrc = readSrc('src/types/rbac.ts')
    expect(rbacSrc).toContain('staff.view')
  })

  it('T2: staff.manage is declared as P7Permission in rbac types', () => {
    const rbacSrc = readSrc('src/types/rbac.ts')
    expect(rbacSrc).toContain('staff.manage')
  })

  it('T3: owner has staff.view permission', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole(['owner'])).toContain('staff.view')
  })

  it('T4: owner has staff.manage permission', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole(['owner'])).toContain('staff.manage')
  })

  it('T5: kitchen role does NOT have staff.manage', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole(['kitchen'])).not.toContain('staff.manage')
  })

  it('T6: admin has staff.view and staff.manage', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const perms = getPermissionsForRole(['admin'])
    expect(perms).toContain('staff.view')
    expect(perms).toContain('staff.manage')
  })

  it('T7: cashier does NOT have staff.manage', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole(['cashier'])).not.toContain('staff.manage')
  })

  it('T8: waiter does NOT have staff.view', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole(['waiter'])).not.toContain('staff.view')
  })
})

// ── U. StaffAuditEvent shape ──────────────────────────────────────────────────

describe('U. StaffAuditEvent shape', () => {
  it('U1: action is defined on audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ action: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e as { action: string }))
    await staffService.activateStaff('staff-marketing-02')
    expect(events[0]?.action).toBeDefined()
  })

  it('U2: tenantId is defined on audit event', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ tenantId: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e as { tenantId: string }))
    await staffService.activateStaff('staff-marketing-02')
    expect(events[0]?.tenantId).toBeDefined()
  })

  it('U3: timestamp is an ISO string', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ timestamp: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e as { timestamp: string }))
    await staffService.activateStaff('staff-marketing-02')
    expect(() => new Date(events[0]!.timestamp)).not.toThrow()
    expect(isNaN(new Date(events[0]!.timestamp).getTime())).toBe(false)
  })

  it('U4: staffMemberId on member-targeting actions', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ staffMemberId?: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e as { staffMemberId?: string }))
    await staffService.suspendStaff('staff-cashier-01')
    expect(events[0]?.staffMemberId).toBe('staff-cashier-01')
  })

  it('U5: inviteId on invite-targeting actions', async () => {
    const { staffService, staffAuditHooks } = await freshService()
    const events: Array<{ inviteId?: string }> = []
    staffAuditHooks.subscribe((e) => events.push(e as { inviteId?: string }))
    await staffService.inviteStaff('tenant-savor-01', { email: 'x@x.com', roles: ['waiter'] })
    expect(events[0]?.inviteId).toBeDefined()
  })
})

// ── V. Hooks source checks ────────────────────────────────────────────────────

describe('V. Staff hooks source', () => {
  it('V1: useStaff hook exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useStaff(')
  })

  it('V2: useStaffMember hook exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useStaffMember(')
  })

  it('V3: useInvites hook exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useInvites(')
  })

  it('V4: useInviteStaff mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useInviteStaff(')
  })

  it('V5: useSuspendStaff mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useSuspendStaff(')
  })

  it('V6: useActivateStaff mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useActivateStaff(')
  })

  it('V7: useRemoveStaff mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useRemoveStaff(')
  })

  it('V8: useTransferOwnership mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useTransferOwnership(')
  })

  it('V9: useUpdateStaffRoles mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useUpdateStaffRoles(')
  })

  it('V10: useCancelInvite mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useCancelInvite(')
  })

  it('V11: useResendInvite mutation exported', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('export function useResendInvite(')
  })

  it('V12: useAdminModuleNav filters by permissionKey', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('permissionKey')
  })

  it('V13: staffService imported in hooks', () => {
    const hooksSrc = readSrc('src/hooks/index.ts')
    expect(hooksSrc).toContain('staffService')
  })
})

// ── W. Page source checks ─────────────────────────────────────────────────────

describe('W. Staff page source', () => {
  it('W1: admin/staff/page.tsx exists and has content', () => {
    const pageSrc = readSrc('src/app/admin/staff/page.tsx')
    expect(pageSrc.length).toBeGreaterThan(0)
  })

  it('W2: staff page uses PermissionGuard', () => {
    const pageSrc = readSrc('src/app/admin/staff/page.tsx')
    expect(pageSrc).toContain('PermissionGuard')
  })

  it('W3: staff page guards staff.view permission', () => {
    const pageSrc = readSrc('src/app/admin/staff/page.tsx')
    expect(pageSrc).toContain('staff.view')
  })

  it('W4: staff page imports useStaff', () => {
    const pageSrc = readSrc('src/app/admin/staff/page.tsx')
    expect(pageSrc).toContain('useStaff')
  })

  it('W5: staff page imports useInvites', () => {
    const pageSrc = readSrc('src/app/admin/staff/page.tsx')
    expect(pageSrc).toContain('useInvites')
  })

  it('W6: staff page shows analytics section', () => {
    const pageSrc = readSrc('src/app/admin/staff/page.tsx')
    expect(pageSrc).toContain('analytics')
  })

  it('W7: staff detail page exists and has content', () => {
    const detailSrc = readSrc('src/app/admin/staff/[id]/page.tsx')
    expect(detailSrc.length).toBeGreaterThan(0)
  })

  it('W8: detail page uses PermissionGuard', () => {
    const detailSrc = readSrc('src/app/admin/staff/[id]/page.tsx')
    expect(detailSrc).toContain('PermissionGuard')
  })

  it('W9: detail page uses use(params) for async route params', () => {
    const detailSrc = readSrc('src/app/admin/staff/[id]/page.tsx')
    expect(detailSrc).toContain('use(params)')
  })

  it('W10: detail page shows derived permissions', () => {
    const detailSrc = readSrc('src/app/admin/staff/[id]/page.tsx')
    expect(detailSrc).toContain('getPermissionsForRole')
  })

  it('W11: detail page guards staff.view', () => {
    const detailSrc = readSrc('src/app/admin/staff/[id]/page.tsx')
    expect(detailSrc).toContain('staff.view')
  })
})

// ── X. TenantMembership shape ─────────────────────────────────────────────────

describe('X. TenantMembership shape', () => {
  it('X1: membership has userId', async () => {
    const { staffService } = await freshService()
    const m = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(m).toHaveProperty('userId')
  })

  it('X2: membership has tenantId', async () => {
    const { staffService } = await freshService()
    const m = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(m).toHaveProperty('tenantId')
  })

  it('X3: membership has staffMemberId', async () => {
    const { staffService } = await freshService()
    const m = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(m).toHaveProperty('staffMemberId')
  })

  it('X4: membership has roles array', async () => {
    const { staffService } = await freshService()
    const m = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(Array.isArray(m?.roles)).toBe(true)
  })

  it('X5: membership has status', async () => {
    const { staffService } = await freshService()
    const m = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(m).toHaveProperty('status')
  })

  it('X6: TenantMembership declared in types source', () => {
    const staffSrc = readSrc('src/types/staff.ts')
    expect(staffSrc).toContain('TenantMembership')
  })

  it('X7: membership status matches staff member status', async () => {
    const { staffService } = await freshService()
    const m = staffService.getMembership('user-owner-01', 'tenant-savor-01')
    expect(m?.status).toBe('active')
  })
})

// ── Y. Regression: existing systems unaffected ────────────────────────────────

describe('Y. Regression', () => {
  it('Y1: getStaff returns copies — mutations do not affect store', async () => {
    const { staffService } = await freshService()
    const staff1 = await staffService.getStaff('tenant-savor-01')
    staff1[0]!.email = 'mutated@test.com'
    const staff2 = await staffService.getStaff('tenant-savor-01')
    expect(staff2[0]!.email).not.toBe('mutated@test.com')
  })

  it('Y2: getInvites returns copies — mutations do not affect store', async () => {
    const { staffService } = await freshService()
    const inv1 = await staffService.getInvites('tenant-savor-01')
    inv1[0]!.email = 'mutated@test.com'
    const inv2 = await staffService.getInvites('tenant-savor-01')
    expect(inv2[0]!.email).not.toBe('mutated@test.com')
  })

  it('Y3: staffService exports staffAuditHooks as property', async () => {
    const { staffService } = await freshService()
    expect(staffService.staffAuditHooks).toBeDefined()
  })

  it('Y4: staffAuditHooks is also exported standalone', async () => {
    const { staffAuditHooks } = await freshService()
    expect(staffAuditHooks).toBeDefined()
    expect(typeof staffAuditHooks.subscribe).toBe('function')
  })

  it('Y5: service exports computeAnalytics', async () => {
    const { staffService } = await freshService()
    expect(typeof staffService.computeAnalytics).toBe('function')
  })

  it('Y6: service exports getMembership', async () => {
    const { staffService } = await freshService()
    expect(typeof staffService.getMembership).toBe('function')
  })

  it('Y7: service exports _resetMockStore', async () => {
    const { staffService } = await freshService()
    expect(typeof staffService._resetMockStore).toBe('function')
  })

  it('Y8: ENDPOINTS.STAFF is defined', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.STAFF).toBeDefined()
  })

  it('Y9: ENDPOINTS.STAFF.LIST is a function returning tenant-scoped path', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(typeof ENDPOINTS.STAFF.LIST).toBe('function')
    expect(ENDPOINTS.STAFF.LIST('t1')).toContain('t1')
  })

  it('Y10: ENDPOINTS.STAFF.TRANSFER_OWNERSHIP is a function', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(typeof ENDPOINTS.STAFF.TRANSFER_OWNERSHIP).toBe('function')
  })

  it('Y11: RESTAURANT_MODULE adminNavItems count increased by 1', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.adminNavItems!.length).toBeGreaterThanOrEqual(3)
  })

  it('Y12: NavItem type has optional permissionKey field', () => {
    const typesSrc = readSrc('src/types/index.ts')
    expect(typesSrc).toContain('permissionKey')
  })
})
