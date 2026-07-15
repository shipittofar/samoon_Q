// ============================================================
// P7.6 — Notification Preferences Service
// Per-user, per-tenant, per-branch notification preferences.
// ============================================================

import type {
  NotificationPreference,
  NotificationCategory,
  NotificationPriority,
  ChannelPreference,
} from '@/types/notification'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Default preference templates ─────────────────────────────────────────────

const DEFAULT_CHANNEL_PREFS: ChannelPreference = {
  in_app: true,
  push: true,
  email: false,
  sms: false,
}

const URGENT_CHANNEL_PREFS: ChannelPreference = {
  in_app: true,
  push: true,
  email: true,
  sms: false,
}

const LOW_CHANNEL_PREFS: ChannelPreference = {
  in_app: true,
  push: false,
  email: false,
  sms: false,
}

interface CreatePreferenceParams {
  userId: string
  tenantId: string
  branchId?: string
  category: NotificationCategory
  enabled?: boolean
  channels?: Partial<ChannelPreference>
  minPriority?: NotificationPriority
}

function buildDefaultPreferences(userId: string, tenantId: string, branchId?: string): NotificationPreference[] {
  const now = new Date().toISOString()
  const defs: Array<{ category: NotificationCategory; channels: ChannelPreference; minPriority: NotificationPriority }> = [
    { category: 'order', channels: DEFAULT_CHANNEL_PREFS, minPriority: 'normal' },
    { category: 'reservation', channels: DEFAULT_CHANNEL_PREFS, minPriority: 'normal' },
    { category: 'staff', channels: DEFAULT_CHANNEL_PREFS, minPriority: 'normal' },
    { category: 'branch', channels: DEFAULT_CHANNEL_PREFS, minPriority: 'normal' },
    { category: 'promotion', channels: LOW_CHANNEL_PREFS, minPriority: 'normal' },
    { category: 'tenant', channels: URGENT_CHANNEL_PREFS, minPriority: 'high' },
    { category: 'vendor', channels: DEFAULT_CHANNEL_PREFS, minPriority: 'normal' },
    { category: 'loyalty', channels: LOW_CHANNEL_PREFS, minPriority: 'low' },
    { category: 'payment', channels: URGENT_CHANNEL_PREFS, minPriority: 'high' },
    { category: 'system', channels: DEFAULT_CHANNEL_PREFS, minPriority: 'normal' },
    { category: 'audit', channels: DEFAULT_CHANNEL_PREFS, minPriority: 'high' },
  ]
  return defs.map((d, i) => ({
    id: `pref-${userId}-${d.category}`,
    userId,
    tenantId,
    branchId,
    category: d.category,
    enabled: true,
    channels: d.channels,
    minPriority: d.minPriority,
    updatedAt: now,
  }))
}

// ── Mock store ────────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'user-owner-01'
const MOCK_TENANT_ID = 'tenant-samoon-01'

let _prefStore: NotificationPreference[] = buildDefaultPreferences(MOCK_USER_ID, MOCK_TENANT_ID)

// ── Mock implementations ───────────────────────────────────────────────────────

async function getPreferencesMock(userId: string, tenantId: string, branchId?: string): Promise<NotificationPreference[]> {
  let prefs = _prefStore.filter((p) => p.userId === userId && p.tenantId === tenantId)
  if (branchId) prefs = prefs.filter((p) => !p.branchId || p.branchId === branchId)
  if (prefs.length === 0) {
    const defaults = buildDefaultPreferences(userId, tenantId, branchId)
    _prefStore.push(...defaults)
    return defaults
  }
  return prefs
}

async function updatePreferenceMock(
  userId: string,
  tenantId: string,
  category: NotificationCategory,
  update: Partial<Pick<NotificationPreference, 'enabled' | 'channels' | 'minPriority'>>,
  branchId?: string,
): Promise<NotificationPreference> {
  const idx = _prefStore.findIndex(
    (p) => p.userId === userId && p.tenantId === tenantId && p.category === category && p.branchId === branchId,
  )
  if (idx === -1) {
    const defaults = buildDefaultPreferences(userId, tenantId, branchId)
    const pref = defaults.find((p) => p.category === category)!
    const updated = { ...pref, ...update, updatedAt: new Date().toISOString() }
    _prefStore.push(updated)
    return updated
  }
  _prefStore[idx] = { ..._prefStore[idx], ...update, updatedAt: new Date().toISOString() }
  return _prefStore[idx]
}

async function createPreferenceMock(params: CreatePreferenceParams): Promise<NotificationPreference> {
  const pref: NotificationPreference = {
    id: `pref-${params.userId}-${params.category}-${Date.now()}`,
    userId: params.userId,
    tenantId: params.tenantId,
    branchId: params.branchId,
    category: params.category,
    enabled: params.enabled ?? true,
    channels: { ...DEFAULT_CHANNEL_PREFS, ...params.channels },
    minPriority: params.minPriority ?? 'normal',
    updatedAt: new Date().toISOString(),
  }
  _prefStore.push(pref)
  return pref
}

async function resetPreferencesMock(userId: string, tenantId: string): Promise<NotificationPreference[]> {
  _prefStore = _prefStore.filter((p) => !(p.userId === userId && p.tenantId === tenantId))
  const defaults = buildDefaultPreferences(userId, tenantId)
  _prefStore.push(...defaults)
  return defaults
}

// ── Real API stubs ─────────────────────────────────────────────────────────────

async function getPreferencesReal(userId: string, tenantId: string, branchId?: string): Promise<NotificationPreference[]> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<NotificationPreference[]>('/notifications/preferences/', {
    params: { userId, tenantId, branchId },
  })
  return res.data
}

async function updatePreferenceReal(
  userId: string,
  tenantId: string,
  category: NotificationCategory,
  update: Partial<Pick<NotificationPreference, 'enabled' | 'channels' | 'minPriority'>>,
  branchId?: string,
): Promise<NotificationPreference> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.patch<NotificationPreference>(`/notifications/preferences/${category}/`, {
    userId, tenantId, branchId, ...update,
  })
  return res.data
}

async function createPreferenceReal(params: CreatePreferenceParams): Promise<NotificationPreference> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<NotificationPreference>('/notifications/preferences/', params)
  return res.data
}

async function resetPreferencesReal(userId: string, tenantId: string): Promise<NotificationPreference[]> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<NotificationPreference[]>('/notifications/preferences/reset/', { userId, tenantId })
  return res.data
}

// ── Public service ─────────────────────────────────────────────────────────────

export const notificationPreferencesService = {
  getPreferences: USE_MOCK ? getPreferencesMock : getPreferencesReal,
  updatePreference: USE_MOCK ? updatePreferenceMock : updatePreferenceReal,
  createPreference: USE_MOCK ? createPreferenceMock : createPreferenceReal,
  resetPreferences: USE_MOCK ? resetPreferencesMock : resetPreferencesReal,

  getDefaultPreferences: buildDefaultPreferences,

  _resetMock(): void {
    _prefStore = buildDefaultPreferences(MOCK_USER_ID, MOCK_TENANT_ID)
  },
  _getMockCount(): number {
    return _prefStore.length
  },
  _getStore(): NotificationPreference[] {
    return [..._prefStore]
  },
}

export { buildDefaultPreferences }
export const NOTIFICATION_CATEGORIES_WITH_LABELS: Record<NotificationCategory, string> = {
  order: 'Orders',
  reservation: 'Reservations',
  staff: 'Staff',
  branch: 'Branches',
  promotion: 'Promotions',
  tenant: 'Tenant',
  vendor: 'Vendors',
  loyalty: 'Loyalty',
  payment: 'Payments',
  system: 'System',
  audit: 'Audit Events',
}
