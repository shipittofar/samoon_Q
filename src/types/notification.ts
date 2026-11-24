// ============================================================
// P7.6 — Enterprise Notification Center Types
// ============================================================

import type { Role } from '@/types/rbac'
import type { AuditAction } from '@/types/audit-log'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms'

export type NotificationStatus = 'unread' | 'read' | 'archived' | 'deleted'

export type NotificationCategory =
  | 'order'
  | 'reservation'
  | 'staff'
  | 'branch'
  | 'promotion'
  | 'tenant'
  | 'vendor'
  | 'loyalty'
  | 'payment'
  | 'system'
  | 'audit'

export type RichNotificationType =
  | 'order_created'
  | 'order_status_changed'
  | 'reservation_created'
  | 'reservation_confirmed'
  | 'reservation_cancelled'
  | 'staff_created'
  | 'staff_suspended'
  | 'staff_removed'
  | 'ownership_transferred'
  | 'branch_created'
  | 'branch_deactivated'
  | 'branch_maintenance'
  | 'promotion_created'
  | 'promotion_disabled'
  | 'tenant_activated'
  | 'tenant_suspended'
  | 'tenant_archived'
  | 'vendor_created'
  | 'loyalty_reward_created'
  | 'payment_refunded'
  | 'feature_flag_changed'
  | 'system_alert'
  | 'audit_critical'
  // Created by the backend (notifications app) from real events:
  | 'order_cancelled_by_customer'
  | 'reservation_cancelled_by_customer'
  | 'business_request_created'
  | 'business_request_approved'
  | 'business_request_rejected'
  | 'password_changed'
  | 'wallet_payment'
  | 'wallet_refund'
  | 'wallet_topup'
  | 'wallet_adjustment'
  | 'settlement_payout_requested'
  | 'settlement_account_submitted'
  | 'settlement_account_approved'
  | 'settlement_account_rejected'
  | 'settlement_payout_paid'
  | 'settlement_payout_rejected'

export interface NotificationScope {
  tenantId: string
  branchId?: string
}

export interface NotificationActor {
  id: string
  name: string
  roles: Role[]
}

export interface NotificationDeepLink {
  type: 'order' | 'reservation' | 'staff' | 'branch' | 'promotion' | 'audit_log' | 'vendor' | 'tenant'
  id: string
  href: string
}

export interface RichNotification {
  id: string
  type: RichNotificationType
  category: NotificationCategory
  priority: NotificationPriority
  status: NotificationStatus
  title: string
  message: string
  actor?: NotificationActor
  scope: NotificationScope
  deepLink?: NotificationDeepLink
  sourceAuditAction?: AuditAction
  channels: NotificationChannel[]
  data?: Record<string, unknown>
  created_at: string
  readAt?: string
  archivedAt?: string
  expiresAt?: string
}

export interface NotificationFilter {
  tenantId?: string
  branchId?: string
  category?: NotificationCategory
  priority?: NotificationPriority
  status?: NotificationStatus
  type?: RichNotificationType
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'priority' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedNotifications {
  results: RichNotification[]
  count: number
  page: number
  pageSize: number
  totalPages: number
  unreadCount: number
}

export interface NotificationGroup {
  category: NotificationCategory
  notifications: RichNotification[]
  unreadCount: number
  latestAt: string
}

export interface NotificationStatistics {
  totalNotifications: number
  unreadCount: number
  readCount: number
  archivedCount: number
  readRate: number
  notificationsByCategory: Record<NotificationCategory, number>
  notificationsByPriority: Record<NotificationPriority, number>
  notificationsByBranch: Record<string, number>
  notificationsByDay: Record<string, number>
  topTypes: Array<{ type: RichNotificationType; count: number }>
  dateFrom: string
  dateTo: string
}

export interface NotificationSummary {
  unreadCount: number
  urgentCount: number
  latestNotification?: RichNotification
  categories: Partial<Record<NotificationCategory, number>>
}

export interface ChannelPreference {
  in_app: boolean
  push: boolean
  email: boolean
  sms: boolean
}

export interface NotificationPreference {
  id: string
  userId: string
  tenantId: string
  branchId?: string
  category: NotificationCategory
  enabled: boolean
  channels: ChannelPreference
  minPriority: NotificationPriority
  updated_at: string
}

export interface NotificationDelivery {
  notificationId: string
  channel: NotificationChannel
  status: 'pending' | 'delivered' | 'failed'
  deliveredAt?: string
  failureReason?: string
  retryCount: number
}

export type NotificationType =
  | 'order_update'
  | 'reservation_update'
  | 'promotion'
  | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}
