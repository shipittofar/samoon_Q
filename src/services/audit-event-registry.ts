// ============================================================
// P7.5 — Audit Event Registry
// Single source of truth for all auditable action definitions.
// ============================================================

import type { AuditAction, AuditSeverity, AuditTargetType } from '@/types/audit-log'

/** Metadata attached to each registered audit action. */
export interface AuditEventMeta {
  action: AuditAction
  domain: string
  description: string
  severity: AuditSeverity
  targetType: AuditTargetType
}

/** Complete registry of all audit event definitions. */
export const AUDIT_EVENT_REGISTRY: Readonly<Record<AuditAction, AuditEventMeta>> = {
  // ── Staff ────────────────────────────────────────────────────────────────
  STAFF_CREATED: {
    action: 'STAFF_CREATED',
    domain: 'staff',
    description: 'A new staff member was invited',
    severity: 'info',
    targetType: 'staff',
  },
  STAFF_UPDATED: {
    action: 'STAFF_UPDATED',
    domain: 'staff',
    description: 'Staff member roles or details were updated',
    severity: 'info',
    targetType: 'staff',
  },
  STAFF_SUSPENDED: {
    action: 'STAFF_SUSPENDED',
    domain: 'staff',
    description: 'A staff member was suspended',
    severity: 'warning',
    targetType: 'staff',
  },
  STAFF_REACTIVATED: {
    action: 'STAFF_REACTIVATED',
    domain: 'staff',
    description: 'A suspended staff member was reactivated',
    severity: 'info',
    targetType: 'staff',
  },
  STAFF_REMOVED: {
    action: 'STAFF_REMOVED',
    domain: 'staff',
    description: 'A staff member was permanently removed',
    severity: 'warning',
    targetType: 'staff',
  },
  OWNERSHIP_TRANSFERRED: {
    action: 'OWNERSHIP_TRANSFERRED',
    domain: 'staff',
    description: 'Tenant ownership was transferred to another user',
    severity: 'critical',
    targetType: 'staff',
  },
  STAFF_INVITE_SENT: {
    action: 'STAFF_INVITE_SENT',
    domain: 'staff',
    description: 'A staff invitation email was sent',
    severity: 'info',
    targetType: 'staff',
  },
  STAFF_INVITE_CANCELLED: {
    action: 'STAFF_INVITE_CANCELLED',
    domain: 'staff',
    description: 'A pending staff invitation was cancelled',
    severity: 'info',
    targetType: 'staff',
  },
  STAFF_INVITE_RESENT: {
    action: 'STAFF_INVITE_RESENT',
    domain: 'staff',
    description: 'A staff invitation email was resent',
    severity: 'info',
    targetType: 'staff',
  },
  INVITE_ACCEPTED: {
    action: 'INVITE_ACCEPTED',
    domain: 'staff',
    description: 'A staff invitation was accepted',
    severity: 'info',
    targetType: 'staff',
  },

  // ── Branch ───────────────────────────────────────────────────────────────
  BRANCH_CREATED: {
    action: 'BRANCH_CREATED',
    domain: 'branch',
    description: 'A new branch was created',
    severity: 'info',
    targetType: 'branch',
  },
  BRANCH_UPDATED: {
    action: 'BRANCH_UPDATED',
    domain: 'branch',
    description: 'Branch details were updated',
    severity: 'info',
    targetType: 'branch',
  },
  BRANCH_ACTIVATED: {
    action: 'BRANCH_ACTIVATED',
    domain: 'branch',
    description: 'A branch was activated',
    severity: 'info',
    targetType: 'branch',
  },
  BRANCH_DEACTIVATED: {
    action: 'BRANCH_DEACTIVATED',
    domain: 'branch',
    description: 'A branch was deactivated',
    severity: 'warning',
    targetType: 'branch',
  },
  BRANCH_MAINTENANCE_SET: {
    action: 'BRANCH_MAINTENANCE_SET',
    domain: 'branch',
    description: 'A branch was placed in maintenance mode',
    severity: 'warning',
    targetType: 'branch',
  },
  BRANCH_MANAGER_ASSIGNED: {
    action: 'BRANCH_MANAGER_ASSIGNED',
    domain: 'branch',
    description: 'A manager was assigned to a branch',
    severity: 'info',
    targetType: 'branch',
  },

  // ── Orders ───────────────────────────────────────────────────────────────
  ORDER_CREATED: {
    action: 'ORDER_CREATED',
    domain: 'orders',
    description: 'A new order was placed',
    severity: 'info',
    targetType: 'order',
  },
  ORDER_STATUS_CHANGED: {
    action: 'ORDER_STATUS_CHANGED',
    domain: 'orders',
    description: 'An order status was updated',
    severity: 'info',
    targetType: 'order',
  },

  // ── Reservations ─────────────────────────────────────────────────────────
  RESERVATION_CREATED: {
    action: 'RESERVATION_CREATED',
    domain: 'reservations',
    description: 'A new reservation was created',
    severity: 'info',
    targetType: 'reservation',
  },
  RESERVATION_CONFIRMED: {
    action: 'RESERVATION_CONFIRMED',
    domain: 'reservations',
    description: 'A reservation was confirmed',
    severity: 'info',
    targetType: 'reservation',
  },
  RESERVATION_CANCELLED: {
    action: 'RESERVATION_CANCELLED',
    domain: 'reservations',
    description: 'A reservation was cancelled',
    severity: 'warning',
    targetType: 'reservation',
  },

  // ── Tenant ───────────────────────────────────────────────────────────────
  TENANT_ACTIVATED: {
    action: 'TENANT_ACTIVATED',
    domain: 'tenant',
    description: 'A tenant was activated',
    severity: 'info',
    targetType: 'tenant',
  },
  TENANT_SUSPENDED: {
    action: 'TENANT_SUSPENDED',
    domain: 'tenant',
    description: 'A tenant was suspended',
    severity: 'critical',
    targetType: 'tenant',
  },
  TENANT_ARCHIVED: {
    action: 'TENANT_ARCHIVED',
    domain: 'tenant',
    description: 'A tenant was archived',
    severity: 'critical',
    targetType: 'tenant',
  },
  TENANT_PROVISIONED: {
    action: 'TENANT_PROVISIONED',
    domain: 'tenant',
    description: 'A new tenant was provisioned',
    severity: 'info',
    targetType: 'tenant',
  },
  TENANT_CLONED: {
    action: 'TENANT_CLONED',
    domain: 'tenant',
    description: 'A tenant was cloned',
    severity: 'info',
    targetType: 'tenant',
  },

  // ── Promotions ───────────────────────────────────────────────────────────
  PROMOTION_CREATED: {
    action: 'PROMOTION_CREATED',
    domain: 'promotions',
    description: 'A new promotion was created',
    severity: 'info',
    targetType: 'promotion',
  },
  PROMOTION_UPDATED: {
    action: 'PROMOTION_UPDATED',
    domain: 'promotions',
    description: 'A promotion was updated',
    severity: 'info',
    targetType: 'promotion',
  },
  PROMOTION_DISABLED: {
    action: 'PROMOTION_DISABLED',
    domain: 'promotions',
    description: 'A promotion was disabled',
    severity: 'warning',
    targetType: 'promotion',
  },
  PROMOTION_ACTIVATED: {
    action: 'PROMOTION_ACTIVATED',
    domain: 'promotions',
    description: 'A promotion was activated',
    severity: 'info',
    targetType: 'promotion',
  },

  // ── Vendors ──────────────────────────────────────────────────────────────
  VENDOR_CREATED: {
    action: 'VENDOR_CREATED',
    domain: 'vendors',
    description: 'A new vendor was created',
    severity: 'info',
    targetType: 'vendor',
  },
  VENDOR_UPDATED: {
    action: 'VENDOR_UPDATED',
    domain: 'vendors',
    description: 'Vendor details were updated',
    severity: 'info',
    targetType: 'vendor',
  },
  VENDOR_DISABLED: {
    action: 'VENDOR_DISABLED',
    domain: 'vendors',
    description: 'A vendor was disabled',
    severity: 'warning',
    targetType: 'vendor',
  },
  VENDOR_SETTLEMENT_CREATED: {
    action: 'VENDOR_SETTLEMENT_CREATED',
    domain: 'vendors',
    description: 'A vendor settlement was created',
    severity: 'info',
    targetType: 'vendor',
  },

  // ── Menu ─────────────────────────────────────────────────────────────────
  MENU_ITEM_CREATED: {
    action: 'MENU_ITEM_CREATED',
    domain: 'menu',
    description: 'A new menu item was created',
    severity: 'info',
    targetType: 'menu_item',
  },
  MENU_ITEM_UPDATED: {
    action: 'MENU_ITEM_UPDATED',
    domain: 'menu',
    description: 'A menu item was updated',
    severity: 'info',
    targetType: 'menu_item',
  },
  MENU_ITEM_DELETED: {
    action: 'MENU_ITEM_DELETED',
    domain: 'menu',
    description: 'A menu item was deleted',
    severity: 'warning',
    targetType: 'menu_item',
  },

  // ── Loyalty ──────────────────────────────────────────────────────────────
  LOYALTY_REWARD_CREATED: {
    action: 'LOYALTY_REWARD_CREATED',
    domain: 'loyalty',
    description: 'A new loyalty reward was created',
    severity: 'info',
    targetType: 'loyalty_reward',
  },
  LOYALTY_REWARD_UPDATED: {
    action: 'LOYALTY_REWARD_UPDATED',
    domain: 'loyalty',
    description: 'A loyalty reward was updated',
    severity: 'info',
    targetType: 'loyalty_reward',
  },
  LOYALTY_REWARD_DISABLED: {
    action: 'LOYALTY_REWARD_DISABLED',
    domain: 'loyalty',
    description: 'A loyalty reward was disabled',
    severity: 'warning',
    targetType: 'loyalty_reward',
  },
  LOYALTY_POINTS_EARNED: {
    action: 'LOYALTY_POINTS_EARNED',
    domain: 'loyalty',
    description: 'Loyalty points were earned',
    severity: 'info',
    targetType: 'loyalty_reward',
  },
  LOYALTY_REWARD_REDEEMED: {
    action: 'LOYALTY_REWARD_REDEEMED',
    domain: 'loyalty',
    description: 'A loyalty reward was redeemed',
    severity: 'info',
    targetType: 'loyalty_reward',
  },

  // ── Payments ─────────────────────────────────────────────────────────────
  PAYMENT_REFUNDED: {
    action: 'PAYMENT_REFUNDED',
    domain: 'payments',
    description: 'A payment was refunded',
    severity: 'critical',
    targetType: 'payment',
  },

  // ── Feature Flags ─────────────────────────────────────────────────────────
  FEATURE_FLAG_CHANGED: {
    action: 'FEATURE_FLAG_CHANGED',
    domain: 'settings',
    description: 'A feature flag was changed',
    severity: 'warning',
    targetType: 'feature_flag',
  },
}

/** All registered audit action keys. */
export const AUDIT_ACTIONS = Object.keys(AUDIT_EVENT_REGISTRY) as AuditAction[]

/** All auditable domain names. */
export const AUDIT_DOMAINS = [
  ...new Set(Object.values(AUDIT_EVENT_REGISTRY).map((e) => e.domain)),
]

/** Look up the metadata for a given action. Returns undefined for unregistered actions. */
export function getAuditEventMeta(action: AuditAction): AuditEventMeta {
  return AUDIT_EVENT_REGISTRY[action]
}

/** Returns all events for a given domain. */
export function getEventsByDomain(domain: string): AuditEventMeta[] {
  return Object.values(AUDIT_EVENT_REGISTRY).filter((e) => e.domain === domain)
}

/** Returns all events for a given target type. */
export function getEventsByTargetType(targetType: string): AuditEventMeta[] {
  return Object.values(AUDIT_EVENT_REGISTRY).filter((e) => e.targetType === targetType)
}

/** Returns all critical severity events. */
export function getCriticalEvents(): AuditEventMeta[] {
  return Object.values(AUDIT_EVENT_REGISTRY).filter((e) => e.severity === 'critical')
}
