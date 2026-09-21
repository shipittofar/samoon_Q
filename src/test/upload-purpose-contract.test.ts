/**
 * Upload purpose contract — frontend must match live Django PurposeEnum.
 *
 * Canonical enum (OpenAPI components.schemas.PurposeEnum):
 * branch_cover, branch_hero, branch_logo, menu_category, menu_item, menu_tag,
 * tenant_discover_avatar, tenant_discover_cover, tenant_hero, tenant_logo,
 * user_avatar, website_media
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  UPLOAD_PURPOSES,
  UPLOAD_PURPOSE_CONTEXT,
} from '@/types/upload'
import { UPLOAD_POLICIES } from '@/lib/upload-validation'
import { ENDPOINTS } from '@/services/endpoints'

const ROOT = join(__dirname, '..')

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

const BACKEND_PURPOSE_ENUM = [
  'branch_cover',
  'branch_hero',
  'branch_logo',
  'menu_category',
  'menu_item',
  'menu_tag',
  'tenant_discover_avatar',
  'tenant_discover_cover',
  'tenant_hero',
  'tenant_logo',
  'user_avatar',
  'website_media',
] as const

describe('upload purpose contract vs Django PurposeEnum', () => {
  it('frontend UploadPurpose set equals backend PurposeEnum', () => {
    expect([...UPLOAD_PURPOSES].sort()).toEqual([...BACKEND_PURPOSE_ENUM].sort())
  })

  it('every purpose has a client validation policy', () => {
    for (const purpose of UPLOAD_PURPOSES) {
      expect(UPLOAD_POLICIES[purpose]).toBeTruthy()
      expect(UPLOAD_PURPOSE_CONTEXT[purpose]).toBeTruthy()
    }
  })

  it('rejects stale frontend purpose names', () => {
    const stale = [
      'platform_hero',
      'branch_image',
      'avatar',
      'website_hero',
      'menu_extra',
      'tenant_gallery',
    ]
    const src = [
      read('types/upload.ts'),
      read('lib/upload-validation.ts'),
      read('app/console/branches/new/page.tsx'),
      read('app/console/branches/[id]/edit/page.tsx'),
      read('components/admin/platform-admin/PlatformHomepageHeroEditor.tsx'),
      read('app/console/website/page.tsx'),
      read('services/combined.service.ts'),
      read('components/admin/TenantCanonicalSettingsForm.tsx'),
      read('app/console/extras/page.tsx'),
      read('hooks/index.ts'),
    ].join('\n')
    for (const name of stale) {
      expect(src).not.toMatch(new RegExp(`['"]${name}['"]`))
    }
  })

  it('branch create/edit use branch_logo for image_asset_id', () => {
    expect(read('app/console/branches/new/page.tsx')).toContain("purpose: 'branch_logo'")
    expect(read('app/console/branches/[id]/edit/page.tsx')).toContain("purpose: 'branch_logo'")
    expect(read('app/console/branches/new/page.tsx')).toContain('tenantId')
    expect(read('app/console/branches/[id]/edit/page.tsx')).toContain('tenantId')
  })

  it('platform homepage and tenant website heroes use website_media', () => {
    expect(read('components/admin/platform-admin/PlatformHomepageHeroEditor.tsx')).toContain(
      'purpose="website_media"',
    )
    expect(read('app/console/website/page.tsx')).toContain('purpose="website_media"')
  })

  it('avatar upload uses user_avatar', () => {
    expect(read('services/combined.service.ts')).toContain("purpose: 'user_avatar'")
    expect(read('app/dashboard/settings/page.tsx')).toContain('purpose="user_avatar"')
  })
})

describe('initiate payload includes tenant_id / branch_id when provided', () => {
  it('posts tenant_id for branch_logo and branch_id for menu_item', async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_USE_MOCK = 'false'
    vi.doMock('@/services/axios.instance', () => ({
      default: {
        post: vi.fn().mockResolvedValue({
          data: {
            asset_id: '11111111-1111-1111-1111-111111111111',
            status: 'INITIATED',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            upload: {
              method: 'PUT',
              url: 'https://storage.test/put',
              headers: { 'Content-Type': 'image/jpeg' },
            },
          },
        }),
        get: vi.fn(),
        patch: vi.fn(),
      },
    }))

    const { uploadService: svc } = await import('@/services/upload.service')
    const apiMod = await import('@/services/axios.instance')
    const post = apiMod.default.post as ReturnType<typeof vi.fn>

    await svc.initiateUpload({
      purpose: 'branch_logo',
      filename: 'logo.jpg',
      mimeType: 'image/jpeg',
      byteSize: 12,
      tenantId: '22222222-2222-2222-2222-222222222222',
      idempotencyKey: 'idem-branch',
    })

    expect(post).toHaveBeenCalledWith(
      ENDPOINTS.UPLOADS.INITIATE,
      expect.objectContaining({
        purpose: 'branch_logo',
        tenant_id: '22222222-2222-2222-2222-222222222222',
      }),
      expect.anything(),
    )

    post.mockClear()
    await svc.initiateUpload({
      purpose: 'menu_item',
      filename: 'item.jpg',
      mimeType: 'image/jpeg',
      byteSize: 12,
      tenantId: '22222222-2222-2222-2222-222222222222',
      branchId: '33333333-3333-3333-3333-333333333333',
      idempotencyKey: 'idem-menu',
    })

    expect(post).toHaveBeenCalledWith(
      ENDPOINTS.UPLOADS.INITIATE,
      expect.objectContaining({
        purpose: 'menu_item',
        tenant_id: '22222222-2222-2222-2222-222222222222',
        branch_id: '33333333-3333-3333-3333-333333333333',
      }),
      expect.anything(),
    )

    const avatarBodyCall = post.mock.calls.length
    await svc.initiateUpload({
      purpose: 'user_avatar',
      filename: 'me.jpg',
      mimeType: 'image/jpeg',
      byteSize: 12,
      idempotencyKey: 'idem-avatar',
    })
    const body = post.mock.calls[avatarBodyCall]?.[1] as Record<string, unknown>
    expect(body.purpose).toBe('user_avatar')
    expect(body).not.toHaveProperty('tenant_id')
    expect(body).not.toHaveProperty('branch_id')

    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    vi.resetModules()
  })
})
