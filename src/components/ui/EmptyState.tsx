import { type ReactNode } from 'react'
import { cn } from '@/utils'

/**
 * EmptyState primitive — Phase 2 (P2.3).
 * Used for zero-data screens, empty search results, and access-denied placeholders.
 * All styling via CSS tokens; no hardcoded colors.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Package className="h-8 w-8" />}
 *     title="No orders yet"
 *     description="Your placed orders will appear here."
 *     action={<Button>Browse Menu</Button>}
 *   />
 */
export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 text-center',
        className,
      )}
      role="status"
      aria-label={title}
    >
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--card-hover)] text-[var(--fg-muted)]">
          {icon}
        </div>
      )}
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-semibold text-[var(--fg)]">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--fg-muted)]">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
