import { describe, it, expect, vi, beforeAll } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test/test-utils'
import { ImageUploader, EMPTY_IMAGE_FIELD } from '@/components/ImageUploader'
import { createLocalUploadSession } from '@/types/upload'

beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = () => 'blob:mock-preview'
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = () => {}
  }
})

vi.mock('next/image', () => ({
  default: (props: { alt?: string; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ''} src={typeof props.src === 'string' ? props.src : ''} />
  ),
}))

describe('ImageUploader direct-upload UI', () => {
  it('shows uploading percent from session progress', () => {
    const file = new File([new Uint8Array(32)], 'a.jpg', { type: 'image/jpeg' })
    const session = {
      ...createLocalUploadSession(file, 'menu_item'),
      status: 'UPLOADING' as const,
      progress: { bytesSent: 40, bytesTotal: 100, percent: 40, phase: 'uploading' as const },
    }
    const view = renderWithIntl(
      <ImageUploader
        value={{ file, existingUrl: '', cleared: false }}
        session={session}
        onChange={() => {}}
      />,
    )
    expect(view.getByText(/Uploading 40%/)).toBeTruthy()
  })

  it('shows processing separately from upload percent', () => {
    const file = new File([new Uint8Array(32)], 'a.jpg', { type: 'image/jpeg' })
    const session = {
      ...createLocalUploadSession(file, 'menu_item'),
      status: 'PROCESSING' as const,
      progress: { bytesSent: 100, bytesTotal: 100, percent: 100, phase: 'processing' as const },
    }
    const view = renderWithIntl(
      <ImageUploader
        value={{ file, existingUrl: '', cleared: false }}
        session={session}
        onChange={() => {}}
      />,
    )
    expect(view.getByText(/Processing image/)).toBeTruthy()
  })

  it('retry and cancel callbacks fire', () => {
    const onRetry = vi.fn()
    const onCancelUpload = vi.fn()
    const file = new File([new Uint8Array(32)], 'a.jpg', { type: 'image/jpeg' })
    const failed = {
      ...createLocalUploadSession(file, 'user_avatar'),
      status: 'FAILED' as const,
      error: {
        code: 'network_failure' as const,
        messageKey: 'uploadErrorNetwork',
        retryable: true,
      },
    }
    const view = renderWithIntl(
      <ImageUploader
        value={{ file, existingUrl: '', cleared: false }}
        session={failed}
        onChange={() => {}}
        onRetry={onRetry}
      />,
    )
    fireEvent.click(view.getByRole('button', { name: /Retry upload/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    const uploading = {
      ...createLocalUploadSession(file, 'user_avatar'),
      status: 'UPLOADING' as const,
      progress: { bytesSent: 10, bytesTotal: 100, percent: 10, phase: 'uploading' as const },
    }
    const uploadingView = renderWithIntl(
      <ImageUploader
        value={{ file, existingUrl: '', cleared: false }}
        session={uploading}
        onChange={() => {}}
        onCancelUpload={onCancelUpload}
      />,
    )
    fireEvent.click(uploadingView.getByRole('button', { name: /Cancel upload/i }))
    expect(onCancelUpload).toHaveBeenCalledTimes(1)
  })

  it('keeps existing remote URLs without converting them to blob URLs', () => {
    const view = renderWithIntl(
      <ImageUploader
        value={{ ...EMPTY_IMAGE_FIELD, existingUrl: 'https://cdn.example/hero.jpg' }}
        onChange={() => {}}
      />,
    )
    expect(view.getByAltText(/hero.jpg/)).toHaveAttribute('src', 'https://cdn.example/hero.jpg')
  })
})
