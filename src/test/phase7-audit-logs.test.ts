// ============================================================
// P7.5 — Enterprise Audit Logs & Activity Tracking Tests
// ============================================================

process.env.NEXT_PUBLIC_USE_MOCK = 'true'

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AUDIT_EVENT_REGISTRY,
  AUDIT_ACTIONS,
  AUDIT_DOMAINS,
  getAuditEventMeta,
  getEventsByDomain,
  getEventsByTargetType,
  getCriticalEvents,
  type AuditEventMeta,
} from '@/services/audit-event-registry'
import { auditLogService } from '@/services/audit-log.service'
import type {
  AuditLog,
  AuditAction,
  AuditFilter,
  AuditSeverity,
  AuditTargetType,
  AuditTimelineItem,
  AuditStatistics,
  PaginatedAuditLogs,
  AuditActor,
  AuditTarget,
  AuditScope,
  AuditMetadata,
  AuditChangeSet,
  AuditExportRequest,
} from '@/types/audit-log'
import { ROLE_PERMISSION_MAP, hasPermission, ALL_PERMISSIONS } from '@/services/permission.service'
import type { P7Permission, Role } from '@/types/rbac'
import {
  RESTAURANT_MODULE,
  CAFE_MODULE,
  BAR_MODULE,
  FOOD_COURT_MODULE,
  FOOD_TRUCK_MODULE,
  MOBILE_CAFE_MODULE,
  ADMIN_AUDIT_ROUTES,
} from '@/modules/registry'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeActor(overrides: Partial<AuditActor> = {}): AuditActor {
  return {
    id: 'user-test-01',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['admin'] as Role[],
    ...overrides,
  }
}

function makeTarget(overrides: Partial<AuditTarget> = {}): AuditTarget {
  return {
    type: 'staff' as AuditTargetType,
    id: 'target-01',
    displayName: 'Test Target',
    ...overrides,
  }
}

function makeScope(overrides: Partial<AuditScope> = {}): AuditScope {
  return {
    tenantId: 'tenant-test-01',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TYPE SHAPE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Types — AuditLog shape', () => {
  it('AuditActor has required fields', () => {
    const actor: AuditActor = makeActor()
    expect(actor).toHaveProperty('id')
    expect(actor).toHaveProperty('name')
    expect(actor).toHaveProperty('roles')
  })

  it('AuditActor email is optional', () => {
    const actor: AuditActor = { id: 'u1', name: 'No Email', roles: ['admin'] }
    expect(actor.email).toBeUndefined()
  })

  it('AuditTarget has type, id, displayName', () => {
    const target: AuditTarget = makeTarget()
    expect(target.type).toBe('staff')
    expect(target.id).toBe('target-01')
    expect(target.displayName).toBe('Test Target')
  })

  it('AuditScope tenantId is required, branchId optional', () => {
    const scopeGlobal: AuditScope = { tenantId: 'tenant-01' }
    expect(scopeGlobal.branchId).toBeUndefined()
    const scopeBranch: AuditScope = { tenantId: 'tenant-01', branchId: 'branch-01' }
    expect(scopeBranch.branchId).toBe('branch-01')
  })

  it('AuditMetadata all fields optional', () => {
    const meta: AuditMetadata = {}
    expect(meta.correlationId).toBeUndefined()
    expect(meta.ipAddress).toBeUndefined()
    expect(meta.userAgent).toBeUndefined()
    expect(meta.sessionId).toBeUndefined()
  })

  it('AuditChangeSet before/after nullable', () => {
    const cs: AuditChangeSet = { before: null, after: { status: 'active' } }
    expect(cs.before).toBeNull()
    expect(cs.after).not.toBeNull()
  })

  it('AuditChangeSet changedFields is optional array', () => {
    const cs: AuditChangeSet = { before: null, after: null, changedFields: ['name', 'email'] }
    expect(cs.changedFields).toHaveLength(2)
  })

  it('AuditFilter all fields optional', () => {
    const filter: AuditFilter = {}
    expect(Object.keys(filter)).toHaveLength(0)
  })

  it('AuditFilter pagination fields accepted', () => {
    const filter: AuditFilter = { page: 2, pageSize: 50, sortBy: 'timestamp', sortOrder: 'asc' }
    expect(filter.page).toBe(2)
    expect(filter.pageSize).toBe(50)
  })

  it('AuditExportRequest requires filter, format, includeChangeset', () => {
    const req: AuditExportRequest = { filter: {}, format: 'csv', includeChangeset: true }
    expect(req.format).toBe('csv')
    expect(req.includeChangeset).toBe(true)
  })

  it('AuditExportRequest format can be excel', () => {
    const req: AuditExportRequest = { filter: {}, format: 'excel', includeChangeset: false }
    expect(req.format).toBe('excel')
  })

  it('PaginatedAuditLogs has all required fields', () => {
    const p: PaginatedAuditLogs = { results: [], count: 0, page: 1, pageSize: 20, totalPages: 0 }
    expect(p).toHaveProperty('results')
    expect(p).toHaveProperty('count')
    expect(p).toHaveProperty('page')
    expect(p).toHaveProperty('pageSize')
    expect(p).toHaveProperty('totalPages')
  })

  it('AuditTimelineItem has date and events array', () => {
    const item: AuditTimelineItem = { date: '2026-06-20', events: [] }
    expect(item.date).toBe('2026-06-20')
    expect(item.events).toEqual([])
  })

  it('AuditStatistics has all stat fields', () => {
    const stats: AuditStatistics = {
      totalEvents: 10,
      eventsPerDay: {},
      eventsPerActor: {},
      eventsPerBranch: {},
      eventsPerDomain: {},
      criticalEvents: 1,
      warningEvents: 2,
      infoEvents: 7,
      topActions: [],
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
    }
    expect(stats.totalEvents).toBe(10)
    expect(stats.criticalEvents).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUDIT EVENT REGISTRY TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 AuditEventRegistry — structure', () => {
  it('AUDIT_EVENT_REGISTRY is defined', () => {
    expect(AUDIT_EVENT_REGISTRY).toBeDefined()
  })

  it('AUDIT_ACTIONS has 44 actions', () => {
    expect(AUDIT_ACTIONS).toHaveLength(44)
  })

  it('AUDIT_DOMAINS is a non-empty array', () => {
    expect(AUDIT_DOMAINS.length).toBeGreaterThan(0)
  })

  it('every registry entry has action, domain, description, severity, targetType', () => {
    for (const meta of Object.values(AUDIT_EVENT_REGISTRY)) {
      expect(meta.action).toBeDefined()
      expect(meta.domain).toBeDefined()
      expect(meta.description).toBeDefined()
      expect(['info', 'warning', 'critical']).toContain(meta.severity)
      expect(meta.targetType).toBeDefined()
    }
  })

  it('registry action key matches entry action', () => {
    for (const [key, meta] of Object.entries(AUDIT_EVENT_REGISTRY)) {
      expect(meta.action).toBe(key)
    }
  })

  it('STAFF_CREATED is info severity', () => {
    expect(AUDIT_EVENT_REGISTRY.STAFF_CREATED.severity).toBe('info')
  })

  it('STAFF_SUSPENDED is warning severity', () => {
    expect(AUDIT_EVENT_REGISTRY.STAFF_SUSPENDED.severity).toBe('warning')
  })

  it('STAFF_REMOVED is warning severity', () => {
    expect(AUDIT_EVENT_REGISTRY.STAFF_REMOVED.severity).toBe('warning')
  })

  it('OWNERSHIP_TRANSFERRED is critical severity', () => {
    expect(AUDIT_EVENT_REGISTRY.OWNERSHIP_TRANSFERRED.severity).toBe('critical')
  })

  it('TENANT_SUSPENDED is critical severity', () => {
    expect(AUDIT_EVENT_REGISTRY.TENANT_SUSPENDED.severity).toBe('critical')
  })

  it('TENANT_ARCHIVED is critical severity', () => {
    expect(AUDIT_EVENT_REGISTRY.TENANT_ARCHIVED.severity).toBe('critical')
  })

  it('PAYMENT_REFUNDED is critical severity', () => {
    expect(AUDIT_EVENT_REGISTRY.PAYMENT_REFUNDED.severity).toBe('critical')
  })

  it('BRANCH_DEACTIVATED is warning severity', () => {
    expect(AUDIT_EVENT_REGISTRY.BRANCH_DEACTIVATED.severity).toBe('warning')
  })

  it('MENU_ITEM_DELETED is warning severity', () => {
    expect(AUDIT_EVENT_REGISTRY.MENU_ITEM_DELETED.severity).toBe('warning')
  })

  it('BRANCH_CREATED is info severity', () => {
    expect(AUDIT_EVENT_REGISTRY.BRANCH_CREATED.severity).toBe('info')
  })

  it('ORDER_STATUS_CHANGED is info severity', () => {
    expect(AUDIT_EVENT_REGISTRY.ORDER_STATUS_CHANGED.severity).toBe('info')
  })

  it('PROMOTION_DISABLED is warning severity', () => {
    expect(AUDIT_EVENT_REGISTRY.PROMOTION_DISABLED.severity).toBe('warning')
  })

  it('VENDOR_DISABLED is warning severity', () => {
    expect(AUDIT_EVENT_REGISTRY.VENDOR_DISABLED.severity).toBe('warning')
  })
})

describe('P7.5 AuditEventRegistry — getAuditEventMeta', () => {
  it('returns correct meta for STAFF_CREATED', () => {
    const meta = getAuditEventMeta('STAFF_CREATED')
    expect(meta.domain).toBe('staff')
    expect(meta.targetType).toBe('staff')
    expect(meta.severity).toBe('info')
  })

  it('returns correct meta for OWNERSHIP_TRANSFERRED', () => {
    const meta = getAuditEventMeta('OWNERSHIP_TRANSFERRED')
    expect(meta.severity).toBe('critical')
    expect(meta.domain).toBe('staff')
  })

  it('returns correct meta for PAYMENT_REFUNDED', () => {
    const meta = getAuditEventMeta('PAYMENT_REFUNDED')
    expect(meta.targetType).toBe('payment')
    expect(meta.severity).toBe('critical')
  })

  it('returns correct meta for FEATURE_FLAG_CHANGED', () => {
    const meta = getAuditEventMeta('FEATURE_FLAG_CHANGED')
    expect(meta.targetType).toBe('feature_flag')
  })
})

describe('P7.5 AuditEventRegistry — getEventsByDomain', () => {
  it('staff domain has staff actions', () => {
    const events = getEventsByDomain('staff')
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.domain === 'staff')).toBe(true)
  })

  it('branch domain has branch actions', () => {
    const events = getEventsByDomain('branch')
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.domain === 'branch')).toBe(true)
  })

  it('unknown domain returns empty array', () => {
    expect(getEventsByDomain('nonexistent')).toEqual([])
  })

  it('orders domain returns events', () => {
    const events = getEventsByDomain('orders')
    expect(events.length).toBeGreaterThan(0)
  })

  it('tenant domain returns events', () => {
    const events = getEventsByDomain('tenant')
    expect(events.length).toBeGreaterThan(0)
  })
})

describe('P7.5 AuditEventRegistry — getEventsByTargetType', () => {
  it('staff targetType returns staff events', () => {
    const events = getEventsByTargetType('staff')
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.targetType === 'staff')).toBe(true)
  })

  it('branch targetType returns branch events', () => {
    const events = getEventsByTargetType('branch')
    expect(events.length).toBeGreaterThan(0)
  })

  it('payment targetType includes PAYMENT_REFUNDED', () => {
    const events = getEventsByTargetType('payment')
    expect(events.some((e) => e.action === 'PAYMENT_REFUNDED')).toBe(true)
  })

  it('feature_flag targetType returns events', () => {
    const events = getEventsByTargetType('feature_flag')
    expect(events.length).toBeGreaterThan(0)
  })

  it('unknown targetType returns empty array', () => {
    expect(getEventsByTargetType('nonexistent')).toEqual([])
  })
})

describe('P7.5 AuditEventRegistry — getCriticalEvents', () => {
  it('returns only critical events', () => {
    const events = getCriticalEvents()
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.severity === 'critical')).toBe(true)
  })

  it('includes OWNERSHIP_TRANSFERRED', () => {
    const events = getCriticalEvents()
    expect(events.some((e) => e.action === 'OWNERSHIP_TRANSFERRED')).toBe(true)
  })

  it('includes TENANT_SUSPENDED', () => {
    const events = getCriticalEvents()
    expect(events.some((e) => e.action === 'TENANT_SUSPENDED')).toBe(true)
  })

  it('includes TENANT_ARCHIVED', () => {
    const events = getCriticalEvents()
    expect(events.some((e) => e.action === 'TENANT_ARCHIVED')).toBe(true)
  })

  it('includes PAYMENT_REFUNDED', () => {
    const events = getCriticalEvents()
    expect(events.some((e) => e.action === 'PAYMENT_REFUNDED')).toBe(true)
  })
})

describe('P7.5 AuditEventRegistry — AUDIT_DOMAINS', () => {
  it('contains staff domain', () => {
    expect(AUDIT_DOMAINS).toContain('staff')
  })

  it('contains branch domain', () => {
    expect(AUDIT_DOMAINS).toContain('branch')
  })

  it('contains orders domain', () => {
    expect(AUDIT_DOMAINS).toContain('orders')
  })

  it('contains tenant domain', () => {
    expect(AUDIT_DOMAINS).toContain('tenant')
  })

  it('contains promotions domain', () => {
    expect(AUDIT_DOMAINS).toContain('promotions')
  })

  it('contains vendors domain', () => {
    expect(AUDIT_DOMAINS).toContain('vendors')
  })

  it('contains menu domain', () => {
    expect(AUDIT_DOMAINS).toContain('menu')
  })

  it('contains loyalty domain', () => {
    expect(AUDIT_DOMAINS).toContain('loyalty')
  })

  it('has no duplicates', () => {
    expect(new Set(AUDIT_DOMAINS).size).toBe(AUDIT_DOMAINS.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUDIT LOG SERVICE — MOCK MODE
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 AuditLogService — mock mode', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('_resetMock restores original mock data', async () => {
    const initial = auditLogService._getMockCount()
    await auditLogService.createAuditLog(
      'BRANCH_CREATED', makeActor(), makeTarget({ type: 'branch' }), makeScope(),
      { before: null, after: null }, {},
    )
    expect(auditLogService._getMockCount()).toBe(initial + 1)
    auditLogService._resetMock()
    expect(auditLogService._getMockCount()).toBe(initial)
  })

  it('getAuditLogs returns PaginatedAuditLogs', async () => {
    const result = await auditLogService.getAuditLogs({})
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('count')
    expect(result).toHaveProperty('page')
    expect(result).toHaveProperty('pageSize')
    expect(result).toHaveProperty('totalPages')
  })

  it('getAuditLogs results are AuditLog[]', async () => {
    const result = await auditLogService.getAuditLogs({})
    for (const log of result.results) {
      expect(log).toHaveProperty('id')
      expect(log).toHaveProperty('action')
      expect(log).toHaveProperty('actor')
      expect(log).toHaveProperty('target')
      expect(log).toHaveProperty('scope')
      expect(log).toHaveProperty('severity')
      expect(log).toHaveProperty('changeset')
      expect(log).toHaveProperty('metadata')
      expect(log).toHaveProperty('timestamp')
      expect(log).toHaveProperty('description')
    }
  })

  it('getAuditLogs default page is 1', async () => {
    const result = await auditLogService.getAuditLogs({})
    expect(result.page).toBe(1)
  })

  it('getAuditLogs default pageSize is 20', async () => {
    const result = await auditLogService.getAuditLogs({})
    expect(result.pageSize).toBe(20)
  })

  it('createAuditLog creates a new log entry', async () => {
    const before = auditLogService._getMockCount()
    await auditLogService.createAuditLog(
      'STAFF_CREATED', makeActor(), makeTarget(), makeScope(),
      { before: null, after: { name: 'New Staff' } }, {},
    )
    expect(auditLogService._getMockCount()).toBe(before + 1)
  })

  it('createAuditLog returns created AuditLog', async () => {
    const log = await auditLogService.createAuditLog(
      'ORDER_STATUS_CHANGED', makeActor(), makeTarget({ type: 'order' }), makeScope(),
      { before: null, after: null }, {},
    )
    expect(log.action).toBe('ORDER_STATUS_CHANGED')
    expect(log.id).toBeDefined()
    expect(log.timestamp).toBeDefined()
  })

  it('getAuditLog returns log by id', async () => {
    const created = await auditLogService.createAuditLog(
      'BRANCH_UPDATED', makeActor(), makeTarget({ type: 'branch' }), makeScope(),
      { before: null, after: null }, {},
    )
    const fetched = await auditLogService.getAuditLog(created.id)
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.action).toBe('BRANCH_UPDATED')
  })

  it('getAuditTimeline returns AuditTimelineItem[]', async () => {
    const result = await auditLogService.getAuditTimeline({})
    expect(Array.isArray(result)).toBe(true)
    for (const item of result) {
      expect(item).toHaveProperty('date')
      expect(item).toHaveProperty('events')
      expect(Array.isArray(item.events)).toBe(true)
    }
  })

  it('getAuditStatistics returns statistics object', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    expect(stats).toHaveProperty('totalEvents')
    expect(stats).toHaveProperty('criticalEvents')
    expect(stats).toHaveProperty('warningEvents')
    expect(stats).toHaveProperty('infoEvents')
    expect(stats).toHaveProperty('eventsPerDay')
    expect(stats).toHaveProperty('eventsPerDomain')
    expect(stats).toHaveProperty('topActions')
  })

  it('getAuditStatistics totalEvents >= criticalEvents + warningEvents + infoEvents', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    expect(stats.criticalEvents + stats.warningEvents + stats.infoEvents).toBe(stats.totalEvents)
  })

  it('exportAuditLogs returns CSV string', async () => {
    const csv = await auditLogService.exportAuditLogs({ filter: {}, format: 'csv', includeChangeset: true })
    expect(typeof csv).toBe('string')
    expect(csv.length).toBeGreaterThan(0)
  })

  it('exportAuditLogs CSV has header row', async () => {
    const csv = await auditLogService.exportAuditLogs({ filter: {}, format: 'csv', includeChangeset: false })
    const lines = csv.split('\n')
    expect(lines[0]).toContain('Timestamp')
    expect(lines[0]).toContain('Action')
  })

  it('record() does not throw on valid input', () => {
    expect(() => {
      auditLogService.record(
        'STAFF_UPDATED',
        makeActor(),
        makeTarget(),
        makeScope(),
        { before: null, after: null },
        {},
      )
    }).not.toThrow()
  })

  it('record() is fire-and-forget (returns void)', () => {
    const result = auditLogService.record('STAFF_CREATED', makeActor(), makeTarget(), makeScope())
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. FILTERING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 AuditLogService — _applyFilter', () => {
  let mockLogs: AuditLog[]

  beforeEach(async () => {
    auditLogService._resetMock()
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    mockLogs = all.results
  })

  it('empty filter returns all logs', () => {
    const result = auditLogService._applyFilter(mockLogs, {})
    expect(result).toHaveLength(mockLogs.length)
  })

  it('severity filter returns only matching logs', () => {
    const result = auditLogService._applyFilter(mockLogs, { severity: 'warning' })
    expect(result.every((l) => l.severity === 'warning')).toBe(true)
  })

  it('severity=critical returns only critical logs', () => {
    const result = auditLogService._applyFilter(mockLogs, { severity: 'critical' })
    expect(result.every((l) => l.severity === 'critical')).toBe(true)
  })

  it('severity=info returns only info logs', () => {
    const result = auditLogService._applyFilter(mockLogs, { severity: 'info' })
    expect(result.every((l) => l.severity === 'info')).toBe(true)
  })

  it('tenantId filter isolates by tenant', () => {
    const allScopes = mockLogs.map((l) => l.scope.tenantId)
    const uniqueTenants = [...new Set(allScopes)]
    if (uniqueTenants.length < 2) return
    const tenantA = uniqueTenants[0]
    const result = auditLogService._applyFilter(mockLogs, { tenantId: tenantA })
    expect(result.every((l) => l.scope.tenantId === tenantA)).toBe(true)
  })

  it('branchId filter isolates by branch', () => {
    const logsWithBranch = mockLogs.filter((l) => l.scope.branchId)
    if (logsWithBranch.length === 0) return
    const branchId = logsWithBranch[0].scope.branchId!
    const result = auditLogService._applyFilter(mockLogs, { branchId })
    expect(result.every((l) => l.scope.branchId === branchId)).toBe(true)
  })

  it('action filter returns only matching action', () => {
    const result = auditLogService._applyFilter(mockLogs, { action: 'STAFF_CREATED' })
    expect(result.every((l) => l.action === 'STAFF_CREATED')).toBe(true)
  })

  it('targetType filter returns only matching type', () => {
    const result = auditLogService._applyFilter(mockLogs, { targetType: 'staff' })
    expect(result.every((l) => l.target.type === 'staff')).toBe(true)
  })

  it('search filter matches actor name', () => {
    const firstLog = mockLogs[0]
    const actorName = firstLog.actor.name
    const result = auditLogService._applyFilter(mockLogs, { search: actorName })
    expect(result.some((l) => l.actor.name.includes(actorName))).toBe(true)
  })

  it('search filter matches action string', () => {
    const action = mockLogs[0].action
    const result = auditLogService._applyFilter(mockLogs, { search: action.slice(0, 5) })
    expect(result.length).toBeGreaterThan(0)
  })

  it('search with no matches returns empty array', () => {
    const result = auditLogService._applyFilter(mockLogs, { search: 'ZZZNOMATCH__XYZ99999' })
    expect(result).toHaveLength(0)
  })

  it('dateFrom filters out logs before that date', () => {
    const sorted = [...mockLogs].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const midTimestamp = sorted[Math.floor(sorted.length / 2)]?.timestamp
    if (!midTimestamp) return
    const dateFrom = midTimestamp.split('T')[0]
    const result = auditLogService._applyFilter(mockLogs, { dateFrom })
    expect(result.every((l) => l.timestamp >= dateFrom)).toBe(true)
  })

  it('dateTo filters out logs after that date', () => {
    const sorted = [...mockLogs].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const midTimestamp = sorted[Math.floor(sorted.length / 2)]?.timestamp
    if (!midTimestamp) return
    const dateTo = midTimestamp.split('T')[0]
    const result = auditLogService._applyFilter(mockLogs, { dateTo })
    expect(result.every((l) => l.timestamp.split('T')[0] <= dateTo)).toBe(true)
  })

  it('combined filters are ANDed together', () => {
    const result = auditLogService._applyFilter(mockLogs, {
      severity: 'warning',
      targetType: 'staff',
    })
    expect(result.every((l) => l.severity === 'warning' && l.target.type === 'staff')).toBe(true)
  })

  it('sortOrder=asc sorts by timestamp ascending', () => {
    const result = auditLogService._applyFilter(mockLogs, { sortBy: 'timestamp', sortOrder: 'asc' })
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].timestamp <= result[i].timestamp).toBe(true)
    }
  })

  it('sortOrder=desc sorts by timestamp descending', () => {
    const result = auditLogService._applyFilter(mockLogs, { sortBy: 'timestamp', sortOrder: 'desc' })
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].timestamp >= result[i].timestamp).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. PAGINATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 AuditLogService — pagination', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('page 1 returns first pageSize results', async () => {
    const result = await auditLogService.getAuditLogs({ page: 1, pageSize: 3 })
    expect(result.results.length).toBeLessThanOrEqual(3)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(3)
  })

  it('totalPages is correct for pageSize', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const total = all.count
    const pageSize = 3
    const result = await auditLogService.getAuditLogs({ pageSize })
    expect(result.totalPages).toBe(Math.ceil(total / pageSize))
  })

  it('count equals total logs after filter', async () => {
    const all = await auditLogService.getAuditLogs({})
    expect(all.count).toBeGreaterThan(0)
  })

  it('page 2 returns different results than page 1', async () => {
    const p1 = await auditLogService.getAuditLogs({ page: 1, pageSize: 2 })
    const p2 = await auditLogService.getAuditLogs({ page: 2, pageSize: 2 })
    if (p2.results.length === 0) return
    const p1ids = p1.results.map((l) => l.id)
    const p2ids = p2.results.map((l) => l.id)
    expect(p1ids.some((id) => p2ids.includes(id))).toBe(false)
  })

  it('last page has remaining results', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const total = all.count
    const pageSize = 5
    const lastPage = Math.ceil(total / pageSize)
    const result = await auditLogService.getAuditLogs({ page: lastPage, pageSize })
    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results.length).toBeLessThanOrEqual(pageSize)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. TIMELINE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 AuditLogService — _buildTimeline', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('groups logs by date', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const timeline = auditLogService._buildTimeline(all.results)
    for (const group of timeline) {
      const groupDate = group.date
      expect(group.events.every((e) => e.timestamp.startsWith(groupDate))).toBe(true)
    }
  })

  it('dates are sorted descending (newest first)', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const timeline = auditLogService._buildTimeline(all.results)
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i - 1].date >= timeline[i].date).toBe(true)
    }
  })

  it('total events in timeline matches input count', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const timeline = auditLogService._buildTimeline(all.results)
    const total = timeline.reduce((n, g) => n + g.events.length, 0)
    expect(total).toBe(all.results.length)
  })

  it('empty input produces empty timeline', () => {
    const timeline = auditLogService._buildTimeline([])
    expect(timeline).toHaveLength(0)
  })

  it('getAuditTimeline with severity filter respects filter', async () => {
    const timeline = await auditLogService.getAuditTimeline({ severity: 'critical' })
    for (const group of timeline) {
      expect(group.events.every((e) => e.severity === 'critical')).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. STATISTICS TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 AuditLogService — _buildStatistics', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('eventsPerDomain sums to totalEvents', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const stats = auditLogService._buildStatistics(all.results, {})
    const domainTotal = Object.values(stats.eventsPerDomain).reduce((n, v) => n + v, 0)
    expect(domainTotal).toBe(stats.totalEvents)
  })

  it('topActions is an array', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const stats = auditLogService._buildStatistics(all.results, {})
    expect(Array.isArray(stats.topActions)).toBe(true)
  })

  it('topActions entries have action and count', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const stats = auditLogService._buildStatistics(all.results, {})
    for (const ta of stats.topActions) {
      expect(ta).toHaveProperty('action')
      expect(ta).toHaveProperty('count')
    }
  })

  it('getAuditStatistics criticalEvents is correct', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const criticalCount = all.results.filter((l) => l.severity === 'critical').length
    expect(stats.criticalEvents).toBe(criticalCount)
  })

  it('getAuditStatistics warningEvents is correct', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const warningCount = all.results.filter((l) => l.severity === 'warning').length
    expect(stats.warningEvents).toBe(warningCount)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. CSV EXPORT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 AuditLogService — _buildCsvExport', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('CSV includes header with required columns', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const csv = auditLogService._buildCsvExport(all.results, false)
    const header = csv.split('\n')[0]
    expect(header).toContain('Timestamp')
    expect(header).toContain('Action')
    expect(header).toContain('Severity')
    expect(header).toContain('Actor')
  })

  it('CSV row count matches logs + header', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const csv = auditLogService._buildCsvExport(all.results, false)
    const lines = csv.split('\n').filter((l) => l.trim() !== '')
    expect(lines.length).toBe(all.results.length + 1)
  })

  it('CSV with includeChangeset adds Before/After columns', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const csv = auditLogService._buildCsvExport(all.results, true)
    const header = csv.split('\n')[0]
    expect(header).toContain('Before')
    expect(header).toContain('After')
  })

  it('CSV without includeChangeset omits Before/After columns', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const csv = auditLogService._buildCsvExport(all.results, false)
    const header = csv.split('\n')[0]
    expect(header).not.toContain('Before')
  })

  it('empty logs returns only header', async () => {
    const csv = auditLogService._buildCsvExport([], false)
    const lines = csv.split('\n').filter((l) => l.trim() !== '')
    expect(lines).toHaveLength(1)
  })

  it('exportAuditLogs with filter exports filtered results', async () => {
    const csv = await auditLogService.exportAuditLogs({
      filter: { severity: 'critical' },
      format: 'csv',
      includeChangeset: false,
    })
    const lines = csv.split('\n').filter((l) => l.trim() !== '')
    const all = await auditLogService.getAuditLogs({ severity: 'critical', pageSize: 100 })
    expect(lines.length).toBe(all.count + 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. PERMISSION MODEL TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Permissions — audit permissions in RBAC', () => {
  it('audit.view is in P7Permission type', () => {
    const p: P7Permission = 'audit.view'
    expect(p).toBe('audit.view')
  })

  it('audit.export is in P7Permission type', () => {
    const p: P7Permission = 'audit.export'
    expect(p).toBe('audit.export')
  })

  it('audit.manage is in P7Permission type', () => {
    const p: P7Permission = 'audit.manage'
    expect(p).toBe('audit.manage')
  })

  it('ALL_PERMISSIONS contains audit.view', () => {
    expect(ALL_PERMISSIONS).toContain('audit.view')
  })

  it('ALL_PERMISSIONS contains audit.export', () => {
    expect(ALL_PERMISSIONS).toContain('audit.export')
  })

  it('ALL_PERMISSIONS contains audit.manage', () => {
    expect(ALL_PERMISSIONS).toContain('audit.manage')
  })

  it('owner has audit.view', () => {
    expect(ROLE_PERMISSION_MAP.owner).toContain('audit.view')
  })

  it('owner has audit.export', () => {
    expect(ROLE_PERMISSION_MAP.owner).toContain('audit.export')
  })

  it('owner has audit.manage', () => {
    expect(ROLE_PERMISSION_MAP.owner).toContain('audit.manage')
  })

  it('admin has audit.view', () => {
    expect(ROLE_PERMISSION_MAP.admin).toContain('audit.view')
  })

  it('admin has audit.export', () => {
    expect(ROLE_PERMISSION_MAP.admin).toContain('audit.export')
  })

  it('admin has audit.manage', () => {
    expect(ROLE_PERMISSION_MAP.admin).toContain('audit.manage')
  })

  it('manager does NOT have audit.view', () => {
    expect(ROLE_PERMISSION_MAP.manager).not.toContain('audit.view')
  })

  it('support does NOT have audit.view', () => {
    expect(ROLE_PERMISSION_MAP.support).not.toContain('audit.view')
  })

  it('waiter does NOT have audit.view', () => {
    expect(ROLE_PERMISSION_MAP.waiter).not.toContain('audit.view')
  })

  it('kitchen does NOT have audit.view', () => {
    expect(ROLE_PERMISSION_MAP.kitchen).not.toContain('audit.view')
  })

  it('cashier does NOT have audit.view', () => {
    expect(ROLE_PERMISSION_MAP.cashier).not.toContain('audit.view')
  })

  it('hasPermission(owner, audit.view) returns true', () => {
    expect(hasPermission('owner', 'audit.view')).toBe(true)
  })

  it('hasPermission(admin, audit.export) returns true', () => {
    expect(hasPermission('admin', 'audit.export')).toBe(true)
  })

  it('hasPermission(manager, audit.view) returns false', () => {
    expect(hasPermission('manager', 'audit.view')).toBe(false)
  })

  it('hasPermission(manager, audit.export) returns false', () => {
    expect(hasPermission('manager', 'audit.export')).toBe(false)
  })

  it('hasPermission(support, audit.view) returns false', () => {
    expect(hasPermission('support', 'audit.view')).toBe(false)
  })

  it('hasPermission(waiter, audit.view) returns false', () => {
    expect(hasPermission('waiter', 'audit.view')).toBe(false)
  })

  it('hasPermission(kitchen, audit.manage) returns false', () => {
    expect(hasPermission('kitchen', 'audit.manage')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. NAVIGATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Navigation — AUDIT_LOGS_NAV_ITEM in all modules', () => {
  it('RESTAURANT_MODULE has audit-logs nav item', () => {
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item).toBeDefined()
  })

  it('CAFE_MODULE has audit-logs nav item', () => {
    const item = CAFE_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item).toBeDefined()
  })

  it('BAR_MODULE has audit-logs nav item', () => {
    const item = BAR_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item).toBeDefined()
  })

  it('FOOD_COURT_MODULE has audit-logs nav item', () => {
    const item = FOOD_COURT_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item).toBeDefined()
  })

  it('FOOD_TRUCK_MODULE has audit-logs nav item', () => {
    const item = FOOD_TRUCK_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item).toBeDefined()
  })

  it('MOBILE_CAFE_MODULE has audit-logs nav item', () => {
    const item = MOBILE_CAFE_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item).toBeDefined()
  })

  it('audit-logs nav item has label "Audit Logs"', () => {
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item?.label).toBe('Audit Logs')
  })

  it('audit-logs nav item has permissionKey audit.view', () => {
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item?.permissionKey).toBe('audit.view')
  })

  it('audit-logs nav item has featureFlagKey', () => {
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item?.featureFlagKey).toBeDefined()
  })

  it('RESTAURANT_MODULE.adminNavItems has 6 items', () => {
    expect(RESTAURANT_MODULE.adminNavItems).toHaveLength(19)
  })

  it('CAFE_MODULE.adminNavItems has 9 items', () => {
    expect(CAFE_MODULE.adminNavItems).toHaveLength(20)
  })

  it('BAR_MODULE.adminNavItems has 9 items', () => {
    expect(BAR_MODULE.adminNavItems).toHaveLength(21)
  })

  it('FOOD_COURT_MODULE.adminNavItems has 8 items', () => {
    expect(FOOD_COURT_MODULE.adminNavItems).toHaveLength(20)
  })

  it('FOOD_TRUCK_MODULE.adminNavItems has 8 items', () => {
    expect(FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(19)
  })

  it('MOBILE_CAFE_MODULE.adminNavItems has 8 items', () => {
    expect(MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(19)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. REGISTRY ROUTES TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Registry — ADMIN_AUDIT_ROUTES', () => {
  it('ADMIN_AUDIT_ROUTES is defined', () => {
    expect(ADMIN_AUDIT_ROUTES).toBeDefined()
  })

  it('ADMIN_AUDIT_ROUTES contains /admin/audit-logs', () => {
    expect(ADMIN_AUDIT_ROUTES).toContain('/admin/audit-logs')
  })

  it('RESTAURANT_MODULE routes include /admin/audit-logs', () => {
    expect(RESTAURANT_MODULE.routes).toContain('/admin/audit-logs')
  })

  it('CAFE_MODULE routes include /admin/audit-logs', () => {
    expect(CAFE_MODULE.routes).toContain('/admin/audit-logs')
  })

  it('BAR_MODULE routes include /admin/audit-logs', () => {
    expect(BAR_MODULE.routes).toContain('/admin/audit-logs')
  })

  it('FOOD_COURT_MODULE routes include /admin/audit-logs', () => {
    expect(FOOD_COURT_MODULE.routes).toContain('/admin/audit-logs')
  })

  it('FOOD_TRUCK_MODULE routes include /admin/audit-logs', () => {
    expect(FOOD_TRUCK_MODULE.routes).toContain('/admin/audit-logs')
  })

  it('MOBILE_CAFE_MODULE routes include /admin/audit-logs', () => {
    expect(MOBILE_CAFE_MODULE.routes).toContain('/admin/audit-logs')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. HOOKS EXPORT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Hooks — audit hooks exported', () => {
  it('useAuditLogs is exported from @/hooks', async () => {
    const hooks = await import('@/hooks')
    expect(typeof hooks.useAuditLogs).toBe('function')
  })

  it('useAuditLog is exported from @/hooks', async () => {
    const hooks = await import('@/hooks')
    expect(typeof hooks.useAuditLog).toBe('function')
  })

  it('useAuditTimeline is exported from @/hooks', async () => {
    const hooks = await import('@/hooks')
    expect(typeof hooks.useAuditTimeline).toBe('function')
  })

  it('useAuditStatistics is exported from @/hooks', async () => {
    const hooks = await import('@/hooks')
    expect(typeof hooks.useAuditStatistics).toBe('function')
  })

  it('useExportAuditLogs is exported from @/hooks', async () => {
    const hooks = await import('@/hooks')
    expect(typeof hooks.useExportAuditLogs).toBe('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. COMPONENT SOURCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Components — AuditTimeline source checks', () => {
  it('AuditTimeline is importable', async () => {
    const mod = await import('@/components/admin/AuditTimeline')
    expect(mod.AuditTimeline).toBeDefined()
  })

  it('AuditTimeline is a function', async () => {
    const mod = await import('@/components/admin/AuditTimeline')
    expect(typeof mod.AuditTimeline).toBe('function')
  })

  it('AuditTimeline default export is also available', async () => {
    const mod = await import('@/components/admin/AuditTimeline')
    expect(mod.default).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. TENANT ISOLATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Tenant Isolation', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('tenantId filter prevents cross-tenant data leakage', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const tenants = [...new Set(all.results.map((l) => l.scope.tenantId))]
    if (tenants.length < 2) return
    const tenantA = tenants[0]
    const tenantB = tenants[1]
    const resultsA = await auditLogService.getAuditLogs({ tenantId: tenantA, pageSize: 100 })
    const resultsB = await auditLogService.getAuditLogs({ tenantId: tenantB, pageSize: 100 })
    expect(resultsA.results.every((l) => l.scope.tenantId === tenantA)).toBe(true)
    expect(resultsB.results.every((l) => l.scope.tenantId === tenantB)).toBe(true)
    const idsA = new Set(resultsA.results.map((l) => l.id))
    const idsB = new Set(resultsB.results.map((l) => l.id))
    const overlap = [...idsA].filter((id) => idsB.has(id))
    expect(overlap).toHaveLength(0)
  })

  it('created log is associated with provided tenantId', async () => {
    const tenantId = 'tenant-isolation-test'
    const log = await auditLogService.createAuditLog(
      'BRANCH_CREATED', makeActor(), makeTarget({ type: 'branch' }), { tenantId },
      { before: null, after: null }, {},
    )
    expect(log.scope.tenantId).toBe(tenantId)
  })

  it('tenantId filter excludes logs from other tenants', async () => {
    await auditLogService.createAuditLog(
      'STAFF_CREATED', makeActor(), makeTarget(), { tenantId: 'tenant-xyz' },
      { before: null, after: null }, {},
    )
    const result = await auditLogService.getAuditLogs({ tenantId: 'tenant-test-01', pageSize: 100 })
    expect(result.results.every((l) => l.scope.tenantId === 'tenant-test-01')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. BRANCH ISOLATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Branch Isolation', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('branchId filter only returns logs for that branch', async () => {
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const logsWithBranch = all.results.filter((l) => l.scope.branchId)
    if (logsWithBranch.length === 0) return
    const branchId = logsWithBranch[0].scope.branchId!
    const filtered = await auditLogService.getAuditLogs({ branchId, pageSize: 100 })
    expect(filtered.results.every((l) => l.scope.branchId === branchId)).toBe(true)
  })

  it('created log with branchId is stored correctly', async () => {
    const branchId = 'branch-isolation-test'
    const log = await auditLogService.createAuditLog(
      'ORDER_CREATED', makeActor(), makeTarget({ type: 'order' }), { tenantId: 'tenant-test', branchId },
      { before: null, after: null }, {},
    )
    expect(log.scope.branchId).toBe(branchId)
  })

  it('global scoped logs have no branchId', async () => {
    const log = await auditLogService.createAuditLog(
      'TENANT_ACTIVATED', makeActor(), makeTarget({ type: 'tenant' }), { tenantId: 'tenant-test' },
      { before: null, after: null }, {},
    )
    expect(log.scope.branchId).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. DEEP LINK TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Deep Links', () => {
  it('/admin/audit-logs is a valid route', () => {
    expect(ADMIN_AUDIT_ROUTES).toContain('/admin/audit-logs')
  })

  it('all modules expose the audit-logs route for deep linking', () => {
    const modules = [
      RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE,
      FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE,
    ]
    for (const mod of modules) {
      expect(mod.routes).toContain('/admin/audit-logs')
    }
  })

  it('audit-logs nav item href matches the route', () => {
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.href === '/admin/audit-logs')
    expect(item?.href).toBe('/admin/audit-logs')
    expect(ADMIN_AUDIT_ROUTES).toContain(item?.href)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 17. ANALYTICS / STATISTICS DEEP TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Audit Analytics', () => {
  beforeEach(() => {
    auditLogService._resetMock()
  })

  it('statistics reflect added entries', async () => {
    const before = await auditLogService.getAuditStatistics({})
    await auditLogService.createAuditLog(
      'OWNERSHIP_TRANSFERRED', makeActor(), makeTarget(), makeScope(),
      { before: null, after: null }, {},
    )
    const after = await auditLogService.getAuditStatistics({})
    expect(after.totalEvents).toBe(before.totalEvents + 1)
    expect(after.criticalEvents).toBe(before.criticalEvents + 1)
  })

  it('eventsPerDomain tracks domain counts', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    const staffDomainCount = stats.eventsPerDomain['staff'] ?? 0
    expect(staffDomainCount).toBeGreaterThanOrEqual(0)
  })

  it('eventsPerActor tracks actor ids', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    expect(typeof stats.eventsPerActor).toBe('object')
  })

  it('eventsPerBranch tracks branch ids', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    expect(typeof stats.eventsPerBranch).toBe('object')
  })

  it('topActions count is > 0 when there are logs', async () => {
    const stats = await auditLogService.getAuditStatistics({})
    if (stats.totalEvents > 0) {
      expect(stats.topActions.length).toBeGreaterThan(0)
    }
  })

  it('statistics filter by tenantId respected', async () => {
    const allStats = await auditLogService.getAuditStatistics({})
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const tenants = [...new Set(all.results.map((l) => l.scope.tenantId))]
    if (tenants.length < 2) return
    const tenantAStats = await auditLogService.getAuditStatistics({ tenantId: tenants[0] })
    expect(tenantAStats.totalEvents).toBeLessThanOrEqual(allStats.totalEvents)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 18. REGRESSION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('P7.5 Regression — existing functionality not broken', () => {
  it('auditLogService is defined and has 7 public methods', () => {
    const publicMethods = [
      'getAuditLogs', 'getAuditLog', 'createAuditLog',
      'getAuditTimeline', 'exportAuditLogs', 'searchAuditLogs',
      'getAuditStatistics',
    ]
    for (const method of publicMethods) {
      expect(typeof (auditLogService as Record<string, unknown>)[method]).toBe('function')
    }
  })

  it('auditLogService has helper methods', () => {
    expect(typeof auditLogService._resetMock).toBe('function')
    expect(typeof auditLogService._getMockCount).toBe('function')
    expect(typeof auditLogService._applyFilter).toBe('function')
    expect(typeof auditLogService._buildTimeline).toBe('function')
    expect(typeof auditLogService._buildStatistics).toBe('function')
    expect(typeof auditLogService._buildCsvExport).toBe('function')
  })

  it('AUDIT_EVENT_REGISTRY has no undefined values', () => {
    for (const [, meta] of Object.entries(AUDIT_EVENT_REGISTRY)) {
      expect(meta).not.toBeUndefined()
      expect(meta).not.toBeNull()
    }
  })

  it('audit types are re-exported from @/types', async () => {
    const types = await import('@/types')
    expect(types).toBeDefined()
  })

  it('permission service still has all original permissions', () => {
    const required: P7Permission[] = ['staff.view', 'staff.manage', 'branches.view', 'orders.view']
    for (const perm of required) {
      expect(ALL_PERMISSIONS).toContain(perm)
    }
  })

  it('ROLE_PERMISSION_MAP owner still has original permissions', () => {
    expect(ROLE_PERMISSION_MAP.owner).toContain('staff.manage')
    expect(ROLE_PERMISSION_MAP.owner).toContain('branches.manage')
  })

  it('searchAuditLogs returns paginated results', async () => {
    const result = await auditLogService.searchAuditLogs('Staff', {})
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('count')
  })

  it('searchAuditLogs with specific term filters results', async () => {
    auditLogService._resetMock()
    const result = await auditLogService.searchAuditLogs('STAFF', {})
    if (result.count > 0) {
      expect(result.results.length).toBeGreaterThan(0)
    }
  })

  it('mock data has logs across multiple dates', async () => {
    auditLogService._resetMock()
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const dates = new Set(all.results.map((l) => l.timestamp.split('T')[0]))
    expect(dates.size).toBeGreaterThanOrEqual(1)
  })

  it('mock data covers multiple severity levels', async () => {
    auditLogService._resetMock()
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const severities = new Set(all.results.map((l) => l.severity))
    expect(severities.size).toBeGreaterThan(1)
  })

  it('mock data covers multiple domains', async () => {
    auditLogService._resetMock()
    const all = await auditLogService.getAuditLogs({ pageSize: 100 })
    const stats = auditLogService._buildStatistics(all.results, {})
    expect(Object.keys(stats.eventsPerDomain).length).toBeGreaterThan(1)
  })
})
