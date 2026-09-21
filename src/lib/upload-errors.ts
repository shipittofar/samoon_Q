import axios, { AxiosError } from 'axios'
import type { UploadError, UploadErrorCode } from '@/types/upload'

export class DirectUploadError extends Error {
  readonly uploadError: UploadError

  constructor(error: UploadError, cause?: unknown) {
    super(error.detail ?? error.messageKey)
    this.name = 'DirectUploadError'
    this.uploadError = error
    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

const STATUS_MAP: Record<number, { code: UploadErrorCode; messageKey: string; retryable: boolean }> = {
  400: { code: 'validation', messageKey: 'uploadErrorValidation', retryable: false },
  401: { code: 'authentication', messageKey: 'uploadErrorAuthentication', retryable: false },
  403: { code: 'permission', messageKey: 'uploadErrorPermission', retryable: false },
  413: { code: 'file_too_large', messageKey: 'uploadErrorFileTooLarge', retryable: false },
  415: { code: 'unsupported_type', messageKey: 'uploadErrorUnsupportedType', retryable: false },
  429: { code: 'rate_limited', messageKey: 'uploadErrorRateLimited', retryable: true },
}

export function uploadError(
  code: UploadErrorCode,
  messageKey: string,
  options?: { httpStatus?: number; retryable?: boolean; detail?: string },
): UploadError {
  return {
    code,
    messageKey,
    httpStatus: options?.httpStatus,
    retryable: options?.retryable ?? false,
    detail: options?.detail,
  }
}

export function isDirectUploadError(err: unknown): err is DirectUploadError {
  return err instanceof DirectUploadError
}

export function toUploadError(err: unknown): UploadError {
  if (isDirectUploadError(err)) return err.uploadError
  if (err instanceof DOMException && err.name === 'AbortError') {
    return uploadError('cancelled', 'uploadErrorCancelled', { retryable: false })
  }
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ERR_CANCELED') {
    return uploadError('cancelled', 'uploadErrorCancelled', { retryable: false })
  }

  if (axios.isAxiosError(err)) {
    return fromAxiosError(err)
  }

  const status = (err as { status?: number; httpStatus?: number })?.status
    ?? (err as { httpStatus?: number })?.httpStatus
  if (typeof status === 'number' && STATUS_MAP[status]) {
    return { ...STATUS_MAP[status], httpStatus: status }
  }

  const message = err instanceof Error ? err.message : String(err ?? '')
  if (/timeout/i.test(message)) {
    return uploadError('timeout', 'uploadErrorTimeout', { retryable: true, detail: message })
  }
  if (/network|failed to fetch|offline/i.test(message)) {
    return uploadError('network_failure', 'uploadErrorNetwork', { retryable: true, detail: message })
  }

  return uploadError('unknown', 'uploadErrorUnknown', { retryable: false, detail: message })
}

function fromAxiosError(err: AxiosError): UploadError {
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) {
    return uploadError('timeout', 'uploadErrorTimeout', { retryable: true, detail: err.message })
  }
  if (!err.response) {
    return uploadError('network_failure', 'uploadErrorNetwork', { retryable: true, detail: err.message })
  }
  const status = err.response.status
  const mapped = STATUS_MAP[status]
  if (mapped) return { ...mapped, httpStatus: status }
  if (status >= 500) {
    return uploadError('server_failure', 'uploadErrorServer', { httpStatus: status, retryable: true })
  }
  return uploadError('unknown', 'uploadErrorUnknown', { httpStatus: status, retryable: false })
}

export function throwUploadError(error: UploadError, cause?: unknown): never {
  throw new DirectUploadError(error, cause)
}
