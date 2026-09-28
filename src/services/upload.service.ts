import api from '@/services/axios.instance'
import { ENDPOINTS } from '@/services/endpoints'
import { uploadToPresignedStorage } from '@/lib/storage-upload'
import { DirectUploadError, toUploadError, throwUploadError, uploadError } from '@/lib/upload-errors'
import { assertValidUploadFile } from '@/lib/upload-validation'
import { DEFAULT_UPLOAD_CONCURRENCY, runWithConcurrency } from '@/lib/upload-concurrency'
import {
  createLocalUploadSession,
  createUploadIdempotencyKey,
  mapBackendStatus,
  type AssetId,
  type InitiateUploadResponse,
  type UploadIntent,
  type UploadProgress,
  type UploadPurpose,
  type UploadSession,
  type UploadStatusResponse,
} from '@/types/upload'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const POLL_INTERVAL_MS = 700
const POLL_TIMEOUT_MS = 60_000
const MAX_EXPIRED_REINITIATES = 1

/**
 * Caller-supplied idempotency keys only.
 * A key joins in-flight calls and replays a successful result so a retry of
 * the same logical action does not initiate a second asset.
 * Calls that omit a key stay independent (logo and cover may upload together).
 */
const inFlightByKey = new Map<string, Promise<ReadyAsset>>()
const completedByKey = new Map<string, ReadyAsset>()

export interface UploadFileRequest {
  file: File
  purpose: UploadPurpose
  /** Required for tenant-scoped / menu / branch purposes. */
  tenantId?: string
  /** Required for menu_* purposes (Branch UUID, not a menu row id). */
  branchId?: string
  entityType?: string
  entityId?: string
  signal?: AbortSignal
  onProgress?: (progress: UploadProgress) => void
  onSession?: (session: UploadSession) => void
  idempotencyKey?: string
  /** Internal: at most one re-initiate after an expired presigned URL. */
  expiredRetries?: number
}

export interface ReadyAsset {
  assetId: AssetId
  url: string
}

function emit(session: UploadSession, onSession?: (s: UploadSession) => void): UploadSession {
  onSession?.(session)
  return session
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throwUploadError(uploadError('cancelled', 'uploadErrorCancelled'))
  }
}

async function sha256Hex(file: File): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined
  try {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return undefined
  }
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t <= Date.now()
}

function failSession(
  session: UploadSession,
  err: unknown,
  onSession?: (s: UploadSession) => void,
): DirectUploadError {
  const error = toUploadError(err)
  emit(
    { ...session, status: error.code === 'cancelled' ? 'CANCELLED' : error.code === 'expired' ? 'EXPIRED' : 'FAILED', error, localFile: null },
    onSession,
  )
  return err instanceof DirectUploadError ? err : new DirectUploadError(error, err)
}

export const uploadService = {
  async initiateUpload(
    intent: UploadIntent,
    signal?: AbortSignal,
  ): Promise<InitiateUploadResponse> {
    if (USE_MOCK) {
      const assetId = intent.idempotencyKey
      return {
        asset_id: assetId,
        status: 'INITIATED',
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        upload: {
          method: 'PUT',
          url: `https://storage.mock.local/presigned/${assetId}`,
          headers: { 'Content-Type': intent.mimeType },
        },
      }
    }

    try {
      const body: Record<string, unknown> = {
        purpose: intent.purpose,
        filename: intent.filename,
        mime_type: intent.mimeType,
        byte_size: intent.byteSize,
      }
      if (intent.checksum) body.checksum = intent.checksum
      if (intent.tenantId) body.tenant_id = intent.tenantId
      if (intent.branchId) body.branch_id = intent.branchId
      if (intent.entityType) body.entity_type = intent.entityType
      if (intent.entityId) body.entity_id = intent.entityId

      const { data } = await api.post<InitiateUploadResponse>(
        ENDPOINTS.UPLOADS.INITIATE,
        body,
        {
          signal,
          headers: { 'Idempotency-Key': intent.idempotencyKey },
        },
      )
      return data
    } catch (err) {
      throw new DirectUploadError(toUploadError(err), err)
    }
  },

  async uploadToStorage(
    file: File,
    upload: NonNullable<InitiateUploadResponse['upload']>,
    signal?: AbortSignal,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<void> {
    if (USE_MOCK) {
      assertNotAborted(signal)
      onProgress?.({ bytesSent: file.size, bytesTotal: file.size, percent: 100, phase: 'uploading' })
      return
    }
    await uploadToPresignedStorage({ file, upload, signal, onProgress })
  },

  async completeUpload(assetId: AssetId, signal?: AbortSignal): Promise<UploadStatusResponse> {
    if (USE_MOCK) {
      return {
        asset_id: assetId,
        status: 'PROCESSING',
        url: mockAssetUrl(assetId),
      }
    }
    try {
      const { data } = await api.post<UploadStatusResponse>(
        ENDPOINTS.UPLOADS.COMPLETE(assetId),
        {},
        { signal },
      )
      return data
    } catch (err) {
      const mapped = toUploadError(err)
      if (
        mapped.retryable &&
        (mapped.code === 'timeout' || mapped.code === 'network_failure' || mapped.code === 'server_failure')
      ) {
        try {
          const { data } = await api.post<UploadStatusResponse>(
            ENDPOINTS.UPLOADS.COMPLETE(assetId),
            {},
            { signal },
          )
          return data
        } catch (retryErr) {
          throw new DirectUploadError(toUploadError(retryErr), retryErr)
        }
      }
      throw new DirectUploadError(mapped, err)
    }
  },

  async getUploadStatus(assetId: AssetId, signal?: AbortSignal): Promise<UploadStatusResponse> {
    if (USE_MOCK) {
      return {
        asset_id: assetId,
        status: 'READY',
        url: mockAssetUrl(assetId),
      }
    }
    try {
      const { data } = await api.get<UploadStatusResponse>(ENDPOINTS.UPLOADS.STATUS(assetId), { signal })
      return data
    } catch (err) {
      throw new DirectUploadError(toUploadError(err), err)
    }
  },

  async cancelUpload(assetId: AssetId | null | undefined, signal?: AbortSignal): Promise<void> {
    if (!assetId || USE_MOCK) return
    try {
      await api.post(ENDPOINTS.UPLOADS.CANCEL(assetId), {}, { signal })
    } catch {
      // Best-effort; backend TTL owns orphan cleanup.
    }
  },

  async waitUntilReady(
    assetId: AssetId,
    signal?: AbortSignal,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadStatusResponse> {
    const started = Date.now()
    let attempt = 0
    while (Date.now() - started < POLL_TIMEOUT_MS) {
      assertNotAborted(signal)
      const status = await this.getUploadStatus(assetId, signal)
      const mapped = mapBackendStatus(status.status)
      if (mapped === 'READY') {
        if (!status.asset_id) {
          throwUploadError(uploadError('processing_failure', 'uploadErrorProcessing', { retryable: false }))
        }
        return status
      }
      if (mapped === 'FAILED') {
        throwUploadError(uploadError('processing_failure', 'uploadErrorProcessing', { retryable: false, detail: status.error }))
      }
      if (mapped === 'EXPIRED') {
        throwUploadError(uploadError('expired', 'uploadErrorExpired', { retryable: false }))
      }
      if (mapped === 'CANCELLED') {
        throwUploadError(uploadError('cancelled', 'uploadErrorCancelled'))
      }
      onProgress?.({
        bytesSent: 0,
        bytesTotal: 0,
        percent: 100,
        phase: 'processing',
      })
      const delay = Math.min(4_000, POLL_INTERVAL_MS * 2 ** Math.min(attempt, 3))
      attempt += 1
      await sleep(delay, signal)
    }
    throwUploadError(uploadError('timeout', 'uploadErrorTimeout', { retryable: true }))
  },

  /**
   * Drop a cached successful upload so a later, different user action can
   * initiate again. In-flight work is left alone.
   */
  releaseIdempotency(key: string | null | undefined): void {
    if (!key) return
    completedByKey.delete(key)
  },

  async uploadFile(request: UploadFileRequest): Promise<ReadyAsset> {
    const idempotencyKey = request.idempotencyKey ?? createUploadIdempotencyKey()
    const track = Boolean(request.idempotencyKey)
    if (track) {
      const cached = completedByKey.get(idempotencyKey)
      if (cached) return cached
      const pending = inFlightByKey.get(idempotencyKey)
      if (pending) return pending
    }

    const run = this.performUpload({ ...request, idempotencyKey }).then((asset) => {
      if (track) completedByKey.set(idempotencyKey, asset)
      return asset
    })
    if (track) inFlightByKey.set(idempotencyKey, run)
    try {
      return await run
    } finally {
      if (track) inFlightByKey.delete(idempotencyKey)
    }
  },

  async performUpload(request: UploadFileRequest): Promise<ReadyAsset> {
    assertValidUploadFile(request.file, request.purpose)
    assertNotAborted(request.signal)
    const idempotencyKey = request.idempotencyKey ?? createUploadIdempotencyKey()
    let session = emit(
      createLocalUploadSession(request.file, request.purpose, idempotencyKey),
      request.onSession,
    )

    const checksum = await sha256Hex(request.file)
    assertNotAborted(request.signal)
    session = emit({ ...session, status: 'INITIATING' }, request.onSession)

    let initiated: InitiateUploadResponse
    try {
      initiated = await this.initiateUpload(
        {
          purpose: request.purpose,
          filename: request.file.name,
          mimeType: request.file.type || 'application/octet-stream',
          byteSize: request.file.size,
          checksum,
          tenantId: request.tenantId,
          branchId: request.branchId,
          entityType: request.entityType,
          entityId: request.entityId,
          idempotencyKey,
        },
        request.signal,
      )
    } catch (err) {
      throw failSession(session, err, request.onSession)
    }

    if (!initiated.asset_id) {
      throw failSession(
        session,
        new DirectUploadError(uploadError('server_failure', 'uploadErrorServer', { retryable: true })),
        request.onSession,
      )
    }

    const initiatedStatus = mapBackendStatus(initiated.status)
    if (initiatedStatus === 'FAILED' || initiatedStatus === 'CANCELLED') {
      throw failSession(
        session,
        new DirectUploadError(uploadError('processing_failure', 'uploadErrorProcessing')),
        request.onSession,
      )
    }

    session = emit(
      {
        ...session,
        status: initiatedStatus === 'READY' ? 'PROCESSING' : initiatedStatus === 'PROCESSING' ? 'PROCESSING' : 'UPLOADING',
        assetId: initiated.asset_id,
        uploadId: initiated.asset_id,
        expiresAt: initiated.expires_at ?? null,
      },
      request.onSession,
    )

    const alreadyReady = initiatedStatus === 'READY'
    const skipPut = alreadyReady || initiatedStatus === 'PROCESSING' || initiatedStatus === 'UPLOADED'

    if (!skipPut) {
      try {
        const presigned = initiated.upload
        if (!presigned?.url) {
          throwUploadError(uploadError('server_failure', 'uploadErrorServer', { retryable: true }))
        }
        if (isExpired(initiated.expires_at)) {
          throwUploadError(uploadError('expired', 'uploadErrorExpired'))
        }
        await this.uploadToStorage(request.file, presigned, request.signal, (progress) => {
          request.onProgress?.(progress)
          emit({ ...session, status: 'UPLOADING', progress, localFile: request.file }, request.onSession)
        })
      } catch (err) {
        const error = toUploadError(err)
        if (
          (error.code === 'expired' || error.httpStatus === 403) &&
          (request.expiredRetries ?? 0) < MAX_EXPIRED_REINITIATES &&
          error.code !== 'cancelled'
        ) {
          emit({ ...session, status: 'EXPIRED', error, localFile: request.file }, request.onSession)
          // A new key is required here only. Replaying the caller's key would
          // return the same initiate response, including the expired presign,
          // if the API treats Idempotency-Key as a replay. The caller's key
          // still identifies the logical action: uploadFile() caches the
          // eventual asset under that key. This path calls performUpload
          // directly so it does not join the in-flight map for the new key
          // or deadlock on the caller's key.
          return this.performUpload({
            ...request,
            idempotencyKey: createUploadIdempotencyKey(),
            expiredRetries: (request.expiredRetries ?? 0) + 1,
          })
        }
        if (error.code === 'cancelled' && initiated.asset_id) {
          void this.cancelUpload(initiated.asset_id)
        }
        throw failSession(session, err, request.onSession)
      }

      session = emit({ ...session, status: 'UPLOADED' }, request.onSession)
    }

    try {
      assertNotAborted(request.signal)
      let ready: UploadStatusResponse
      if (alreadyReady) {
        ready = {
          asset_id: initiated.asset_id,
          status: 'READY',
          url: initiated.url,
        }
      } else {
        if (initiatedStatus !== 'PROCESSING') {
          const completed = await this.completeUpload(initiated.asset_id, request.signal)
          if (mapBackendStatus(completed.status) === 'READY') {
            ready = completed
          } else {
            session = emit({ ...session, status: 'PROCESSING', localFile: null }, request.onSession)
            request.onProgress?.({
              bytesSent: request.file.size,
              bytesTotal: request.file.size,
              percent: 100,
              phase: 'processing',
            })
            ready = await this.waitUntilReady(initiated.asset_id, request.signal, request.onProgress)
          }
        } else {
          session = emit({ ...session, status: 'PROCESSING', localFile: null }, request.onSession)
          ready = await this.waitUntilReady(initiated.asset_id, request.signal, request.onProgress)
        }
      }

      assertNotAborted(request.signal)
      const assetId = ready.asset_id || initiated.asset_id
      if (!assetId) {
        throwUploadError(uploadError('processing_failure', 'uploadErrorProcessing', { retryable: false }))
      }
      const url = ready.url || (USE_MOCK ? mockAssetUrl(assetId) : '')
      emit(
        { ...session, status: 'READY', url, assetId, localFile: null },
        request.onSession,
      )
      return { assetId, url }
    } catch (err) {
      const error = toUploadError(err)
      if (error.code === 'cancelled' && initiated.asset_id) {
        void this.cancelUpload(initiated.asset_id)
      }
      throw failSession(session, err, request.onSession)
    }
  },

  async retryUpload(request: UploadFileRequest): Promise<ReadyAsset> {
    // Same logical action: reuse the caller's key. A missing key is a new action.
    return this.uploadFile({
      ...request,
      idempotencyKey: request.idempotencyKey,
      expiredRetries: 0,
    })
  },

  async uploadMany(
    items: Array<UploadFileRequest & { id: string }>,
    options?: { concurrency?: number; signal?: AbortSignal },
  ): Promise<Array<{ id: string; asset?: ReadyAsset; error?: unknown }>> {
    const results = await runWithConcurrency(
      items.map((item) => ({
        id: item.id,
        run: (signal) =>
          this.uploadFile({
            ...item,
            signal: composeAbort(options?.signal, signal, item.signal),
          }),
      })),
      { limit: options?.concurrency ?? DEFAULT_UPLOAD_CONCURRENCY, signal: options?.signal },
    )
    return results.map((result, index) => ({
      id: items[index]!.id,
      asset: result.value,
      error: result.error,
    }))
  },
}

function mockAssetUrl(assetId: string): string {
  return `https://cdn.mock.local/assets/${assetId}`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DirectUploadError(uploadError('cancelled', 'uploadErrorCancelled')))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DirectUploadError(uploadError('cancelled', 'uploadErrorCancelled')))
      },
      { once: true },
    )
  })
}

function composeAbort(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => Boolean(s))
  if (active.length === 0) return undefined
  if (active.length === 1) return active[0]
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}
