'use client'

import { cn } from '@/utils'
import { useMoney } from '@/hooks/use-money'

export interface SelectableOptionRowProps {
  name: string
  price?: number
  selected: boolean
  disabled?: boolean
  selectionType?: 'single' | 'multiple'
  onClick: () => void
}

export function SelectableOptionRow({
  name,
  price,
  selected,
  disabled = false,
  selectionType = 'multiple',
  onClick,
  currency,
}: SelectableOptionRowProps & { currency?: string }) {
  const money = useMoney()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selectionType === 'multiple' ? selected : undefined}
      aria-checked={selectionType === 'single' ? selected : undefined}
      role={selectionType === 'single' ? 'radio' : undefined}
      className={cn(
        'flex items-center justify-between w-full px-3 py-2.5 rounded-xl border text-sm transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
        selected
          ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]'
          : 'border-[var(--border)] hover:border-[var(--accent-border)]/50 text-[var(--fg)]',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'h-4 w-4 flex items-center justify-center transition-all border',
            selectionType === 'single' ? 'rounded-full' : 'rounded-md',
            selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-input)]',
          )}
        >
          {selected && selectionType === 'single' && (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-fg)]"/>
          )}
          {selected && selectionType === 'multiple' && (
            <span className="text-[10px] text-[var(--accent-fg)]">✓</span>
          )}
        </span>
        {name}
      </span>
      {price != null && price > 0 && <span className="font-medium">+{money.format(price, currency)}</span>}
      {price === 0 && <span className="text-xs text-[var(--fg-muted)]">Included</span>}
    </button>
  )
}
