/** Centralized direct-to-object-storage upload domain types. */

export type AssetId = string

export type UploadPurpose =
  | 'menu_item'
  | 'menu_category'
  | 'menu_extra'
  | 'menu_tag'
  | 'branch_image'
  | 'branch_cover'
  | 'branch_hero'
  | 'tenant_logo'
  | 'tenant_discover_avatar'
  | 'tenant_discover_cover'
  | 'tenant_hero'
  | 'tenant_gallery'
  | 'website_hero'
  | 'website_media'
  | 'platform_hero'
  | 'avatar'

export type UploadStatus =
  | 'LOCAL'
  | 'INITIATING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'

export type BackendUploadStatus =
  | 'INITIATED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'

export type UploadErrorCode =
  | 'validation'
  | 'authentication'
  | 'permission'
  | 'file_too_large'
  | 'unsupported_type'
  | 'rate_limited'
  | 'server_failure'
  | 'network_failure'
  | 'timeout'
  | 'expired'
  | 'object_verification'
  | 'processing_failure'
  | 'cancelled'
  | 'unknown'

export interface UploadIntent {
  purpose: UploadPurpose
  filename: string
  mimeType: string
  byteSize: number
  checksum?: string
  entityType?: string
  entityId?: string
  idempotencyKey: string
}

export interface UploadProgress {
  bytesSent: number
  bytesTotal: number
  percent: number
  phase: 'uploading' | 'processing'
}

export interface UploadError {
  code: UploadErrorCode
  messageKey: string
  httpStatus?: number
  retryable: boolean
  detail?: string
}

export interface PresignedUpload {
  method: 'PUT'
  url: string
  headers: Record<string, string>
}

export interface InitiateUploadResponse {
  asset_id: AssetId
  status: BackendUploadStatus
  expires_at?: string
  url?: string
  upload: PresignedUpload
}

export interface UploadStatusResponse {
  asset_id: AssetId
  status: BackendUploadStatus
  url?: string
  error?: string
  expires_at?: string
}

export interface AssetReference {
  assetId: AssetId
  url?: string
}

export interface UploadSession {
  localFile: File | null
  objectUrl: string | null
  uploadId: string | null
  assetId: AssetId | null
  status: UploadStatus
  progress: UploadProgress
  error: UploadError | null
  expiresAt: string | null
  url: string | null
  purpose: UploadPurpose
  idempotencyKey: string
}

export const EMPTY_UPLOAD_PROGRESS: UploadProgress = {
  bytesSent: 0,
  bytesTotal: 0,
  percent: 0,
  phase: 'uploading',
}

export function createLocalUploadSession(
  file: File,
  purpose: UploadPurpose,
  idempotencyKey = createUploadIdempotencyKey(),
): UploadSession {
  return {
    localFile: file,
    objectUrl: null,
    uploadId: null,
    assetId: null,
    status: 'LOCAL',
    progress: { ...EMPTY_UPLOAD_PROGRESS, bytesTotal: file.size },
    error: null,
    expiresAt: null,
    url: null,
    purpose,
    idempotencyKey,
  }
}

export function createUploadIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function isTransientMediaUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith('blob:') || value.startsWith('data:')
}

export function mapBackendStatus(status: BackendUploadStatus | string): UploadStatus {
  switch (status) {
    case 'INITIATED':
      return 'INITIATING'
    case 'UPLOADING':
      return 'UPLOADING'
    case 'UPLOADED':
      return 'UPLOADED'
    case 'PROCESSING':
      return 'PROCESSING'
    case 'READY':
      return 'READY'
    case 'FAILED':
      return 'FAILED'
    case 'CANCELLED':
      return 'CANCELLED'
    case 'EXPIRED':
      return 'EXPIRED'
    default:
      return 'FAILED'
  }
}
