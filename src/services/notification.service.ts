// ============================================================
// P7.6 — Notification Service
// Mock-first implementation following the USE_MOCK pattern.
// ============================================================

import { getNotificationConfig, buildDeepLinkHref } from '@/services/notification-event-registry'
import type {
  RichNotification,
  NotificationFilter,
  NotificationStatistics,
  NotificationSummary,
  PaginatedNotifications,
  NotificationCategory,
  NotificationPriority,
  RichNotificationType,
  NotificationScope,
  NotificationActor,
  NotificationDeepLink,
  NotificationStatus,
} from '@/types/notification'
import type { AuditAction } from '@/types/audit-log'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Mock data ─────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-samoon-01'
const TENANT_B = 'tenant-brew-cafe-01'
const BRANCH_1 = 'branch-rest-01'
const BRANCH_2 = 'branch-rest-02'

const MOCK_NOTIFICATIONS: RichNotification[] = [
  {
    id: 'notif-001',
    type: 'order_created',
    category: 'order',
    priority: 'normal',
    status: 'unread',
    title: 'New order received',
    message: 'Kai Kitchen placed Order #0042',
    actor: { id: 'user-kitchen-01', name: 'Kai Kitchen', roles: ['kitchen'] },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    deepLink: { type: 'order', id: 'order-042', href: '/console/orders/order-042' },
    sourceAuditAction: 'ORDER_CREATED',
    channels: ['in_app', 'push'],
    data: { orderId: 'order-042' },
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'notif-002',
    type: 'staff_suspended',
    category: 'staff',
    priority: 'high',
    status: 'unread',
    title: 'Staff member suspended',
    message: 'Alex Admin suspended Casey Cashier',
    actor: { id: 'user-admin-01', name: 'Alex Admin', roles: ['admin'] },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    deepLink: { type: 'staff', id: 'staff-cashier-01', href: '/console/staff/staff-cashier-01' },
    sourceAuditAction: 'STAFF_SUSPENDED',
    channels: ['in_app', 'push'],
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'notif-003',
    type: 'ownership_transferred',
    category: 'staff',
    priority: 'urgent',
    status: 'unread',
    title: 'Ownership transferred',
    message: 'Olivia Owner transferred ownership to Alex Admin',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', roles: ['owner'] },
    scope: { tenantId: TENANT_A },
    deepLink: { type: 'audit_log', id: 'audit-005', href: '/console/audit-logs' },
    sourceAuditAction: 'OWNERSHIP_TRANSFERRED',
    channels: ['in_app', 'push', 'email'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'notif-004',
    type: 'reservation_confirmed',
    category: 'reservation',
    priority: 'normal',
    status: 'read',
    title: 'Reservation confirmed',
    message: 'Table for 4 on Saturday at 7:30 PM confirmed',
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    deepLink: { type: 'reservation', id: 'res-001', href: '/console/reservations/res-001' },
    sourceAuditAction: 'RESERVATION_CONFIRMED',
    channels: ['in_app'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'notif-005',
    type: 'branch_deactivated',
    category: 'branch',
    priority: 'high',
    status: 'read',
    title: 'Branch deactivated',
    message: 'Olivia Owner deactivated Downtown Branch',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', roles: ['owner'] },
    scope: { tenantId: TENANT_A, branchId: BRANCH_2 },
    deepLink: { type: 'branch', id: BRANCH_2, href: `/console/branches/${BRANCH_2}` },
    sourceAuditAction: 'BRANCH_DEACTIVATED',
    channels: ['in_app', 'push'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'notif-006',
    type: 'tenant_suspended',
    category: 'tenant',
    priority: 'urgent',
    status: 'unread',
    title: 'Tenant suspended',
    message: 'Brew Cafe tenant has been suspended',
    scope: { tenantId: TENANT_B },
    deepLink: { type: 'audit_log', id: 'audit-999', href: '/console/audit-logs' },
    sourceAuditAction: 'TENANT_SUSPENDED',
    channels: ['in_app', 'push', 'email'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: 'notif-007',
    type: 'promotion_created',
    category: 'promotion',
    priority: 'normal',
    status: 'archived',
    title: 'New promotion created',
    message: 'Maria Manager created Summer Sale 20%',
    actor: { id: 'user-manager-01', name: 'Maria Manager', roles: ['manager'] },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    deepLink: { type: 'promotion', id: 'promo-001', href: '/console/promotions/promo-001' },
    sourceAuditAction: 'PROMOTION_CREATED',
    channels: ['in_app'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    archivedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: 'notif-008',
    type: 'payment_refunded',
    category: 'payment',
    priority: 'urgent',
    status: 'read',
    title: 'Payment refunded',
    message: 'Alex Admin issued a refund for Order #0039',
    actor: { id: 'user-admin-01', name: 'Alex Admin', roles: ['admin'] },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    deepLink: { type: 'audit_log', id: 'audit-888', href: '/console/audit-logs' },
    sourceAuditAction: 'PAYMENT_REFUNDED',
    channels: ['in_app', 'push', 'email'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: 'notif-009',
    type: 'staff_created',
    category: 'staff',
    priority: 'normal',
    status: 'read',
    title: 'New staff member added',
    message: 'Olivia Owner added Will Waiter to the team',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', roles: ['owner'] },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    deepLink: { type: 'staff', id: 'staff-waiter-01', href: '/console/staff/staff-waiter-01' },
    sourceAuditAction: 'STAFF_CREATED',
    channels: ['in_app'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
  },
  {
    id: 'notif-010',
    type: 'order_status_changed',
    category: 'order',
    priority: 'normal',
    status: 'read',
    title: 'Order status updated',
    message: 'Order #0041 is now preparing',
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    deepLink: { type: 'order', id: 'order-041', href: '/console/orders/order-041' },
    sourceAuditAction: 'ORDER_STATUS_CHANGED',
    channels: ['in_app'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
  },
  {
    id: 'notif-011',
    type: 'branch_created',
    category: 'branch',
    priority: 'normal',
    status: 'read',
    title: 'New branch created',
    message: 'Olivia Owner created Downtown Branch',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', roles: ['owner'] },
    scope: { tenantId: TENANT_A },
    deepLink: { type: 'branch', id: BRANCH_2, href: `/console/branches/${BRANCH_2}` },
    sourceAuditAction: 'BRANCH_CREATED',
    channels: ['in_app'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 71).toISOString(),
  },
  {
    id: 'notif-012',
    type: 'feature_flag_changed',
    category: 'system',
    priority: 'high',
    status: 'read',
    title: 'Feature flag changed',
    message: 'Olivia Owner changed feature flag admin.audit.enabled',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', roles: ['owner'] },
    scope: { tenantId: TENANT_A },
    deepLink: { type: 'audit_log', id: '', href: '/console/audit-logs' },
    sourceAuditAction: 'FEATURE_FLAG_CHANGED',
    channels: ['in_app'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 95).toISOString(),
  },
]

let _mockStore: RichNotification[] = [...MOCK_NOTIFICATIONS]

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function applyNotificationFilter(
  notifications: RichNotification[],
  filter: NotificationFilter,
): RichNotification[] {
  let result = [...notifications]

  if (filter.tenantId) {
    result = result.filter((n) => n.scope.tenantId === filter.tenantId)
  }
  if (filter.branchId) {
    result = result.filter((n) => n.scope.branchId === filter.branchId)
  }
  if (filter.category) {
    result = result.filter((n) => n.category === filter.category)
  }
  if (filter.priority) {
    result = result.filter((n) => n.priority === filter.priority)
  }
  if (filter.status) {
    result = result.filter((n) => n.status === filter.status)
  }
  if (filter.type) {
    result = result.filter((n) => n.type === filter.type)
  }
  if (filter.search) {
    const q = filter.search.toLowerCase()
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.actor?.name ?? '').toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q),
    )
  }
  if (filter.dateFrom) {
    result = result.filter((n) => n.createdAt >= filter.dateFrom!)
  }
  if (filter.dateTo) {
    const dateTo = filter.dateTo + 'T23:59:59Z'
    result = result.filter((n) => n.createdAt <= dateTo)
  }

  const sortBy = filter.sortBy ?? 'createdAt'
  const asc = filter.sortOrder === 'asc'
  result.sort((a, b) => {
    const va = a[sortBy as keyof RichNotification] as string ?? ''
    const vb = b[sortBy as keyof RichNotification] as string ?? ''
    return asc ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  return result
}

function paginate(
  items: RichNotification[],
  page: number,
  pageSize: number,
): PaginatedNotifications {
  const start = (page - 1) * pageSize
  const results = items.slice(start, start + pageSize)
  const unreadCount = items.filter((n) => n.status === 'unread').length
  return {
    results,
    count: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize) || 1,
    unreadCount,
  }
}

export function buildNotificationStatistics(
  notifications: RichNotification[],
  filter: NotificationFilter,
): NotificationStatistics {
  const now = new Date()
  const dateFrom = filter.dateFrom ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const dateTo = filter.dateTo ?? now.toISOString().split('T')[0]

  const total = notifications.length
  const unread = notifications.filter((n) => n.status === 'unread').length
  const read = notifications.filter((n) => n.status === 'read').length
  const archived = notifications.filter((n) => n.status === 'archived').length

  const byCategory: Partial<Record<NotificationCategory, number>> = {}
  const byPriority: Partial<Record<NotificationPriority, number>> = {}
  const byBranch: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  const typeCounts: Partial<Record<RichNotificationType, number>> = {}

  for (const n of notifications) {
    byCategory[n.category] = (byCategory[n.category] ?? 0) + 1
    byPriority[n.priority] = (byPriority[n.priority] ?? 0) + 1
    if (n.scope.branchId) {
      byBranch[n.scope.branchId] = (byBranch[n.scope.branchId] ?? 0) + 1
    }
    const day = n.createdAt.split('T')[0]
    byDay[day] = (byDay[day] ?? 0) + 1
    typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1
  }

  const topTypes = (Object.entries(typeCounts) as [RichNotificationType, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }))

  return {
    totalNotifications: total,
    unreadCount: unread,
    readCount: read,
    archivedCount: archived,
    readRate: total > 0 ? Math.round((read / total) * 100) : 0,
    notificationsByCategory: byCategory as Record<NotificationCategory, number>,
    notificationsByPriority: byPriority as Record<NotificationPriority, number>,
    notificationsByBranch: byBranch,
    notificationsByDay: byDay,
    topTypes,
    dateFrom,
    dateTo,
  }
}

export function buildNotificationSummary(notifications: RichNotification[]): NotificationSummary {
  const active = notifications.filter((n) => n.status !== 'archived' && n.status !== 'deleted')
  const unread = active.filter((n) => n.status === 'unread')
  const urgent = unread.filter((n) => n.priority === 'urgent')
  const byCategory: Partial<Record<NotificationCategory, number>> = {}
  for (const n of unread) {
    byCategory[n.category] = (byCategory[n.category] ?? 0) + 1
  }
  return {
    unreadCount: unread.length,
    urgentCount: urgent.length,
    latestNotification: active[0],
    categories: byCategory,
  }
}

// ── Mock implementations ───────────────────────────────────────────────────────

async function getNotificationsMock(filter: NotificationFilter): Promise<PaginatedNotifications> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20
  const filtered = applyNotificationFilter(_mockStore, filter)
  return paginate(filtered, page, pageSize)
}

async function getNotificationMock(id: string): Promise<RichNotification | null> {
  return _mockStore.find((n) => n.id === id) ?? null
}

async function markAsReadMock(id: string): Promise<RichNotification> {
  const idx = _mockStore.findIndex((n) => n.id === id)
  if (idx === -1) throw new Error(`Notification not found: ${id}`)
  _mockStore[idx] = { ..._mockStore[idx], status: 'read', readAt: new Date().toISOString() }
  return _mockStore[idx]
}

async function markAllAsReadMock(filter: NotificationFilter = {}): Promise<number> {
  let count = 0
  _mockStore = _mockStore.map((n) => {
    if (n.status !== 'unread') return n
    if (filter.tenantId && n.scope.tenantId !== filter.tenantId) return n
    if (filter.branchId && n.scope.branchId !== filter.branchId) return n
    count++
    return { ...n, status: 'read' as NotificationStatus, readAt: new Date().toISOString() }
  })
  return count
}

async function deleteNotificationMock(id: string): Promise<void> {
  _mockStore = _mockStore.filter((n) => n.id !== id)
}

async function archiveNotificationMock(id: string): Promise<RichNotification> {
  const idx = _mockStore.findIndex((n) => n.id === id)
  if (idx === -1) throw new Error(`Notification not found: ${id}`)
  _mockStore[idx] = { ..._mockStore[idx], status: 'archived', archivedAt: new Date().toISOString() }
  return _mockStore[idx]
}

async function getStatisticsMock(filter: NotificationFilter): Promise<NotificationStatistics> {
  const filtered = applyNotificationFilter(_mockStore, filter)
  return buildNotificationStatistics(filtered, filter)
}

async function getUnreadCountMock(filter: NotificationFilter = {}): Promise<number> {
  const tenantFilter = filter.tenantId
    ? _mockStore.filter((n) => n.scope.tenantId === filter.tenantId)
    : _mockStore
  const branchFiltered = filter.branchId
    ? tenantFilter.filter((n) => n.scope.branchId === filter.branchId)
    : tenantFilter
  return branchFiltered.filter((n) => n.status === 'unread').length
}

async function createNotificationMock(
  auditAction: AuditAction,
  actor: NotificationActor,
  targetName: string,
  targetId: string,
  scope: NotificationScope,
  data?: Record<string, unknown>,
): Promise<RichNotification> {
  const config = getNotificationConfig(auditAction)
  const deepLink: NotificationDeepLink | undefined = config.generateDeepLink && config.deepLinkType
    ? {
        type: config.deepLinkType,
        id: targetId,
        href: buildDeepLinkHref(config.deepLinkType, targetId),
      }
    : undefined

  const notification: RichNotification = {
    id: generateId(),
    type: config.notificationType,
    category: config.category,
    priority: config.priority,
    status: 'unread',
    title: config.titleTemplate,
    message: config.messageTemplate
      .replace('{actor}', actor.name)
      .replace('{target}', targetName),
    actor,
    scope,
    deepLink,
    sourceAuditAction: auditAction,
    channels: config.channels,
    data,
    createdAt: new Date().toISOString(),
  }
  _mockStore.unshift(notification)
  return notification
}

async function getSummaryMock(scope?: Partial<NotificationScope>): Promise<NotificationSummary> {
  let items = [..._mockStore]
  if (scope?.tenantId) items = items.filter((n) => n.scope.tenantId === scope.tenantId)
  if (scope?.branchId) items = items.filter((n) => n.scope.branchId === scope.branchId)
  return buildNotificationSummary(items)
}

// ── Real API stubs ─────────────────────────────────────────────────────────────

async function getNotificationsReal(filter: NotificationFilter): Promise<PaginatedNotifications> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<PaginatedNotifications>('/notifications/rich/', { params: filter })
  return res.data
}

async function getNotificationReal(id: string): Promise<RichNotification | null> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<RichNotification>(`/notifications/${id}/`)
  return res.data
}

async function markAsReadReal(id: string): Promise<RichNotification> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<RichNotification>(`/notifications/${id}/read/`)
  return res.data
}

async function markAllAsReadReal(filter: NotificationFilter = {}): Promise<number> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<{ count: number }>('/notifications/read-all/', filter)
  return res.data.count
}

async function deleteNotificationReal(id: string): Promise<void> {
  const { default: api } = await import('@/services/axios.instance')
  await api.delete(`/notifications/${id}/`)
}

async function archiveNotificationReal(id: string): Promise<RichNotification> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<RichNotification>(`/notifications/${id}/archive/`)
  return res.data
}

async function getStatisticsReal(filter: NotificationFilter): Promise<NotificationStatistics> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<NotificationStatistics>('/notifications/statistics/', { params: filter })
  return res.data
}

async function getUnreadCountReal(filter: NotificationFilter = {}): Promise<number> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<{ count: number }>('/notifications/unread-count/', { params: filter })
  return res.data.count
}

async function createNotificationReal(
  auditAction: AuditAction,
  actor: NotificationActor,
  targetName: string,
  targetId: string,
  scope: NotificationScope,
  data?: Record<string, unknown>,
): Promise<RichNotification> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<RichNotification>('/notifications/', {
    auditAction, actor, targetName, targetId, scope, data,
  })
  return res.data
}

async function getSummaryReal(scope?: Partial<NotificationScope>): Promise<NotificationSummary> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<NotificationSummary>('/notifications/summary/', { params: scope })
  return res.data
}

// ── Public service interface ───────────────────────────────────────────────────

export const notificationRichService = {
  getNotifications: USE_MOCK ? getNotificationsMock : getNotificationsReal,
  getNotification: USE_MOCK ? getNotificationMock : getNotificationReal,
  markAsRead: USE_MOCK ? markAsReadMock : markAsReadReal,
  markAllAsRead: USE_MOCK ? markAllAsReadMock : markAllAsReadReal,
  deleteNotification: USE_MOCK ? deleteNotificationMock : deleteNotificationReal,
  archiveNotification: USE_MOCK ? archiveNotificationMock : archiveNotificationReal,
  getNotificationStatistics: USE_MOCK ? getStatisticsMock : getStatisticsReal,
  getUnreadCount: USE_MOCK ? getUnreadCountMock : getUnreadCountReal,
  createNotification: USE_MOCK ? createNotificationMock : createNotificationReal,
  getSummary: USE_MOCK ? getSummaryMock : getSummaryReal,

  /** Fire-and-forget notification creation — failures never disrupt primary operations. */
  notify(
    auditAction: AuditAction,
    actor: NotificationActor,
    targetName: string,
    targetId: string,
    scope: NotificationScope,
    data?: Record<string, unknown>,
  ): void {
    const fn = USE_MOCK ? createNotificationMock : createNotificationReal
    fn(auditAction, actor, targetName, targetId, scope, data).catch(() => {})
  },

  _resetMock(): void {
    _mockStore = [...MOCK_NOTIFICATIONS]
  },
  _getMockCount(): number {
    return _mockStore.length
  },
  _applyFilter: applyNotificationFilter,
  _buildStatistics: buildNotificationStatistics,
  _buildSummary: buildNotificationSummary,
}
