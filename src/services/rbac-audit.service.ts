// ============================================================
// P8.6 — RBAC Audit Service
// ============================================================

import type { RbacAuditEvent, Role, P7Permission } from '@/types/rbac'

let _getStore: (() => {
  addRbacAuditEvent: (event: RbacAuditEvent) => void
  getRbacAuditLog: (tenantId: string) => RbacAuditEvent[]
  clearRbacAuditLog: (tenantId: string) => void
}) | null = null

export function setRbacAuditStoreAccessor(
  fn: () => {
    addRbacAuditEvent: (event: RbacAuditEvent) => void
    getRbacAuditLog: (tenantId: string) => RbacAuditEvent[]
    clearRbacAuditLog: (tenantId: string) => void
  },
) {
  _getStore = fn
}

function genId(): string {
  return `rbac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const rbacAuditService = {
  logRoleAssigned(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    branchId?: string
    role: Role | string
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'role_assigned',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      branchId: params.branchId,
      role: params.role,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logRoleRemoved(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    branchId?: string
    role: Role | string
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'role_removed',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      branchId: params.branchId,
      role: params.role,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logPermissionGranted(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    permission: P7Permission
    oldValue?: boolean
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'permission_granted',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      permission: params.permission,
      oldValue: params.oldValue,
      newValue: true,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logPermissionDenied(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    permission: P7Permission
    oldValue?: boolean
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'permission_denied',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      permission: params.permission,
      oldValue: params.oldValue,
      newValue: false,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logPermissionReset(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    permission: P7Permission
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'permission_reset',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      permission: params.permission,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logCustomRoleCreated(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    role: string
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'custom_role_created',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      role: params.role,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logCustomRoleEdited(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    role: string
    oldValue?: unknown
    newValue?: unknown
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'custom_role_edited',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      role: params.role,
      oldValue: params.oldValue,
      newValue: params.newValue,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logCustomRoleDeleted(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    role: string
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'custom_role_deleted',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      role: params.role,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logBranchRoleSet(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    branchId: string
    role: Role | string
    oldValue?: unknown
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'branch_role_set',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      branchId: params.branchId,
      role: params.role,
      oldValue: params.oldValue,
      newValue: params.role,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  logBranchRoleCleared(params: {
    actorId: string
    targetUserId: string
    tenantId: string
    branchId: string
    role?: Role | string
    reason?: string
  }): void {
    const event: RbacAuditEvent = {
      id: genId(),
      type: 'branch_role_cleared',
      actorId: params.actorId,
      targetUserId: params.targetUserId,
      tenantId: params.tenantId,
      branchId: params.branchId,
      role: params.role,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    }
    _getStore?.().addRbacAuditEvent(event)
  },

  getLog(tenantId: string): RbacAuditEvent[] {
    return _getStore?.().getRbacAuditLog(tenantId) ?? []
  },

  clearLog(tenantId: string): void {
    _getStore?.().clearRbacAuditLog(tenantId)
  },
}
