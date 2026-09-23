/**
 * Runtime initiate payload proof for previously failing flows:
 * - platform homepage hero (stale purpose was platform_hero)
 * - branch branding image (stale purpose was branch_image)
 *
 * Asserts the exact POST /api/uploads/initiate/ JSON body shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { ENDPOINTS } from '@/services/endpoints'
import type { ImageFieldValue } from '@/components/ImageUploader'

const TENANT_ID = '22222222-2222-2222-2222-222222222222'
const BRANCH_ID = '33333333-3333-3333-3333-333333333333'
const ASSET_ID = '11111111-1111-1111-1111-111111111111'

function makeJpeg(name = 'photo.jpg', size = 256): File {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
}

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'test') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) collectTsFiles(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

describe('stale purpose strings are absent from runtime source', () => {
  it('does not contain platform_hero or branch_image outside test assertions', () => {
    const srcRoot = join(__dirname, '..')
    const files = collectTsFiles(srcRoot)
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      if (text.includes("'platform_hero'") || text.includes('"platform_hero"')) {
        offenders.push(`${file}: platform_hero`)
      }
      if (text.includes("'branch_image'") || text.includes('"branch_image"')) {
        offenders.push(`${file}: branch_image`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('runtime initiate payloads for fixed flows', () => {
  let post: ReturnType<typeof vi.fn>
  let uploadService: typeof import('@/services/upload.service').uploadService

  beforeEach(async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_USE_MOCK = 'false'
    post = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/complete')) {
        return Promise.resolve({
          data: { asset_id: ASSET_ID, status: 'PROCESSING' },
        })
      }
      return Promise.resolve({
        data: {
          asset_id: ASSET_ID,
          status: 'INITIATED',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          upload: {
            method: 'PUT',
            url: 'https://storage.test/put',
            headers: { 'Content-Type': 'image/jpeg' },
          },
        },
      })
    })
    vi.doMock('@/services/axios.instance', () => ({
      default: {
        post,
        get: vi.fn().mockResolvedValue({
          data: { asset_id: ASSET_ID, status: 'READY', url: 'https://cdn.test/a.jpg' },
        }),
        patch: vi.fn(),
      },
    }))
    vi.doMock('@/lib/storage-upload', () => ({
      uploadToPresignedStorage: vi.fn().mockResolvedValue(undefined),
    }))
    ;({ uploadService } = await import('@/services/upload.service'))
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    vi.resetModules()
    vi.doUnmock('@/services/axios.instance')
    vi.doUnmock('@/lib/storage-upload')
  })

  it('platform homepage hero initiates with website_media (not platform_hero)', async () => {
    // Mirrors PlatformHomepageHeroEditor → HeroBackgroundGallery props
    await uploadService.uploadFile({
      file: makeJpeg('hero.jpg'),
      purpose: 'website_media',
      entityType: 'platform',
      entityId: 'homepage',
    })

    expect(post).toHaveBeenCalled()
    const [url, body] = post.mock.calls.find(
      (c) => c[0] === ENDPOINTS.UPLOADS.INITIATE,
    ) as [string, Record<string, unknown>]

    expect(url).toBe(ENDPOINTS.UPLOADS.INITIATE)
    expect(body.purpose).toBe('website_media')
    expect(body.purpose).not.toBe('platform_hero')
    expect(body.filename).toBe('hero.jpg')
    expect(body.mime_type).toBe('image/jpeg')
    expect(body.byte_size).toBe(256)
    expect(body.entity_type).toBe('platform')
    expect(body.entity_id).toBe('homepage')
    expect(body).not.toHaveProperty('tenant_id')
    expect(body).not.toHaveProperty('branch_id')
  })

  it('branch create image initiates with branch_logo + tenant_id (not branch_image)', async () => {
    // Mirrors branches/new/page.tsx uploadImageFields call
    const imageField: ImageFieldValue = {
      file: makeJpeg('branch.jpg'),
      existingUrl: null,
      cleared: false,
    }

    // Re-import after mock so image-asset-write uses mocked upload service
    const { uploadImageFields: uploadFields } = await import('@/lib/image-asset-write')
    await uploadFields(
      [{ key: 'image_asset_id', field: imageField, purpose: 'branch_logo' }],
      { tenantId: TENANT_ID },
    )

    const initiateCall = post.mock.calls.find((c) => c[0] === ENDPOINTS.UPLOADS.INITIATE)
    expect(initiateCall).toBeTruthy()
    const body = initiateCall![1] as Record<string, unknown>

    expect(body.purpose).toBe('branch_logo')
    expect(body.purpose).not.toBe('branch_image')
    expect(body.tenant_id).toBe(TENANT_ID)
    expect(body).not.toHaveProperty('entity_type')
    expect(body).not.toHaveProperty('entity_id')
    expect(body).not.toHaveProperty('branch_id')
    expect(body.filename).toBe('branch.jpg')
    expect(body.mime_type).toBe('image/jpeg')
  })

  it('branch edit image initiates with branch_logo + tenant_id + branch_id', async () => {
    const imageField: ImageFieldValue = {
      file: makeJpeg('branch-edit.jpg'),
      existingUrl: null,
      cleared: false,
    }

    const { uploadImageFields: uploadFields } = await import('@/lib/image-asset-write')
    await uploadFields(
      [{ key: 'image_asset_id', field: imageField, purpose: 'branch_logo' }],
      {
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        entityType: 'branch',
        entityId: BRANCH_ID,
      },
    )

    const body = post.mock.calls.find((c) => c[0] === ENDPOINTS.UPLOADS.INITIATE)![1] as Record<
      string,
      unknown
    >

    expect(body.purpose).toBe('branch_logo')
    expect(body.tenant_id).toBe(TENANT_ID)
    expect(body.branch_id).toBe(BRANCH_ID)
    expect(body.entity_type).toBe('branch')
    expect(body.entity_id).toBe(BRANCH_ID)
  })
})

describe('component wiring still uses canonical purposes', () => {
  const ROOT = join(__dirname, '..')

  it('PlatformHomepageHeroEditor wires website_media', () => {
    const src = readFileSync(
      join(ROOT, 'components/admin/platform-admin/PlatformHomepageHeroEditor.tsx'),
      'utf8',
    )
    expect(src).toContain('purpose="website_media"')
    expect(src).toContain('entityType="platform"')
    expect(src).toContain('entityId="homepage"')
    expect(src).not.toContain('platform_hero')
  })

  it('BranchFormFields + create/edit pages wire branch_logo with tenant context', () => {
    const fields = readFileSync(join(ROOT, 'app/console/branches/BranchFormFields.tsx'), 'utf8')
    const createPage = readFileSync(join(ROOT, 'app/console/branches/new/page.tsx'), 'utf8')
    const editPage = readFileSync(join(ROOT, 'app/console/branches/[id]/edit/page.tsx'), 'utf8')

    expect(fields).toContain('purpose="branch_logo"')
    expect(fields).not.toContain('branch_image')
    expect(createPage).toContain("purpose: 'branch_logo'")
    expect(createPage).toContain('{ tenantId }')
    expect(createPage).not.toContain("entityType: 'branch'")
    expect(editPage).toContain("purpose: 'branch_logo'")
    expect(editPage).toContain('tenantId, branchId: id')
    expect(editPage).toContain("entityType: 'branch'")
  })
})
