import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test/test-utils'
import { HeroBackgroundGallery } from '@/components/admin/HeroBackgroundGallery'
import { DirectUploadError, uploadError } from '@/lib/upload-errors'

const uploadFile = vi.fn()
const retryUpload = vi.fn()
const cancelUpload = vi.fn()

vi.mock('@/services/upload.service', () => ({
  uploadService: {
    uploadFile: (...args: unknown[]) => uploadFile(...args),
    retryUpload: (...args: unknown[]) => retryUpload(...args),
    cancelUpload: (...args: unknown[]) => cancelUpload(...args),
  },
}))

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}))

beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = () => 'blob:mock-preview'
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = () => {}
  }
})

function setFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
}

function jpeg(): File {
  return new File([new Uint8Array(16)], 'hero.jpg', { type: 'image/jpeg' })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('HeroBackgroundGallery upload lock', () => {
  beforeEach(() => {
    uploadFile.mockReset()
    retryUpload.mockReset()
    cancelUpload.mockReset()
  })

  it('starts one upload queue when the file input fires twice', () => {
    const gate = deferred<{ assetId: string; url: string }>()
    uploadFile.mockImplementation(() => gate.promise)
    const view = renderWithIntl(
      <HeroBackgroundGallery
        images={[]}
        onChange={() => {}}
        purpose="website_media"
        intervalMs={5000}
        transitionMs={400}
        onIntervalChange={() => {}}
        onTransitionChange={() => {}}
      />,
    )
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    const file = jpeg()
    setFiles(input, [file])
    fireEvent.change(input)
    setFiles(input, [file])
    fireEvent.change(input)
    expect(uploadFile).toHaveBeenCalledTimes(1)
    expect(view.getByRole('button', { name: 'Upload images' })).toBeDisabled()
  })

  it('starts one retry when Retry is activated twice', () => {
    const gate = deferred<{ assetId: string; url: string }>()
    let fail = true
    uploadFile.mockImplementation(() => {
      if (fail) {
        return Promise.reject(new DirectUploadError(uploadError('network_failure', 'uploadErrorNetwork', { retryable: true })))
      }
      return gate.promise
    })
    retryUpload.mockImplementation(() => gate.promise)
    const view = renderWithIntl(
      <HeroBackgroundGallery
        images={[]}
        onChange={() => {}}
        purpose="website_media"
        intervalMs={5000}
        transitionMs={400}
        onIntervalChange={() => {}}
        onTransitionChange={() => {}}
      />,
    )
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    setFiles(input, [jpeg()])
    fireEvent.change(input)
    return Promise.resolve().then(async () => {
      fail = false
      const retry = await view.findByRole('button', { name: /retry/i })
      const firstKey = uploadFile.mock.calls[0]?.[0]?.idempotencyKey
      fireEvent.click(retry)
      fireEvent.click(retry)
      expect(retryUpload).toHaveBeenCalledTimes(1)
      expect(retryUpload.mock.calls[0]?.[0]?.idempotencyKey).toBe(firstKey)
    })
  })
})
