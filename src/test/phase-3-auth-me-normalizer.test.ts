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

  it('maps flat camelCase tenantName and tenantSlug', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-1',
      tenantName: 'Samoon',
      tenantSlug: 'samoon',
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.tenantName).toBe('Samoon')
    expect(membership?.tenantSlug).toBe('samoon')
  })

  it('maps nested tenant.name and tenant.slug', () => {
    const membership = normalizeWireMembership({
      tenant: {
        id: 'tenant-1',
        name: 'Samoon',
        slug: 'samoon',
      },
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.tenantId).toBe('tenant-1')
    expect(membership?.tenantName).toBe('Samoon')
    expect(membership?.tenantSlug).toBe('samoon')
  })

  it('maps nested tenant.status INACTIVE onto tenantStatus', () => {
    const membership = normalizeWireMembership({
      tenant: { id: 'tenant-1', name: 'Samoon', slug: 'samoon', status: 'INACTIVE' },
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.tenantStatus).toBe('INACTIVE')
    expect(membership?.status).toBe('active')
  })

  it('prefers flat tenantName/tenantSlug over nested tenant.name/tenant.slug', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-1',
      tenantName: 'Flat Name',
      tenantSlug: 'flat-slug',
      tenant: {
        id: 'nested-id',
        name: 'Nested Name',
        slug: 'nested-slug',
      },
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.tenantId).toBe('tenant-1')
    expect(membership?.tenantName).toBe('Flat Name')
    expect(membership?.tenantSlug).toBe('flat-slug')
  })

  it('uses nested slug when only tenantName is flat', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-1',
      tenantName: 'Flat Name',
      tenant: {
        name: 'Nested Name',
        slug: 'nested-slug',
      },
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.tenantName).toBe('Flat Name')
    expect(membership?.tenantSlug).toBe('nested-slug')
  })

  it('preserves MembershipOutputSerializer camelCase tenantName (not slug)', () => {
    const membership = normalizeWireMembership({
      tenantId: 'tenant-a',
      tenantName: 'Samoon Restaurant',
      tenantSlug: 'samoon-restaurant',
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    })
    expect(membership?.tenantName).toBe('Samoon Restaurant')
    expect(membership?.tenantSlug).toBe('samoon-restaurant')
    expect(membership?.tenantName).not.toBe(membership?.tenantSlug)
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

  it('keeps tenantName on every membership from GET /auth/me', () => {
    const response = normalizeGetMeResponse({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        is_verified: true,
        created_at: '',
      },
      memberships: [
        {
          tenantId: 'tenant-a',
          tenantName: 'Samoon Restaurant',
          tenantSlug: 'samoon-restaurant',
          roles: ['owner'],
          branchAccess: { scope: 'all' },
        },
        {
          tenantId: 'tenant-b',
          tenantName: 'Brew Cafe',
          tenantSlug: 'brew-cafe',
          roles: ['manager'],
          branchAccess: { scope: 'all' },
        },
      ],
    })
    expect(response.memberships?.map((m) => m.tenantName)).toEqual([
      'Samoon Restaurant',
      'Brew Cafe',
    ])
    expect(response.memberships?.map((m) => m.tenantSlug)).toEqual([
      'samoon-restaurant',
      'brew-cafe',
    ])
  })

  it('keeps per-membership nested tenant names (does not copy active tenant onto all)', () => {
    const response = normalizeGetMeResponse({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        is_verified: true,
        created_at: '',
      },
      memberships: [
        {
          tenant: { id: '1', name: 'Samoon', slug: 'samoon' },
          roles: ['owner'],
          branchAccess: { scope: 'all' },
        },
        {
          tenant: { id: '2', name: 'Another Business', slug: 'another-business' },
          roles: ['manager'],
          branchAccess: { scope: 'all' },
        },
      ],
      activeMembership: {
        tenantId: '1',
        tenant: { name: 'Samoon', slug: 'samoon' },
      },
    })
    expect(response.memberships?.map((m) => ({ id: m.tenantId, name: m.tenantName, slug: m.tenantSlug }))).toEqual([
      { id: '1', name: 'Samoon', slug: 'samoon' },
      { id: '2', name: 'Another Business', slug: 'another-business' },
    ])
    expect(response.activeMembership?.tenantName).toBe('Samoon')
    expect(response.activeMembership?.tenantSlug).toBe('samoon')
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
