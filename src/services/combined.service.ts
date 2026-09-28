// ─── reservation.service.ts ──────────────────────────────────────────────────
import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { uploadService, type UploadFileRequest } from '@/services/upload.service'
import { DirectUploadError, uploadError } from '@/lib/upload-errors'
import { MOCK_BRANCHES, MOCK_TENANT_BRANCHES, MOCK_NOTIFICATIONS, MOCK_RESERVATIONS } from '@/lib/mock-data'
import { branchBelongsToMockTenant } from '@/lib/mock-tenant-scope'
import type { Branch, Notification, PaginatedResponse, Reservation, TableInfo, UpdateProfileRequest, User } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms))

export interface CreateReservationPayload {
  branch_id: string
  date: string
  time: string
  guests: number
  name: string
  phone_number: string
  email?: string
  notes?: string
}

export const reservationService = {
  async create(payload: CreateReservationPayload): Promise<Reservation> {
    if (USE_MOCK) {
      await delay(1000)
      return {
        id: `res-${Date.now()}`,
        ...payload,
        status: 'confirmed',
        confirmation_code: `SAV-${Math.floor(Math.random() * 9000) + 1000}`,
        created_at: new Date().toISOString(),
      }
    }
    const { data } = await api.post<Reservation>(ENDPOINTS.RESERVATIONS.CREATE, payload)
    return data
  },

  async getReservations(): Promise<PaginatedResponse<Reservation>> {
    if (USE_MOCK) {
      await delay(600)
      return { count: MOCK_RESERVATIONS.length, next: null, previous: null, results: MOCK_RESERVATIONS }
    }
    const { data } = await api.get<PaginatedResponse<Reservation>>(ENDPOINTS.RESERVATIONS.LIST)
    return data
  },

  async cancelReservation(id: string, tenantId?: string): Promise<Reservation> {
    if (USE_MOCK) {
      await delay(600)
      const res = MOCK_RESERVATIONS.find((r) => r.id === id)
      if (!res) throw new Error(`Reservation ${id} not found`)
      if (tenantId && !branchBelongsToMockTenant(res.branch_id, tenantId)) {
          throw new Error(`Reservation ${id} not found`)
        }
      return { ...res!, status: 'cancelled' }
    }
    const { data } = await api.post<Reservation>(ENDPOINTS.RESERVATIONS.CANCEL(id), null, {
      ...(tenantId ? { params: { tenantId } } : {}),
    })
    return data
  },

  async getAvailableSlots(date: string, branchId: string): Promise<string[]> {
    if (USE_MOCK) {
      await delay(500)
      return ['12:00', '12:30', '13:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']
    }
    const { data } = await api.get<string[]>(ENDPOINTS.RESERVATIONS.AVAILABLE_SLOTS, {
      params: { date, branch_id: branchId },
    })
    return data
  },
}

// ─── branch.service.ts ────────────────────────────────────────────────────────
export const branchService = {
  /**
   * Phase Z.1 — kept for the (rare) case a caller genuinely has no tenant
   * context yet — see useBranches() in hooks/index.ts, which falls back to
   * this only while the active tenant is still resolving. `tenantId`
   * omitted returns the legacy, tenant-less MOCK_BRANCHES list — that
   * fallback is intentional and covered by context-integrity.test.ts, not
   * a bug to silently remove here. Prefer getTenantBranches(tenantId)
   * below at any call site that already has a resolved tenant.
   */
  async getBranches(tenantId?: string): Promise<Branch[]> {
    if (USE_MOCK) {
      await delay(400)
      if (tenantId && MOCK_TENANT_BRANCHES[tenantId]) {
        return MOCK_TENANT_BRANCHES[tenantId]
      }
      return MOCK_BRANCHES
    }
    const params = tenantId ? { tenant_id: tenantId } : {}
    const { data } = await api.get<PaginatedResponse<Branch>>(ENDPOINTS.BRANCHES.LIST, { params })
    return data.results
  },

  /**
   * Phase Z.1 — "this tenant's branches," full stop: `tenantId` is
   * required, so a call site using this method can never silently fall
   * back to the tenant-less global MOCK_BRANCHES list the way
   * getBranches(undefined) does. Per docs/BACKEND_CONTRACT.md's
   * `GET /tenants/{tenantId}/branches` (not yet implemented — see
   * API_GAP_REPORT.md) — placeholder boundary, same underlying data as
   * getBranches(tenantId) until that endpoint exists. No route migration
   * here: still called from the exact same /reservation and
   * BranchSelector call sites, just with an unambiguous signature.
   */
  async getTenantBranches(tenantId: string): Promise<Branch[]> {
    return branchService.getBranches(tenantId)
  },

  async getBranch(id: string): Promise<Branch> {
    if (USE_MOCK) {
      await delay(300)
      const branch = MOCK_BRANCHES.find((b) => b.id === id || b.slug === id)
      if (!branch) throw new Error('Branch not found')
      return branch
    }
    const { data } = await api.get<Branch>(ENDPOINTS.BRANCHES.DETAIL(id))
    return data
  },
}

// ─── notification.service.ts ──────────────────────────────────────────────────
export const notificationService = {
  async getNotifications(): Promise<PaginatedResponse<Notification>> {
    if (USE_MOCK) {
      await delay(400)
      return { count: MOCK_NOTIFICATIONS.length, next: null, previous: null, results: MOCK_NOTIFICATIONS }
    }
    const { data } = await api.get<PaginatedResponse<Notification>>(ENDPOINTS.NOTIFICATIONS.LIST)
    return data
  },

  async markRead(id: string): Promise<void> {
    if (USE_MOCK) { await delay(200); return }
    await api.post(ENDPOINTS.NOTIFICATIONS.MARK_READ(id))
  },

  async markAllRead(): Promise<void> {
    if (USE_MOCK) { await delay(300); return }
    await api.post(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ)
  },

  async registerDevice(token: string, platform: 'web' | 'ios' | 'android'): Promise<void> {
    if (USE_MOCK) { return }
    await api.post(ENDPOINTS.NOTIFICATIONS.REGISTER_DEVICE, { token, platform })
  },
}

// ─── user.service.ts ──────────────────────────────────────────────────────────
export const userService = {
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    if (USE_MOCK) {
      await delay(800)
      return data as User
    }
    const { data: res } = await api.patch<User>(ENDPOINTS.USERS.UPDATE_PROFILE, data)
    return res
  },

  async getAddresses() {
    const { addressService } = await import('./address.service')
    const res = await addressService.list({ page_size: 50 })
    return res.results
  },

  async createAddress(address: import('@/types/address').UserAddressInput) {
    const { addressService } = await import('./address.service')
    const { buildAddressCreatePayload, assertAddressOwnerProfile } = await import('@/lib/address-profile')
    const { useAuthStore } = await import('@/stores')
    const profile = assertAddressOwnerProfile(useAuthStore.getState().user)
    return addressService.create(buildAddressCreatePayload(address, profile))
  },

  async deleteAddress(id: string) {
    const { addressService } = await import('./address.service')
    return addressService.delete(id)
  },

  async uploadAvatar(
    file: File,
    options?: {
      signal?: AbortSignal
      onSession?: UploadFileRequest['onSession']
      idempotencyKey?: string
    },
  ): Promise<{ avatar_url: string }> {
    const asset = await uploadService.uploadFile({
      file,
      purpose: 'user_avatar',
      signal: options?.signal,
      onSession: options?.onSession,
      idempotencyKey: options?.idempotencyKey,
    })
    if (options?.signal?.aborted) {
      throw new DirectUploadError(uploadError('cancelled', 'uploadErrorCancelled'))
    }
    if (USE_MOCK) {
      return { avatar_url: asset.url }
    }

    const { data } = await api.patch<{ avatar_url?: string; avatar_asset_id?: string }>(
      ENDPOINTS.USERS.AVATAR_UPLOAD,
      { avatar_asset_id: asset.assetId },
    )
    return { avatar_url: data?.avatar_url || asset.url }
  },
}

// ─── tableService ─────────────────────────────────────────────────────────────
const MOCK_TABLE_INFO: Record<string, TableInfo> = {
  '1': { id: 'table-1', number: 1, capacity: 4, section: 'Main Hall', server_name: 'Alex', status: 'occupied' },
  '2': { id: 'table-2', number: 2, capacity: 2, section: 'Window', server_name: 'Maria', status: 'occupied' },
  '3': { id: 'table-3', number: 3, capacity: 6, section: 'Patio', server_name: 'Jordan', status: 'occupied' },
}

export const tableService = {
  async getTableInfo(tableId: string): Promise<TableInfo> {
    if (USE_MOCK) {
      await delay(500)
      const info = MOCK_TABLE_INFO[tableId]
      if (info) return info
      return { id: `table-${tableId}`, number: parseInt(tableId, 10), status: 'occupied' }
    }
    const { data } = await api.get<TableInfo>(ENDPOINTS.TABLE.INFO(tableId))
    return data
  },
}
