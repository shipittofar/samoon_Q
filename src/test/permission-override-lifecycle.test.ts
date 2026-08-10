import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizePermissionOverride,
  unwrapPermissionOverrideList,
} from '@/api/normalizers'
import {
  createPermissionOverride,
  updatePermissionOverride,
  listPermissionOverrides,
} from '@/api/authorization'
import {
  findOverrideForPermission,
  planPermissionOverrideMutation,
  upsertOverrideInList,
} from '@/lib/permission-override-lifecycle'
import type { PermissionOverride } from '@/types/rbac-api'
import api from '@/api/client'

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const PERMISSION_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OVERRIDE_ID = 'override-123'
const TENANT_ID = 't-1'
const MEMBERSHIP_ID = 'm-1'

function override(partial: Partial<PermissionOverride> & Pick<PermissionOverride, 'id' | 'effect'>): PermissionOverride {
  return {
    tenantId: TENANT_ID,
    membershipId: MEMBERSHIP_ID,
    permission: 'settings.manage',
    permissionId: PERMISSION_UUID,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'u-1',
    ...partial,
  }
}

describe('permission override lifecycle', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.patch).mockReset()
  })

  it('normalizes nested permission.slug + membership UUID from list items', () => {
    const normalized = normalizePermissionOverride({
      id: OVERRIDE_ID,
      membership: MEMBERSHIP_ID,
      permission: {
        id: PERMISSION_UUID,
        slug: 'settings.manage',
        resource: 'settings',
        action: 'manage',
        description: 'Manage settings',
      },
      effect: 'deny',
      created_by: 'u-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    })

    expect(normalized).toMatchObject({
      id: OVERRIDE_ID,
      membershipId: MEMBERSHIP_ID,
      permission: 'settings.manage',
      permissionId: PERMISSION_UUID,
      effect: 'deny',
    })
  })

  it('unwraps paginated override list envelope', () => {
    const list = unwrapPermissionOverrideList({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: OVERRIDE_ID,
          membership: MEMBERSHIP_ID,
          permission: {
            id: PERMISSION_UUID,
            slug: 'settings.manage',
            resource: 'settings',
            action: 'manage',
          },
          effect: 'deny',
          created_at: '2026-01-01T00:00:00Z',
          created_by: 'u-1',
        },
      ],
    })
    expect(list).toHaveLength(1)
    expect(list[0]?.permissionId).toBe(PERMISSION_UUID)
    expect(list[0]?.permission).toBe('settings.manage')
  })

  it('listPermissionOverrides uses membership-scoped GET', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { count: 0, next: null, previous: null, results: [] },
    })
    await listPermissionOverrides(TENANT_ID, { membership_id: MEMBERSHIP_ID })
    expect(api.get).toHaveBeenCalledWith(
      `/authorization/tenants/${TENANT_ID}/memberships/${MEMBERSHIP_ID}/permission-overrides/`,
      { params: { user_id: undefined, page: undefined, page_size: undefined } },
    )
  })

  it('Test 1 — no existing override → POST create with UUID deny', async () => {
    const plan = planPermissionOverrideMutation([], {
      permissionId: PERMISSION_UUID,
      permissionKey: 'settings.manage',
      effect: 'deny',
    })
    expect(plan).toEqual({
      action: 'create',
      permissionId: PERMISSION_UUID,
      effect: 'deny',
    })

    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: OVERRIDE_ID,
        membership: MEMBERSHIP_ID,
        permission: {
          id: PERMISSION_UUID,
          slug: 'settings.manage',
          resource: 'settings',
          action: 'manage',
        },
        effect: 'deny',
        created_at: '2026-01-01T00:00:00Z',
        created_by: 'u-1',
      },
    })

    await createPermissionOverride(TENANT_ID, {
      membership_id: MEMBERSHIP_ID,
      permission_id: PERMISSION_UUID,
      effect: 'deny',
    })

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith(
      `/authorization/tenants/${TENANT_ID}/memberships/${MEMBERSHIP_ID}/permission-overrides/`,
      { permission_id: PERMISSION_UUID, effect: 'deny' },
    )
    expect(api.patch).not.toHaveBeenCalled()
    const body = vi.mocked(api.post).mock.calls[0]![1] as { permission_id: string }
    expect(body.permission_id).not.toBe('settings.manage')
  })

  it('Test 2 — deny → allow uses PATCH, not POST', async () => {
    const existing = override({ id: OVERRIDE_ID, effect: 'deny' })
    const plan = planPermissionOverrideMutation([existing], {
      permissionId: PERMISSION_UUID,
      permissionKey: 'settings.manage',
      effect: 'allow',
    })
    expect(plan).toEqual({
      action: 'update',
      overrideId: OVERRIDE_ID,
      effect: 'allow',
    })

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        id: OVERRIDE_ID,
        membership: MEMBERSHIP_ID,
        permission: {
          id: PERMISSION_UUID,
          slug: 'settings.manage',
        },
        effect: 'allow',
        created_at: '2026-01-01T00:00:00Z',
        created_by: 'u-1',
      },
    })

    await updatePermissionOverride(TENANT_ID, MEMBERSHIP_ID, OVERRIDE_ID, {
      effect: 'allow',
    })

    expect(api.patch).toHaveBeenCalledWith(
      `/authorization/tenants/${TENANT_ID}/memberships/${MEMBERSHIP_ID}/permission-overrides/${OVERRIDE_ID}/`,
      { effect: 'allow' },
    )
    expect(api.post).not.toHaveBeenCalled()
  })

  it('Test 3 — allow → deny uses PATCH, not POST', async () => {
    const existing = override({ id: OVERRIDE_ID, effect: 'allow' })
    const plan = planPermissionOverrideMutation([existing], {
      permissionId: PERMISSION_UUID,
      effect: 'deny',
    })
    expect(plan).toEqual({
      action: 'update',
      overrideId: OVERRIDE_ID,
      effect: 'deny',
    })

    vi.mocked(api.patch).mockResolvedValue({
      data: {
        id: OVERRIDE_ID,
        membership: MEMBERSHIP_ID,
        permission: { id: PERMISSION_UUID, slug: 'settings.manage' },
        effect: 'deny',
        created_at: '2026-01-01T00:00:00Z',
        created_by: 'u-1',
      },
    })

    await updatePermissionOverride(TENANT_ID, MEMBERSHIP_ID, OVERRIDE_ID, {
      effect: 'deny',
    })

    expect(api.patch).toHaveBeenCalledWith(
      `/authorization/tenants/${TENANT_ID}/memberships/${MEMBERSHIP_ID}/permission-overrides/${OVERRIDE_ID}/`,
      { effect: 'deny' },
    )
    expect(api.post).not.toHaveBeenCalled()
  })

  it('Test 4 — same effect is a noop (no POST/PATCH)', () => {
    const existing = override({ id: OVERRIDE_ID, effect: 'deny' })
    expect(
      planPermissionOverrideMutation([existing], {
        permissionId: PERMISSION_UUID,
        effect: 'deny',
      }),
    ).toEqual({ action: 'noop' })
  })

  it('Test 5+6 — PATCH response replaces override in local list', () => {
    const existing = override({ id: OVERRIDE_ID, effect: 'deny' })
    const patched = override({ id: OVERRIDE_ID, effect: 'allow' })
    const next = upsertOverrideInList([existing], patched)
    expect(next).toHaveLength(1)
    expect(next[0]?.effect).toBe('allow')
    expect(next[0]?.id).toBe(OVERRIDE_ID)
  })

  it('Test 7 — deny → allow → deny never POSTs after create', () => {
    let list: PermissionOverride[] = []
    const network: string[] = []

    const apply = (effect: 'allow' | 'deny') => {
      const plan = planPermissionOverrideMutation(list, {
        permissionId: PERMISSION_UUID,
        permissionKey: 'settings.manage',
        effect,
      })
      if (plan.action === 'noop') return
      if (plan.action === 'create') {
        network.push('POST')
        list = upsertOverrideInList(list, override({ id: OVERRIDE_ID, effect: plan.effect }))
        return
      }
      network.push('PATCH')
      list = upsertOverrideInList(
        list,
        override({ id: plan.overrideId, effect: plan.effect }),
      )
    }

    apply('deny')
    apply('allow')
    apply('deny')

    expect(network).toEqual(['POST', 'PATCH', 'PATCH'])
    expect(list[0]?.effect).toBe('deny')
  })

  it('indexes existing override by permission UUID', () => {
    const existing = override({ id: OVERRIDE_ID, effect: 'deny' })
    expect(
      findOverrideForPermission([existing], { permissionId: PERMISSION_UUID })?.id,
    ).toBe(OVERRIDE_ID)
  })
})
