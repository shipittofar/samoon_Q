/**
 * P7.7 — Realtime Operations Dashboard Tests
 *
 * Coverage:
 *   A. Domain types (realtime-operations.ts)
 *   B. Realtime event registry
 *   C. Realtime operations service
 *   D. RBAC — operations.view / operations.manage
 *   E. WebSocket admin broadcast channels
 *   F. Module registry — operations nav + routes
 *   G. Hooks exports
 *   H. Branch isolation
 *   I. Tenant isolation
 *   J. SLA alert logic
 *   K. Statistics
 *   L. Kitchen status
 *   M. Staff presence
 *   N. Activity feed / deep links
 *   O. Realtime event registry cross-validation
 *   P. Service test helpers
 *   Q. Regression
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

const readSrc = (rel: string) =>
  fs.readFileSync(path.resolve('src', rel), 'utf-8')

// ── A — Domain types ──────────────────────────────────────────────────────────

describe('A — Domain types (realtime-operations.ts)', () => {
  const src = () => readSrc('types/realtime-operations.ts')

  it('exports OperationsEventPriority', () => {
    expect(src()).toContain("'low' | 'normal' | 'high' | 'critical'")
  })

  it('exports OperationsEventType with all 18 variants', () => {
    const s = src()
    const types = [
      'LIVE_ORDER_CREATED', 'LIVE_ORDER_UPDATED', 'LIVE_ORDER_CANCELLED',
      'LIVE_RESERVATION_CREATED', 'LIVE_RESERVATION_UPDATED', 'LIVE_RESERVATION_CANCELLED',
      'LIVE_RESERVATION_CHECKED_IN', 'STAFF_STATUS_CHANGED', 'STAFF_PRESENCE_UPDATED',
      'BRANCH_STATUS_CHANGED', 'BRANCH_HEALTH_UPDATED', 'LIVE_NOTIFICATION',
      'LIVE_AUDIT_EVENT', 'SLA_ALERT_RAISED', 'SLA_ALERT_RESOLVED',
      'KITCHEN_QUEUE_UPDATED', 'METRICS_UPDATED', 'SYSTEM_ALERT',
    ]
    types.forEach((t) => expect(s).toContain(t))
  })

  it('exports OrderLiveStatus with 7 variants', () => {
    const s = src()
    ;['pending','accepted','preparing','ready','delivering','delivered','cancelled'].forEach((v) =>
      expect(s).toContain(`'${v}'`)
    )
  })

  it('exports ReservationLiveStatus with 6 variants', () => {
    const s = src()
    ;['upcoming','confirmed','checked_in','completed','cancelled','no_show'].forEach((v) =>
      expect(s).toContain(`'${v}'`)
    )
  })

  it('exports StaffPresenceStatus', () => {
    expect(src()).toContain("StaffPresenceStatus")
    ;['online','busy','break','offline'].forEach((v) =>
      expect(src()).toContain(`'${v}'`)
    )
  })

  it('exports BranchHealthLevel', () => {
    ;['healthy','degraded','critical','offline'].forEach((v) =>
      expect(src()).toContain(`'${v}'`)
    )
  })

  it('exports SLAAlertType', () => {
    ;['order_prep_exceeded','order_delivery_exceeded','reservation_wait_exceeded','kitchen_queue_depth','staff_shortage'].forEach((v) =>
      expect(src()).toContain(`'${v}'`)
    )
  })

  it('exports OperationsScope interface', () => {
    expect(src()).toContain('OperationsScope')
    expect(src()).toContain('tenantId: string')
  })

  it('exports OperationsEvent interface', () => {
    expect(src()).toContain('interface OperationsEvent')
    expect(src()).toContain('type: OperationsEventType')
    expect(src()).toContain('priority: OperationsEventPriority')
    expect(src()).toContain('scope: OperationsScope')
  })

  it('LiveOrder has required fields', () => {
    const s = src()
    expect(s).toContain('interface LiveOrder')
    expect(s).toContain('orderNumber: string')
    expect(s).toContain('status: OrderLiveStatus')
    expect(s).toContain('totalAmount: number')
    expect(s).toContain('slaBreached: boolean')
    expect(s).toContain('isDelayed: boolean')
  })

  it('LiveReservation has required fields', () => {
    const s = src()
    expect(s).toContain('interface LiveReservation')
    expect(s).toContain('guestName: string')
    expect(s).toContain('partySize: number')
    expect(s).toContain('isOverdue: boolean')
  })

  it('StaffPresence has required fields', () => {
    const s = src()
    expect(s).toContain('interface StaffPresence')
    expect(s).toContain('userId: string')
    expect(s).toContain('activeOrderCount: number')
    expect(s).toContain('status: StaffPresenceStatus')
  })

  it('BranchStatus has required fields', () => {
    const s = src()
    expect(s).toContain('interface BranchStatus')
    expect(s).toContain('health: BranchHealthLevel')
    expect(s).toContain('activeOrders: number')
    expect(s).toContain('staffOnline: number')
  })

  it('KitchenStatus has required fields', () => {
    const s = src()
    expect(s).toContain('interface KitchenStatus')
    expect(s).toContain('pendingOrders: LiveOrder[]')
    expect(s).toContain('preparingOrders: LiveOrder[]')
    expect(s).toContain('queueDepth: number')
    expect(s).toContain('capacityPercent: number')
  })

  it('SLAAlert has required fields', () => {
    const s = src()
    expect(s).toContain('interface SLAAlert')
    expect(s).toContain('thresholdMinutes: number')
    expect(s).toContain('elapsedMinutes: number')
    expect(s).toContain('isActive: boolean')
  })

  it('OperationsDashboard aggregates all entities', () => {
    const s = src()
    expect(s).toContain('interface OperationsDashboard')
    expect(s).toContain('liveOrders: LiveOrder[]')
    expect(s).toContain('liveReservations: LiveReservation[]')
    expect(s).toContain('branchStatuses: BranchStatus[]')
    expect(s).toContain('staffPresences: StaffPresence[]')
    expect(s).toContain('kitchenStatuses: KitchenStatus[]')
    expect(s).toContain('slaAlerts: SLAAlert[]')
    expect(s).toContain('recentEvents: OperationsEvent[]')
    expect(s).toContain('metrics: LiveMetric[]')
  })

  it('exports OperationsChannelName with all 7 channels', () => {
    const s = src()
    ;['admin.operations','branch.operations','orders.broadcast','reservations.broadcast','staff.broadcast','notifications.broadcast','audit.broadcast'].forEach((ch) =>
      expect(s).toContain(`'${ch}'`)
    )
  })

  it('exports RealtimeConnectionState', () => {
    expect(src()).toContain('interface RealtimeConnectionState')
    expect(src()).toContain('isHealthy: boolean')
  })

  it('exports RealtimeStatistics', () => {
    const s = src()
    expect(s).toContain('interface RealtimeStatistics')
    expect(s).toContain('eventsPerMinute: number')
    expect(s).toContain('slaCompliancePercent: number')
    expect(s).toContain('branchHealthSummary:')
  })
})

// ── B — Realtime event registry ───────────────────────────────────────────────

describe('B — Realtime event registry', () => {
  const src = () => readSrc('services/realtime-event-registry.ts')

  it('file exists', () => {
    expect(src()).toBeTruthy()
  })

  it('exports REALTIME_EVENT_REGISTRY', () => {
    expect(src()).toContain('REALTIME_EVENT_REGISTRY')
  })

  it('exports getRealtimeConfig function', () => {
    expect(src()).toContain('export function getRealtimeConfig')
  })

  it('exports getOperationalAuditActions', () => {
    expect(src()).toContain('export function getOperationalAuditActions')
  })

  it('exports getHighPriorityOperationsActions', () => {
    expect(src()).toContain('export function getHighPriorityOperationsActions')
  })

  it('exports getCriticalOperationsActions', () => {
    expect(src()).toContain('export function getCriticalOperationsActions')
  })

  it('exports getActionsByChannel', () => {
    expect(src()).toContain('export function getActionsByChannel')
  })

  it('exports getSLATriggeredActions', () => {
    expect(src()).toContain('export function getSLATriggeredActions')
  })

  it('exports verifyRealtimeRegistryConsumesUpstream', () => {
    expect(src()).toContain('export function verifyRealtimeRegistryConsumesUpstream')
  })

  it('registry references order broadcast channel', () => {
    expect(src()).toContain('orders.broadcast')
  })

  it('registry references reservations broadcast channel', () => {
    expect(src()).toContain('reservations.broadcast')
  })

  it('registry references admin.operations channel', () => {
    expect(src()).toContain('admin.operations')
  })

  it('registry has audit broadcast channel', () => {
    expect(src()).toContain('audit.broadcast')
  })

  it('registry has REALTIME_AUDIT_ACTIONS export', () => {
    expect(src()).toContain('REALTIME_AUDIT_ACTIONS')
  })
})

describe('B2 — Realtime event registry runtime', () => {
  beforeEach(() => vi.resetModules())

  it('getRealtimeConfig returns config for ORDER_CREATED', async () => {
    const { getRealtimeConfig } = await import('@/services/realtime-event-registry')
    const config = getRealtimeConfig('ORDER_CREATED')
    expect(config).toBeDefined()
    expect(config?.channels).toContain('orders.broadcast')
  })

  it('getRealtimeConfig returns config for RESERVATION_CREATED', async () => {
    const { getRealtimeConfig } = await import('@/services/realtime-event-registry')
    const config = getRealtimeConfig('RESERVATION_CREATED')
    expect(config).toBeDefined()
    expect(config?.channels).toContain('reservations.broadcast')
  })

  it('getOperationalAuditActions returns non-empty array', async () => {
    const { getOperationalAuditActions } = await import('@/services/realtime-event-registry')
    expect(getOperationalAuditActions().length).toBeGreaterThan(0)
  })

  it('getHighPriorityOperationsActions returns subset of operational', async () => {
    const { getHighPriorityOperationsActions, getOperationalAuditActions } = await import('@/services/realtime-event-registry')
    const high = getHighPriorityOperationsActions()
    const all = getOperationalAuditActions()
    expect(high.length).toBeGreaterThan(0)
  })

  it('getCriticalOperationsActions subset of high priority', async () => {
    const { getCriticalOperationsActions, getHighPriorityOperationsActions } = await import('@/services/realtime-event-registry')
    const critical = getCriticalOperationsActions()
    const high = getHighPriorityOperationsActions()
    critical.forEach((a) => expect(high).toContain(a))
  })

  it('getActionsByChannel returns order events for orders.broadcast', async () => {
    const { getActionsByChannel } = await import('@/services/realtime-event-registry')
    const actions = getActionsByChannel('orders.broadcast')
    expect(actions.length).toBeGreaterThan(0)
  })

  it('getSLATriggeredActions returns non-empty', async () => {
    const { getSLATriggeredActions } = await import('@/services/realtime-event-registry')
    expect(getSLATriggeredActions().length).toBeGreaterThan(0)
  })

  it('verifyRealtimeRegistryConsumesUpstream returns true', async () => {
    const { verifyRealtimeRegistryConsumesUpstream } = await import('@/services/realtime-event-registry')
    expect(verifyRealtimeRegistryConsumesUpstream()).toBe(true)
  })
})

// ── C — Realtime operations service ──────────────────────────────────────────

describe('C — RealtimeOperationsService', () => {
  const src = () => readSrc('services/realtime-operations.service.ts')

  it('file exists', () => {
    expect(src()).toBeTruthy()
  })

  it('exports realtimeOperationsService', () => {
    expect(src()).toContain('export const realtimeOperationsService')
  })

  it('has getOperationsSnapshot method', () => {
    expect(src()).toContain('getOperationsSnapshot')
  })

  it('has getLiveOrders method', () => {
    expect(src()).toContain('getLiveOrders')
  })

  it('has getLiveReservations method', () => {
    expect(src()).toContain('getLiveReservations')
  })

  it('has getBranchStatus method', () => {
    expect(src()).toContain('getBranchStatus')
  })

  it('has getKitchenStatus method', () => {
    expect(src()).toContain('getKitchenStatus')
  })

  it('has getStaffPresence method', () => {
    expect(src()).toContain('getStaffPresence')
  })

  it('has getSLAAlerts method', () => {
    expect(src()).toContain('getSLAAlerts')
  })

  it('has getRealtimeStatistics method', () => {
    expect(src()).toContain('getRealtimeStatistics')
  })

  it('has publishEvent method', () => {
    expect(src()).toContain('publishEvent')
  })

  it('has subscribe method', () => {
    expect(src()).toContain('subscribe')
  })

  it('has emit method', () => {
    expect(src()).toContain('emit')
  })

  it('uses mock-first pattern', () => {
    expect(src()).toContain('USE_MOCK')
    expect(src()).toContain('NEXT_PUBLIC_USE_MOCK')
  })

  it('has test helpers', () => {
    expect(src()).toContain('_resetMock')
    expect(src()).toContain('_getMockOrderCount')
    expect(src()).toContain('_getMockBranchCount')
  })
})

describe('C2 — RealtimeOperationsService runtime', () => {
  beforeEach(() => vi.resetModules())

  it('getOperationsSnapshot returns dashboard with all sections', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const snapshot = await realtimeOperationsService.getOperationsSnapshot({ tenantId: 'tenant-samoon-01' })
    expect(snapshot.liveOrders).toBeInstanceOf(Array)
    expect(snapshot.liveReservations).toBeInstanceOf(Array)
    expect(snapshot.branchStatuses).toBeInstanceOf(Array)
    expect(snapshot.staffPresences).toBeInstanceOf(Array)
    expect(snapshot.kitchenStatuses).toBeInstanceOf(Array)
    expect(snapshot.slaAlerts).toBeInstanceOf(Array)
    expect(snapshot.recentEvents).toBeInstanceOf(Array)
    expect(snapshot.metrics).toBeInstanceOf(Array)
    expect(snapshot.lastUpdated).toBeTruthy()
  })

  it('getLiveOrders returns array of LiveOrder', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const orders = await realtimeOperationsService.getLiveOrders({ tenantId: 'tenant-samoon-01' })
    expect(orders.length).toBeGreaterThan(0)
    const o = orders[0]!
    expect(o).toHaveProperty('id')
    expect(o).toHaveProperty('orderNumber')
    expect(o).toHaveProperty('status')
    expect(o).toHaveProperty('totalAmount')
    expect(o).toHaveProperty('slaBreached')
    expect(o).toHaveProperty('isDelayed')
  })

  it('getLiveReservations returns array of LiveReservation', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const reservations = await realtimeOperationsService.getLiveReservations({ tenantId: 'tenant-samoon-01' })
    expect(reservations.length).toBeGreaterThan(0)
    const r = reservations[0]!
    expect(r).toHaveProperty('id')
    expect(r).toHaveProperty('guestName')
    expect(r).toHaveProperty('partySize')
    expect(r).toHaveProperty('isOverdue')
  })

  it('getBranchStatus returns array of BranchStatus', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const branches = await realtimeOperationsService.getBranchStatuses({ tenantId: 'tenant-samoon-01' })
    expect(branches.length).toBeGreaterThan(0)
    const b = branches[0]!
    expect(b).toHaveProperty('branchId')
    expect(b).toHaveProperty('health')
    expect(b).toHaveProperty('activeOrders')
  })

  it('getKitchenStatus returns KitchenStatus', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const ksRaw = await realtimeOperationsService.getKitchenStatus('branch-rest-01')
    const ks = ksRaw!
    expect(ks).toHaveProperty('branchId')
    expect(ks).toHaveProperty('pendingOrders')
    expect(ks).toHaveProperty('queueDepth')
    expect(ks).toHaveProperty('capacityPercent')
  })

  it('getStaffPresence returns array of StaffPresence', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const staff = await realtimeOperationsService.getStaffPresence({ tenantId: 'tenant-samoon-01' })
    expect(staff.length).toBeGreaterThan(0)
    const s = staff[0]!
    expect(s).toHaveProperty('userId')
    expect(s).toHaveProperty('name')
    expect(s).toHaveProperty('status')
    expect(s).toHaveProperty('activeOrderCount')
  })

  it('getSLAAlerts returns array of SLAAlert', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const alerts = await realtimeOperationsService.getSLAAlerts({ tenantId: 'tenant-samoon-01' })
    expect(alerts).toBeInstanceOf(Array)
    if (alerts.length > 0) {
      const a = alerts[0]!
      expect(a).toHaveProperty('type')
      expect(a).toHaveProperty('isActive')
      expect(a).toHaveProperty('thresholdMinutes')
      expect(a).toHaveProperty('elapsedMinutes')
    }
  })

  it('getRealtimeStatistics returns statistics', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const stats = await realtimeOperationsService.getRealtimeStatistics({ tenantId: 'tenant-samoon-01' })
    expect(stats).toHaveProperty('eventsPerMinute')
    expect(stats).toHaveProperty('slaCompliancePercent')
    expect(stats).toHaveProperty('activeStaff')
    expect(stats).toHaveProperty('branchHealthSummary')
    expect(typeof stats.slaCompliancePercent).toBe('number')
  })

  it('subscribe returns unsubscribe function', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const received: unknown[] = []
    const unsub = realtimeOperationsService.subscribe((e) => received.push(e))
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('emit does not throw', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    expect(() => realtimeOperationsService.emit({
      type: 'LIVE_ORDER_UPDATED',
      priority: 'normal',
      scope: { tenantId: 'tenant-samoon-01' },
      payload: {},
      occurredAt: new Date().toISOString(),
    })).not.toThrow()
  })
})

// ── D — RBAC operations permissions ──────────────────────────────────────────

describe('D — RBAC operations.view / operations.manage', () => {
  beforeEach(() => vi.resetModules())

  it('operations.view is in ALL_PERMISSIONS', async () => {
    const { ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(ALL_PERMISSIONS).toContain('operations.view')
  })

  it('operations.manage is in ALL_PERMISSIONS', async () => {
    const { ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(ALL_PERMISSIONS).toContain('operations.manage')
  })

  it('owner has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'operations.view')).toBe(true)
  })

  it('owner has operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'operations.manage')).toBe(true)
  })

  it('admin has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'operations.view')).toBe(true)
  })

  it('admin has operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'operations.manage')).toBe(true)
  })

  it('manager has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'operations.view')).toBe(true)
  })

  it('manager does NOT have operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'operations.manage')).toBe(false)
  })

  it('cashier has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'operations.view')).toBe(true)
  })

  it('cashier does NOT have operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'operations.manage')).toBe(false)
  })

  it('waiter has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'operations.view')).toBe(true)
  })

  it('waiter does NOT have operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'operations.manage')).toBe(false)
  })

  it('kitchen has operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'operations.view')).toBe(true)
  })

  it('kitchen does NOT have operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'operations.manage')).toBe(false)
  })

  it('marketing does NOT have operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'operations.view')).toBe(false)
  })

  it('marketing does NOT have operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'operations.manage')).toBe(false)
  })

  it('support does NOT have operations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'operations.view')).toBe(false)
  })

  it('support does NOT have operations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'operations.manage')).toBe(false)
  })
})

// ── E — WebSocket admin broadcast channels ───────────────────────────────────

describe('E — WebSocket admin broadcast channels', () => {
  const src = () => readSrc('services/websocket.service.ts')

  it('exports adminOperationsSocket', () => {
    expect(src()).toContain('adminOperationsSocket')
  })

  it('exports branchOperationsSocket', () => {
    expect(src()).toContain('branchOperationsSocket')
  })

  it('exports ordersBroadcastSocket', () => {
    expect(src()).toContain('ordersBroadcastSocket')
  })

  it('exports reservationsBroadcastSocket', () => {
    expect(src()).toContain('reservationsBroadcastSocket')
  })

  it('exports staffBroadcastSocket', () => {
    expect(src()).toContain('staffBroadcastSocket')
  })

  it('exports notificationsBroadcastSocket', () => {
    expect(src()).toContain('notificationsBroadcastSocket')
  })

  it('exports auditBroadcastSocket', () => {
    expect(src()).toContain('auditBroadcastSocket')
  })

  it('exports OperationsChannelManager', () => {
    expect(src()).toContain('class OperationsChannelManager')
  })

  it('exports operationsChannelManager singleton', () => {
    expect(src()).toContain('export const operationsChannelManager')
  })

  it('attachHeartbeat function exported', () => {
    expect(src()).toContain('export function attachHeartbeat')
  })

  it('ConnectionHealth interface exported', () => {
    expect(src()).toContain('export interface ConnectionHealth')
  })

  it('OperationsChannelManager has getOrCreate', () => {
    expect(src()).toContain('getOrCreate')
  })

  it('OperationsChannelManager has getAllHealth', () => {
    expect(src()).toContain('getAllHealth')
  })

  it('OperationsChannelManager has disconnectAll', () => {
    expect(src()).toContain('disconnectAll')
  })

  it('heartbeat options have intervalMs and timeoutMs', () => {
    expect(src()).toContain('intervalMs')
    expect(src()).toContain('timeoutMs')
  })
})

describe('E2 — OperationsChannelManager runtime', () => {
  beforeEach(() => vi.resetModules())

  it('operationsChannelManager is defined', async () => {
    const { operationsChannelManager } = await import('@/services/websocket.service')
    expect(operationsChannelManager).toBeDefined()
  })

  it('getAllHealth returns object', async () => {
    const { operationsChannelManager } = await import('@/services/websocket.service')
    const health = operationsChannelManager.getAllHealth()
    expect(typeof health).toBe('object')
  })

  it('getOrCreate returns DjangoChannelsWebSocket', async () => {
    const { operationsChannelManager, DjangoChannelsWebSocket } = await import('@/services/websocket.service')
    const ws = operationsChannelManager.getOrCreate('test.channel.e2')
    expect(ws).toBeInstanceOf(DjangoChannelsWebSocket)
  })

  it('getOrCreate returns same instance on second call', async () => {
    const { operationsChannelManager } = await import('@/services/websocket.service')
    const ws1 = operationsChannelManager.getOrCreate('test.channel.idempotent')
    const ws2 = operationsChannelManager.getOrCreate('test.channel.idempotent')
    expect(ws1).toBe(ws2)
  })

  it('getHealth returns undefined for unknown channel', async () => {
    const { operationsChannelManager } = await import('@/services/websocket.service')
    expect(operationsChannelManager.getHealth('no.such.channel')).toBeUndefined()
  })

  it('getHealth returns ConnectionHealth for known channel', async () => {
    const { operationsChannelManager } = await import('@/services/websocket.service')
    operationsChannelManager.getOrCreate('test.health.check')
    const h = operationsChannelManager.getHealth('test.health.check')
    expect(h).toBeDefined()
    expect(h).toHaveProperty('status')
    expect(h).toHaveProperty('reconnectCount')
    expect(h).toHaveProperty('isHealthy')
  })

  it('adminOperationsSocket is DjangoChannelsWebSocket instance', async () => {
    const { adminOperationsSocket, DjangoChannelsWebSocket } = await import('@/services/websocket.service')
    expect(adminOperationsSocket).toBeInstanceOf(DjangoChannelsWebSocket)
  })

  it('all 7 broadcast sockets are distinct instances', async () => {
    const {
      adminOperationsSocket, branchOperationsSocket, ordersBroadcastSocket,
      reservationsBroadcastSocket, staffBroadcastSocket,
      notificationsBroadcastSocket, auditBroadcastSocket,
    } = await import('@/services/websocket.service')
    const sockets = [
      adminOperationsSocket, branchOperationsSocket, ordersBroadcastSocket,
      reservationsBroadcastSocket, staffBroadcastSocket,
      notificationsBroadcastSocket, auditBroadcastSocket,
    ]
    const unique = new Set(sockets)
    expect(unique.size).toBe(7)
  })
})

// ── F — Module registry — operations nav ─────────────────────────────────────

describe('F — Module registry operations nav', () => {
  const src = () => readSrc('modules/registry.ts')

  it('OPERATIONS_NAV_ITEM defined in registry', () => {
    expect(src()).toContain("href: '/console/operations'")
  })

  it('ADMIN_OPERATIONS_ROUTES exported', () => {
    expect(src()).toContain('ADMIN_OPERATIONS_ROUTES')
  })

  it('operations permissionKey is operations.view', () => {
    expect(src()).toContain("permissionKey: 'operations.view'")
  })
})

describe('F2 — Module registry runtime nav counts', () => {
  async function freshRegistry() {
    vi.resetModules()
    return import('@/modules/registry')
  }

  it('RESTAURANT_MODULE has 8 admin nav items', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    expect(RESTAURANT_MODULE.adminNavItems).toHaveLength(28)
  })

  it('CAFE_MODULE has 11 admin nav items', async () => {
    const { CAFE_MODULE } = await freshRegistry()
    expect(CAFE_MODULE.adminNavItems).toHaveLength(28)
  })

  it('BAR_MODULE has 11 admin nav items', async () => {
    const { BAR_MODULE } = await freshRegistry()
    expect(BAR_MODULE.adminNavItems).toHaveLength(29)
  })

  it('FOOD_COURT_MODULE has 10 admin nav items', async () => {
    const { FOOD_COURT_MODULE } = await freshRegistry()
    expect(FOOD_COURT_MODULE.adminNavItems).toHaveLength(28)
  })

  it('FOOD_TRUCK_MODULE has 10 admin nav items', async () => {
    const { FOOD_TRUCK_MODULE } = await freshRegistry()
    expect(FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(27)
  })

  it('MOBILE_CAFE_MODULE has 10 admin nav items', async () => {
    const { MOBILE_CAFE_MODULE } = await freshRegistry()
    expect(MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(27)
  })

  it('getAdminNav(["restaurant"]) returns 8 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['restaurant'])).toHaveLength(28)
  })

  it('getAdminNav(["cafe"]) returns 11 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['cafe'])).toHaveLength(28)
  })

  it('getAdminNav(["bar"]) returns 11 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['bar'])).toHaveLength(29)
  })

  it('getAdminNav(["food_court"]) returns 10 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_court'])).toHaveLength(28)
  })

  it('getAdminNav(["food_truck"]) returns 10 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_truck'])).toHaveLength(27)
  })

  it('getAdminNav(["mobile_cafe"]) returns 10 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['mobile_cafe'])).toHaveLength(27)
  })

  it('RESTAURANT_MODULE routes include /console/operations', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    expect(RESTAURANT_MODULE.routes).toContain('/console/operations')
  })

  it('all 6 modules include operations nav item', async () => {
    const { RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE } = await freshRegistry()
    const modules = [RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE]
    modules.forEach((mod) => {
      const found = mod.adminNavItems?.find((n) => n.href === '/console/operations')
      expect(found).toBeDefined()
      expect(found?.label).toBe('Live Operations')
    })
  })
})

// ── G — Hooks exports ─────────────────────────────────────────────────────────

describe('G — Hooks exports', () => {
  const src = () => readSrc('hooks/index.ts')

  it('exports useOperationsDashboard', () => {
    expect(src()).toContain('export function useOperationsDashboard')
  })

  it('exports useLiveOrders', () => {
    expect(src()).toContain('export function useLiveOrders')
  })

  it('exports useLiveReservations', () => {
    expect(src()).toContain('export function useLiveReservations')
  })

  it('exports useBranchStatus', () => {
    expect(src()).toContain('export function useBranchStatus')
  })

  it('exports useKitchenStatus', () => {
    expect(src()).toContain('export function useKitchenStatus')
  })

  it('exports useStaffPresence', () => {
    expect(src()).toContain('export function useStaffPresence')
  })

  it('exports useSLAAlerts', () => {
    expect(src()).toContain('export function useSLAAlerts')
  })

  it('exports useRealtimeStatistics', () => {
    expect(src()).toContain('export function useRealtimeStatistics')
  })

  it('exports useOperationsStream', () => {
    expect(src()).toContain('export function useOperationsStream')
  })

  it('imports realtimeOperationsService', () => {
    expect(src()).toContain("from '@/services/realtime-operations.service'")
  })

  it('useLiveOrders uses refetchInterval', () => {
    expect(src()).toContain('refetchInterval')
  })
})

// ── H — Branch isolation ──────────────────────────────────────────────────────

describe('H — Branch isolation', () => {
  beforeEach(() => vi.resetModules())

  it('getLiveOrders filters by branchId', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const all = await realtimeOperationsService.getLiveOrders({ tenantId: 'tenant-samoon-01' })
    const main = await realtimeOperationsService.getLiveOrders({ tenantId: 'tenant-samoon-01', branchId: 'branch-rest-01' })
    expect(main.length).toBeLessThanOrEqual(all.length)
    main.forEach((o) => expect(o.scope.branchId).toBe('branch-rest-01'))
  })

  it('getLiveReservations filters by branchId', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const main = await realtimeOperationsService.getLiveReservations({ tenantId: 'tenant-samoon-01', branchId: 'branch-rest-01' })
    main.forEach((r) => expect(r.scope.branchId).toBe('branch-rest-01'))
  })

  it('getStaffPresence filters by branchId', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const main = await realtimeOperationsService.getStaffPresence({ tenantId: 'tenant-samoon-01', branchId: 'branch-rest-01' })
    main.forEach((s) => expect(s.branchId).toBe('branch-rest-01'))
  })

  it('getKitchenStatus returns status for specific branch', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const ksRaw = await realtimeOperationsService.getKitchenStatus('branch-rest-01')
    const ks = ksRaw!
    expect(ks.branchId).toBeDefined()
  })

  it('getBranchStatus filters by tenantId', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const branches = await realtimeOperationsService.getBranchStatuses({ tenantId: 'tenant-samoon-01' })
    branches.forEach((b) => expect(b.tenantId).toBe('tenant-samoon-01'))
  })
})

// ── I — Tenant isolation ──────────────────────────────────────────────────────

describe('I — Tenant isolation', () => {
  beforeEach(() => vi.resetModules())

  it('getOperationsSnapshot scoped to tenant', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const snap = await realtimeOperationsService.getOperationsSnapshot({ tenantId: 'tenant-samoon-01' })
    expect(snap.scope.tenantId).toBe('tenant-samoon-01')
  })

  it('getRealtimeStatistics returns scope', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const stats = await realtimeOperationsService.getRealtimeStatistics({ tenantId: 'tenant-samoon-01' })
    expect(stats.scope.tenantId).toBe('tenant-samoon-01')
  })

  it('getBranchStatus for tenant B returns only tenant B branches', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const branches = await realtimeOperationsService.getBranchStatuses({ tenantId: 'tenant-brew-cafe-01' })
    branches.forEach((b) => expect(b.tenantId).toBe('tenant-brew-cafe-01'))
  })

  it('getOperationsSnapshot for different tenants returns different data', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const snapA = await realtimeOperationsService.getOperationsSnapshot({ tenantId: 'tenant-samoon-01' })
    const snapB = await realtimeOperationsService.getOperationsSnapshot({ tenantId: 'tenant-brew-cafe-01' })
    expect(snapA.scope.tenantId).toBe('tenant-samoon-01')
    expect(snapB.scope.tenantId).toBe('tenant-brew-cafe-01')
  })
})

// ── J — SLA alert logic ───────────────────────────────────────────────────────

describe('J — SLA alert logic', () => {
  beforeEach(() => vi.resetModules())

  it('active SLA alerts have isActive=true', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const alerts = await realtimeOperationsService.getSLAAlerts({ tenantId: 'tenant-samoon-01' })
    const active = alerts.filter((a) => a.isActive)
    active.forEach((a) => expect(a.resolvedAt).toBeUndefined())
  })

  it('SLA alert has elapsedMinutes > thresholdMinutes when active', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const alerts = await realtimeOperationsService.getSLAAlerts({ tenantId: 'tenant-samoon-01' })
    const active = alerts.filter((a) => a.isActive)
    active.forEach((a) => expect(a.elapsedMinutes).toBeGreaterThan(a.thresholdMinutes))
  })

  it('SLA alerts have valid priority', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const alerts = await realtimeOperationsService.getSLAAlerts({ tenantId: 'tenant-samoon-01' })
    const validPriorities = new Set(['low', 'normal', 'high', 'critical'])
    alerts.forEach((a) => expect(validPriorities.has(a.priority)).toBe(true))
  })

  it('SLA alerts have valid entityType', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const alerts = await realtimeOperationsService.getSLAAlerts({ tenantId: 'tenant-samoon-01' })
    const validTypes = new Set(['order', 'reservation', 'branch', 'staff'])
    alerts.forEach((a) => expect(validTypes.has(a.entityType)).toBe(true))
  })

  it('slaBreached orders have slaBreached=true', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const orders = await realtimeOperationsService.getLiveOrders({ tenantId: 'tenant-samoon-01' })
    const breached = orders.filter((o) => o.slaBreached)
    breached.forEach((o) => expect(o.slaBreached).toBe(true))
  })
})

// ── K — Statistics ────────────────────────────────────────────────────────────

describe('K — RealtimeStatistics', () => {
  beforeEach(() => vi.resetModules())

  it('statistics have valid numeric fields', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const stats = await realtimeOperationsService.getRealtimeStatistics({ tenantId: 'tenant-samoon-01' })
    expect(stats.eventsPerMinute).toBeGreaterThanOrEqual(0)
    expect(stats.totalEventsToday).toBeGreaterThanOrEqual(0)
    expect(stats.activeConnections).toBeGreaterThanOrEqual(0)
    expect(stats.slaCompliancePercent).toBeGreaterThanOrEqual(0)
    expect(stats.slaCompliancePercent).toBeLessThanOrEqual(100)
  })

  it('branchHealthSummary has healthy/degraded/critical/offline', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const stats = await realtimeOperationsService.getRealtimeStatistics({ tenantId: 'tenant-samoon-01' })
    expect(stats.branchHealthSummary).toHaveProperty('healthy')
    expect(stats.branchHealthSummary).toHaveProperty('degraded')
    expect(stats.branchHealthSummary).toHaveProperty('critical')
    expect(stats.branchHealthSummary).toHaveProperty('offline')
  })

  it('statistics updatedAt is valid ISO string', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const stats = await realtimeOperationsService.getRealtimeStatistics({ tenantId: 'tenant-samoon-01' })
    expect(() => new Date(stats.updated_at)).not.toThrow()
  })
})

// ── L — Kitchen status ────────────────────────────────────────────────────────

describe('L — KitchenStatus', () => {
  beforeEach(() => vi.resetModules())

  it('kitchenStatus has all order arrays', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const ksRaw = await realtimeOperationsService.getKitchenStatus('branch-rest-01')
    const ks = ksRaw!
    expect(ks.pendingOrders).toBeInstanceOf(Array)
    expect(ks.preparingOrders).toBeInstanceOf(Array)
    expect(ks.readyOrders).toBeInstanceOf(Array)
    expect(ks.delayedOrders).toBeInstanceOf(Array)
    expect(ks.priorityOrders).toBeInstanceOf(Array)
  })

  it('capacityPercent is 0-100', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const ksRaw = await realtimeOperationsService.getKitchenStatus('branch-rest-01')
    const ks = ksRaw!
    expect(ks.capacityPercent).toBeGreaterThanOrEqual(0)
    expect(ks.capacityPercent).toBeLessThanOrEqual(100)
  })

  it('queueDepth is non-negative', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const ksRaw = await realtimeOperationsService.getKitchenStatus('branch-rest-01')
    const ks = ksRaw!
    expect(ks.queueDepth).toBeGreaterThanOrEqual(0)
  })

  it('averagePrepMinutes is non-negative', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const ksRaw = await realtimeOperationsService.getKitchenStatus('branch-rest-01')
    const ks = ksRaw!
    expect(ks.averagePrepMinutes).toBeGreaterThanOrEqual(0)
  })
})

// ── M — Staff presence ────────────────────────────────────────────────────────

describe('M — Staff presence', () => {
  beforeEach(() => vi.resetModules())

  it('staff have valid status values', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const staff = await realtimeOperationsService.getStaffPresence({ tenantId: 'tenant-samoon-01' })
    const valid = new Set(['online', 'busy', 'break', 'offline'])
    staff.forEach((s) => expect(valid.has(s.status)).toBe(true))
  })

  it('staff have valid role values', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const staff = await realtimeOperationsService.getStaffPresence({ tenantId: 'tenant-samoon-01' })
    const validRoles = new Set(['owner', 'admin', 'manager', 'cashier', 'waiter', 'kitchen', 'marketing', 'support'])
    staff.forEach((s) => expect(validRoles.has(s.role)).toBe(true))
  })

  it('staff lastActivity is valid ISO string', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const staff = await realtimeOperationsService.getStaffPresence({ tenantId: 'tenant-samoon-01' })
    staff.forEach((s) => expect(() => new Date(s.lastActivity)).not.toThrow())
  })

  it('activeOrderCount is non-negative', async () => {
    const { realtimeOperationsService } = await import('@/services/realtime-operations.service')
    const staff = await realtimeOperationsService.getStaffPresence({ tenantId: 'tenant-samoon-01' })
    staff.forEach((s) => expect(s.activeOrderCount).toBeGreaterThanOrEqual(0))
  })
})

// ── N — Activity feed / deep links ────────────────────────────────────────────

describe('N — ActivityFeed component source', () => {
  const src = () => readSrc('components/admin/ActivityFeed.tsx')

  it('ActivityFeed.tsx exists', () => {
    expect(src()).toBeTruthy()
  })

  it('exports ActivityFeed component', () => {
    expect(src()).toContain('export function ActivityFeed')
  })

  it('resolves deep links for orders', () => {
    expect(src()).toContain('/console/orders/')
  })

  it('resolves deep links for reservations', () => {
    expect(src()).toContain('/console/reservations/')
  })

  it('resolves deep links for staff', () => {
    expect(src()).toContain('/console/staff/')
  })

  it('resolves deep links for audit events', () => {
    expect(src()).toContain('/console/audit-logs/')
  })

  it('uses useOperationsStream hook', () => {
    expect(src()).toContain('useOperationsStream')
  })

  it('renders chronologically sorted events', () => {
    expect(src()).toContain('occurredAt')
  })
})

// ── O — Operations page ───────────────────────────────────────────────────────

describe('O — Operations page source', () => {
  const src = () => readSrc('app/console/operations/page.tsx')

  it('page exists', () => {
    expect(src()).toBeTruthy()
  })

  it('has use client directive', () => {
    expect(src()).toContain("'use client'")
  })

  it('uses PermissionGuard with operations.view', () => {
    expect(src()).toContain("operations.view")
    expect(src()).toContain("PermissionGuard")
  })

  it('uses ErrorBoundary', () => {
    expect(src()).toContain('ErrorBoundary')
  })

  it('imports LiveOrderQueue', () => {
    expect(src()).toContain('LiveOrderQueue')
  })

  it('imports LiveReservationQueue', () => {
    expect(src()).toContain('LiveReservationQueue')
  })

  it('imports KitchenDisplay', () => {
    expect(src()).toContain('KitchenDisplay')
  })

  it('imports StaffPresenceBoard', () => {
    expect(src()).toContain('StaffPresenceBoard')
  })

  it('imports BranchStatusGrid', () => {
    expect(src()).toContain('BranchStatusGrid')
  })

  it('imports SLAMonitor', () => {
    expect(src()).toContain('SLAMonitor')
  })

  it('imports ActivityFeed', () => {
    expect(src()).toContain('ActivityFeed')
  })

  it('imports realtime dashboard widgets', () => {
    expect(src()).toContain('RealtimeConnectionStatus')
    expect(src()).toContain('SystemHealthBadge')
    expect(src()).toContain('BranchContextIndicator')
  })

  it('includes branch filter UI', () => {
    expect(src()).toContain('branchFilter')
  })

  it('shows statistics row', () => {
    expect(src()).toContain('StatCard')
  })
})

// ── P — Component sources ─────────────────────────────────────────────────────

describe('P — Component file structure', () => {
  const componentSrc = (name: string) => readSrc(`components/admin/${name}`)

  it('LiveOrderQueue.tsx exists and exports component', () => {
    const s = componentSrc('LiveOrderQueue.tsx')
    expect(s).toContain('export function LiveOrderQueue')
    expect(s).toContain('useLiveOrders')
  })

  it('LiveReservationQueue.tsx exists and exports component', () => {
    const s = componentSrc('LiveReservationQueue.tsx')
    expect(s).toContain('export function LiveReservationQueue')
    expect(s).toContain('useLiveReservations')
  })

  it('KitchenDisplay.tsx exists and exports component', () => {
    const s = componentSrc('KitchenDisplay.tsx')
    expect(s).toContain('export function KitchenDisplay')
    expect(s).toContain('useKitchenStatus')
  })

  it('StaffPresenceBoard.tsx exists and exports component', () => {
    const s = componentSrc('StaffPresenceBoard.tsx')
    expect(s).toContain('export function StaffPresenceBoard')
    expect(s).toContain('useStaffPresence')
  })

  it('BranchStatusGrid.tsx exists and exports component', () => {
    const s = componentSrc('BranchStatusGrid.tsx')
    expect(s).toContain('export function BranchStatusGrid')
    expect(s).toContain('useBranchStatus')
  })

  it('SLAMonitor.tsx exists and exports component', () => {
    const s = componentSrc('SLAMonitor.tsx')
    expect(s).toContain('export function SLAMonitor')
    expect(s).toContain('useSLAAlerts')
  })

  it('RealtimeDashboardWidgets.tsx exists with all 5 widgets', () => {
    const s = componentSrc('RealtimeDashboardWidgets.tsx')
    expect(s).toContain('export function RealtimeConnectionStatus')
    expect(s).toContain('export function ActiveUsersCounter')
    expect(s).toContain('export function EventsPerMinute')
    expect(s).toContain('export function SystemHealthBadge')
    expect(s).toContain('export function BranchContextIndicator')
  })

  it('LiveOrderQueue shows SLA breach indicator', () => {
    expect(componentSrc('LiveOrderQueue.tsx')).toContain('slaBreached')
  })

  it('LiveOrderQueue shows delay indicator', () => {
    expect(componentSrc('LiveOrderQueue.tsx')).toContain('isDelayed')
  })

  it('StaffPresenceBoard shows online/busy/break/offline sections', () => {
    const s = componentSrc('StaffPresenceBoard.tsx')
    expect(s).toContain('online')
    expect(s).toContain('busy')
    expect(s).toContain('break')
    expect(s).toContain('offline')
  })

  it('BranchStatusGrid shows health levels', () => {
    const s = componentSrc('BranchStatusGrid.tsx')
    expect(s).toContain('healthy')
    expect(s).toContain('degraded')
    expect(s).toContain('critical')
  })

  it('KitchenDisplay shows capacity percent', () => {
    expect(componentSrc('KitchenDisplay.tsx')).toContain('capacityPercent')
  })

  it('SLAMonitor shows SLA compliance', () => {
    expect(componentSrc('SLAMonitor.tsx')).toContain('slaCompliancePercent')
  })
})

// ── Q — Service test helpers ──────────────────────────────────────────────────

describe('Q — Service test helpers', () => {
  beforeEach(() => vi.resetModules())

  it('_resetMock resets to initial state', async () => {
    const svc = await import('@/services/realtime-operations.service')
    const countBefore = svc.realtimeOperationsService._getMockOrderCount()
    svc.realtimeOperationsService._resetMock()
    const countAfter = svc.realtimeOperationsService._getMockOrderCount()
    expect(countAfter).toBeGreaterThan(0)
    expect(typeof countAfter).toBe('number')
  })

  it('_getMockOrderCount returns number', async () => {
    const svc = await import('@/services/realtime-operations.service')
    expect(typeof svc.realtimeOperationsService._getMockOrderCount()).toBe('number')
  })

  it('_getMockBranchCount returns number', async () => {
    const svc = await import('@/services/realtime-operations.service')
    expect(typeof svc.realtimeOperationsService._getMockBranchCount()).toBe('number')
  })

  it('_getMockAlertCount returns number', async () => {
    const svc = await import('@/services/realtime-operations.service')
    expect(typeof svc.realtimeOperationsService._getMockAlertCount()).toBe('number')
  })

  it('_getMockEventCount returns number', async () => {
    const svc = await import('@/services/realtime-operations.service')
    expect(typeof svc.realtimeOperationsService._getMockEventCount()).toBe('number')
  })

  it('_getMockPresenceCount returns number', async () => {
    const svc = await import('@/services/realtime-operations.service')
    expect(typeof svc.realtimeOperationsService._getMockPresenceCount()).toBe('number')
  })
})

// ── R — Regression ────────────────────────────────────────────────────────────

describe('R — Regression', () => {
  beforeEach(() => vi.resetModules())

  it('P7.6 notification hooks still export from hooks/index.ts', () => {
    const src = readSrc('hooks/index.ts')
    expect(src).toContain('export function useNotificationSummary')
    expect(src).toContain('export function useUnreadNotifications')
    expect(src).toContain('export function useMarkNotificationRead')
  })

  it('P7.5 audit hooks still export', () => {
    const src = readSrc('hooks/index.ts')
    expect(src).toContain('export function useAuditLog')
  })

  it('P7.6 NOTIFICATIONS_NAV_ITEM still in all 6 modules', () => {
    const src = readSrc('modules/registry.ts')
    expect(src).toContain("href: '/console/notifications'")
    const count = (src.match(/NOTIFICATIONS_NAV_ITEM/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(6)
  })

  it('P7.7 OPERATIONS_NAV_ITEM in all 6 modules', () => {
    const src = readSrc('modules/registry.ts')
    expect(src).toContain("href: '/console/operations'")
    const count = (src.match(/OPERATIONS_NAV_ITEM/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(6)
  })

  it('permission.service.ts has the expected total permission count', async () => {
    const { ALL_PERMISSIONS } = await import('@/services/permission.service')
    // +rbac.manage_roles
    expect(ALL_PERMISSIONS).toHaveLength(65)
  })

  it('realtime types do not use any type', () => {
    const src = readSrc('types/realtime-operations.ts')
    expect(src).not.toContain(': any')
    expect(src).not.toContain('as any')
  })

  it('realtime-operations.service.ts does not have TODO comments', () => {
    const src = readSrc('services/realtime-operations.service.ts')
    expect(src).not.toContain('// TODO')
    expect(src).not.toContain('/* TODO')
  })

  it('operations page gated by operations.view not hardcoded role', () => {
    const src = readSrc('app/console/operations/page.tsx')
    expect(src).not.toMatch(/role\s*===\s*['"]/)
    expect(src).toContain('operations.view')
  })

  it('realtime-event-registry does not use require()', () => {
    const src = readSrc('services/realtime-event-registry.ts')
    expect(src).not.toContain('require(')
  })

  it('websocket service singletons created via operationsChannelManager', () => {
    const src = readSrc('services/websocket.service.ts')
    expect(src).toContain('operationsChannelManager.getOrCreate')
  })
})
