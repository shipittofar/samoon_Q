'use client'

import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { cn } from '@/utils'

export type SearchFieldVariant = 'chrome' | 'overlay'

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  onSubmitQuery?: (value: string) => void
  variant?: SearchFieldVariant
  loading?: boolean
  label: string
  clearLabel: string
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(
    {
      value,
      onChange,
      onClear,
      onSubmitQuery,
      variant = 'chrome',
      loading = false,
      label,
      clearLabel,
      className,
      id,
      disabled,
      onFocus,
      onKeyDown,
      placeholder,
      ...rest
    },
    ref,
  ) {
    const autoId = useId()
    const inputId = id ?? autoId
    const isOverlay = variant === 'overlay'

    return (
      <div
        className={cn(
          'relative w-full',
          isOverlay
            ? 'h-[var(--search-field-height-overlay)]'
            : 'h-[var(--search-field-height-chrome)]',
          className,
        )}
      >
        <Search
          className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--fg-muted)] pointer-events-none"
          aria-hidden="true"
        />
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="search"
          role="searchbox"
          enterKeyHint="search"
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          aria-busy={loading || undefined}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmitQuery?.(value)
            }
            onKeyDown?.(e)
          }}
          className={cn(
            'w-full h-full rounded-[var(--search-field-radius)] border border-[var(--border-input)]',
            'bg-[var(--input-bg)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
            'text-base ps-11',
            value || loading ? 'pe-11' : 'pe-3',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:border-[var(--focus-ring)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
          )}
        />
        {loading && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          </span>
        )}
        {!loading && value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              onClear?.()
            }}
            aria-label={clearLabel}
            className="absolute end-0 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-[var(--search-field-radius)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  },
)
