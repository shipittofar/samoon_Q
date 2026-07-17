// ─── reservation.service.ts ──────────────────────────────────────────────────
import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_BRANCHES, MOCK_TENANT_BRANCHES, MOCK_NOTIFICATIONS, MOCK_RESERVATIONS } from '@/lib/mock-data'
import type { Address, Branch, Notification, PaginatedResponse, Reservation, TableInfo, UpdateProfileRequest, User } from '@/types'

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

  async cancelReservation(id: string): Promise<Reservation> {
    if (USE_MOCK) {
      await delay(600)
      const res = MOCK_RESERVATIONS.find((r) => r.id === id)
      return { ...res!, status: 'cancelled' }
    }
    const { data } = await api.post<Reservation>(ENDPOINTS.RESERVATIONS.CANCEL(id))
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
  async getBranches(tenantId?: string): Promise<Branch[]> {
    if (USE_MOCK) {
      await delay(400)
      if (tenantId && MOCK_TENANT_BRANCHES[tenantId]) {
        return MOCK_TENANT_BRANCHES[tenantId]
      }
      return MOCK_BRANCHES
    }
    const params = tenantId ? { tenant_id: tenantId } : {}
    const { data } = await api.get<Branch[]>(ENDPOINTS.BRANCHES.LIST, { params })
    return data
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

  async getAddresses(): Promise<Address[]> {
    if (USE_MOCK) {
      await delay(400)
      return [
        { id: '1', label: 'Home', street: '123 Main St', city: 'New York', is_default: true },
        { id: '2', label: 'Work', street: '456 Office Ave', city: 'New York', is_default: false },
      ]
    }
    const { data } = await api.get<Address[]>(ENDPOINTS.USERS.ADDRESSES)
    return data
  },

  async createAddress(address: Omit<Address, 'id'>): Promise<Address> {
    if (USE_MOCK) {
      await delay(600)
      return { ...address, id: Date.now().toString() }
    }
    const { data } = await api.post<Address>(ENDPOINTS.USERS.ADDRESSES, address)
    return data
  },

  async deleteAddress(id: string): Promise<void> {
    if (USE_MOCK) { await delay(400); return }
    await api.delete(ENDPOINTS.USERS.ADDRESS(id))
  },

  async getFavorites(): Promise<string[]> {
    if (USE_MOCK) {
      await delay(300)
      return ['1', '8', '12']
    }
    const { data } = await api.get<string[]>(ENDPOINTS.USERS.FAVORITES)
    return data
  },

  async toggleFavorite(itemId: string): Promise<{ favorited: boolean }> {
    if (USE_MOCK) {
      await delay(300)
      return { favorited: Math.random() > 0.5 }
    }
    const { data } = await api.post<{ favorited: boolean }>(ENDPOINTS.USERS.TOGGLE_FAVORITE(itemId))
    return data
  },

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Unsupported file type. Please upload a JPEG, PNG, WebP, or GIF image.')
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error('File is too large. Maximum allowed size is 5 MB.')
    }

    if (USE_MOCK) {
      await delay(900)
      const objectUrl = URL.createObjectURL(file)
      return { avatar_url: objectUrl }
    }

    const form = new FormData()
    form.append('avatar', file)
    const { data } = await api.patch<{ avatar_url: string }>(
      ENDPOINTS.USERS.AVATAR_UPLOAD,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    if (!data?.avatar_url) throw new Error('Server did not return an avatar URL.')
    return data
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
