'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/utils'

export interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  decreaseLabel: string
  increaseLabel: string
  className?: string
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  size = 'md',
  decreaseLabel,
  increaseLabel,
  className,
}: QuantityStepperProps) {
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const valueWidth = size === 'sm' ? 'w-6 text-sm' : 'w-8 text-base'

  return (
    <div
      className={cn(
        'flex items-center rounded-xl border border-[var(--border)] overflow-hidden shrink-0',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(
          btnSize,
          'flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
        aria-label={decreaseLabel}
      >
        <Minus className={iconSize} />
      </button>
      <span
        className={cn(valueWidth, 'text-center font-semibold text-[var(--fg)] tabular-nums')}
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        disabled={max != null && value >= max}
        className={cn(
          btnSize,
          'flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
        aria-label={increaseLabel}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  )
}
