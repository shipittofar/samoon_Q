/**
 * Proves backend lowercase `initiated` continues the upload lifecycle:
 * initiate → PUT → complete → poll → READY
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ENDPOINTS } from '@/services/endpoints'
import { mapBackendStatus } from '@/types/upload'

const ASSET_ID = 'b805a8d6-63ec-4449-b610-be69c53af92f'
const CDN_URL = `https://cdn.test/assets/${ASSET_ID}.jpg`
const PRESIGN_URL = 'https://s3.ir-thr-at1.arvanstorage.ir/bucket/object?X-Amz-Signature=test'

function makeJpeg(size = 256): File {
  return new File([new Uint8Array(size)], 'hero.jpg', { type: 'image/jpeg' })
}

describe('backend initiated status continues upload lifecycle', () => {
  let post: ReturnType<typeof vi.fn>
  let get: ReturnType<typeof vi.fn>
  let putStorage: ReturnType<typeof vi.fn>
  let uploadService: typeof import('@/services/upload.service').uploadService

  beforeEach(async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_USE_MOCK = 'false'

    putStorage = vi.fn().mockResolvedValue(undefined)
    post = vi.fn().mockImplementation((url: string) => {
      const path = String(url)
      if (path === ENDPOINTS.UPLOADS.INITIATE || path.endsWith('/uploads/initiate/')) {
        return Promise.resolve({
          data: {
            asset_id: ASSET_ID,
            purpose: 'website_media',
            status: 'initiated',
            mime_type: 'image/jpeg',
            byte_size: 256,
            entity_type: 'platform',
            entity_id: 'homepage',
            tenant_id: null,
            failure_code: '',
            failure_message: '',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            upload: {
              method: 'PUT',
              url: PRESIGN_URL,
              headers: { 'Content-Type': 'image/jpeg' },
            },
          },
        })
      }
      if (path.includes('/complete')) {
        return Promise.resolve({
          data: {
            asset_id: ASSET_ID,
            status: 'processing',
          },
        })
      }
      return Promise.reject(new Error(`unexpected POST ${path}`))
    })

    get = vi
      .fn()
      .mockResolvedValueOnce({
        data: { asset_id: ASSET_ID, status: 'processing' },
      })
      .mockResolvedValueOnce({
        data: { asset_id: ASSET_ID, status: 'ready', url: CDN_URL },
      })

    vi.doMock('@/services/axios.instance', () => ({
      default: { post, get, patch: vi.fn() },
    }))
    vi.doMock('@/lib/storage-upload', () => ({
      uploadToPresignedStorage: putStorage,
    }))

    ;({ uploadService } = await import('@/services/upload.service'))
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    vi.resetModules()
    vi.doUnmock('@/services/axios.instance')
    vi.doUnmock('@/lib/storage-upload')
  })

  it('maps initiated → INITIATING and does not treat it as FAILED', () => {
    expect(mapBackendStatus('initiated')).toBe('INITIATING')
    expect(mapBackendStatus('initiated')).not.toBe('FAILED')
  })

  it('platform website_media: initiated → PUT → complete → poll → READY', async () => {
    const result = await uploadService.uploadFile({
      file: makeJpeg(),
      purpose: 'website_media',
      entityType: 'platform',
      entityId: 'homepage',
    })

    expect(result.assetId).toBe(ASSET_ID)
    expect(result.url).toBe(CDN_URL)

    // Initiate used lowercase status and still proceeded
    const initiateCall = post.mock.calls.find((c) => c[0] === ENDPOINTS.UPLOADS.INITIATE)
    expect(initiateCall).toBeTruthy()
    expect(initiateCall![1]).toMatchObject({
      purpose: 'website_media',
      entity_type: 'platform',
      entity_id: 'homepage',
    })

    // Presigned PUT was performed
    expect(putStorage).toHaveBeenCalledTimes(1)
    expect(putStorage.mock.calls[0]![0]).toMatchObject({
      upload: {
        method: 'PUT',
        url: PRESIGN_URL,
        headers: { 'Content-Type': 'image/jpeg' },
      },
    })

    // complete followed PUT
    const completeIdx = post.mock.calls.findIndex((c) =>
      String(c[0]).includes(`/uploads/${ASSET_ID}/complete`),
    )
    expect(completeIdx).toBeGreaterThanOrEqual(0)
    expect(putStorage.mock.invocationCallOrder[0]!).toBeLessThan(
      post.mock.invocationCallOrder[completeIdx]!,
    )

    // polling occurred
    expect(get).toHaveBeenCalled()
    expect(String(get.mock.calls[0]![0])).toContain(ASSET_ID)
  })

  it('branch_logo with lowercase initiated still PUTs and completes (behavior unchanged)', async () => {
    const tenantId = '22222222-2222-2222-2222-222222222222'
    await uploadService.uploadFile({
      file: makeJpeg(),
      purpose: 'branch_logo',
      tenantId,
      entityType: 'branch',
    })

    expect(putStorage).toHaveBeenCalledTimes(1)
    const initiateBody = post.mock.calls.find((c) => c[0] === ENDPOINTS.UPLOADS.INITIATE)![1]
    expect(initiateBody).toMatchObject({
      purpose: 'branch_logo',
      tenant_id: tenantId,
      entity_type: 'branch',
    })
    expect(
      post.mock.calls.some((c) => String(c[0]).includes(`/uploads/${ASSET_ID}/complete`)),
    ).toBe(true)
  })

  it('backend failed still surfaces as processing failure after poll', async () => {
    get.mockReset()
    get.mockResolvedValue({
      data: { asset_id: ASSET_ID, status: 'failed', error: 'decode error' },
    })

    await expect(
      uploadService.uploadFile({
        file: makeJpeg(),
        purpose: 'website_media',
        entityType: 'platform',
        entityId: 'homepage',
      }),
    ).rejects.toMatchObject({
      uploadError: {
        code: 'processing_failure',
        messageKey: 'uploadErrorProcessing',
      },
    })
  })

  it('READY without asset_id is still a processing failure', async () => {
    get.mockReset()
    get.mockResolvedValue({
      data: { asset_id: '', status: 'ready', url: CDN_URL },
    })

    await expect(
      uploadService.uploadFile({
        file: makeJpeg(),
        purpose: 'website_media',
        entityType: 'platform',
        entityId: 'homepage',
      }),
    ).rejects.toMatchObject({
      uploadError: { messageKey: 'uploadErrorProcessing' },
    })
  })

  it('expired remains non-processing FAILED mapping', () => {
    expect(mapBackendStatus('expired')).toBe('EXPIRED')
    expect(mapBackendStatus('EXPIRED')).toBe('EXPIRED')
  })
})
