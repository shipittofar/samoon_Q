'use client'

/**
 * P8.9.2 — International phone input component.
 * P8.9.2.1 — Country picker UX fixes: scroll lock, focus trap, auto-scroll to
 *             selected, accent-insensitive search, safe area, a11y improvements.
 *
 * Renders a flag + dial-code selector and a national-number field.
 * Outputs E.164 via onChange. Includes a searchable country picker
 * that opens as a bottom-anchored sheet on mobile and a modal on desktop.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
} from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, ChevronDown, X } from 'lucide-react'
import { cn } from '@/utils'
import {
  COUNTRIES,
  Country,
  getFlagEmoji,
  PREFERRED_COUNTRY_CODES,
  getSortedCountries,
  guessCountryFromLocale,
  loadRecentCountries,
  saveRecentCountry,
  searchCountries,
} from '@/data/countries'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PhoneInputMeta {
  countryCode: string   // ISO alpha-2
  dialCode: string      // e.g. '+1'
  nationalNumber: string // raw digits, unformatted
  e164: string          // full E.164 output
  isValid: boolean
}

export interface PhoneInputProps {
  value?: string           // E.164 preferred, or national number
  onChange?: (e164: string, meta: PhoneInputMeta) => void
  defaultCountry?: string  // ISO alpha-2; falls back to browser locale
  label?: string
  error?: string
  hint?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  className?: string
  id?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Strip all non-digit characters. */
const digitsOnly = (s: string) => s.replace(/\D/g, '')

/**
 * Naïve national-number formatter.
 * US/CA → (XXX) XXX-XXXX; everything else → spaced groups.
 */
function formatNational(digits: string, country: Country): string {
  const d = digitsOnly(digits)
  if (country.code === 'US' || country.code === 'CA') {
    if (d.length <= 3) return d
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
  }
  if (country.code === 'GB') {
    if (d.length <= 4) return d
    if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}`
  }
  // Generic: space every 3-4 digits
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`
  if (d.length <= 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`
}

/** Build E.164 from dial code + national digits. */
function buildE164(dialCode: string, nationalDigits: string): string {
  const stripped = digitsOnly(dialCode)
  const national = digitsOnly(nationalDigits)
  if (!national) return ''
  return `+${stripped}${national}`
}

/** Minimum digits for a valid number (very loose heuristic). */
function isValidLength(nationalDigits: string): boolean {
  const len = digitsOnly(nationalDigits).length
  return len >= 5 && len <= 15
}

/** Parse an E.164 number → find country + extract national digits. */
function parseE164(e164: string): { country: Country | null; national: string } {
  if (!e164.startsWith('+')) return { country: null, national: e164 }
  const digits = e164.slice(1) // remove leading +

  // Try to match longest dial code first (e.g. +380 before +38)
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const c of sorted) {
    const dc = c.dialCode.replace('+', '')
    if (digits.startsWith(dc)) {
      return { country: c, national: digits.slice(dc.length) }
    }
  }
  return { country: null, national: digits }
}

// ── Scroll lock ────────────────────────────────────────────────────────────────

function lockBodyScroll(): () => void {
  const el = document.documentElement
  const body = document.body
  const prevOverflow = el.style.overflow
  const prevBodyOverflow = body.style.overflow
  const prevTouchAction = body.style.touchAction
  const scrollY = window.scrollY

  el.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  // Prevent iOS rubber-band scroll while keeping position
  body.style.position = 'fixed'
  body.style.top = `-${scrollY}px`
  body.style.width = '100%'
  body.style.touchAction = 'none'

  return () => {
    el.style.overflow = prevOverflow
    body.style.overflow = prevBodyOverflow
    body.style.position = ''
    body.style.top = ''
    body.style.width = ''
    body.style.touchAction = prevTouchAction
    window.scrollTo(0, scrollY)
  }
}

// ── Focus trap ─────────────────────────────────────────────────────────────────

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return
    const el = containerRef.current
    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) { e.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    el.addEventListener('keydown', handleKeyDown as unknown as EventListener)
    return () => el.removeEventListener('keydown', handleKeyDown as unknown as EventListener)
  }, [active, containerRef])
}

// ── Country Picker ─────────────────────────────────────────────────────────────

interface CountryPickerProps {
  isOpen: boolean
  selected: Country
  onSelect: (country: Country) => void
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

function CountryPicker({ isOpen, selected, onSelect, onClose, triggerRef }: CountryPickerProps) {
  const prefersReducedMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recents, setRecents] = useState<Country[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()
  const titleId = `${dialogId}-title`

  const results = useMemo(
    () => (query ? searchCountries(query) : getSortedCountries()),
    [query],
  )
  const preferreds = useMemo(
    () => PREFERRED_COUNTRY_CODES.map((c) => COUNTRIES.find((x) => x.code === c)).filter(Boolean) as Country[],
    [],
  )

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return
    const unlock = lockBodyScroll()
    return unlock
  }, [isOpen])

  // Open — reset state, focus search, scroll selected into view
  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIndex(-1)
    setRecents(loadRecentCountries())

    // Defer to after animation completes
    const t = setTimeout(() => {
      searchRef.current?.focus()
      // Scroll selected country into view
      if (listRef.current) {
        const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement
        sel?.scrollIntoView({ block: 'center' })
      }
    }, 120)
    return () => clearTimeout(t)
  }, [isOpen])

  // Restore focus to trigger button on close
  useEffect(() => {
    if (!isOpen) {
      // Small delay to let animation finish
      const t = setTimeout(() => triggerRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [isOpen, triggerRef])

  // Focus trap
  useFocusTrap(containerRef, isOpen)

  const handleSelect = useCallback((country: Country) => {
    saveRecentCountry(country.code)
    onSelect(country)
    onClose()
  }, [onSelect, onClose])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const total = results.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, total - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(total - 1)
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const listContent = (
    <div
      ref={containerRef}
      className="flex flex-col h-full"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
    >
      {/* Header — sticky, never scrolls */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <h2 id={titleId} className="text-base font-semibold text-[var(--fg)]">Select country</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--card-hover)] text-[var(--fg-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          aria-label="Close country picker"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search — sticky, never scrolls */}
      <div className="px-4 pb-3 shrink-0">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)] pointer-events-none" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1) }}
            placeholder="Search by name, code or +dial…"
            autoComplete="off"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] ps-9 pe-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
            aria-label="Search countries"
            aria-controls={`${dialogId}-list`}
            aria-autocomplete="list"
          />
        </div>
      </div>

      {/* Country list — ONLY this scrolls */}
      <div
        ref={listRef}
        id={`${dialogId}-list`}
        role="listbox"
        aria-label="Countries"
        className={cn(
          'flex-1 overflow-y-auto px-2 overscroll-contain',
          // Safe-area bottom padding for iOS home indicator
          'pb-[max(1rem,env(safe-area-inset-bottom))]',
          // Custom scrollbar
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--border)]',
          // Momentum scrolling on iOS
          '[--webkit-overflow-scrolling:touch]',
        )}
      >
        {/* Recent countries */}
        {!query && recents.length > 0 && (
          <div className="mb-2">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Recent</p>
            {recents.map((c) => (
              <CountryRow
                key={`recent-${c.code}`}
                country={c}
                selected={selected}
                onSelect={handleSelect}
                index={-1}
                activeIndex={-1}
              />
            ))}
          </div>
        )}

        {/* Preferred countries (when no query) */}
        {!query && (
          <div className="mb-2">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Suggested</p>
            {preferreds.map((c) => (
              <CountryRow
                key={`pref-${c.code}`}
                country={c}
                selected={selected}
                onSelect={handleSelect}
                index={-1}
                activeIndex={-1}
              />
            ))}
            <div className="my-1 border-t border-[var(--border)]" />
          </div>
        )}

        {/* Full / search results */}
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-sm text-[var(--fg-muted)]">No countries found</p>
            <p className="text-xs text-[var(--fg-muted)]">Try searching by name, code (US), or dial code (+1)</p>
          </div>
        ) : (
          results.map((c, i) => (
            <CountryRow
              key={c.code}
              country={c}
              selected={selected}
              onSelect={handleSelect}
              index={i}
              activeIndex={activeIndex}
            />
          ))
        )}
      </div>
    </div>
  )

  const slideY = prefersReducedMotion ? 0 : '100%'
  const duration = prefersReducedMotion ? 0 : 0.28

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet — bottom on mobile, centered on desktop */}
          <motion.div
            key="picker-sheet"
            initial={{ y: slideY, opacity: prefersReducedMotion ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: slideY, opacity: prefersReducedMotion ? 0 : 1 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, duration }}
            className={cn(
              // Base
              'fixed z-50 bg-[var(--bg)] shadow-2xl',
              // Force flex column so header/search stay sticky and list scrolls
              'flex flex-col',
              // Mobile: bottom sheet
              'bottom-0 start-0 end-0 rounded-t-2xl max-h-[85dvh]',
              // Desktop: centered modal
              'md:bottom-auto md:start-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
              'md:rounded-2xl md:w-[480px] md:max-h-[70vh]',
            )}
          >
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-2 pb-0 md:hidden shrink-0" aria-hidden="true">
              <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
            </div>
            {listContent}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface CountryRowProps {
  country: Country
  selected: Country
  onSelect: (c: Country) => void
  index: number
  activeIndex: number
}

function CountryRow({ country, selected, onSelect, index, activeIndex }: CountryRowProps) {
  const isActive = index === activeIndex
  const isSelected = country.code === selected.code
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      data-index={index}
      data-selected={isSelected || undefined}
      onClick={() => onSelect(country)}
      className={cn(
        // Touch-friendly: min 48px height
        'w-full flex items-center gap-3 px-2 rounded-xl text-sm transition-colors text-start',
        'min-h-[48px] py-2',
        isActive
          ? 'bg-[var(--accent)]/10 outline-none ring-2 ring-inset ring-[var(--accent)]/30'
          : isSelected
            ? 'bg-[var(--accent)]/8 dark:bg-[var(--accent)]/12'
            : 'hover:bg-[var(--card-hover)] focus-visible:bg-[var(--card-hover)] focus:outline-none',
      )}
    >
      {/* Flag */}
      <span className="text-xl leading-none w-8 shrink-0 text-center" aria-hidden="true">
        {getFlagEmoji(country.code)}
      </span>

      {/* Name */}
      <span className="flex-1 truncate text-[var(--fg)] font-medium">{country.name}</span>

      {/* ISO code + dial code */}
      <span className="shrink-0 flex items-center gap-2">
        <span className="text-[10px] font-mono text-[var(--fg-muted)] opacity-60 hidden sm:inline">
          {country.code}
        </span>
        <span className="text-sm font-mono text-[var(--fg-muted)] min-w-[3rem] text-end">
          {country.dialCode}
        </span>
      </span>

      {/* Selected checkmark */}
      {isSelected && (
        <span className="shrink-0 text-[var(--accent)]" aria-hidden="true">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        </span>
      )}
    </button>
  )
}

// ── PhoneInput ─────────────────────────────────────────────────────────────────

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  {
    value,
    onChange,
    defaultCountry,
    label,
    error,
    hint,
    disabled,
    required,
    autoFocus,
    className,
    id: idProp,
  },
  ref,
) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Resolve initial country
  const resolveInitialCountry = (): Country => {
    if (defaultCountry) {
      const c = COUNTRIES.find((x) => x.code === defaultCountry.toUpperCase())
      if (c) return c
    }
    if (value && value.startsWith('+')) {
      const parsed = parseE164(value)
      if (parsed.country) return parsed.country
    }
    const locale = guessCountryFromLocale()
    if (locale) return locale
    return COUNTRIES.find((c) => c.code === 'US')!
  }

  const [country, setCountry] = useState<Country>(resolveInitialCountry)
  const [national, setNational] = useState<string>(() => {
    if (value && value.startsWith('+')) {
      const parsed = parseE164(value)
      return parsed.national
    }
    return value ? digitsOnly(value) : ''
  })
  const [pickerOpen, setPickerOpen] = useState(false)

  // Sync when external value changes
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const parsed = parseE164(value)
      if (parsed.country && parsed.country.code !== country.code) {
        setCountry(parsed.country)
      }
      setNational(parsed.national)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCountrySelect = useCallback((c: Country) => {
    setCountry(c)
    const e164 = buildE164(c.dialCode, national)
    const meta: PhoneInputMeta = {
      countryCode: c.code,
      dialCode: c.dialCode,
      nationalNumber: digitsOnly(national),
      e164,
      isValid: isValidLength(national),
    }
    onChange?.(e164, meta)
  }, [national, onChange])

  const handleNationalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const digits = digitsOnly(raw)
    // Limit to 15 digits (ITU-T E.164 max)
    if (digits.length > 15) return
    const formatted = formatNational(digits, country)
    setNational(digits)
    const e164 = buildE164(country.dialCode, digits)
    const meta: PhoneInputMeta = {
      countryCode: country.code,
      dialCode: country.dialCode,
      nationalNumber: digits,
      e164,
      isValid: isValidLength(digits),
    }
    onChange?.(e164, meta)
    // Update the input's displayed value with formatting
    e.target.value = formatted
  }, [country, onChange])

  const displayValue = formatNational(national, country)
  const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
          {label}
          {required && <span className="ms-1 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}

      <div
        className={cn(
          'flex items-stretch rounded-xl border bg-[var(--input-bg)] transition-shadow',
          error
            ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400 dark:ring-red-500'
            : 'border-[var(--border)] focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-transparent',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        {/* Country button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          aria-label={`Phone country: ${country.name} ${country.dialCode}`}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          className={cn(
            'flex items-center gap-1.5 ps-3 pe-2 py-2.5 shrink-0 border-e border-[var(--border)]',
            'hover:bg-[var(--card-hover)] rounded-s-xl transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)]',
          )}
        >
          <span className="text-base leading-none" aria-hidden="true">{getFlagEmoji(country.code)}</span>
          <span className="text-sm font-medium text-[var(--fg)] tabular-nums">{country.dialCode}</span>
          <ChevronDown className="h-3 w-3 text-[var(--fg-muted)]" aria-hidden="true" />
        </button>

        {/* National number input */}
        <input
          ref={ref}
          id={id}
          type="tel"
          inputMode="numeric"
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          placeholder={country.placeholder}
          defaultValue={displayValue}
          onChange={handleNationalChange}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          autoComplete="tel-national"
          className={cn(
            'flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[var(--fg)]',
            'placeholder:text-[var(--fg-muted)]',
            'focus:outline-none',
          )}
        />
      </div>

      {/* Error */}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-500">
          {error}
        </p>
      )}

      {/* Hint */}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-[var(--fg-muted)]">
          {hint}
        </p>
      )}

      {/* Country picker */}
      <CountryPicker
        isOpen={pickerOpen}
        selected={country}
        onSelect={handleCountrySelect}
        onClose={() => setPickerOpen(false)}
        triggerRef={triggerRef}
      />
    </div>
  )
})
