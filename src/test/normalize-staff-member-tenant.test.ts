import { describe, it, expect } from 'vitest'
import { normalizeStaffMember } from '@/api/staff'

describe('normalizeStaffMember — tenant field compatibility', () => {
  it('accepts backend membership payload with tenant (not tenant_id)', () => {
    const member = normalizeStaffMember({
      id: 'ca5a3e42-cd08-4a16-b2a6-3662bebd8165',
      tenant: '01428ce9-fa5e-4ba8-beab-f16e976eb746',
      user: 'fa7c8ecc-9905-4d16-a6f3-6224414ec580',
      user_id: 'fa7c8ecc-9905-4d16-a6f3-6224414ec580',
      email: 'nvojreWS23@gmail.com',
      first_name: null,
      last_name: null,
      status: 'active',
    })

    expect(member).not.toBeNull()
    expect(member).toMatchObject({
      id: 'ca5a3e42-cd08-4a16-b2a6-3662bebd8165',
      tenantId: '01428ce9-fa5e-4ba8-beab-f16e976eb746',
      userId: 'fa7c8ecc-9905-4d16-a6f3-6224414ec580',
      email: 'nvojreWS23@gmail.com',
      status: 'active',
      firstName: '',
      lastName: '',
    })
  })

  it('still accepts tenant_id', () => {
    const member = normalizeStaffMember({
      id: 'membership-1',
      tenant_id: 'tenant-snake',
      user_id: 'user-1',
      email: 'a@example.com',
      status: 'active',
    })
    expect(member?.tenantId).toBe('tenant-snake')
  })

  it('still accepts tenantId', () => {
    const member = normalizeStaffMember({
      id: 'membership-2',
      tenantId: 'tenant-camel',
      userId: 'user-2',
      email: 'b@example.com',
      status: 'active',
    })
    expect(member?.tenantId).toBe('tenant-camel')
  })

  it('does not reject null first_name / last_name', () => {
    const member = normalizeStaffMember({
      id: 'membership-3',
      tenant: 'tenant-3',
      user_id: 'user-3',
      email: 'c@example.com',
      first_name: null,
      last_name: null,
      status: 'active',
    })
    expect(member).not.toBeNull()
    expect(member?.firstName).toBe('')
    expect(member?.lastName).toBe('')
  })
})
