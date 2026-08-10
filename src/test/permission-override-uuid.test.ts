import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizePermissionEntry } from '@/api/normalizers'
import { resolvePermissionIdForKey } from '@/lib/permission-catalog'
import { createPermissionOverride } from '@/api/authorization'
import api from '@/api/client'

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('permission override UUID contract', () => {
  const uuid = '11111111-1111-1111-1111-111111111111'

  beforeEach(() => {
    vi.mocked(api.post).mockReset()
  })

  it('resolvePermissionIdForKey returns UUID for settings.manage', () => {
    const id = resolvePermissionIdForKey(
      [{ id: uuid, key: 'settings.manage', resource: 'settings', action: 'manage', description: '' }],
      'settings.manage',
    )
    expect(id).toBe(uuid)
  })

  it('resolvePermissionIdForKey never falls back to the slug', () => {
    const id = resolvePermissionIdForKey(
      [{ key: 'settings.manage', resource: 'settings', action: 'manage', description: '' }],
      'settings.manage',
    )
    expect(id).toBeUndefined()
  })

  it('createPermissionOverride posts UUID for deny', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'ov-1',
        tenant_id: 't-1',
        permission: 'settings.manage',
        permission_id: uuid,
        effect: 'deny',
        created_at: '2026-01-01T00:00:00Z',
        created_by: 'u-1',
      },
    })

    await createPermissionOverride('t-1', {
      membership_id: 'm-1',
      permission_id: uuid,
      effect: 'deny',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/authorization/tenants/t-1/memberships/m-1/permission-overrides/',
      { permission_id: uuid, effect: 'deny' },
    )
    const body = vi.mocked(api.post).mock.calls[0]![1] as { permission_id: string }
    expect(body.permission_id).not.toBe('settings.manage')
  })

  it('createPermissionOverride posts UUID for allow', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'ov-2',
        tenant_id: 't-1',
        permission: 'settings.manage',
        permission_id: uuid,
        effect: 'allow',
        created_at: '2026-01-01T00:00:00Z',
        created_by: 'u-1',
      },
    })

    await createPermissionOverride('t-1', {
      membership_id: 'm-1',
      permission_id: uuid,
      effect: 'allow',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/authorization/tenants/t-1/memberships/m-1/permission-overrides/',
      { permission_id: uuid, effect: 'allow' },
    )
  })

  it('normalizePermissionEntry preserves catalog UUID', () => {
    const entry = normalizePermissionEntry({
      id: uuid,
      key: 'settings.manage',
      resource: 'settings',
      action: 'manage',
      description: 'Manage settings',
    })
    expect(entry).toMatchObject({
      id: uuid,
      key: 'settings.manage',
    })
  })
})
