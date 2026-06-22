// ============================================================
// P7.5 — Enterprise Audit Log Types
// ============================================================

import type { Role } from '@/types/rbac'

/** Severity level of an audit event. */
export type AuditSeverity = 'info' | 'warning' | 'critical'

/**
 * All auditable action identifiers — kept in sync with AuditEventRegistry.
 * Add new actions here and in audit-event-registry.ts simultaneously.
 */
export type AuditAction =
  | 'STAFF_CREATED'
  | 'STAFF_UPDATED'
  | 'STAFF_SUSPENDED'
  | 'STAFF_REACTIVATED'
  | 'STAFF_REMOVED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'STAFF_INVITE_SENT'
  | 'STAFF_INVITE_CANCELLED'
  | 'STAFF_INVITE_RESENT'
  | 'INVITE_ACCEPTED'
  | 'BRANCH_CREATED'
  | 'BRANCH_UPDATED'
  | 'BRANCH_ACTIVATED'
  | 'BRANCH_DEACTIVATED'
  | 'BRANCH_MAINTENANCE_SET'
  | 'BRANCH_MANAGER_ASSIGNED'
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'RESERVATION_CREATED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_CANCELLED'
  | 'TENANT_ACTIVATED'
  | 'TENANT_SUSPENDED'
  | 'TENANT_ARCHIVED'
  | 'TENANT_PROVISIONED'
  | 'TENANT_CLONED'
  | 'PROMOTION_CREATED'
  | 'PROMOTION_UPDATED'
  | 'PROMOTION_DISABLED'
  | 'PROMOTION_ACTIVATED'
  | 'VENDOR_CREATED'
  | 'VENDOR_UPDATED'
  | 'VENDOR_DISABLED'
  | 'VENDOR_SETTLEMENT_CREATED'
  | 'MENU_ITEM_CREATED'
  | 'MENU_ITEM_UPDATED'
  | 'MENU_ITEM_DELETED'
  | 'LOYALTY_REWARD_CREATED'
  | 'LOYALTY_REWARD_UPDATED'
  | 'LOYALTY_REWARD_DISABLED'
  | 'LOYALTY_POINTS_EARNED'
  | 'LOYALTY_REWARD_REDEEMED'
  | 'PAYMENT_REFUNDED'
  | 'FEATURE_FLAG_CHANGED'

/** The entity type that was acted upon. */
export type AuditTargetType =
  | 'staff'
  | 'branch'
  | 'order'
  | 'reservation'
  | 'tenant'
  | 'promotion'
  | 'vendor'
  | 'menu_item'
  | 'loyalty_reward'
  | 'payment'
  | 'feature_flag'

/** The actor who performed the action. */
export interface AuditActor {
  id: string
  name: string
  email?: string
  roles: Role[]
}

/** The entity that was acted upon. */
export interface AuditTarget {
  type: AuditTargetType
  id: string
  displayName: string
}

/** Tenant and branch scope of the event. */
export interface AuditScope {
  tenantId: string
  branchId?: string
}

/** HTTP/session metadata for traceability. */
export interface AuditMetadata {
  correlationId?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

/** Before/after snapshot of changed fields. */
export interface AuditChangeSet {
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  changedFields?: string[]
}

/** A single persisted audit log record. */
export interface AuditLog {
  id: string
  action: AuditAction
  actor: AuditActor
  target: AuditTarget
  scope: AuditScope
  severity: AuditSeverity
  changeset: AuditChangeSet
  metadata: AuditMetadata
  timestamp: string
  description: string
}

/** Filters applied when querying audit logs. */
export interface AuditFilter {
  tenantId?: string
  branchId?: string
  actorId?: string
  targetType?: AuditTargetType
  action?: AuditAction
  severity?: AuditSeverity
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: 'timestamp' | 'severity' | 'action'
  sortOrder?: 'asc' | 'desc'
}

/** Request payload for exporting audit logs. */
export interface AuditExportRequest {
  filter: AuditFilter
  format: 'csv' | 'excel'
  includeChangeset: boolean
}

/** A grouped timeline entry for UI rendering. */
export interface AuditTimelineItem {
  date: string
  events: AuditLog[]
}

/** Aggregate statistics over a set of audit logs. */
export interface AuditStatistics {
  totalEvents: number
  eventsPerDay: Record<string, number>
  eventsPerActor: Record<string, number>
  eventsPerBranch: Record<string, number>
  eventsPerDomain: Record<string, number>
  criticalEvents: number
  warningEvents: number
  infoEvents: number
  topActions: Array<{ action: AuditAction; count: number }>
  dateFrom: string
  dateTo: string
}

/** Paginated response wrapper for audit log queries. */
export interface PaginatedAuditLogs {
  results: AuditLog[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}
