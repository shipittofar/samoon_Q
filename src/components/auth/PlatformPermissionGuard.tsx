'use client'

/**
 * PlatformPermissionGuard — P9.4 Phase G
 *
 * Declarative gate for the Platform Administration Center, checked against
 * the separate platform permission model (src/platform-admin/permissions.ts)
 * rather than tenant `P7Permission`s — the counterpart to `PermissionGuard`
 * (P7.1) for a fundamentally different scope. Deliberately its own small
 * component rather than a new prop on `PermissionGuard`, since the two
 * permission systems must never be conflated (see
 * docs/P9.4_PLATFORM_ADMIN_AUDIT.md §"what platform administration is not").
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
