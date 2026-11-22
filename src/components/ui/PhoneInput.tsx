'use client'

/**
 * P8.9.2  — International phone_number input with E.164 output.
 * P8.9.2.1 — Scroll lock, focus trap, auto-scroll, a11y.
 * P8.9.2.2 — Premium UX polish: pinned section, recent×5, timezone detection,
 *             fuzzy search, PageUp/PageDown, type-to-search, aria-live,
 *             aria-activedescendant, per-option IDs, RTL-safe dial codes,
 *             visual hierarchy, empty state with clear, scrollbar polish.
 * P8.9.2.3 — SVG flags, VisualViewport keyboard safety, production hardening.
 * P8.9.2.4 — Native keyboard: sheet anchored at bottom:0; only list resizes.
 * P8.9.2.5 — Layout rewrite: CSS Grid dialog, min-h-0 list, overflow-hidden sheet.
 * P8.9.2.6 — Mobile keyboard UX: no auto-focus on open; blur-on-close; tap-to-search.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  memo,
  KeyboardEvent,
} from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, ChevronDown, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import {
  COUNTRIES,
  Country,
  PINNED_COUNTRY_CODES,
  digitsOnly,
  getMaxNationalDigits,
  getPinnedCountries,
  getRestCountries,
  FALLBACK_COUNTRY_CODE,
  fetchCountryFromIp,
  guessCountryFromLocale,
  guessCountryFromTimezone,
  loadRecentCountries,
  saveRecentCountry,
  saveLastSelected,
  loadLastSelected,
  searchCountries,
} from '@/data/countries'
import { FlagIcon } from '@/components/ui/FlagIcon'
import { useMediaQuery } from '@/hooks/client'
import { API_BASE_URL } from '@/constants'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PhoneInputMeta {
  countryCode: string    // ISO alpha-2
  dialCode: string       // e.g. '+1'
  nationalNumber: string // raw digits, unformatted
  e164: string           // full E.164 output
  isValid: boolean
}

export interface PhoneInputProps {
  value?: string           // E.164 preferred, or national number
  onChange?: (e164: string, meta: PhoneInputMeta) => void
  defaultCountry?: string  // ISO alpha-2; else last choice → time zone → IP → browser language → IR
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
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`
  if (d.length <= 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`
}

function buildE164(dialCode: string, nationalDigits: string): string {
  const stripped = digitsOnly(dialCode)
  const national = digitsOnly(nationalDigits)
  if (!national) return ''
  return `+${stripped}${national}`
}

function isValidLength(nationalDigits: string, country: Country): boolean {
  const len = digitsOnly(nationalDigits).length
  const max = getMaxNationalDigits(country)
  return len >= 5 && len <= max
}

function clampNationalDigits(digits: string, country: Country): string {
  return digitsOnly(digits).slice(0, getMaxNationalDigits(country))
}

function buildMeta(country: Country, nationalDigits: string): PhoneInputMeta {
  const digits = digitsOnly(nationalDigits)
  const e164 = buildE164(country.dialCode, digits)
  return {
    countryCode: country.code,
    dialCode: country.dialCode,
    nationalNumber: digits,
    e164,
    isValid: isValidLength(digits, country),
  }
}

function parseE164(e164: string): { country: Country | null; national: string } {
  if (!e164.startsWith('+')) return { country: null, national: e164 }
  const digits = e164.slice(1)
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
  const prevElOverflow = el.style.overflow
  const prevBodyOverflow = body.style.overflow
  const prevPosition = body.style.position
  const prevTop = body.style.top
  const prevWidth = body.style.width
  const prevTouchAction = body.style.touchAction
  const scrollY = window.scrollY

  el.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${scrollY}px`
  body.style.width = '100%'
  body.style.touchAction = 'none'

  return () => {
    el.style.overflow = prevElOverflow
    body.style.overflow = prevBodyOverflow
    body.style.position = prevPosition
    body.style.top = prevTop
    body.style.width = prevWidth
    body.style.touchAction = prevTouchAction
    window.scrollTo(0, scrollY)
  }
}

// ── Focus trap ─────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTORS = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return
    const el = ref.current
    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS))
    const handler = (e: KeyboardEvent) => {
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
    el.addEventListener('keydown', handler as unknown as EventListener)
    return () => el.removeEventListener('keydown', handler as unknown as EventListener)
  }, [active, ref])
}

// ── Announcer ──────────────────────────────────────────────────────────────────

function useAnnouncer() {
  const ref = useRef<HTMLDivElement>(null)
  const announce = useCallback((msg: string) => {
    if (!ref.current) return
    ref.current.textContent = ''
    requestAnimationFrame(() => {
      if (ref.current) ref.current.textContent = msg
    })
  }, [])
  const node = (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  )
  return { announce, node }
}

// ── VisualViewport keyboard safety ────────────────────────────────────────────

interface ViewportState {
  keyboardHeight: number
  viewportHeight: number
}

function useVisualViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>({
    keyboardHeight: 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      const kh = Math.max(0, window.innerHeight - vv!.height - (vv!.offsetTop ?? 0))
      setState({ keyboardHeight: kh, viewportHeight: vv!.height })
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return state
}

// ── Incremental list loading ───────────────────────────────────────────────────

const INITIAL_REST_BATCH = 25
const REST_BATCH_SIZE = 25

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] select-none">
      {label}
    </p>
  )
}

// ── Country Row ────────────────────────────────────────────────────────────────

interface CountryRowProps {
  country: Country
  selected: Country
  onSelect: (c: Country) => void
  optionId: string
  isActive: boolean
}

const CountryRow = memo(function CountryRow({
  country,
  selected,
  onSelect,
  optionId,
  isActive,
}: CountryRowProps) {
  const isSelected = country.code === selected.code
  return (
    <button
      id={optionId}
      type="button"
      role="option"
      aria-selected={isSelected}
      data-selected={isSelected || undefined}
      onClick={() => onSelect(country)}
      className={cn(
        'w-full flex items-center gap-3 px-3 rounded-xl text-sm text-start transition-colors',
        'min-h-[48px] py-2',
        isSelected && !isActive
          ? 'bg-[var(--accent)]/10 border-s-2 border-[var(--accent)]'
          : '',
        isActive
          ? 'bg-[var(--accent)]/15 outline-none ring-2 ring-inset ring-[var(--accent)]/40'
          : '',
        !isActive && !isSelected
          ? 'hover:bg-[var(--card-hover)] focus-visible:bg-[var(--card-hover)] focus:outline-none'
          : '',
      )}
    >
      <span className="w-8 shrink-0 flex items-center justify-center"aria-hidden="true">
        <FlagIcon code={country.code} size={22} />
      </span>
      <span className="flex-1 min-w-0 truncate font-medium text-[var(--fg)]">
        {country.name}
      </span>
      <span
        className="hidden sm:inline text-[10px] font-mono text-[var(--fg-muted)] shrink-0 opacity-50"
        aria-hidden="true"
      >
        {country.code}
      </span>
      <span
        dir="ltr"
        className="text-sm font-mono text-[var(--fg-muted)] shrink-0 min-w-[3.25rem] text-end"
      >
        {country.dialCode}
      </span>
      {isSelected && (
        <span className="shrink-0 text-[var(--accent)] ms-1"aria-hidden="true">
          <svg className="h-4 w-4"viewBox="0 0 16 16"fill="currentColor"aria-hidden="true">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
          </svg>
        </span>
      )}
    </button>
  )
})

// ── Country Picker ─────────────────────────────────────────────────────────────

interface CountryPickerProps {
  isOpen: boolean
  selected: Country
  onSelect: (country: Country) => void
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  /** Called after exit animation when the picker closed due to country selection. */
  onAfterSelectClose?: () => void
}

const PAGE_SIZE = 8

function CountryPicker({
  isOpen,
  selected,
  onSelect,
  onClose,
  triggerRef,
  onAfterSelectClose,
}: CountryPickerProps) {
  const t = useTranslations('phoneInput')
  const prefersReducedMotion = useReducedMotion()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recents, setRecents] = useState<Country[]>([])
  const [visibleRestCount, setVisibleRestCount] = useState(INITIAL_REST_BATCH)
  const { keyboardHeight, viewportHeight } = useVisualViewport()
  const keyboardOpen = keyboardHeight > 50
  const sheetMaxHeight = keyboardOpen && !isDesktop
    ? `${Math.round(viewportHeight * 0.92)}px`
    : undefined

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const uid = useId()
  const titleId = `${uid}-title`
  const listId = `${uid}-list`
  const optionId = (i: number) => `${uid}-opt-${i}`

  const { announce, node: announcer } = useAnnouncer()
  const closedBySelectionRef = useRef(false)

  const pinned = useMemo(() => getPinnedCountries(), [])
  const pinnedSet = useMemo(() => new Set(PINNED_COUNTRY_CODES), [])

  const results = useMemo(
    () => (query ? searchCountries(query) : []),
    [query],
  )

  const recentFiltered = useMemo(
    () => recents.filter((c) => !pinnedSet.has(c.code)),
    [recents, pinnedSet],
  )

  const rest = useMemo(() => getRestCountries(), [])

  const restExcludingRecent = useMemo(() => {
    const recentCodes = new Set(recentFiltered.map((c) => c.code))
    return rest.filter((c) => !recentCodes.has(c.code))
  }, [rest, recentFiltered])

  const visibleRest = useMemo(
    () => restExcludingRecent.slice(0, visibleRestCount),
    [restExcludingRecent, visibleRestCount],
  )

  const navList: Country[] = useMemo(() => {
    if (query) return results
    return [...pinned, ...recentFiltered, ...restExcludingRecent]
  }, [query, results, pinned, recentFiltered, restExcludingRecent])

  useEffect(() => {
    if (!isOpen) return
    const unlock = lockBodyScroll()
    return unlock
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIndex(-1)
    setVisibleRestCount(INITIAL_REST_BATCH)

    requestAnimationFrame(() => {
      setRecents(loadRecentCountries())

      if (isDesktop) {
        searchRef.current?.focus({ preventScroll: true })
      }

      requestAnimationFrame(() => {
        if (listRef.current) {
          const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement
          sel?.scrollIntoView({ block: 'center' })
        }
        announce(t('countryPickerOpened'))
      })
    })
  }, [isOpen, announce, t, isDesktop])

  useEffect(() => {
    if (isOpen) return
    searchRef.current?.blur()
    if (closedBySelectionRef.current) return
    const timer = setTimeout(() => triggerRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [isOpen, triggerRef])

  const handleExitComplete = useCallback(() => {
    if (!closedBySelectionRef.current) return
    closedBySelectionRef.current = false
    onAfterSelectClose?.()
  }, [onAfterSelectClose])

  useEffect(() => {
    if (!isOpen || !query) return
    announce(t('countriesFoundCount', { count: results.length }))
  }, [query, results.length, isOpen, announce, t])

  useFocusTrap(containerRef, isOpen)

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const item = listRef.current.querySelector(`[id="${optionId(activeIndex)}"]`) as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((country: Country) => {
    closedBySelectionRef.current = true
    saveRecentCountry(country.code)
    saveLastSelected(country.code)
    onSelect(country)
    announce(t('countrySelectedAnnounce', { name: country.name }))
    onClose()
  }, [onSelect, onClose, announce, t])

  const handleListScroll = useCallback(() => {
    const el = listRef.current
    if (!el || query) return
    if (visibleRestCount >= restExcludingRecent.length) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120
    if (nearBottom) {
      setVisibleRestCount((n) => Math.min(n + REST_BATCH_SIZE, restExcludingRecent.length))
    }
  }, [query, visibleRestCount, restExcludingRecent.length])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const total = navList.length

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, total - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(total - 1)
        break
      case 'PageDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + PAGE_SIZE, total - 1))
        break
      case 'PageUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - PAGE_SIZE, 0))
        break
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < total) {
          e.preventDefault()
          handleSelect(navList[activeIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (document.activeElement !== searchRef.current) {
            e.preventDefault()
            searchRef.current?.focus()
            setQuery((q) => q + e.key)
            setActiveIndex(-1)
          }
        }
        break
    }
  }

  const isSearching = query.length > 0

  const listContent = (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 grid grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
    >
      {announcer}

      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 id={titleId} className="text-base font-semibold text-[var(--fg)]">
          {t('selectCountry')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--card-hover)] text-[var(--fg-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          aria-label={t('closeCountryPickerAria')}
        >
          <X className="h-4 w-4"/>
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <Search
            className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1) }}
            placeholder={t('countrySearchPlaceholder')}
            autoComplete="off"
            className={cn(
              'w-full rounded-xl border bg-[var(--input-bg)]',
              'ps-9 pe-3 py-2.5 text-sm text-[var(--fg)]',
              'placeholder:text-[var(--fg-muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow',
              'border-[var(--border)]',
            )}
            aria-label={t('searchCountriesAria')}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => { setQuery(''); setActiveIndex(-1); searchRef.current?.focus() }}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
              aria-label={t('clearSearchAria')}
            >
              <X className="h-3.5 w-3.5"/>
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t('countriesListAria')}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onScroll={handleListScroll}
        className={cn(
          'min-h-0 overflow-y-auto px-2 overscroll-contain scrollbar-thin',
          '[WebkitOverflowScrolling:touch]',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        {isSearching ? (
          results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="text-3xl"aria-hidden="true">🔍</span>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--fg)]">{t('noCountriesFound')}</p>
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                  {t('tryAnotherSearchHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setQuery(''); setActiveIndex(-1); searchRef.current?.focus() }}
                className="mt-1 text-sm font-medium text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded px-2 py-1"
              >
                {t('clearSearch')}
              </button>
            </div>
          ) : (
            results.map((c, i) => (
              <CountryRow
                key={c.code}
                country={c}
                selected={selected}
                onSelect={handleSelect}
                optionId={optionId(i)}
                isActive={i === activeIndex}
              />
            ))
          )
        ) : (
          <>
            <SectionHeader label={t('pinned')} />
            {pinned.map((c, i) => (
              <CountryRow
                key={`pin-${c.code}`}
                country={c}
                selected={selected}
                onSelect={handleSelect}
                optionId={optionId(i)}
                isActive={i === activeIndex}
              />
            ))}

            {recentFiltered.length > 0 && (
              <>
                <SectionHeader label={t('recent')} />
                {recentFiltered.map((c, i) => {
                  const navIdx = pinned.length + i
                  return (
                    <CountryRow
                      key={`rec-${c.code}`}
                      country={c}
                      selected={selected}
                      onSelect={handleSelect}
                      optionId={optionId(navIdx)}
                      isActive={navIdx === activeIndex}
                    />
                  )
                })}
              </>
            )}

            <div className="mx-3 my-2 border-t border-[var(--border)]"aria-hidden="true"/>

            <SectionHeader label={t('allCountries')} />
            {visibleRest.map((c, i) => {
              const navIdx = pinned.length + recentFiltered.length + i
              return (
                <CountryRow
                  key={c.code}
                  country={c}
                  selected={selected}
                  onSelect={handleSelect}
                  optionId={optionId(navIdx)}
                  isActive={navIdx === activeIndex}
                />
              )
            })}
          </>
        )}
      </div>
    </div>
  )

  const sheetInitial = prefersReducedMotion
    ? { opacity: 0 }
    : isDesktop
      ? { opacity: 0, scale: 0.97 }
      : { y: '100%' }

  const sheetAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : isDesktop
      ? { opacity: 1, scale: 1 }
      : { y: 0 }

  const sheetExit = prefersReducedMotion
    ? { opacity: 0 }
    : isDesktop
      ? { opacity: 0, scale: 0.97 }
      : { y: '100%' }

  const sheetTransition = prefersReducedMotion
    ? { duration: 0 }
    : isDesktop
      ? { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const }
      : { type: 'spring' as const, damping: 32, stiffness: 380, mass: 0.85 }

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isOpen && (
        <>
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-[var(--overlay)]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/*
            Positioning wrapper uses flex centering (md:items-center md:justify-center)
            instead of start-1/2 + translate-x. That avoids RTL misalignment where
            logical start-1/2 pairs with physical -translate-x-1/2.
            Framer Motion transform animations live on the inner sheet only, so they
            never override the positioning translate used by Tailwind utilities.
          */}
          <div
            className={cn(
              'fixed inset-0 z-50 flex pointer-events-none',
              'items-end md:items-center md:justify-center md:p-4',
            )}
          >
            <motion.div
              key="cp-sheet"
              initial={sheetInitial}
              animate={sheetAnimate}
              exit={sheetExit}
              transition={sheetTransition}
              style={{
                maxHeight: sheetMaxHeight ?? undefined,
                willChange: prefersReducedMotion ? undefined : 'transform, opacity',
              }}
              className={cn(
                'pointer-events-auto bg-[var(--bg)] shadow-2xl flex flex-col overflow-hidden w-full',
                'rounded-t-2xl max-h-[85dvh]',
                'md:rounded-2xl md:w-[480px] md:max-w-full md:max-h-[70vh]',
              )}
            >
              <div className="flex justify-center pt-2.5 pb-0 md:hidden shrink-0"aria-hidden="true">
                <div className="h-1 w-10 rounded-full bg-[var(--border)]"/>
              </div>
              {listContent}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
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
  const inputRef = useRef<HTMLInputElement>(null)

  const t = useTranslations('phoneInput')

  const resolveInitialCountry = (): Country => {
    if (defaultCountry) {
      const c = COUNTRIES.find((x) => x.code === defaultCountry.toUpperCase())
      if (c) return c
    }
    if (value && value.startsWith('+')) {
      const parsed = parseE164(value)
      if (parsed.country) return parsed.country
    }
    const last = loadLastSelected()
    if (last) return last
    // The system clock's time zone says where the device is; the browser
    // language only says which language it speaks (an en-US browser in Iran
    // is common), so it comes after the IP lookup below.
    const tz = guessCountryFromTimezone()
    if (tz) return tz
    const locale = guessCountryFromLocale()
    if (locale) return locale
    return COUNTRIES.find((c) => c.code === FALLBACK_COUNTRY_CODE)!
  }

  /** Nothing definite (caller, value, last choice, time zone) chose the country. */
  const initialIsGuess = (): boolean =>
    !(defaultCountry && COUNTRIES.some((x) => x.code === defaultCountry.toUpperCase())) &&
    !(value && value.startsWith('+') && parseE164(value).country) &&
    !loadLastSelected() &&
    !guessCountryFromTimezone()

  const [country, setCountry] = useState<Country>(resolveInitialCountry)
  // Set once the user picks a country or types; the IP answer never overrides that.
  const userChoseRef = useRef(false)
  const [national, setNational] = useState<string>(() => {
    if (value && value.startsWith('+')) {
      const parsed = parseE164(value)
      const c = parsed.country ?? resolveInitialCountry()
      return clampNationalDigits(parsed.national, c)
    }
    const initialCountry = resolveInitialCountry()
    return value ? clampNationalDigits(value, initialCountry) : ''
  })
  const [pickerOpen, setPickerOpen] = useState(false)

  const mergeRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  useEffect(() => {
    if (value && value.startsWith('+')) {
      const parsed = parseE164(value)
      const nextCountry = parsed.country
      if (nextCountry && nextCountry.code !== country.code) {
        setCountry(nextCountry)
      }
      const clamped = nextCountry
        ? clampNationalDigits(parsed.national, nextCountry)
        : digitsOnly(parsed.national)
      setNational(clamped)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const emitChange = useCallback(
    (c: Country, nationalDigits: string) => {
      const meta = buildMeta(c, nationalDigits)
      onChange?.(meta.e164, meta)
    },
    [onChange],
  )

  // Only a guess so far (browser language or the fallback): ask the backend
  // which country the visitor's IP is in, and use it unless they already chose.
  useEffect(() => {
    if (!initialIsGuess()) return
    let cancelled = false
    fetchCountryFromIp(API_BASE_URL).then((c) => {
      if (cancelled || !c || userChoseRef.current) return
      setCountry((current) => (current.code === c.code ? current : c))
    })
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCountrySelect = useCallback(
    (c: Country) => {
      userChoseRef.current = true
      const trimmed = clampNationalDigits(national, c)
      setCountry(c)
      setNational(trimmed)
      emitChange(c, trimmed)
    },
    [national, emitChange],
  )

  const focusPhoneInput = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const input = inputRef.current
        if (!input) return
        input.focus({ preventScroll: true })
        const len = input.value.length
        try {
          input.setSelectionRange(len, len)
        } catch {
          // setSelectionRange may fail on some mobile browsers for type=tel
        }
      })
    })
  }, [])

  const applyNationalDigits = useCallback(
    (rawDigits: string) => {
      const digits = clampNationalDigits(rawDigits, country)
      if (digits) userChoseRef.current = true
      setNational(digits)
      emitChange(country, digits)
      return digits
    },
    [country, emitChange],
  )

  const handleNationalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      applyNationalDigits(e.target.value)
    },
    [applyNationalDigits],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData('text')
      applyNationalDigits(pasted)
    },
    [applyNationalDigits],
  )

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const inputEvent = e.nativeEvent as InputEvent
      if (!inputEvent.data || inputEvent.inputType?.startsWith('delete')) return
      const max = getMaxNationalDigits(country)
      if (digitsOnly(national).length >= max) {
        e.preventDefault()
      }
    },
    [country, national],
  )

  const displayValue = formatNational(national, country)
  const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
          {label}
          {required && <span className="ms-1 text-[var(--danger-text)]"aria-hidden="true">*</span>}
        </label>
      )}

      <div
        className={cn(
          'flex items-stretch rounded-xl border bg-[var(--input-bg)] transition-shadow',
          error
            ? 'border-[var(--danger)] ring-1 ring-[var(--danger)] dark:ring-[var(--danger)]'
            : 'border-[var(--border)] focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-transparent',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          aria-label={t('phoneCountryAria', { name: country.name, dialCode: country.dialCode })}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          className={cn(
            'flex items-center gap-1.5 ps-3 pe-2 py-2.5 shrink-0',
            'border-e border-[var(--border)] hover:bg-[var(--card-hover)]',
            'rounded-s-xl transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)]',
          )}
        >
          <FlagIcon code={country.code} size={20} />
          <span dir="ltr"className="text-sm font-medium text-[var(--fg)] tabular-nums">
            {country.dialCode}
          </span>
          <ChevronDown className="h-3 w-3 text-[var(--fg-muted)]"aria-hidden="true"/>
        </button>

        <input
          ref={mergeRefs}
          id={id}
          type="tel"
          inputMode="numeric"
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          placeholder={country.placeholder}
          value={displayValue}
          onChange={handleNationalChange}
          onPaste={handlePaste}
          onBeforeInput={handleBeforeInput}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          autoComplete="tel-national"
          className={cn(
            'flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[var(--fg)]',
            'placeholder:text-[var(--fg-muted)] focus:outline-none',
          )}
        />
      </div>

      {error && (
        <p id={errorId} role="alert"className="mt-1.5 text-xs text-[var(--danger-text)]">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-[var(--fg-muted)]">
          {hint}
        </p>
      )}

      <CountryPicker
        isOpen={pickerOpen}
        selected={country}
        onSelect={handleCountrySelect}
        onClose={() => setPickerOpen(false)}
        triggerRef={triggerRef}
        onAfterSelectClose={focusPhoneInput}
      />
    </div>
  )
})
