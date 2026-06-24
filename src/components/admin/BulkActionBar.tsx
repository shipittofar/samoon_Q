'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface BulkAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

interface BulkActionBarProps {
  selectedCount: number
  actions: BulkAction[]
  onClearSelection: () => void
}

export function BulkActionBar({ selectedCount, actions, onClearSelection }: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--fg)] text-[var(--bg)] shadow-2xl border border-[var(--border)]"
    >
      <span className="text-sm font-semibold whitespace-nowrap">
        {selectedCount} selected
      </span>
      <div className="w-px h-5 bg-current opacity-30" />
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          disabled={action.disabled}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
            action.variant === 'danger'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : action.variant === 'primary'
              ? 'bg-[var(--primary)] text-white hover:opacity-90'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          {action.label}
        </button>
      ))}
      <div className="w-px h-5 bg-current opacity-30" />
      <button
        onClick={onClearSelection}
        aria-label="Clear selection"
        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
