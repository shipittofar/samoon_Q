'use client'

import { cn } from '@/utils'

export interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  label: string
  getStarLabel: (count: number) => string
  className?: string
}

export function StarRatingInput({ value, onChange, label, getStarLabel, className }: StarRatingInputProps) {
  return (
    <div className={cn('flex gap-1', className)} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn(
            'text-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded',
            s <= value ? 'text-[var(--warning-border)]' : 'text-[var(--border-strong)]',
          )}
          aria-label={getStarLabel(s)}
        >
          ★
        </button>
      ))}
    </div>
  )
}
