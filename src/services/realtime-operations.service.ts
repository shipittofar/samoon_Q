// ============================================================
// P7.7 — Realtime Operations Service
// Mock-first, tenant-scoped, branch-scoped, permission-aware.
// The single source of truth for operational snapshots.
// ============================================================

import type {
  OperationsDashboard,
  LiveOrder,
  LiveReservation,
  StaffPresence,
  BranchStatus,
  KitchenStatus,
  SLAAlert,
  LiveMetric,
  RealtimeStatistics,
  OperationsEvent,
  OperationsScope,
  BranchHealthLevel,
} from '@/types/realtime-operations'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Mock data ─────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-samoon-01'
const TENANT_B = 'tenant-brew-cafe-01'
const BRANCH_1 = 'branch-rest-01'
const BRANCH_2 = 'branch-rest-02'
const BRANCH_3 = 'branch-cafe-01'

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

const MOCK_LIVE_ORDERS: LiveOrder[] = [
  {
    id: 'live-order-001',
    orderNumber: '#0042',
    status: 'preparing',
    tableNumber: '5',
    items: [
      { name: 'Grilled Chicken', quantity: 2, notes: 'No spice' },
      { name: 'Caesar Salad', quantity: 1 },
    ],
    customerName: 'Alice Johnson',
    totalAmount: 4500,
    currency: 'USD',
    estimatedPrepMinutes: 8,
    acceptedAt: minutesAgo(7),
    preparingAt: minutesAgo(6),
    created_at: minutesAgo(8),
    updated_at: minutesAgo(6),
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    isDelayed: false,
    slaBreached: false,
  },
  {
    id: 'live-order-002',
    orderNumber: '#0043',
    status: 'pending',
    tableNumber: '3',
    items: [{ name: 'Burger Deluxe', quantity: 1 }, { name: 'Fries', quantity: 2 }],
    customerName: 'Bob Smith',
    totalAmount: 2800,
    currency: 'USD',
    estimatedPrepMinutes: 12,
    created_at: minutesAgo(2),
    updated_at: minutesAgo(2),
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    isDelayed: false,
    slaBreached: false,
  },
  {
    id: 'live-order-003',
    orderNumber: '#0044',
    status: 'ready',
    tableNumber: '8',
    items: [{ name: 'Pasta Primavera', quantity: 1 }],
    customerName: 'Carol White',
    totalAmount: 1800,
    currency: 'USD',
    estimatedPrepMinutes: 15,
    acceptedAt: minutesAgo(18),
    preparingAt: minutesAgo(17),
    readyAt: minutesAgo(2),
    created_at: minutesAgo(20),
    updated_at: minutesAgo(2),
    scope: { tenantId: TENANT_A, branchId: BRANCH_2 },
    isDelayed: false,
    slaBreached: false,
  },
  {
    id: 'live-order-004',
    orderNumber: '#0045',
    status: 'preparing',
    tableNumber: '12',
    items: [{ name: 'Steak', quantity: 2 }, { name: 'Wine', quantity: 1 }],
    customerName: 'Dave Brown',
    totalAmount: 9800,
    currency: 'USD',
    estimatedPrepMinutes: 25,
    acceptedAt: minutesAgo(30),
    preparingAt: minutesAgo(28),
    created_at: minutesAgo(32),
    updated_at: minutesAgo(28),
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    isDelayed: true,
    slaBreached: true,
  },
  {
    id: 'live-order-005',
    orderNumber: '#0046',
    status: 'delivering',
    items: [{ name: 'Pizza Margherita', quantity: 1 }],
    customerName: 'Eve Martin',
    totalAmount: 1500,
    currency: 'USD',
    estimatedPrepMinutes: 20,
    acceptedAt: minutesAgo(22),
    preparingAt: minutesAgo(20),
    readyAt: minutesAgo(5),
    created_at: minutesAgo(25),
    updated_at: minutesAgo(5),
    scope: { tenantId: TENANT_B, branchId: BRANCH_3 },
    isDelayed: false,
    slaBreached: false,
  },
]

const MOCK_LIVE_RESERVATIONS: LiveReservation[] = [
  {
    id: 'live-res-001',
    guestName: 'Frank Lee',
    partySize: 4,
    status: 'confirmed',
    tableNumber: '10',
    scheduledAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    waitMinutes: 0,
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    isOverdue: false,
  },
  {
    id: 'live-res-002',
    guestName: 'Grace Kim',
    partySize: 2,
    status: 'checked_in',
    tableNumber: '7',
    scheduledAt: minutesAgo(5),
    checkedInAt: minutesAgo(3),
    waitMinutes: 3,
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    isOverdue: false,
  },
  {
    id: 'live-res-003',
    guestName: 'Hank Davis',
    partySize: 6,
    status: 'upcoming',
    scheduledAt: new Date(Date.now() + 45 * 60_000).toISOString(),
    waitMinutes: 0,
    notes: 'Birthday celebration — please prepare dessert',
    scope: { tenantId: TENANT_A, branchId: BRANCH_2 },
    isOverdue: false,
  },
  {
    id: 'live-res-004',
    guestName: 'Iris Wong',
    partySize: 3,
    status: 'upcoming',
    scheduledAt: minutesAgo(10),
    waitMinutes: 10,
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    isOverdue: true,
  },
]

const MOCK_STAFF_PRESENCES: StaffPresence[] = [
  {
    userId: 'user-manager-01',
    name: 'Maria Manager',
    role: 'manager',
    status: 'online',
    branchId: BRANCH_1,
    branchName: 'Main Restaurant',
    lastActivity: minutesAgo(2),
    activeOrderCount: 0,
    shiftStartedAt: minutesAgo(180),
  },
  {
    userId: 'user-kitchen-01',
    name: 'Kai Kitchen',
    role: 'kitchen',
    status: 'busy',
    branchId: BRANCH_1,
    branchName: 'Main Restaurant',
    lastActivity: minutesAgo(1),
    activeOrderCount: 3,
    shiftStartedAt: minutesAgo(240),
  },
  {
    userId: 'user-waiter-01',
    name: 'Will Waiter',
    role: 'waiter',
    status: 'online',
    branchId: BRANCH_1,
    branchName: 'Main Restaurant',
    lastActivity: minutesAgo(5),
    activeOrderCount: 2,
    shiftStartedAt: minutesAgo(120),
  },
  {
    userId: 'user-cashier-01',
    name: 'Casey Cashier',
    role: 'cashier',
    status: 'break',
    branchId: BRANCH_2,
    branchName: 'Downtown Branch',
    lastActivity: minutesAgo(15),
    activeOrderCount: 0,
    shiftStartedAt: minutesAgo(200),
  },
  {
    userId: 'user-support-01',
    name: 'Sam Support',
    role: 'support',
    status: 'offline',
    branchId: BRANCH_1,
    branchName: 'Main Restaurant',
    lastActivity: minutesAgo(60),
    activeOrderCount: 0,
  },
]

const MOCK_BRANCH_STATUSES: BranchStatus[] = [
  {
    branchId: BRANCH_1,
    branchName: 'Main Restaurant',
    health: 'healthy',
    tenantId: TENANT_A,
    isOpen: true,
    activeOrders: 3,
    pendingReservations: 2,
    staffOnline: 3,
    notificationCount: 4,
    systemAlerts: [],
    lastUpdated: minutesAgo(1),
  },
  {
    branchId: BRANCH_2,
    branchName: 'Downtown Branch',
    health: 'degraded',
    tenantId: TENANT_A,
    isOpen: true,
    activeOrders: 1,
    pendingReservations: 1,
    staffOnline: 1,
    notificationCount: 2,
    systemAlerts: ['Staff shortage detected'],
    lastUpdated: minutesAgo(2),
  },
  {
    branchId: BRANCH_3,
    branchName: 'Brew Cafe',
    health: 'healthy',
    tenantId: TENANT_B,
    isOpen: true,
    activeOrders: 1,
    pendingReservations: 0,
    staffOnline: 2,
    notificationCount: 1,
    systemAlerts: [],
    lastUpdated: minutesAgo(3),
  },
]

const MOCK_SLA_ALERTS: SLAAlert[] = [
  {
    id: 'sla-001',
    type: 'order_prep_exceeded',
    priority: 'high',
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    entityId: 'live-order-004',
    entityType: 'order',
    entityLabel: 'Order #0045',
    message: 'Order #0045 has been preparing for 28 minutes (SLA: 25 min)',
    thresholdMinutes: 25,
    elapsedMinutes: 28,
    raisedAt: minutesAgo(3),
    isActive: true,
  },
  {
    id: 'sla-002',
    type: 'reservation_wait_exceeded',
    priority: 'normal',
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    entityId: 'live-res-004',
    entityType: 'reservation',
    entityLabel: 'Iris Wong (3 guests)',
    message: 'Reservation overdue by 10 minutes — no table assigned',
    thresholdMinutes: 5,
    elapsedMinutes: 10,
    raisedAt: minutesAgo(5),
    isActive: true,
  },
]

const MOCK_METRICS: LiveMetric[] = [
  {
    key: 'orders_today',
    label: 'Orders Today',
    value: 47,
    previousValue: 41,
    unit: 'orders',
    trend: 'up',
    updated_at: minutesAgo(1),
    scope: { tenantId: TENANT_A },
  },
  {
    key: 'revenue_today',
    label: 'Revenue Today',
    value: 128500,
    previousValue: 112000,
    unit: 'USD',
    trend: 'up',
    updated_at: minutesAgo(1),
    scope: { tenantId: TENANT_A },
  },
  {
    key: 'avg_prep_minutes',
    label: 'Avg Prep Time',
    value: 14,
    previousValue: 16,
    unit: 'min',
    trend: 'down',
    updated_at: minutesAgo(2),
    scope: { tenantId: TENANT_A },
  },
  {
    key: 'sla_compliance',
    label: 'SLA Compliance',
    value: 94,
    previousValue: 91,
    unit: '%',
    trend: 'up',
    updated_at: minutesAgo(2),
    scope: { tenantId: TENANT_A },
  },
  {
    key: 'active_staff',
    label: 'Active Staff',
    value: 4,
    previousValue: 5,
    unit: 'staff',
    trend: 'down',
    updated_at: minutesAgo(5),
    scope: { tenantId: TENANT_A },
  },
]

const MOCK_EVENTS: OperationsEvent[] = [
  {
    id: 'ops-evt-001',
    type: 'LIVE_ORDER_CREATED',
    priority: 'normal',
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    sourceAuditAction: 'ORDER_CREATED',
    payload: { orderId: 'live-order-001', orderNumber: '#0042' },
    actor: { id: 'user-waiter-01', name: 'Will Waiter', roles: ['waiter'] },
    occurredAt: minutesAgo(8),
  },
  {
    id: 'ops-evt-002',
    type: 'STAFF_STATUS_CHANGED',
    priority: 'high',
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    sourceAuditAction: 'STAFF_SUSPENDED',
    payload: { userId: 'user-support-01', status: 'suspended' },
    actor: { id: 'user-admin-01', name: 'Alex Admin', roles: ['admin'] },
    occurredAt: minutesAgo(60),
  },
  {
    id: 'ops-evt-003',
    type: 'SLA_ALERT_RAISED',
    priority: 'high',
    scope: { tenantId: TENANT_A, branchId: BRANCH_1 },
    payload: { alertId: 'sla-001', entityId: 'live-order-004' },
    occurredAt: minutesAgo(3),
  },
]

// ── In-memory mock stores ─────────────────────────────────────────────────────

let _orders = [...MOCK_LIVE_ORDERS]
let _reservations = [...MOCK_LIVE_RESERVATIONS]
let _presences = [...MOCK_STAFF_PRESENCES]
let _branches = [...MOCK_BRANCH_STATUSES]
let _alerts = [...MOCK_SLA_ALERTS]
let _metrics = [...MOCK_METRICS]
let _events = [...MOCK_EVENTS]
let _eventSubscribers: Array<(event: OperationsEvent) => void> = []

// ── Filter helpers ────────────────────────────────────────────────────────────

function filterByScope<T extends { scope: OperationsScope }>(items: T[], scope: Partial<OperationsScope>): T[] {
  return items.filter((item) => {
    if (scope.tenantId && item.scope.tenantId !== scope.tenantId) return false
    if (scope.branchId && item.scope.branchId !== scope.branchId) return false
    return true
  })
}

// ── Statistics builder ────────────────────────────────────────────────────────

function buildStatistics(scope: Partial<OperationsScope>): RealtimeStatistics {
  const orders = filterByScope(_orders, scope)
  const presences = scope.tenantId
    ? _presences.filter((p) => {
        const branchOk = !scope.branchId || p.branchId === scope.branchId
        return branchOk
      })
    : _presences
  const branches = scope.tenantId
    ? _branches.filter((b) => b.tenantId === scope.tenantId && (!scope.branchId || b.branchId === scope.branchId))
    : _branches

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status))
  const avgPrep = activeOrders.length
    ? Math.round(activeOrders.reduce((s, o) => s + o.estimatedPrepMinutes, 0) / activeOrders.length)
    : 0
  const slaBreached = orders.filter((o) => o.slaBreached).length
  const slaCompliance = orders.length > 0
    ? Math.round(((orders.length - slaBreached) / orders.length) * 100)
    : 100

  const branchHealthSummary = { healthy: 0, degraded: 0, critical: 0, offline: 0 }
  for (const b of branches) {
    branchHealthSummary[b.health]++
  }

  return {
    eventsPerMinute: Math.round(_events.length / 60),
    totalEventsToday: _events.length * 12,
    activeConnections: presences.filter((p) => p.status === 'online' || p.status === 'busy').length,
    ordersProcessedToday: 47,
    reservationsToday: 8,
    averageOrderPrepMinutes: avgPrep,
    slaCompliancePercent: slaCompliance,
    activeStaff: presences.filter((p) => p.status !== 'offline').length,
    branchHealthSummary,
    updated_at: new Date().toISOString(),
    scope: { tenantId: scope.tenantId ?? 'all', branchId: scope.branchId },
  }
}

// ── Mock implementations ───────────────────────────────────────────────────────

async function getOperationsSnapshotMock(scope: Partial<OperationsScope>): Promise<OperationsDashboard> {
  const orders = filterByScope(_orders, scope)
  const reservations = filterByScope(_reservations, scope)
  const branches = scope.tenantId
    ? _branches.filter((b) => b.tenantId === scope.tenantId && (!scope.branchId || b.branchId === scope.branchId))
    : _branches
  const staff = scope.branchId
    ? _presences.filter((p) => p.branchId === scope.branchId)
    : _presences
  const events = filterByScope(_events, scope)
  const alerts = filterByScope(_alerts, scope)
  const metrics = filterByScope(_metrics, scope)

  const kitchenStatuses: KitchenStatus[] = branches.map((b) => {
    const branchOrders = orders.filter((o) => o.scope.branchId === b.branchId)
    const pending = branchOrders.filter((o) => o.status === 'pending')
    const preparing = branchOrders.filter((o) => o.status === 'preparing')
    const ready = branchOrders.filter((o) => o.status === 'ready')
    const delayed = branchOrders.filter((o) => o.isDelayed)
    const priority = branchOrders.filter((o) => o.slaBreached)
    const total = branchOrders.length
    const avgPrep = total > 0
      ? Math.round(branchOrders.reduce((s, o) => s + o.estimatedPrepMinutes, 0) / total)
      : 0

    return {
      branchId: b.branchId,
      branchName: b.branchName,
      pendingOrders: pending,
      preparingOrders: preparing,
      readyOrders: ready,
      delayedOrders: delayed,
      priorityOrders: priority,
      averagePrepMinutes: avgPrep,
      queueDepth: pending.length + preparing.length,
      capacityPercent: Math.min(100, Math.round((total / 10) * 100)),
      lastUpdated: new Date().toISOString(),
    }
  })

  return {
    scope: { tenantId: scope.tenantId ?? 'all', branchId: scope.branchId },
    liveOrders: orders,
    liveReservations: reservations,
    branchStatuses: branches,
    staffPresences: staff,
    kitchenStatuses,
    slaAlerts: alerts,
    recentEvents: events.slice(0, 20),
    metrics,
    lastUpdated: new Date().toISOString(),
  }
}

async function getBranchStatusMock(branchId: string): Promise<BranchStatus | null> {
  return _branches.find((b) => b.branchId === branchId) ?? null
}

async function getBranchStatusesMock(scope: Partial<OperationsScope>): Promise<BranchStatus[]> {
  return _branches.filter((b) => {
    if (scope.tenantId && b.tenantId !== scope.tenantId) return false
    if (scope.branchId && b.branchId !== scope.branchId) return false
    return true
  })
}

async function getBranchStatusesReal(scope: Partial<OperationsScope>): Promise<BranchStatus[]> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<BranchStatus[]>('/operations/branches/status/', { params: scope })
  return res.data
}

async function getKitchenStatusMock(branchId: string): Promise<KitchenStatus | null> {
  const branch = _branches.find((b) => b.branchId === branchId)
  if (!branch) return null
  const orders = _orders.filter((o) => o.scope.branchId === branchId)
  return {
    branchId,
    branchName: branch.branchName,
    pendingOrders: orders.filter((o) => o.status === 'pending'),
    preparingOrders: orders.filter((o) => o.status === 'preparing'),
    readyOrders: orders.filter((o) => o.status === 'ready'),
    delayedOrders: orders.filter((o) => o.isDelayed),
    priorityOrders: orders.filter((o) => o.slaBreached),
    averagePrepMinutes: orders.length
      ? Math.round(orders.reduce((s, o) => s + o.estimatedPrepMinutes, 0) / orders.length)
      : 0,
    queueDepth: orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length,
    capacityPercent: Math.min(100, Math.round((orders.length / 10) * 100)),
    lastUpdated: new Date().toISOString(),
  }
}

async function getLiveOrdersMock(scope: Partial<OperationsScope>): Promise<LiveOrder[]> {
  return filterByScope(_orders, scope)
}

async function getLiveReservationsMock(scope: Partial<OperationsScope>): Promise<LiveReservation[]> {
  return filterByScope(_reservations, scope)
}

async function getStaffPresenceMock(scope: Partial<OperationsScope>): Promise<StaffPresence[]> {
  return scope.branchId
    ? _presences.filter((p) => p.branchId === scope.branchId)
    : _presences
}

async function getSLAAlertsMock(scope: Partial<OperationsScope>): Promise<SLAAlert[]> {
  return filterByScope(_alerts.filter((a) => a.isActive), scope)
}

async function getRealtimeStatisticsMock(scope: Partial<OperationsScope>): Promise<RealtimeStatistics> {
  return buildStatistics(scope)
}

async function publishEventMock(event: Omit<OperationsEvent, 'id' | 'processedAt'>): Promise<OperationsEvent> {
  const full: OperationsEvent = {
    ...event,
    id: `ops-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    processedAt: new Date().toISOString(),
  }
  _events.push(full)
  _eventSubscribers.forEach((fn) => fn(full))
  return full
}

// ── Real API stubs ─────────────────────────────────────────────────────────────

async function getOperationsSnapshotReal(scope: Partial<OperationsScope>): Promise<OperationsDashboard> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<OperationsDashboard>('/operations/snapshot/', { params: scope })
  return res.data
}

async function getBranchStatusReal(branchId: string): Promise<BranchStatus | null> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<BranchStatus>(`/operations/branches/${branchId}/status/`)
  return res.data
}

async function getKitchenStatusReal(branchId: string): Promise<KitchenStatus | null> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<KitchenStatus>(`/operations/branches/${branchId}/kitchen/`)
  return res.data
}

async function getLiveOrdersReal(scope: Partial<OperationsScope>): Promise<LiveOrder[]> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<LiveOrder[]>('/operations/orders/live/', { params: scope })
  return res.data
}

async function getLiveReservationsReal(scope: Partial<OperationsScope>): Promise<LiveReservation[]> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<LiveReservation[]>('/operations/reservations/live/', { params: scope })
  return res.data
}

async function getStaffPresenceReal(scope: Partial<OperationsScope>): Promise<StaffPresence[]> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<StaffPresence[]>('/operations/staff/presence/', { params: scope })
  return res.data
}

async function getSLAAlertsReal(scope: Partial<OperationsScope>): Promise<SLAAlert[]> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<SLAAlert[]>('/operations/sla-alerts/', { params: scope })
  return res.data
}

async function getRealtimeStatisticsReal(scope: Partial<OperationsScope>): Promise<RealtimeStatistics> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.get<RealtimeStatistics>('/operations/statistics/', { params: scope })
  return res.data
}

async function publishEventReal(event: Omit<OperationsEvent, 'id' | 'processedAt'>): Promise<OperationsEvent> {
  const { default: api } = await import('@/services/axios.instance')
  const res = await api.post<OperationsEvent>('/operations/events/', event)
  return res.data
}

// ── Public service ─────────────────────────────────────────────────────────────

export const realtimeOperationsService = {
  getOperationsSnapshot: USE_MOCK ? getOperationsSnapshotMock : getOperationsSnapshotReal,
  getBranchStatus: USE_MOCK ? getBranchStatusMock : getBranchStatusReal,
  getBranchStatuses: USE_MOCK ? getBranchStatusesMock : getBranchStatusesReal,
  getKitchenStatus: USE_MOCK ? getKitchenStatusMock : getKitchenStatusReal,
  getLiveOrders: USE_MOCK ? getLiveOrdersMock : getLiveOrdersReal,
  getLiveReservations: USE_MOCK ? getLiveReservationsMock : getLiveReservationsReal,
  getStaffPresence: USE_MOCK ? getStaffPresenceMock : getStaffPresenceReal,
  getSLAAlerts: USE_MOCK ? getSLAAlertsMock : getSLAAlertsReal,
  getRealtimeStatistics: USE_MOCK ? getRealtimeStatisticsMock : getRealtimeStatisticsReal,
  publishEvent: USE_MOCK ? publishEventMock : publishEventReal,

  /** Subscribe to realtime events (mock mode only). Returns unsubscribe fn. */
  subscribe(fn: (event: OperationsEvent) => void): () => void {
    _eventSubscribers.push(fn)
    return () => {
      _eventSubscribers = _eventSubscribers.filter((s) => s !== fn)
    }
  },

  /** Fire-and-forget operational event. Never throws. */
  emit(event: Omit<OperationsEvent, 'id' | 'processedAt'>): void {
    const fn = USE_MOCK ? publishEventMock : publishEventReal
    fn(event).catch(() => {/* swallow */})
  },

  // ── Test helpers ──────────────────────────────────────────────────────────
  _resetMock(): void {
    _orders = [...MOCK_LIVE_ORDERS]
    _reservations = [...MOCK_LIVE_RESERVATIONS]
    _presences = [...MOCK_STAFF_PRESENCES]
    _branches = [...MOCK_BRANCH_STATUSES]
    _alerts = [...MOCK_SLA_ALERTS]
    _metrics = [...MOCK_METRICS]
    _events = [...MOCK_EVENTS]
    _eventSubscribers = []
  },
  _getMockOrderCount(): number { return _orders.length },
  _getMockBranchCount(): number { return _branches.length },
  _getMockAlertCount(): number { return _alerts.filter((a) => a.isActive).length },
  _getMockEventCount(): number { return _events.length },
  _getMockPresenceCount(): number { return _presences.length },
  _buildStatistics: buildStatistics,
}
