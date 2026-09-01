import { describe, it, expect } from 'vitest'
import {
  normalizeGetMeResponse,
  normalizeWireMembership,
  assertMembershipBranchIsolation,
} from '@/lib/auth-me-normalizer'

describe('normalizeWireMembership', () => {
  it('maps snake_case membership fields', () => {
    const membership = normalizeWireMembership({
      tenant_id: 'tenant-1',
      tenant_name: 'Samoon Restaurant',
      tenant_slug: 'samoon',
      tenant_logo: null,
      roles: ['owner'],
      branch_access: { scope: 'all' },
      branches: [
        {
          id: 'branch-1',
          name: 'Main Branch',
          slug: 'main',
          status: 'active',
          is_default: true,
        },
      ],
    })

    expect(membership).toMatchObject({
      tenantId: 'tenant-1',
      tenantName: 'Samoon Restaurant',
      tenantSlug: 'samoon',
      tenantLogo: null,
      roles: ['owner'],
      branchAccess: { scope: 'all' },
      branches: [{ id: 'branch-1', name: 'Main Branch', slug: 'main', status: 'active', isDefault: true }],
    })
  })

  it('normalizes singular role field', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-1',
      tenantSlug: 'samoon',
      role: 'owner',
      branchAccess: { scope: 'all' },
    })
    expect(membership?.roles).toEqual(['owner'])
  })

  it('preserves permissions on membership wire', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-1',
      tenantSlug: 'samoon',
      roles: ['owner'],
      permissions: ['menu.view', 'orders.view'],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.permissions).toEqual(['menu.view', 'orders.view'])
  })

  it('normalizes tenantRoles object array', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-1',
      tenantSlug: 'samoon',
      tenantRoles: [{ role: 'owner' }],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.roles).toEqual(['owner'])
  })

  it('drops branches that belong to another tenant', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-a',
      tenantSlug: 'a',
      roles: ['owner'],
      branchAccess: { scope: 'all' },
      branches: [
        { id: 'b1', name: 'Valid', slug: 'valid', status: 'active', tenant_id: 'tenant-a' },
        { id: 'b2', name: 'Leak', slug: 'leak', status: 'active', tenant_id: 'tenant-b' },
      ],
    })

    expect(membership?.branches).toHaveLength(1)
    expect(membership?.branches?.[0]?.id).toBe('b1')
  })
})

describe('normalizeGetMeResponse', () => {
  it('normalizes nested user + memberships contract', () => {
    const response = normalizeGetMeResponse({
      user: {
        id: 'u1',
        email: 'owner@samoon.com',
        first_name: 'Olivia',
        last_name: 'Owner',
        accountType: 'business',
        is_verified: true,
        created_at: '2024-01-01T00:00:00.000Z',
      },
      memberships: [
        {
          tenantId: 'tenant-samoon-01',
          tenantName: 'Samoon Restaurant',
          tenantSlug: 'samoon',
          tenantLogo: null,
          roles: ['owner'],
          branchAccess: { scope: 'all' },
          branches: [
            { id: 'branch-rest-01', name: 'Main Branch', slug: 'main', status: 'active', isDefault: true },
          ],
        },
      ],
      activeMembership: {
        tenantId: 'tenant-samoon-01',
        tenantName: 'Samoon Restaurant',
        branchId: null,
        branchName: null,
      },
    })

    expect(response.user.id).toBe('u1')
    expect(response.user.is_verified).toBe(true)
    expect(response.user.is_superuser).toBe(false)
    expect(response.memberships).toHaveLength(1)
    expect(response.activeMembership?.tenantId).toBe('tenant-samoon-01')
    expect(response.activeMembership?.tenantName).toBe('Samoon Restaurant')
  })

  it('preserves is_superuser and is_verified from nested /auth/me user', () => {
    const response = normalizeGetMeResponse({
      user: {
        id: 'u1',
        email: 'su@samoon.com',
        first_name: 'Su',
        last_name: 'Per',
        accountType: 'business',
        is_verified: true,
        is_superuser: true,
        is_staff: true,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    })
    expect(response.user.is_superuser).toBe(true)
    expect(response.user.is_verified).toBe(true)
    expect(response.user.is_staff).toBe(true)
  })

  it('treats missing is_superuser as false, not as a grant', () => {
    const response = normalizeGetMeResponse({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        is_verified: false,
        created_at: '',
      },
    })
    expect(response.user.is_superuser).toBe(false)
    expect(response.user.is_verified).toBe(false)
  })

  it('maps camelCase isSuperuser / isVerified on nested user', () => {
    const response = normalizeGetMeResponse({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        isVerified: true,
        isSuperuser: true,
        created_at: '',
      },
    })
    expect(response.user.is_superuser).toBe(true)
    expect(response.user.is_verified).toBe(true)
  })

  it('rejects active branch outside membership branch list', () => {
    const response = normalizeGetMeResponse({
      user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B', accountType: 'business', is_verified: true, created_at: '' },
      memberships: [
        {
          tenantId: 't1',
          tenantSlug: 't1',
          roles: ['owner'],
          branchAccess: { scope: 'all' },
          branches: [{ id: 'branch-a', name: 'A', slug: 'a', status: 'active' }],
        },
      ],
      activeMembership: { tenantId: 't1', branchId: 'branch-b' },
    })

    expect(response.activeMembership?.branchId).toBeUndefined()
  })

  it('supports legacy flat user at root', () => {
    const response = normalizeGetMeResponse({
      id: 'u1',
      email: 'a@b.com',
      first_name: 'A',
      last_name: 'B',
      accountType: 'business',
      is_verified: true,
      created_at: '',
      memberships: [],
    })

    expect(response.user.id).toBe('u1')
    expect(response.memberships).toEqual([])
  })
})

describe('assertMembershipBranchIsolation', () => {
  it('passes for valid memberships', () => {
    expect(() =>
      assertMembershipBranchIsolation([
        {
          tenantId: 't1',
          roles: [],
          branchAccess: { scope: 'all' },
          branches: [{ id: 'b1', name: 'Main', slug: 'main', status: 'active' }],
        },
      ]),
    ).not.toThrow()
  })
})
