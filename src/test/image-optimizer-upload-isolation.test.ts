/**
 * Next.js image-optimizer failures must stay out of the upload error map.
 * The optimizer message is produced only by next/dist/server/image-optimizer.js.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { toUploadError } from '@/lib/upload-errors'

const OPTIMIZER_MESSAGE = 'url parameter is valid but upstream response is invalid'

const UPLOAD_SOURCES = [
  'lib/upload-errors.ts',
  'services/upload.service.ts',
  'types/upload.ts',
  'components/ImageUploader/ImageUploader.tsx',
]

describe('upload errors are isolated from the Next image optimizer', () => {
  it('does not map the optimizer message in upload sources', () => {
    const root = join(__dirname, '..')
    for (const rel of UPLOAD_SOURCES) {
      const source = readFileSync(join(root, rel), 'utf8')
      expect(source).not.toContain(OPTIMIZER_MESSAGE)
    }
  })

  it('classifies an optimizer Error as unknown, not processing_failure', () => {
    const mapped = toUploadError(new Error(`"url" parameter is valid but upstream response is invalid`))
    expect(mapped.code).not.toBe('processing_failure')
    expect(mapped.messageKey).not.toContain(OPTIMIZER_MESSAGE)
    expect(mapped.messageKey).toBe('uploadErrorUnknown')
  })

  it('allows the production storage and CDN hosts in remotePatterns', () => {
    const config = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8')
    expect(config).toContain("hostname: 'samoon.s3.ir-thr-at1.arvanstorage.ir'")
    expect(config).toContain("hostname: 'cdn.samoon.app'")
    expect(config).not.toMatch(/images:\s*\{[^}]*unoptimized:\s*true/)
    expect(config).not.toContain('loader:')
  })
})
