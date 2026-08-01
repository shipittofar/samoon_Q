import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'

export interface AddressSearchBarProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function AddressSearchBar({ value, onChange, className }: AddressSearchBarProps) {
  const t = useTranslations('address')

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
      />
    </div>
  )
}
