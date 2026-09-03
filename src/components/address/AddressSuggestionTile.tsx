import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AddressSuggestion } from '@/types/address'
import { cn } from '@/utils'

export interface AddressSuggestionTileProps {
  suggestion: AddressSuggestion
  onSelect: (suggestion: AddressSuggestion) => void
  className?: string
}

export function AddressSuggestionTile({ suggestion, onSelect, className }: AddressSuggestionTileProps) {
  const t = useTranslations('address')

  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-xl border border-[var(--border)]',
        'hover:border-[var(--accent-border)]/50 hover:bg-[var(--accent-subtle)]/50 transition-colors text-start',
        className,
      )}
    >
      <MapPin className="h-4 w-4 text-[var(--accent-text)] mt-0.5 shrink-0"aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--fg)] truncate">{suggestion.formatted_address}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">
          {t('suggestionMeta', {
            confidence: Math.round(suggestion.confidence * 100),
            provider: suggestion.provider,
          })}
        </p>
      </div>
    </button>
  )
}
