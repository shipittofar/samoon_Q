// ============================================================
// P7.7 — Realtime Operations Types
// Tenant-aware, branch-aware, RBAC-aware operational types.
// ============================================================

import type { Role } from '@/types/rbac'
import type { ConnectionStatus } from '@/services/websocket.service'
import type { AuditAction } from '@/types/audit-log'
import type { RichNotificationType } from '@/types/notification'

// ── Primitive Enumerations ────────────────────────────────────────────────────

export type OperationsEventPriority = 'low' | 'normal' | 'high' | 'critical'

export type OperationsEventType =
  | 'LIVE_ORDER_CREATED'
  | 'LIVE_ORDER_UPDATED'
  | 'LIVE_ORDER_CANCELLED'
  | 'LIVE_RESERVATION_CREATED'
  | 'LIVE_RESERVATION_UPDATED'
  | 'LIVE_RESERVATION_CANCELLED'
  | 'LIVE_RESERVATION_CHECKED_IN'
  | 'STAFF_STATUS_CHANGED'
  | 'STAFF_PRESENCE_UPDATED'
  | 'BRANCH_STATUS_CHANGED'
  | 'BRANCH_HEALTH_UPDATED'
  | 'LIVE_NOTIFICATION'
  | 'LIVE_AUDIT_EVENT'
  | 'SLA_ALERT_RAISED'
  | 'SLA_ALERT_RESOLVED'
  | 'KITCHEN_QUEUE_UPDATED'
  | 'METRICS_UPDATED'
  | 'SYSTEM_ALERT'

export type OrderLiveStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled'

export type ReservationLiveStatus =
  | 'upcoming'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type StaffPresenceStatus = 'online' | 'busy' | 'break' | 'offline'

export type BranchHealthLevel = 'healthy' | 'degraded' | 'critical' | 'offline'

export type SLAAlertType =
  | 'order_prep_exceeded'
  | 'order_delivery_exceeded'
  | 'reservation_wait_exceeded'
  | 'kitchen_queue_depth'
  | 'staff_shortage'

// ── Scope ────────────────────────────────────────────────────────────────────

export interface OperationsScope {
  tenantId: string
  branchId?: string
}

// ── Core Event ───────────────────────────────────────────────────────────────

export interface OperationsEvent {
  id: string
  type: OperationsEventType
  priority: OperationsEventPriority
  scope: OperationsScope
  sourceAuditAction?: AuditAction
  payload: Record<string, unknown>
  actor?: { id: string; name: string; roles: Role[] }
  occurredAt: string
  processedAt?: string
}

// ── Live Order ────────────────────────────────────────────────────────────────

export interface LiveOrder {
  id: string
  orderNumber: string
  status: OrderLiveStatus
  tableNumber?: string
  items: Array<{ name: string; quantity: number; notes?: string }>
  customerId?: string
  customerName?: string
  totalAmount: number
  currency: string
  estimatedPrepMinutes: number
  acceptedAt?: string
  preparingAt?: string
  readyAt?: string
  created_at: string
  updated_at: string
  scope: OperationsScope
  isDelayed: boolean
  slaBreached: boolean
}

// ── Live Reservation ──────────────────────────────────────────────────────────

export interface LiveReservation {
  id: string
  guestName: string
  partySize: number
  status: ReservationLiveStatus
  tableId?: string
  tableNumber?: string
  scheduledAt: string
  checkedInAt?: string
  completedAt?: string
  waitMinutes: number
  notes?: string
  scope: OperationsScope
  isOverdue: boolean
}

// ── Staff Presence ────────────────────────────────────────────────────────────

export interface StaffPresence {
  userId: string
  name: string
  role: Role
  status: StaffPresenceStatus
  branchId: string
  branchName: string
  lastActivity: string
  activeOrderCount: number
  shiftStartedAt?: string
}

// ── Branch Status ─────────────────────────────────────────────────────────────

export interface BranchStatus {
  branchId: string
  branchName: string
  health: BranchHealthLevel
  tenantId: string
  isOpen: boolean
  activeOrders: number
  pendingReservations: number
  staffOnline: number
  notificationCount: number
  systemAlerts: string[]
  lastUpdated: string
}

export interface BranchHealth {
  branchId: string
  health: BranchHealthLevel
  issues: string[]
  score: number
  lastChecked: string
}

// ── Kitchen Status ────────────────────────────────────────────────────────────

export interface KitchenStatus {
  branchId: string
  branchName: string
  pendingOrders: LiveOrder[]
  preparingOrders: LiveOrder[]
  readyOrders: LiveOrder[]
  delayedOrders: LiveOrder[]
  priorityOrders: LiveOrder[]
  averagePrepMinutes: number
  queueDepth: number
  capacityPercent: number
  lastUpdated: string
}

// ── SLA Alert ─────────────────────────────────────────────────────────────────

export interface SLAAlert {
  id: string
  type: SLAAlertType
  priority: OperationsEventPriority
  scope: OperationsScope
  entityId: string
  entityType: 'order' | 'reservation' | 'branch' | 'staff'
  entityLabel: string
  message: string
  thresholdMinutes: number
  elapsedMinutes: number
  raisedAt: string
  resolvedAt?: string
  isActive: boolean
}

// ── Live Metric ───────────────────────────────────────────────────────────────

export interface LiveMetric {
  key: string
  label: string
  value: number
  previousValue?: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  updated_at: string
  scope: OperationsScope
}

// ── Operations Dashboard ──────────────────────────────────────────────────────

export interface OperationsDashboard {
  scope: OperationsScope
  liveOrders: LiveOrder[]
  liveReservations: LiveReservation[]
  branchStatuses: BranchStatus[]
  staffPresences: StaffPresence[]
  kitchenStatuses: KitchenStatus[]
  slaAlerts: SLAAlert[]
  recentEvents: OperationsEvent[]
  metrics: LiveMetric[]
  lastUpdated: string
}

// ── Realtime Stream ───────────────────────────────────────────────────────────

export type OperationsChannelName =
  | 'admin.operations'
  | 'branch.operations'
  | 'orders.broadcast'
  | 'reservations.broadcast'
  | 'staff.broadcast'
  | 'notifications.broadcast'
  | 'audit.broadcast'

export interface OperationsStream {
  channel: OperationsChannelName
  scope: OperationsScope
  connected: boolean
  connectionStatus: ConnectionStatus
  events: OperationsEvent[]
  lastEventAt?: string
  reconnectCount: number
}

// ── Realtime Connection State ─────────────────────────────────────────────────

export interface RealtimeConnectionState {
  status: ConnectionStatus
  reconnectCount: number
  lastConnectedAt?: string
  lastDisconnectedAt?: string
  pingLatencyMs?: number
  isHealthy: boolean
}

// ── Realtime Statistics ───────────────────────────────────────────────────────

export interface RealtimeStatistics {
  eventsPerMinute: number
  totalEventsToday: number
  activeConnections: number
  ordersProcessedToday: number
  reservationsToday: number
  averageOrderPrepMinutes: number
  slaCompliancePercent: number
  activeStaff: number
  branchHealthSummary: { healthy: number; degraded: number; critical: number; offline: number }
  updated_at: string
  scope: OperationsScope
}

// ── Realtime Event Map (for typed consumers) ──────────────────────────────────

export interface RealtimeEventMap {
  'live_order': LiveOrder
  'live_reservation': LiveReservation
  'staff_presence': StaffPresence
  'branch_status': BranchStatus
  'sla_alert': SLAAlert
  'operations_event': OperationsEvent
  'metrics_update': LiveMetric[]
  'system_alert': { message: string; severity: 'info' | 'warning' | 'critical' }
}
