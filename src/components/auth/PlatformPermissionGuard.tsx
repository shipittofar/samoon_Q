'use client'

/**
 * PlatformPermissionGuard — in-center UI metadata gate (optional).
 *
 * Must NOT be used to decide whether a user can enter `/platform-admin`.
 * Route entry is `user.is_superuser === true` via PlatformSuperuserGuard.
 */
import type { ReactNode } from 'react'
import { usePlatformPermission } from '@/platform-admin/hooks'
import type { PlatformPermission } from '@/platform-admin/permissions'

export interface PlatformPermissionGuardProps {
  permission: PlatformPermission
  fallback?: ReactNode
  children: ReactNode
}

export function PlatformPermissionGuard({ permission, fallback = null, children }: PlatformPermissionGuardProps) {
  const allowed = usePlatformPermission(permission)
  return allowed ? <>{children}</> : <>{fallback}</>
}
