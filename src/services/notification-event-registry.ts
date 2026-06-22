// ============================================================
// P7.6 — Notification Event Registry
// Maps AuditActions → NotificationEvents.
// AuditEventRegistry remains the single source of truth for event definitions.
// This registry maps which audit actions generate notifications and with what priority.
// ============================================================

import { AUDIT_EVENT_REGISTRY, getAuditEventMeta } from '@/services/audit-event-registry'
import type { AuditAction } from '@/types/audit-log'
import type { NotificationPriority, NotificationCategory, RichNotificationType, NotificationChannel } from '@/types/notification'

export interface NotificationEventConfig {
  auditAction: AuditAction
  notificationType: RichNotificationType
  category: NotificationCategory
  priority: NotificationPriority
  channels: NotificationChannel[]
  titleTemplate: string
  messageTemplate: string
  generateDeepLink: boolean
  deepLinkType?: 'order' | 'reservation' | 'staff' | 'branch' | 'promotion' | 'audit_log' | 'vendor' | 'tenant'
  targetRoles: string[]
}

const AUDIT_TO_NOTIFICATION: Readonly<Record<AuditAction, NotificationEventConfig>> = {
  // ── Staff ──────────────────────────────────────────────────────────────────
  STAFF_CREATED: {
    auditAction: 'STAFF_CREATED',
    notificationType: 'staff_created',
    category: 'staff',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'New staff member added',
    messageTemplate: '{actor} added {target} to the team',
    generateDeepLink: true,
    deepLinkType: 'staff',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  STAFF_UPDATED: {
    auditAction: 'STAFF_UPDATED',
    notificationType: 'staff_created',
    category: 'staff',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Staff member updated',
    messageTemplate: '{actor} updated {target}\'s details',
    generateDeepLink: true,
    deepLinkType: 'staff',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  STAFF_SUSPENDED: {
    auditAction: 'STAFF_SUSPENDED',
    notificationType: 'staff_suspended',
    category: 'staff',
    priority: 'high',
    channels: ['in_app', 'push'],
    titleTemplate: 'Staff member suspended',
    messageTemplate: '{actor} suspended {target}',
    generateDeepLink: true,
    deepLinkType: 'staff',
    targetRoles: ['owner', 'admin'],
  },
  STAFF_REACTIVATED: {
    auditAction: 'STAFF_REACTIVATED',
    notificationType: 'staff_created',
    category: 'staff',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Staff member reactivated',
    messageTemplate: '{actor} reactivated {target}',
    generateDeepLink: true,
    deepLinkType: 'staff',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  STAFF_REMOVED: {
    auditAction: 'STAFF_REMOVED',
    notificationType: 'staff_removed',
    category: 'staff',
    priority: 'high',
    channels: ['in_app', 'push'],
    titleTemplate: 'Staff member removed',
    messageTemplate: '{actor} removed {target} from the team',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin'],
  },
  OWNERSHIP_TRANSFERRED: {
    auditAction: 'OWNERSHIP_TRANSFERRED',
    notificationType: 'ownership_transferred',
    category: 'staff',
    priority: 'urgent',
    channels: ['in_app', 'push', 'email'],
    titleTemplate: 'Ownership transferred',
    messageTemplate: '{actor} transferred ownership to {target}',
    generateDeepLink: true,
    deepLinkType: 'audit_log',
    targetRoles: ['owner', 'admin'],
  },
  STAFF_INVITE_SENT: {
    auditAction: 'STAFF_INVITE_SENT',
    notificationType: 'staff_created',
    category: 'staff',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Staff invitation sent',
    messageTemplate: '{actor} invited {target} to join',
    generateDeepLink: true,
    deepLinkType: 'staff',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  STAFF_INVITE_CANCELLED: {
    auditAction: 'STAFF_INVITE_CANCELLED',
    notificationType: 'staff_created',
    category: 'staff',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Staff invitation cancelled',
    messageTemplate: '{actor} cancelled the invitation to {target}',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin'],
  },
  STAFF_INVITE_RESENT: {
    auditAction: 'STAFF_INVITE_RESENT',
    notificationType: 'staff_created',
    category: 'staff',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Staff invitation resent',
    messageTemplate: '{actor} resent invitation to {target}',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  INVITE_ACCEPTED: {
    auditAction: 'INVITE_ACCEPTED',
    notificationType: 'staff_created',
    category: 'staff',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Invitation accepted',
    messageTemplate: '{target} accepted the staff invitation',
    generateDeepLink: true,
    deepLinkType: 'staff',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  // ── Branch ─────────────────────────────────────────────────────────────────
  BRANCH_CREATED: {
    auditAction: 'BRANCH_CREATED',
    notificationType: 'branch_created',
    category: 'branch',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'New branch created',
    messageTemplate: '{actor} created branch {target}',
    generateDeepLink: true,
    deepLinkType: 'branch',
    targetRoles: ['owner', 'admin'],
  },
  BRANCH_UPDATED: {
    auditAction: 'BRANCH_UPDATED',
    notificationType: 'branch_created',
    category: 'branch',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Branch updated',
    messageTemplate: '{actor} updated branch {target}',
    generateDeepLink: true,
    deepLinkType: 'branch',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  BRANCH_ACTIVATED: {
    auditAction: 'BRANCH_ACTIVATED',
    notificationType: 'branch_created',
    category: 'branch',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Branch activated',
    messageTemplate: '{actor} activated branch {target}',
    generateDeepLink: true,
    deepLinkType: 'branch',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  BRANCH_DEACTIVATED: {
    auditAction: 'BRANCH_DEACTIVATED',
    notificationType: 'branch_deactivated',
    category: 'branch',
    priority: 'high',
    channels: ['in_app', 'push'],
    titleTemplate: 'Branch deactivated',
    messageTemplate: '{actor} deactivated branch {target}',
    generateDeepLink: true,
    deepLinkType: 'branch',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  BRANCH_MAINTENANCE_SET: {
    auditAction: 'BRANCH_MAINTENANCE_SET',
    notificationType: 'branch_maintenance',
    category: 'branch',
    priority: 'high',
    channels: ['in_app', 'push'],
    titleTemplate: 'Branch in maintenance',
    messageTemplate: '{target} is now in maintenance mode',
    generateDeepLink: true,
    deepLinkType: 'branch',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  BRANCH_MANAGER_ASSIGNED: {
    auditAction: 'BRANCH_MANAGER_ASSIGNED',
    notificationType: 'branch_created',
    category: 'branch',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Branch manager assigned',
    messageTemplate: '{actor} assigned a manager to {target}',
    generateDeepLink: true,
    deepLinkType: 'branch',
    targetRoles: ['owner', 'admin'],
  },
  // ── Orders ─────────────────────────────────────────────────────────────────
  ORDER_CREATED: {
    auditAction: 'ORDER_CREATED',
    notificationType: 'order_created',
    category: 'order',
    priority: 'normal',
    channels: ['in_app', 'push'],
    titleTemplate: 'New order received',
    messageTemplate: 'Order {target} has been placed',
    generateDeepLink: true,
    deepLinkType: 'order',
    targetRoles: ['owner', 'admin', 'manager', 'kitchen', 'cashier'],
  },
  ORDER_STATUS_CHANGED: {
    auditAction: 'ORDER_STATUS_CHANGED',
    notificationType: 'order_status_changed',
    category: 'order',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Order status updated',
    messageTemplate: 'Order {target} status has changed',
    generateDeepLink: true,
    deepLinkType: 'order',
    targetRoles: ['owner', 'admin', 'manager', 'kitchen', 'cashier', 'waiter'],
  },
  // ── Reservations ───────────────────────────────────────────────────────────
  RESERVATION_CREATED: {
    auditAction: 'RESERVATION_CREATED',
    notificationType: 'reservation_created',
    category: 'reservation',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'New reservation',
    messageTemplate: 'A new reservation has been made for {target}',
    generateDeepLink: true,
    deepLinkType: 'reservation',
    targetRoles: ['owner', 'admin', 'manager', 'waiter'],
  },
  RESERVATION_CONFIRMED: {
    auditAction: 'RESERVATION_CONFIRMED',
    notificationType: 'reservation_confirmed',
    category: 'reservation',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Reservation confirmed',
    messageTemplate: '{actor} confirmed reservation for {target}',
    generateDeepLink: true,
    deepLinkType: 'reservation',
    targetRoles: ['owner', 'admin', 'manager', 'waiter'],
  },
  RESERVATION_CANCELLED: {
    auditAction: 'RESERVATION_CANCELLED',
    notificationType: 'reservation_cancelled',
    category: 'reservation',
    priority: 'high',
    channels: ['in_app', 'push'],
    titleTemplate: 'Reservation cancelled',
    messageTemplate: 'Reservation for {target} has been cancelled',
    generateDeepLink: true,
    deepLinkType: 'reservation',
    targetRoles: ['owner', 'admin', 'manager', 'waiter'],
  },
  // ── Tenant ─────────────────────────────────────────────────────────────────
  TENANT_ACTIVATED: {
    auditAction: 'TENANT_ACTIVATED',
    notificationType: 'tenant_activated',
    category: 'tenant',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Tenant activated',
    messageTemplate: 'Tenant {target} has been activated',
    generateDeepLink: true,
    deepLinkType: 'tenant',
    targetRoles: ['owner'],
  },
  TENANT_SUSPENDED: {
    auditAction: 'TENANT_SUSPENDED',
    notificationType: 'tenant_suspended',
    category: 'tenant',
    priority: 'urgent',
    channels: ['in_app', 'push', 'email'],
    titleTemplate: 'Tenant suspended',
    messageTemplate: 'Tenant {target} has been suspended',
    generateDeepLink: true,
    deepLinkType: 'audit_log',
    targetRoles: ['owner'],
  },
  TENANT_ARCHIVED: {
    auditAction: 'TENANT_ARCHIVED',
    notificationType: 'tenant_archived',
    category: 'tenant',
    priority: 'urgent',
    channels: ['in_app', 'push', 'email'],
    titleTemplate: 'Tenant archived',
    messageTemplate: 'Tenant {target} has been archived',
    generateDeepLink: true,
    deepLinkType: 'audit_log',
    targetRoles: ['owner'],
  },
  TENANT_PROVISIONED: {
    auditAction: 'TENANT_PROVISIONED',
    notificationType: 'tenant_activated',
    category: 'tenant',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Tenant provisioned',
    messageTemplate: 'Tenant {target} has been provisioned',
    generateDeepLink: true,
    deepLinkType: 'tenant',
    targetRoles: ['owner'],
  },
  TENANT_CLONED: {
    auditAction: 'TENANT_CLONED',
    notificationType: 'tenant_activated',
    category: 'tenant',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Tenant cloned',
    messageTemplate: '{actor} cloned tenant {target}',
    generateDeepLink: true,
    deepLinkType: 'tenant',
    targetRoles: ['owner'],
  },
  // ── Promotions ─────────────────────────────────────────────────────────────
  PROMOTION_CREATED: {
    auditAction: 'PROMOTION_CREATED',
    notificationType: 'promotion_created',
    category: 'promotion',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'New promotion created',
    messageTemplate: '{actor} created promotion {target}',
    generateDeepLink: true,
    deepLinkType: 'promotion',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  PROMOTION_UPDATED: {
    auditAction: 'PROMOTION_UPDATED',
    notificationType: 'promotion_created',
    category: 'promotion',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Promotion updated',
    messageTemplate: '{actor} updated promotion {target}',
    generateDeepLink: true,
    deepLinkType: 'promotion',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  PROMOTION_DISABLED: {
    auditAction: 'PROMOTION_DISABLED',
    notificationType: 'promotion_disabled',
    category: 'promotion',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Promotion disabled',
    messageTemplate: '{actor} disabled promotion {target}',
    generateDeepLink: true,
    deepLinkType: 'promotion',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  PROMOTION_ACTIVATED: {
    auditAction: 'PROMOTION_ACTIVATED',
    notificationType: 'promotion_created',
    category: 'promotion',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Promotion activated',
    messageTemplate: '{actor} activated promotion {target}',
    generateDeepLink: true,
    deepLinkType: 'promotion',
    targetRoles: ['owner', 'admin', 'manager'],
  },
  // ── Vendors ────────────────────────────────────────────────────────────────
  VENDOR_CREATED: {
    auditAction: 'VENDOR_CREATED',
    notificationType: 'vendor_created',
    category: 'vendor',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'New vendor created',
    messageTemplate: '{actor} created vendor {target}',
    generateDeepLink: true,
    deepLinkType: 'vendor',
    targetRoles: ['owner', 'admin'],
  },
  VENDOR_UPDATED: {
    auditAction: 'VENDOR_UPDATED',
    notificationType: 'vendor_created',
    category: 'vendor',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Vendor updated',
    messageTemplate: '{actor} updated vendor {target}',
    generateDeepLink: true,
    deepLinkType: 'vendor',
    targetRoles: ['owner', 'admin'],
  },
  VENDOR_DISABLED: {
    auditAction: 'VENDOR_DISABLED',
    notificationType: 'vendor_created',
    category: 'vendor',
    priority: 'high',
    channels: ['in_app', 'push'],
    titleTemplate: 'Vendor disabled',
    messageTemplate: '{actor} disabled vendor {target}',
    generateDeepLink: true,
    deepLinkType: 'vendor',
    targetRoles: ['owner', 'admin'],
  },
  VENDOR_SETTLEMENT_CREATED: {
    auditAction: 'VENDOR_SETTLEMENT_CREATED',
    notificationType: 'vendor_created',
    category: 'vendor',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Vendor settlement created',
    messageTemplate: '{actor} created settlement for {target}',
    generateDeepLink: true,
    deepLinkType: 'vendor',
    targetRoles: ['owner', 'admin'],
  },
  // ── Menu ───────────────────────────────────────────────────────────────────
  MENU_ITEM_CREATED: {
    auditAction: 'MENU_ITEM_CREATED',
    notificationType: 'promotion_created',
    category: 'system',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Menu item added',
    messageTemplate: '{actor} added {target} to the menu',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  MENU_ITEM_UPDATED: {
    auditAction: 'MENU_ITEM_UPDATED',
    notificationType: 'promotion_created',
    category: 'system',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Menu item updated',
    messageTemplate: '{actor} updated menu item {target}',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  MENU_ITEM_DELETED: {
    auditAction: 'MENU_ITEM_DELETED',
    notificationType: 'promotion_disabled',
    category: 'system',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Menu item deleted',
    messageTemplate: '{actor} deleted menu item {target}',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  // ── Loyalty ────────────────────────────────────────────────────────────────
  LOYALTY_REWARD_CREATED: {
    auditAction: 'LOYALTY_REWARD_CREATED',
    notificationType: 'promotion_created',
    category: 'loyalty',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Loyalty reward created',
    messageTemplate: '{actor} created loyalty reward {target}',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  LOYALTY_REWARD_UPDATED: {
    auditAction: 'LOYALTY_REWARD_UPDATED',
    notificationType: 'promotion_created',
    category: 'loyalty',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Loyalty reward updated',
    messageTemplate: '{actor} updated loyalty reward {target}',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  LOYALTY_REWARD_DISABLED: {
    auditAction: 'LOYALTY_REWARD_DISABLED',
    notificationType: 'promotion_disabled',
    category: 'loyalty',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Loyalty reward disabled',
    messageTemplate: '{actor} disabled loyalty reward {target}',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  LOYALTY_POINTS_EARNED: {
    auditAction: 'LOYALTY_POINTS_EARNED',
    notificationType: 'order_status_changed',
    category: 'loyalty',
    priority: 'low',
    channels: ['in_app'],
    titleTemplate: 'Loyalty points earned',
    messageTemplate: '{target} earned loyalty points',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin'],
  },
  LOYALTY_REWARD_REDEEMED: {
    auditAction: 'LOYALTY_REWARD_REDEEMED',
    notificationType: 'order_status_changed',
    category: 'loyalty',
    priority: 'normal',
    channels: ['in_app'],
    titleTemplate: 'Loyalty reward redeemed',
    messageTemplate: '{target} redeemed a loyalty reward',
    generateDeepLink: false,
    targetRoles: ['owner', 'admin', 'manager'],
  },
  // ── Payments ───────────────────────────────────────────────────────────────
  PAYMENT_REFUNDED: {
    auditAction: 'PAYMENT_REFUNDED',
    notificationType: 'payment_refunded',
    category: 'payment',
    priority: 'urgent',
    channels: ['in_app', 'push', 'email'],
    titleTemplate: 'Payment refunded',
    messageTemplate: '{actor} issued a refund for {target}',
    generateDeepLink: true,
    deepLinkType: 'audit_log',
    targetRoles: ['owner', 'admin'],
  },
  // ── System ─────────────────────────────────────────────────────────────────
  FEATURE_FLAG_CHANGED: {
    auditAction: 'FEATURE_FLAG_CHANGED',
    notificationType: 'feature_flag_changed',
    category: 'system',
    priority: 'high',
    channels: ['in_app'],
    titleTemplate: 'Feature flag changed',
    messageTemplate: '{actor} changed feature flag {target}',
    generateDeepLink: true,
    deepLinkType: 'audit_log',
    targetRoles: ['owner', 'admin'],
  },
}

export const NOTIFICATION_EVENT_REGISTRY: Readonly<Record<AuditAction, NotificationEventConfig>> = AUDIT_TO_NOTIFICATION

export const NOTIFICATION_AUDIT_ACTIONS = Object.keys(NOTIFICATION_EVENT_REGISTRY) as AuditAction[]

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'order', 'reservation', 'staff', 'branch', 'promotion',
  'tenant', 'vendor', 'loyalty', 'payment', 'system', 'audit',
]

export function getNotificationConfig(action: AuditAction): NotificationEventConfig {
  const config = NOTIFICATION_EVENT_REGISTRY[action]
  if (!config) throw new Error(`No notification config for action: ${action}`)
  return config
}

export function getNotificationsByCategory(category: NotificationCategory): NotificationEventConfig[] {
  return Object.values(NOTIFICATION_EVENT_REGISTRY).filter((c) => c.category === category)
}

export function getUrgentNotificationActions(): AuditAction[] {
  return Object.values(NOTIFICATION_EVENT_REGISTRY)
    .filter((c) => c.priority === 'urgent')
    .map((c) => c.auditAction)
}

export function getHighPriorityActions(): AuditAction[] {
  return Object.values(NOTIFICATION_EVENT_REGISTRY)
    .filter((c) => c.priority === 'high' || c.priority === 'urgent')
    .map((c) => c.auditAction)
}

export function resolveNotificationTitle(config: NotificationEventConfig, actorName: string, targetName: string): string {
  return config.titleTemplate
}

export function resolveNotificationMessage(config: NotificationEventConfig, actorName: string, targetName: string): string {
  return config.messageTemplate
    .replace('{actor}', actorName)
    .replace('{target}', targetName)
}

export function buildDeepLinkHref(type: NonNullable<NotificationEventConfig['deepLinkType']>, id: string): string {
  const DEEP_LINK_MAP: Record<string, string> = {
    order: `/admin/orders/${id}`,
    reservation: `/admin/reservations/${id}`,
    staff: `/admin/staff/${id}`,
    branch: `/admin/branches/${id}`,
    promotion: `/admin/promotions/${id}`,
    audit_log: `/admin/audit-logs/${id}`,
    vendor: `/admin/vendors/${id}`,
    tenant: `/admin/tenants/${id}`,
  }
  return DEEP_LINK_MAP[type] ?? '/'
}

export function verifyRegistryConsumesAuditRegistry(): boolean {
  const auditActions = Object.keys(AUDIT_EVENT_REGISTRY) as AuditAction[]
  return auditActions.every((action) => action in NOTIFICATION_EVENT_REGISTRY)
}

export function getAuditMetaForNotification(action: AuditAction) {
  return getAuditEventMeta(action)
}
