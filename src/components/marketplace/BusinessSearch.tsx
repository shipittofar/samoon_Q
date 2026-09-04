'use client'

import { SearchField } from '@/components/search'

interface BusinessSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/** @deprecated Prefer SearchField. Kept as a thin wrapper for leftover callers. */
export function BusinessSearch({ value, onChange, placeholder, className }: BusinessSearchProps) {
  return (
    <SearchField
      variant="chrome"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      label={placeholder ?? 'Search'}
      clearLabel="Clear search"
      className={className}
    />
  )
}
