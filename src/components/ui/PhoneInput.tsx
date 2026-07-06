'use client'

/**
 * P8.9.2  — International phone input with E.164 output.
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
  getPinnedCountries,
  getRestCountries,
  getSortedCountries,
  guessCountryFromLocale,
  guessCountryFromTimezone,
  loadRecentCountries,
  saveRecentCountry,
  saveLastSelected,
  loadLastSelected,
  searchCountries,
} from '@/data/countries'
import { FlagIcon } from '@/components/ui/FlagIcon'

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

const digitsOnly = (s: string) => s.replace(/\D/g, '')

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

function isValidLength(nationalDigits: string): boolean {
  const len = digitsOnly(nationalDigits).length
  return len >= 5 && len <= 15
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
    // Force DOM flush so changing same text re-triggers SR
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
//
// The Bottom Sheet stays anchored at bottom:0. When a software keyboard opens,
// visualViewport.height shrinks. We cap the sheet's maxHeight to that visible
// height so only the inner list (flex-1) shrinks — the sheet never moves.

interface ViewportState {
  keyboardHeight: number  // px the keyboard occupies (0 when hidden)
  viewportHeight: number  // px of visible screen above keyboard
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

function CountryRow({ country, selected, onSelect, optionId, isActive }: CountryRowProps) {
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
        // Touch-friendly: 48px min height, full width
        'w-full flex items-center gap-3 px-3 rounded-xl text-sm text-start transition-colors',
        'min-h-[48px] py-2',
        // Selected: accent background + left border
        isSelected && !isActive
          ? 'bg-[var(--accent)]/10 border-s-2 border-[var(--accent)]'
          : '',
        // Keyboard-active: stronger accent ring
        isActive
          ? 'bg-[var(--accent)]/15 outline-none ring-2 ring-inset ring-[var(--accent)]/40'
          : '',
        // Default hover / focus-visible
        !isActive && !isSelected
          ? 'hover:bg-[var(--card-hover)] focus-visible:bg-[var(--card-hover)] focus:outline-none'
          : '',
      )}
    >
      {/* Flag */}
      <span className="w-8 shrink-0 flex items-center justify-center" aria-hidden="true">
        <FlagIcon code={country.code} size={22} />
      </span>

      {/* Name */}
      <span className="flex-1 min-w-0 truncate font-medium text-[var(--fg)]">
        {country.name}
      </span>

      {/* ISO code — muted, hidden on xs */}
      <span
        className="hidden sm:inline text-[10px] font-mono text-[var(--fg-muted)] shrink-0 opacity-50"
        aria-hidden="true"
      >
        {country.code}
      </span>

      {/* Dial code — always dir="ltr" for RTL layouts */}
      <span
        dir="ltr"
        className="text-sm font-mono text-[var(--fg-muted)] shrink-0 min-w-[3.25rem] text-end"
      >
        {country.dialCode}
      </span>

      {/* Check icon for selected */}
      {isSelected && (
        <span className="shrink-0 text-[var(--accent)] ms-1" aria-hidden="true">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        </span>
      )}
    </button>
  )
}

// ── Country Picker ─────────────────────────────────────────────────────────────

interface CountryPickerProps {
  isOpen: boolean
  selected: Country
  onSelect: (country: Country) => void
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const PAGE_SIZE = 8 // rows per PageUp/PageDown jump

function CountryPicker({ isOpen, selected, onSelect, onClose, triggerRef }: CountryPickerProps) {
  const t = useTranslations('phoneInput')
  const prefersReducedMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recents, setRecents] = useState<Country[]>([])
  const { keyboardHeight, viewportHeight } = useVisualViewport()
  // When the software keyboard is open (height > 50px threshold), cap the sheet
  // to 92% of the remaining visible area. The sheet stays at bottom:0; only its
  // internal flex-1 list shrinks to fit.
  const keyboardOpen = keyboardHeight > 50
  const sheetMaxHeight = keyboardOpen ? `${Math.round(viewportHeight * 0.92)}px` : undefined

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const uid = useId()
  const titleId = `${uid}-title`
  const listId = `${uid}-list`
  const optionId = (i: number) => `${uid}-opt-${i}`

  const { announce, node: announcer } = useAnnouncer()

  // Memoized pinned (never changes)
  const pinned = useMemo(() => getPinnedCountries(), [])
  const pinnedSet = useMemo(() => new Set(PINNED_COUNTRY_CODES), [])

  // Search results (memoized by query)
  const results = useMemo(
    () => (query ? searchCountries(query) : []),
    [query],
  )

  // Recents filtered to exclude pinned
  const recentFiltered = useMemo(
    () => recents.filter((c) => !pinnedSet.has(c.code)),
    [recents, pinnedSet],
  )

  // Rest = all countries minus pinned, alphabetical
  const rest = useMemo(() => getRestCountries(), [])

  // The flat list used for keyboard navigation depends on whether searching
  const navList: Country[] = useMemo(() => {
    if (query) return results
    // When not searching: pinned + recent + rest (no duplicates)
    const recentCodes = new Set(recentFiltered.map((c) => c.code))
    const filteredRest = rest.filter((c) => !recentCodes.has(c.code))
    return [...pinned, ...recentFiltered, ...filteredRest]
  }, [query, results, pinned, recentFiltered, rest])

  // ── Scroll lock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const unlock = lockBodyScroll()
    return unlock
  }, [isOpen])

  // ── Open: reset state, scroll to selected, announce ─────────────────────────
  // Phase A/B: NO automatic focus on the search input.
  // Focusing the search field would immediately open the soft keyboard on mobile,
  // which is not native UX. The keyboard must only appear when the user
  // intentionally taps the search field.
  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIndex(-1)
    setRecents(loadRecentCountries())

    const timer = setTimeout(() => {
      // Scroll selected row into view — but do NOT focus any input
      if (listRef.current) {
        const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement
        sel?.scrollIntoView({ block: 'center' })
      }
      announce(t('countryPickerOpened'))
    }, 120)
    return () => clearTimeout(timer)
  }, [isOpen, announce, t])

  // ── Close: dismiss keyboard, restore focus to trigger ────────────────────────
  // Phase G: blur the search input so the soft keyboard dismisses when the picker
  // closes (either via selection, Escape, or backdrop tap).
  useEffect(() => {
    if (isOpen) return
    searchRef.current?.blur()
    const timer = setTimeout(() => triggerRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [isOpen, triggerRef])

  // ── Announce search result count ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !query) return
    const count = results.length
    announce(t('countriesFoundCount', { count }))
  }, [query, results, isOpen, announce])

  // ── Focus trap ───────────────────────────────────────────────────────────────
  useFocusTrap(containerRef, isOpen)

  // ── Scroll active item into view ─────────────────────────────────────────────
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const item = listRef.current.querySelector(`[id="${optionId(activeIndex)}"]`) as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((country: Country) => {
    saveRecentCountry(country.code)
    saveLastSelected(country.code)
    onSelect(country)
    announce(t('countrySelectedAnnounce', { name: country.name }))
    onClose()
  }, [onSelect, onClose, announce])

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
        // Type-to-search: printable character redirects focus to search input
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

  // ── Render ───────────────────────────────────────────────────────────────────

  const isSearching = query.length > 0

  // ── Dialog layout (CSS Grid) ──────────────────────────────────────────────
  //
  // The dialog uses a 3-row CSS Grid so that only the list row can scroll.
  // Row 1 (auto):           Header — fixed height, never scrolls
  // Row 2 (auto):           Search — fixed height, never scrolls
  // Row 3 (minmax(0,1fr)):  List   — fills remaining space, scrolls
  //
  // Key constraints:
  //   • Dialog: flex-1 min-h-0  — fills sheet after drag handle; min-h-0
  //     lets it shrink below its content (essential in flex parents)
  //   • Dialog: overflow-hidden — clips content at sheet boundary
  //   • List: min-h-0           — grid child must opt into shrinking;
  //     without this the grid track expands to full content height and the
  //     sheet itself scrolls instead of the list
  //   • List: overflow-y-auto   — the one and only scroll container
  //
  // Removed constraints vs P8.9.2.4:
  //   • h-full on dialog  → replaced by flex-1 (parent is flex-col)
  //   • flex flex-col on dialog → replaced by grid
  //   • shrink-0 on header/search → not needed; grid auto rows are intrinsic
  //   • flex-1 on list    → not needed; list is the minmax(0,1fr) grid track

  const listContent = (
    <div
      ref={containerRef}
      // flex-1 min-h-0: fills sheet's flex layout and allows shrinking
      // grid: 3-row layout so only the list row scrolls
      // overflow-hidden: clips rounded corners; no overflow escapes the dialog
      className="flex-1 min-h-0 grid grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
    >
      {/* Announcer (sr-only) */}
      {announcer}

      {/* ── Row 1: Header — auto height, never scrolls ── */}
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
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Row 2: Search — auto height, never scrolls ── */}
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
          {/* Clear query button */}
          {isSearching && (
            <button
              type="button"
              onClick={() => { setQuery(''); setActiveIndex(-1); searchRef.current?.focus() }}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
              aria-label={t('clearSearchAria')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Row 3: Country list — minmax(0,1fr), ONLY this scrolls ── */}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t('countriesListAria')}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        className={cn(
          // min-h-0: grid child must opt into shrinking (no implicit min-height:auto)
          // overflow-y-auto: the single scroll container; nothing else scrolls
          'min-h-0 overflow-y-auto px-2 overscroll-contain',
          // iOS momentum scrolling (safe for modern + legacy WebKit)
          '[WebkitOverflowScrolling:touch]',
          // Safe area for iOS home indicator / Dynamic Island devices
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          // Thin themed scrollbar (WebKit/Blink)
          '[&::-webkit-scrollbar]:w-[5px]',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:bg-[var(--border)]',
          '[&::-webkit-scrollbar-thumb:hover]:bg-[var(--fg-muted)]',
        )}
      >
        {/* ── Searching: flat ranked results ── */}
        {isSearching ? (
          results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="text-3xl" aria-hidden="true">🔍</span>
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
          /* ── Not searching: Pinned → Recent → All ── */
          <>
            {/* Pinned */}
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

            {/* Recent — only if non-empty */}
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

            {/* Divider */}
            <div className="mx-3 my-2 border-t border-[var(--border)]" aria-hidden="true" />

            {/* All countries (excluding pinned + recent) */}
            <SectionHeader label={t('allCountries')} />
            {rest
              .filter((c) => !recentFiltered.some((r) => r.code === c.code))
              .map((c, i) => {
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

  const slideY = prefersReducedMotion ? 0 : '100%'
  const motionDuration = prefersReducedMotion ? 0 : 0.28

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet — bottom on mobile, centered modal on desktop */}
          <motion.div
            key="cp-sheet"
            initial={{ y: slideY, opacity: prefersReducedMotion ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: slideY, opacity: prefersReducedMotion ? 0 : 1 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, duration: motionDuration }}
            style={sheetMaxHeight ? { maxHeight: sheetMaxHeight } : undefined}
            className={cn(
              // Sheet: flex column so drag handle (shrink-0) + dialog (flex-1) stack correctly
              // overflow-hidden: clips content at rounded corners; no content escapes
              'fixed z-50 bg-[var(--bg)] shadow-2xl flex flex-col overflow-hidden',
              // Mobile: anchored at bottom:0 — NEVER moves; maxHeight shrinks via VisualViewport
              'bottom-0 start-0 end-0 rounded-t-2xl max-h-[85dvh]',
              // Smooth max-height resize as keyboard slides in/out
              prefersReducedMotion ? '' : 'transition-[max-height] duration-200 ease-out',
              // Desktop: centered modal; bottom:auto unanchors from bottom edge
              'md:bottom-auto md:start-1/2 md:top-1/2',
              'md:-translate-x-1/2 md:-translate-y-1/2',
              'md:rounded-2xl md:w-[480px] md:max-h-[70vh]',
            )}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-2.5 pb-0 md:hidden shrink-0" aria-hidden="true">
              <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
            </div>
            {listContent}
          </motion.div>
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

  /**
   * Country detection priority:
   * 1. Explicit defaultCountry prop
   * 2. Parsed from value (E.164)
   * 3. Last explicitly selected (localStorage)
   * 4. Browser locale
   * 5. Browser timezone
   * 6. US default
   */
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
    const locale = guessCountryFromLocale()
    if (locale) return locale
    const tz = guessCountryFromTimezone()
    if (tz) return tz
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
    onChange?.(e164, {
      countryCode: c.code,
      dialCode: c.dialCode,
      nationalNumber: digitsOnly(national),
      e164,
      isValid: isValidLength(national),
    })
  }, [national, onChange])

  const handleNationalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = digitsOnly(e.target.value)
    if (digits.length > 15) return
    setNational(digits)
    const e164 = buildE164(country.dialCode, digits)
    onChange?.(e164, {
      countryCode: country.code,
      dialCode: country.dialCode,
      nationalNumber: digits,
      e164,
      isValid: isValidLength(digits),
    })
    e.target.value = formatNational(digits, country)
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
        {/* Country selector button */}
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
          <span dir="ltr" className="text-sm font-medium text-[var(--fg)] tabular-nums">
            {country.dialCode}
          </span>
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
            'placeholder:text-[var(--fg-muted)] focus:outline-none',
          )}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-500">
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
      />
    </div>
  )
})
