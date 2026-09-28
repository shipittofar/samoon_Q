import { describe, it, expect, vi, afterEach } from 'vitest'
import { uploadService } from '@/services/upload.service'

function jpeg(name = 'a.jpg'): File {
  return new File([new Uint8Array(32)], name, { type: 'image/jpeg' })
}

describe('uploadFile idempotency single-flight', () => {
  afterEach(() => {
    uploadService.releaseIdempotency('same-action')
    uploadService.releaseIdempotency('other-action')
    uploadService.releaseIdempotency('fail-key')
    vi.restoreAllMocks()
  })

  it('runs one upload for concurrent calls that share a key', async () => {
    const spy = vi.spyOn(uploadService, 'performUpload')
    const first = uploadService.uploadFile({
      file: jpeg(),
      purpose: 'tenant_logo',
      idempotencyKey: 'same-action',
    })
    const second = uploadService.uploadFile({
      file: jpeg(),
      purpose: 'tenant_logo',
      idempotencyKey: 'same-action',
    })
    const [a, b] = await Promise.all([first, second])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  it('allows different keys to upload in parallel', async () => {
    const spy = vi.spyOn(uploadService, 'performUpload')
    await Promise.all([
      uploadService.uploadFile({ file: jpeg('a.jpg'), purpose: 'branch_logo', idempotencyKey: 'same-action' }),
      uploadService.uploadFile({ file: jpeg('b.jpg'), purpose: 'branch_cover', idempotencyKey: 'other-action' }),
    ])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('reuses a successful result for a later retry of the same key', async () => {
    const spy = vi.spyOn(uploadService, 'performUpload')
    const first = await uploadService.uploadFile({
      file: jpeg(),
      purpose: 'tenant_logo',
      idempotencyKey: 'same-action',
    })
    const retry = await uploadService.retryUpload({
      file: jpeg(),
      purpose: 'tenant_logo',
      idempotencyKey: 'same-action',
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(retry).toEqual(first)
  })

  it('does not cache a failed upload, so a retry can run again', async () => {
    const spy = vi.spyOn(uploadService, 'performUpload')
    await expect(uploadService.uploadFile({
      file: new File([new Uint8Array(8)], 'x.svg', { type: 'image/svg+xml' }),
      purpose: 'menu_item',
      idempotencyKey: 'fail-key',
    })).rejects.toBeTruthy()
    await expect(uploadService.uploadFile({
      file: new File([new Uint8Array(8)], 'x.svg', { type: 'image/svg+xml' }),
      purpose: 'menu_item',
      idempotencyKey: 'fail-key',
    })).rejects.toBeTruthy()
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
