'use client'

import type { RbacAssignment } from '@/types/rbac-api'
import { activeRoleLabels } from '@/lib/assignments'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-orange-100 text-orange-800',
  cashier: 'bg-green-100 text-green-800',
  waiter: 'bg-blue-100 text-blue-800',
  kitchen: 'bg-yellow-100 text-yellow-800',
  marketing: 'bg-pink-100 text-pink-800',
  support: 'bg-gray-100 text-gray-800',
}

export interface StaffRoleBadgesProps {
  assignments: RbacAssignment[]
  className?: string
}

/** Renders role labels from assignment data — never from staff.roles. */
export function StaffRoleBadges({ assignments, className }: StaffRoleBadgesProps) {
  const roles = activeRoleLabels(assignments)
  if (roles.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {roles.map((r) => (
        <span
          key={r}
          className={`px-2 py-0.5 text-xs rounded font-medium ${ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}
