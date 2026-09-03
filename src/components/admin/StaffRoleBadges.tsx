'use client'

import type { RbacAssignment } from '@/types/rbac-api'
import { activeRoleLabels } from '@/lib/assignments'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-[var(--chart-5)]/15 text-[var(--chart-5)]',
  admin: 'bg-[var(--danger-subtle)] text-[var(--danger-text)]',
  manager: 'bg-[var(--accent-subtle)] text-[var(--accent-text)]',
  cashier: 'bg-[var(--success-subtle)] text-[var(--success-text)]',
  waiter: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
  kitchen: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
  marketing: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]',
  support: 'bg-[var(--card-hover)] text-[var(--fg)]',
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
          className={`px-2 py-0.5 text-xs rounded font-medium ${ROLE_COLORS[r] ?? 'bg-[var(--card-hover)] text-[var(--fg-secondary)]'}`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}
