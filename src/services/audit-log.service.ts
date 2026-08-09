// ============================================================
// P7.5 — Audit Log Service
// Mock-first implementation following the USE_MOCK pattern.
// ============================================================

import { getAuditEventMeta } from '@/services/audit-event-registry'
import type {
  AuditLog,
  AuditAction,
  AuditActor,
  AuditTarget,
  AuditScope,
  AuditMetadata,
  AuditChangeSet,
  AuditFilter,
  AuditExportRequest,
  AuditStatistics,
  AuditTimelineItem,
  PaginatedAuditLogs,
} from '@/types/audit-log'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Mock data ─────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-samoon-01'
const TENANT_B = 'tenant-brew-cafe-01'
const BRANCH_1 = 'branch-rest-01'
const BRANCH_2 = 'branch-rest-02'

const MOCK_LOGS: AuditLog[] = [
  {
    id: 'audit-001',
    action: 'STAFF_CREATED',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', email: 'owner@samoon.com', roles: ['owner'] },
    target: { type: 'staff', id: 'staff-waiter-01', displayName: 'Will Waiter' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    severity: 'info',
    changeset: { before: null, after: { roles: ['waiter'] }, changedFields: ['roles'] },
    metadata: { correlationId: 'corr-001', ipAddress: '10.0.0.1' },
    timestamp: '2026-06-20T09:00:00Z',
    description: 'A new staff member was invited',
  },
  {
    id: 'audit-002',
    action: 'STAFF_SUSPENDED',
    actor: { id: 'user-admin-01', name: 'Alex Admin', email: 'admin@samoon.com', roles: ['admin'] },
    target: { type: 'staff', id: 'staff-cashier-01', displayName: 'Casey Cashier' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    severity: 'warning',
    changeset: { before: { status: 'active' }, after: { status: 'suspended' }, changedFields: ['status'] },
    metadata: { correlationId: 'corr-002', ipAddress: '10.0.0.2' },
    timestamp: '2026-06-20T10:30:00Z',
    description: 'A staff member was suspended',
  },
  {
    id: 'audit-003',
    action: 'BRANCH_CREATED',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', email: 'owner@samoon.com', roles: ['owner'] },
    target: { type: 'branch', id: BRANCH_2, displayName: 'Downtown Branch' },
    scope: { tenantId: TENANT_A },
    severity: 'info',
    changeset: { before: null, after: { name: 'Downtown Branch', status: 'active' }, changedFields: ['name', 'status'] },
    metadata: { correlationId: 'corr-003' },
    timestamp: '2026-06-20T11:00:00Z',
    description: 'A new branch was created',
  },
  {
    id: 'audit-004',
    action: 'ORDER_STATUS_CHANGED',
    actor: { id: 'user-kitchen-01', name: 'Kai Kitchen', email: 'kitchen@samoon.com', roles: ['kitchen'] },
    target: { type: 'order', id: 'order-001', displayName: 'Order #0001' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    severity: 'info',
    changeset: { before: { status: 'accepted' }, after: { status: 'preparing' }, changedFields: ['status'] },
    metadata: { correlationId: 'corr-004' },
    timestamp: '2026-06-21T08:15:00Z',
    description: 'An order status was updated',
  },
  {
    id: 'audit-005',
    action: 'OWNERSHIP_TRANSFERRED',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', email: 'owner@samoon.com', roles: ['owner'] },
    target: { type: 'staff', id: 'user-admin-01', displayName: 'Alex Admin' },
    scope: { tenantId: TENANT_A },
    severity: 'critical',
    changeset: { before: { ownerId: 'user-owner-01' }, after: { ownerId: 'user-admin-01' }, changedFields: ['ownerId'] },
    metadata: { correlationId: 'corr-005', ipAddress: '10.0.0.1' },
    timestamp: '2026-06-21T09:00:00Z',
    description: 'Tenant ownership was transferred to another user',
  },
  {
    id: 'audit-006',
    action: 'PROMOTION_CREATED',
    actor: { id: 'user-manager-01', name: 'Maria Manager', email: 'manager@samoon.com', roles: ['manager'] },
    target: { type: 'promotion', id: 'promo-001', displayName: 'Summer Sale 20%' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    severity: 'info',
    changeset: { before: null, after: { name: 'Summer Sale 20%', type: 'percentage_discount' }, changedFields: ['name', 'type'] },
    metadata: { correlationId: 'corr-006' },
    timestamp: '2026-06-21T10:00:00Z',
    description: 'A new promotion was created',
  },
  {
    id: 'audit-007',
    action: 'TENANT_SUSPENDED',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', email: 'owner@samoon.com', roles: ['owner'] },
    target: { type: 'tenant', id: TENANT_B, displayName: 'Brew Cafe' },
    scope: { tenantId: TENANT_B },
    severity: 'critical',
    changeset: { before: { status: 'active' }, after: { status: 'suspended' }, changedFields: ['status'] },
    metadata: { correlationId: 'corr-007', ipAddress: '10.0.0.1' },
    timestamp: '2026-06-21T14:00:00Z',
    description: 'A tenant was suspended',
  },
  {
    id: 'audit-008',
    action: 'VENDOR_CREATED',
    actor: { id: 'user-manager-01', name: 'Maria Manager', email: 'manager@samoon.com', roles: ['manager'] },
    target: { type: 'vendor', id: 'vendor-001', displayName: 'Spicy Noodles' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    severity: 'info',
    changeset: { before: null, after: { name: 'Spicy Noodles', category: 'noodles' }, changedFields: ['name', 'category'] },
    metadata: { correlationId: 'corr-008' },
    timestamp: '2026-06-22T07:00:00Z',
    description: 'A new vendor was created',
  },
  {
    id: 'audit-009',
    action: 'MENU_ITEM_DELETED',
    actor: { id: 'user-manager-01', name: 'Maria Manager', email: 'manager@samoon.com', roles: ['manager'] },
    target: { type: 'menu_item', id: 'item-005', displayName: 'Stale Soup' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    severity: 'warning',
    changeset: { before: { name: 'Stale Soup', price: 8.99 }, after: null, changedFields: [] },
    metadata: { correlationId: 'corr-009' },
    timestamp: '2026-06-22T08:30:00Z',
    description: 'A menu item was deleted',
  },
  {
    id: 'audit-010',
    action: 'RESERVATION_CANCELLED',
    actor: { id: 'user-waiter-01', name: 'Will Waiter', email: 'waiter@samoon.com', roles: ['waiter'] },
    target: { type: 'reservation', id: 'res-001', displayName: 'Reservation for Smith (4)' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_2 },
    severity: 'warning',
    changeset: { before: { status: 'confirmed' }, after: { status: 'cancelled' }, changedFields: ['status'] },
    metadata: { correlationId: 'corr-010' },
    timestamp: '2026-06-22T09:15:00Z',
    description: 'A reservation was cancelled',
  },
  {
    id: 'audit-011',
    action: 'BRANCH_DEACTIVATED',
    actor: { id: 'user-owner-01', name: 'Olivia Owner', email: 'owner@samoon.com', roles: ['owner'] },
    target: { type: 'branch', id: BRANCH_2, displayName: 'Downtown Branch' },
    scope: { tenantId: TENANT_A },
    severity: 'warning',
    changeset: { before: { status: 'active' }, after: { status: 'inactive' }, changedFields: ['status'] },
    metadata: { correlationId: 'corr-011', ipAddress: '10.0.0.1' },
    timestamp: '2026-06-22T10:00:00Z',
    description: 'A branch was deactivated',
  },
  {
    id: 'audit-012',
    action: 'PAYMENT_REFUNDED',
    actor: { id: 'user-admin-01', name: 'Alex Admin', email: 'admin@samoon.com', roles: ['admin'] },
    target: { type: 'payment', id: 'pay-001', displayName: 'Payment #PAY-0001' },
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    severity: 'critical',
    changeset: { before: { status: 'captured' }, after: { status: 'refunded', refundAmount: 45.00 }, changedFields: ['status', 'refundAmount'] },
    metadata: { correlationId: 'corr-012', ipAddress: '10.0.0.2' },
    timestamp: '2026-06-22T11:30:00Z',
    description: 'A payment was refunded',
  },
]

let _mockStore: AuditLog[] = [...MOCK_LOGS]

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function applyFilter(logs: AuditLog[], filter: AuditFilter): AuditLog[] {
  let result = [...logs]

  if (filter.tenantId) {
    result = result.filter((l) => l.scope.tenantId === filter.tenantId)
  }
  if (filter.branchId) {
    result = result.filter((l) => l.scope.branchId === filter.branchId)
  }
  if (filter.actorId) {
    result = result.filter((l) => l.actor.id === filter.actorId)
  }
  if (filter.targetType) {
    result = result.filter((l) => l.target.type === filter.targetType)
  }
  if (filter.action) {
    result = result.filter((l) => l.action === filter.action)
  }
  if (filter.severity) {
    result = result.filter((l) => l.severity === filter.severity)
  }
  if (filter.dateFrom) {
    result = result.filter((l) => l.timestamp >= filter.dateFrom!)
  }
  if (filter.dateTo) {
    result = result.filter((l) => l.timestamp <= filter.dateTo!)
  }
  if (filter.search) {
    const q = filter.search.toLowerCase()
    result = result.filter(
      (l) =>
        l.actor.name.toLowerCase().includes(q) ||
        l.target.displayName.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q),
    )
  }

  // Sort
  const sortBy = filter.sortBy ?? 'timestamp'
  const sortOrder = filter.sortOrder ?? 'desc'
  result.sort((a, b) => {
    const av = a[sortBy as keyof AuditLog] as string
    const bv = b[sortBy as keyof AuditLog] as string
    return sortOrder === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
  })

  return result
}

function paginate(logs: AuditLog[], page: number, pageSize: number): PaginatedAuditLogs {
  const total = logs.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const offset = (page - 1) * pageSize
  return {
    results: logs.slice(offset, offset + pageSize),
    count: total,
    page,
    pageSize,
    totalPages,
  }
}

function buildTimeline(logs: AuditLog[]): AuditTimelineItem[] {
  const grouped: Record<string, AuditLog[]> = {}
  for (const log of logs) {
    const date = log.timestamp.split('T')[0]!
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(log)
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, events]) => ({ date, events }))
}

function buildStatistics(logs: AuditLog[], filter: AuditFilter): AuditStatistics {
  const eventsPerDay: Record<string, number> = {}
  const eventsPerActor: Record<string, number> = {}
  const eventsPerBranch: Record<string, number> = {}
  const eventsPerDomain: Record<string, number> = {}
  const actionCount: Record<string, number> = {}
  let critical = 0
  let warning = 0
  let info = 0

  for (const log of logs) {
    const day = log.timestamp.split('T')[0]!
    eventsPerDay[day] = (eventsPerDay[day] ?? 0) + 1
    eventsPerActor[log.actor.name] = (eventsPerActor[log.actor.name] ?? 0) + 1
    const branch = log.scope.branchId ?? 'no-branch'
    eventsPerBranch[branch] = (eventsPerBranch[branch] ?? 0) + 1
    const domain = getAuditEventMeta(log.action).domain
    eventsPerDomain[domain] = (eventsPerDomain[domain] ?? 0) + 1
    actionCount[log.action] = (actionCount[log.action] ?? 0) + 1
    if (log.severity === 'critical') critical++
    else if (log.severity === 'warning') warning++
    else info++
  }

  const topActions = Object.entries(actionCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([action, count]) => ({ action: action as AuditAction, count }))

  const timestamps = logs.map((l) => l.timestamp).sort()
  const dateFrom = filter.dateFrom ?? timestamps[0] ?? new Date().toISOString()
  const dateTo = filter.dateTo ?? timestamps[timestamps.length - 1] ?? new Date().toISOString()

  return {
    totalEvents: logs.length,
    eventsPerDay,
    eventsPerActor,
    eventsPerBranch,
    eventsPerDomain,
    criticalEvents: critical,
    warningEvents: warning,
    infoEvents: info,
    topActions,
    dateFrom,
    dateTo,
  }
}

function buildCsvRow(log: AuditLog, includeChangeset: boolean): string {
  const base = [
    log.id,
    log.timestamp,
    log.action,
    log.severity,
    log.actor.name,
    log.actor.roles.join(';'),
    log.target.type,
    log.target.displayName,
    log.scope.tenantId,
    log.scope.branchId ?? '',
    log.description,
  ]
  if (includeChangeset) {
    base.push(JSON.stringify(log.changeset.before ?? {}))
    base.push(JSON.stringify(log.changeset.after ?? {}))
  }
  return base.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
}

function buildCsvExport(logs: AuditLog[], includeChangeset: boolean): string {
  const headers = [
    'ID', 'Timestamp', 'Action', 'Severity', 'Actor Name', 'Actor Roles',
    'Target Type', 'Target Name', 'Tenant ID', 'Branch ID', 'Description',
  ]
  if (includeChangeset) {
    headers.push('Before', 'After')
  }
  const rows = [headers.join(','), ...logs.map((l) => buildCsvRow(l, includeChangeset))]
  return rows.join('\n')
}

// ── Service implementation ────────────────────────────────────────────────────

async function getAuditLogsMock(filter: AuditFilter): Promise<PaginatedAuditLogs> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20
  const filtered = applyFilter(_mockStore, filter)
  return paginate(filtered, page, pageSize)
}

async function getAuditLogMock(id: string, tenantId: string): Promise<AuditLog | null> {
  const log = _mockStore.find((l) => l.id === id) ?? null
  if (!log || log.scope.tenantId !== tenantId) return null
  return log
}

async function createAuditLogMock(
  action: AuditAction,
  actor: AuditActor,
  target: AuditTarget,
  scope: AuditScope,
  changeset: AuditChangeSet,
  metadata: AuditMetadata,
): Promise<AuditLog> {
  const meta = getAuditEventMeta(action)
  const log: AuditLog = {
    id: generateId(),
    action,
    actor,
    target,
    scope,
    severity: meta.severity,
    changeset,
    metadata,
    timestamp: new Date().toISOString(),
    description: meta.description,
  }
  _mockStore.unshift(log)
  return log
}

async function getAuditTimelineMock(filter: AuditFilter): Promise<AuditTimelineItem[]> {
  const filtered = applyFilter(_mockStore, filter)
  return buildTimeline(filtered)
}

async function exportAuditLogsMock(request: AuditExportRequest): Promise<string> {
  const filtered = applyFilter(_mockStore, request.filter)
  return buildCsvExport(filtered, request.includeChangeset)
}

async function searchAuditLogsMock(query: string, filter: AuditFilter): Promise<PaginatedAuditLogs> {
  return getAuditLogsMock({ ...filter, search: query })
}

async function getAuditStatisticsMock(filter: AuditFilter): Promise<AuditStatistics> {
  const filtered = applyFilter(_mockStore, filter)
  return buildStatistics(filtered, filter)
}

// ── Real API stubs (wired to backend when deployed) ───────────────────────────

async function getAuditLogsReal(filter: AuditFilter): Promise<PaginatedAuditLogs> {
  const { default: api } = await import('@/services/axios.instance')
  const params: Record<string, unknown> = { ...filter }
  const res = await api.get<PaginatedAuditLogs>('/audit-logs/', { params })
  return res.data
}

async function getAuditLogReal(id: string, tenantId: string): Promise<AuditLog | null> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<AuditLog>(`/audit-logs/${id}/`, { params: { tenantId } })
  return res.data
}

async function createAuditLogReal(
  action: AuditAction,
  actor: AuditActor,
  target: AuditTarget,
  scope: AuditScope,
  changeset: AuditChangeSet,
  metadata: AuditMetadata,
): Promise<AuditLog> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<AuditLog>('/audit-logs/', { action, actor, target, scope, changeset, metadata })
  return res.data
}

async function getAuditTimelineReal(filter: AuditFilter): Promise<AuditTimelineItem[]> {
  const { default: api } = await import('@/services/axios.instance')
  const params: Record<string, unknown> = { ...filter }
  const res = await api.get<AuditTimelineItem[]>('/audit-logs/timeline/', { params })
  return res.data
}

async function exportAuditLogsReal(request: AuditExportRequest): Promise<string> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<string>('/audit-logs/export/', request)
  return res.data
}

async function searchAuditLogsReal(query: string, filter: AuditFilter): Promise<PaginatedAuditLogs> {
  return getAuditLogsReal({ ...filter, search: query })
}

async function getAuditStatisticsReal(filter: AuditFilter): Promise<AuditStatistics> {
  const { default: api } = await import('@/services/axios.instance')
  const params: Record<string, unknown> = { ...filter }
  const res = await api.get<AuditStatistics>('/audit-logs/statistics/', { params })
  return res.data
}

// ── Public service object ─────────────────────────────────────────────────────

export const auditLogService = {
  getAuditLogs: USE_MOCK ? getAuditLogsMock : getAuditLogsReal,
  getAuditLog: USE_MOCK ? getAuditLogMock : getAuditLogReal,
  createAuditLog: USE_MOCK ? createAuditLogMock : createAuditLogReal,
  getAuditTimeline: USE_MOCK ? getAuditTimelineMock : getAuditTimelineReal,
  exportAuditLogs: USE_MOCK ? exportAuditLogsMock : exportAuditLogsReal,
  searchAuditLogs: USE_MOCK ? searchAuditLogsMock : searchAuditLogsReal,
  getAuditStatistics: USE_MOCK ? getAuditStatisticsMock : getAuditStatisticsReal,

  /** Fire-and-forget audit record — failures do not propagate to callers. */
  record(
    action: AuditAction,
    actor: AuditActor,
    target: AuditTarget,
    scope: AuditScope,
    changeset: AuditChangeSet = { before: null, after: null },
    metadata: AuditMetadata = {},
  ): void {
    const fn = USE_MOCK ? createAuditLogMock : createAuditLogReal
    fn(action, actor, target, scope, changeset, metadata).catch(() => {
      // Audit failures must never disrupt the primary operation
    })
  },

  /** Test helper — resets the mock store to initial state. */
  _resetMock(): void {
    _mockStore = [...MOCK_LOGS]
  },

  /** Test helper — returns the current mock store length. */
  _getMockCount(): number {
    return _mockStore.length
  },

  /** Exposed for testing filter logic directly. */
  _applyFilter: applyFilter,
  _buildTimeline: buildTimeline,
  _buildStatistics: buildStatistics,
  _buildCsvExport: buildCsvExport,
}
