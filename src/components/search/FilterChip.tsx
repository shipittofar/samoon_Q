'use client'

import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils'

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  selected?: boolean
  icon?: ReactNode
  count?: number
  children: ReactNode
}

export function FilterChip({
  selected = false,
  icon,
  count,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-full text-sm font-medium whitespace-nowrap shrink-0',
        'transition-colors duration-[var(--search-motion)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]',
        selected
          ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
          : 'bg-[var(--card)] text-[var(--fg-muted)] border border-[var(--border)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      {children}
      {count != null && (
        <span className={cn('text-xs tabular-nums', selected ? 'opacity-80' : 'opacity-60')}>
          {count}
        </span>
      )}
    </button>
  )
}
