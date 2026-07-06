'use client'

import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import { cn } from '@/utils'

interface BusinessSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function BusinessSearch({
  value,
  onChange,
  placeholder,
  className,
}: BusinessSearchProps) {
  const t = useTranslations('marketplace')
  return (
    <div className={cn('relative w-full max-w-2xl mx-auto', className)}>
      <label htmlFor="marketplace-search" className="sr-only">
        {t('searchBusinesses')}
      </label>
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--fg-muted)] pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="marketplace-search"
        type="search"
        role="searchbox"
        aria-label={t('searchBusinesses')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('searchBusinessesPlaceholder')}
        className={cn(
          'w-full pl-12 pr-10 py-3.5 rounded-2xl border border-[var(--border)]',
          'bg-[var(--input-bg)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
          'text-base shadow-[var(--shadow-soft)] transition-shadow',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('clearSearch')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
