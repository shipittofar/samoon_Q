/** Centralized direct-to-object-storage upload domain types. */

export type AssetId = string

/**
 * Canonical upload purposes — must match Django `PurposeEnum` / UploadAsset choices.
 * Source of truth: live OpenAPI `components.schemas.PurposeEnum`.
 */
export type UploadPurpose =
  | 'branch_cover'
  | 'branch_hero'
  | 'branch_logo'
  | 'menu_category'
  | 'menu_item'
  | 'menu_tag'
  | 'tenant_discover_avatar'
  | 'tenant_discover_cover'
  | 'tenant_hero'
  | 'tenant_logo'
  | 'user_avatar'
  | 'website_media'

/** All purposes accepted by POST /api/uploads/initiate/. */
export const UPLOAD_PURPOSES = [
  'branch_cover',
  'branch_hero',
  'branch_logo',
  'menu_category',
  'menu_item',
  'menu_tag',
  'tenant_discover_avatar',
  'tenant_discover_cover',
  'tenant_hero',
  'tenant_logo',
  'user_avatar',
  'website_media',
] as const satisfies readonly UploadPurpose[]

/**
 * Context required by initiate for each purpose (from OpenAPI docs):
 * - user_avatar: self only — no tenant_id
 * - tenant_* / website_media / branch_*: tenant_id required
 * - menu_*: tenant_id + branch_id required (branch_id is the Branch UUID, not a menu row id)
 */
export type UploadPurposeContextRule =
  | { tenantId: 'required'; branchId: 'forbidden' | 'optional' }
  | { tenantId: 'forbidden'; branchId: 'forbidden' }
  | { tenantId: 'required'; branchId: 'required' }

export const UPLOAD_PURPOSE_CONTEXT: Record<UploadPurpose, UploadPurposeContextRule> = {
  user_avatar: { tenantId: 'forbidden', branchId: 'forbidden' },
  tenant_logo: { tenantId: 'required', branchId: 'optional' },
  tenant_discover_avatar: { tenantId: 'required', branchId: 'optional' },
  tenant_discover_cover: { tenantId: 'required', branchId: 'optional' },
  tenant_hero: { tenantId: 'required', branchId: 'optional' },
  website_media: { tenantId: 'required', branchId: 'optional' },
  branch_logo: { tenantId: 'required', branchId: 'optional' },
  branch_cover: { tenantId: 'required', branchId: 'optional' },
  branch_hero: { tenantId: 'required', branchId: 'optional' },
  menu_item: { tenantId: 'required', branchId: 'required' },
  menu_category: { tenantId: 'required', branchId: 'required' },
  menu_tag: { tenantId: 'required', branchId: 'required' },
}

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
  /** Required for tenant-scoped / menu / branch purposes. */
  tenantId?: string
  /** Required for menu_* purposes (Branch UUID). */
  branchId?: string
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
  retryable?: boolean
  httpStatus?: number
  detail?: string
}

export interface PresignedUpload {
  method?: string
  url: string
  headers?: Record<string, string>
}

export interface InitiateUploadResponse {
  asset_id: AssetId
  purpose?: UploadPurpose | string
  status: BackendUploadStatus | string
  expires_at?: string
  failure_code?: string
  failure_message?: string
  upload?: PresignedUpload
  url?: string
  original_filename?: string
  mime_type?: string
  byte_size?: number
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
