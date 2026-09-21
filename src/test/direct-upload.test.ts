/**
 * Direct-to-object-storage upload architecture tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uploadService } from '@/services/upload.service'
import { uploadToPresignedStorage } from '@/lib/storage-upload'
import { DirectUploadError } from '@/lib/upload-errors'
import { runWithConcurrency } from '@/lib/upload-concurrency'
import { validateUploadFile } from '@/lib/upload-validation'
import { mapBackendStatus, createLocalUploadSession } from '@/types/upload'
import { persistableMediaUrl } from '@/lib/image-asset-write'
import { toUploadError } from '@/lib/upload-errors'
import * as fs from 'fs'
import * as path from 'path'

process.env.NEXT_PUBLIC_USE_MOCK = 'true'

function makeFile(name: string, type: string, size = 128): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('upload state machine', () => {
  it('starts LOCAL then maps backend statuses', () => {
    const session = createLocalUploadSession(makeFile('a.jpg', 'image/jpeg'), 'menu_item')
    expect(session.status).toBe('LOCAL')
    expect(mapBackendStatus('INITIATED')).toBe('INITIATING')
    expect(mapBackendStatus('UPLOADING')).toBe('UPLOADING')
    expect(mapBackendStatus('UPLOADED')).toBe('UPLOADED')
    expect(mapBackendStatus('PROCESSING')).toBe('PROCESSING')
    expect(mapBackendStatus('READY')).toBe('READY')
    expect(mapBackendStatus('FAILED')).toBe('FAILED')
    expect(mapBackendStatus('CANCELLED')).toBe('CANCELLED')
    expect(mapBackendStatus('EXPIRED')).toBe('EXPIRED')
  })
})

describe('upload service mock pipeline', () => {
  it('initiate → storage → complete → READY', async () => {
    const file = makeFile('logo.jpg', 'image/jpeg')
    const result = await uploadService.uploadFile({ file, purpose: 'tenant_logo' })
    expect(result.assetId).toBeTruthy()
    expect(result.url).toMatch(/^https:\/\/cdn\.mock\.local\/assets\//)
    expect(persistableMediaUrl(result.url)).toBe(result.url)
  })

  it('rejects 413-class oversized files without retry', async () => {
    const file = makeFile('huge.jpg', 'image/jpeg', 6 * 1024 * 1024)
    await expect(uploadService.uploadFile({ file, purpose: 'menu_item' })).rejects.toBeInstanceOf(DirectUploadError)
  })

  it('rejects unsupported types including SVG', async () => {
    await expect(
      uploadService.uploadFile({ file: makeFile('x.svg', 'image/svg+xml'), purpose: 'menu_item' }),
    ).rejects.toBeInstanceOf(DirectUploadError)
    await expect(
      uploadService.uploadFile({ file: makeFile('x.webp', 'image/webp'), purpose: 'menu_item' }),
    ).rejects.toBeInstanceOf(DirectUploadError)
  })

  it('cancels via AbortController', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      uploadService.uploadFile({
        file: makeFile('a.jpg', 'image/jpeg'),
        purpose: 'avatar',
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(DirectUploadError)
  })
})

describe('storage transport', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', class {
      status = 200
      timeout = 0
      withCredentials = false
      upload = { onprogress: null as ((ev: ProgressEvent) => void) | null }
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      ontimeout: (() => void) | null = null
      onabort: (() => void) | null = null
      responseText = ''
      headers: Record<string, string> = {}
      open() {}
      setRequestHeader(k: string, v: string) { this.headers[k] = v }
      abort() { this.onabort?.() }
      send() {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent)
        this.onload?.()
      }
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUTs with required headers and no Authorization', async () => {
    const file = makeFile('a.jpg', 'image/jpeg')
    let captured: { headers: Record<string, string> } | undefined
    vi.stubGlobal('XMLHttpRequest', class {
      status = 204
      timeout = 0
      withCredentials = false
      upload = { onprogress: null as ((ev: ProgressEvent) => void) | null }
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      ontimeout: (() => void) | null = null
      onabort: (() => void) | null = null
      responseText = ''
      headers: Record<string, string> = {}
      open() { captured = this }
      setRequestHeader(k: string, v: string) { this.headers[k] = v }
      abort() {}
      send() { this.onload?.() }
    })
    await uploadToPresignedStorage({
      file,
      upload: { method: 'PUT', url: 'https://storage.example/obj', headers: { 'Content-Type': 'image/jpeg', Authorization: 'Bearer leak' } },
    })
    expect(captured!.headers['Authorization']).toBeUndefined()
    expect(captured!.headers['Content-Type']).toBe('image/jpeg')
  })
})

describe('concurrency', () => {
  it('runs at most 3 tasks at once', async () => {
    let current = 0
    let max = 0
    const tasks = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      run: async () => {
        current += 1
        max = Math.max(max, current)
        await new Promise((r) => setTimeout(r, 20))
        current -= 1
        return i
      },
    }))
    const results = await runWithConcurrency(tasks, { limit: 3 })
    expect(max).toBeLessThanOrEqual(3)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('cancels one file without cancelling others', async () => {
    const controller = new AbortController()
    const results = await runWithConcurrency(
      [
        { id: 'a', run: async () => 'ok-a' },
        {
          id: 'b',
          run: async (signal) => {
            controller.abort()
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
            return 'ok-b'
          },
        },
        { id: 'c', run: async (signal) => {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
          return 'ok-c'
        } },
      ],
      { signal: controller.signal, limit: 1 },
    )
    expect(results[0]?.status).toBe('fulfilled')
  })
})

describe('shared validation policy', () => {
  it('accepts jpeg/png for menu and webp for hero', () => {
    expect(validateUploadFile(makeFile('a.jpg', 'image/jpeg'), 'menu_item').valid).toBe(true)
    expect(validateUploadFile(makeFile('a.webp', 'image/webp'), 'website_hero').valid).toBe(true)
    expect(validateUploadFile(makeFile('a.webp', 'image/webp'), 'menu_item').valid).toBe(false)
  })
})

describe('repository architecture invariants', () => {
  const root = path.resolve(__dirname, '../..')
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')

  it('business services no longer send FormData for images', () => {
    expect(read('src/services/menu.service.ts')).not.toContain('new FormData')
    expect(read('src/services/branch.service.ts')).not.toContain('buildBranchFormData')
    expect(read('src/services/combined.service.ts')).not.toContain("form.append('avatar'")
    expect(read('src/services/website-builder.service.ts')).not.toContain('uploadMedia')
    expect(read('src/services/platform-homepage.service.ts')).not.toContain('FormData')
  })

  it('branch create uploads on Create not on select', () => {
    const src = read('src/app/console/branches/new/page.tsx')
    expect(src).toContain('uploadImageFields')
    expect(src).toContain('submitCreate')
    expect(src).toContain('createInFlightRef')
  })

  it('does not persist blob or data URLs in hero gallery add-from-url', () => {
    const src = read('src/components/admin/HeroBackgroundGallery.tsx')
    expect(src).toContain('isTransientMediaUrl')
    expect(src).not.toContain('startsWith(\'data:\')')
  })

  it('legacy platform media BFF does not emit data URLs', () => {
    expect(read('src/app/api/platform/homepage/hero/media/route.ts')).not.toContain('base64')
    expect(read('src/app/api/platform/homepage/hero/media/route.ts')).toContain('410')
  })
})

describe('transient media and error mapping', () => {
  it('rejects blob and data URLs for persistence', () => {
    expect(persistableMediaUrl('blob:http://localhost/x')).toBeUndefined()
    expect(persistableMediaUrl('data:image/png;base64,abc')).toBeUndefined()
    expect(persistableMediaUrl('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg')
  })

  it('maps 413/415/429 without treating them as unknown', () => {
    expect(toUploadError({ status: 413 }).code).toBe('file_too_large')
    expect(toUploadError({ status: 415 }).code).toBe('unsupported_type')
    expect(toUploadError({ status: 429 }).retryable).toBe(true)
  })
})
