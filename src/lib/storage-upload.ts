import { DirectUploadError, toUploadError, uploadError } from '@/lib/upload-errors'
import type { PresignedUpload, UploadProgress } from '@/types/upload'

const STORAGE_TIMEOUT_MS = 180_000
const MAX_SAFE_PUT_RETRIES = 2

export interface StorageUploadOptions {
  file: File
  upload: PresignedUpload
  signal?: AbortSignal
  onProgress?: (progress: UploadProgress) => void
  timeoutMs?: number
}

/**
 * Dedicated object-storage transport.
 * Never uses the business Axios instance (no JWT, CSRF, tenant slug, JSON Content-Type).
 */
export async function uploadToPresignedStorage(options: StorageUploadOptions): Promise<void> {
  const timeoutMs = options.timeoutMs ?? STORAGE_TIMEOUT_MS
  let attempt = 0
  let lastError: unknown

  while (attempt <= MAX_SAFE_PUT_RETRIES) {
    if (options.signal?.aborted) {
      throw new DirectUploadError(uploadError('cancelled', 'uploadErrorCancelled'))
    }
    try {
      await putOnce(options, timeoutMs)
      return
    } catch (err) {
      lastError = err
      const mapped = err instanceof DirectUploadError ? err.uploadError : toUploadError(err)
      if (!mapped.retryable || attempt === MAX_SAFE_PUT_RETRIES) {
        throw err instanceof DirectUploadError ? err : new DirectUploadError(mapped, err)
      }
      await backoff(attempt)
      attempt += 1
    }
  }

  throw lastError instanceof DirectUploadError
    ? lastError
    : new DirectUploadError(toUploadError(lastError), lastError)
}

function putOnce(options: StorageUploadOptions, timeoutMs: number): Promise<void> {
  const { file, upload, signal, onProgress } = options
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(upload.method || 'PUT', upload.url)
    xhr.timeout = timeoutMs
    xhr.withCredentials = false

    const headers = upload.headers ?? {}
    for (const [key, value] of Object.entries(headers)) {
      if (!value) continue
      const lower = key.toLowerCase()
      if (lower === 'authorization' || lower === 'x-tenant-slug' || lower === 'x-csrftoken' || lower === 'cookie') {
        continue
      }
      xhr.setRequestHeader(key, value)
    }

    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type') && file.type) {
      xhr.setRequestHeader('Content-Type', file.type)
    }

    const onAbort = () => {
      xhr.abort()
    }
    signal?.addEventListener('abort', onAbort)

    xhr.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : file.size
      const sent = event.loaded
      onProgress?.({
        bytesSent: sent,
        bytesTotal: total,
        percent: total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0,
        phase: 'uploading',
      })
    }

    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort)
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({
          bytesSent: file.size,
          bytesTotal: file.size,
          percent: 100,
          phase: 'uploading',
        })
        resolve()
        return
      }
      reject(mapStorageStatus(xhr.status))
    }

    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new DirectUploadError(uploadError('network_failure', 'uploadErrorNetwork', { retryable: true })))
    }

    xhr.ontimeout = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new DirectUploadError(uploadError('timeout', 'uploadErrorTimeout', { retryable: true })))
    }

    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new DirectUploadError(uploadError('cancelled', 'uploadErrorCancelled')))
    }

    xhr.send(file)
  })
}

function mapStorageStatus(status: number): DirectUploadError {
  if (status === 403) {
    return new DirectUploadError(
      uploadError('expired', 'uploadErrorExpired', { httpStatus: 403, retryable: false }),
    )
  }
  if (status === 413) {
    return new DirectUploadError(
      uploadError('file_too_large', 'uploadErrorFileTooLarge', { httpStatus: 413, retryable: false }),
    )
  }
  if (status === 415) {
    return new DirectUploadError(
      uploadError('unsupported_type', 'uploadErrorUnsupportedType', { httpStatus: 415, retryable: false }),
    )
  }
  if (status === 429) {
    return new DirectUploadError(
      uploadError('rate_limited', 'uploadErrorRateLimited', { httpStatus: 429, retryable: true }),
    )
  }
  if (status >= 500) {
    return new DirectUploadError(
      uploadError('server_failure', 'uploadErrorServer', { httpStatus: status, retryable: true }),
    )
  }
  return new DirectUploadError(
    uploadError('object_verification', 'uploadErrorObjectVerification', { httpStatus: status, retryable: false }),
  )
}

function backoff(attempt: number): Promise<void> {
  const ms = Math.min(4000, 400 * 2 ** attempt)
  return new Promise((resolve) => setTimeout(resolve, ms))
}
