'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { SearchField } from './SearchField'
import { SuggestionList, type SuggestionGroup, type SuggestionItem } from './SuggestionList'
import { FilterChip } from './FilterChip'

interface SearchOverlayProps {
  open: boolean
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: (value: string) => void
  onSelectSuggestion: (item: SuggestionItem) => void
  recents: string[]
  onRemoveRecent: (query: string) => void
  suggestionGroups: SuggestionGroup[]
  loading?: boolean
  placeholder: string
  label: string
  /** Real category shortcuts — shown only when there are no recents and no query. */
  shortcuts?: { id: string; label: string }[]
  onShortcut?: (id: string) => void
}

export function SearchOverlay({
  open,
  value,
  onChange,
  onClose,
  onSubmit,
  onSelectSuggestion,
  recents,
  onRemoveRecent,
  suggestionGroups,
  loading = false,
  placeholder,
  label,
  shortcuts = [],
  onShortcut,
}: SearchOverlayProps) {
  const t = useTranslations('searchUi')
  const tCommon = useTranslations('common')
  const reduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const [activeId, setActiveId] = useState<string | undefined>()
  const [keyboardInset, setKeyboardInset] = useState(0)
  const flatRef = useRef<SuggestionItem[]>([])
  const activeIdRef = useRef<string | undefined>(undefined)

  const groupedRecents: SuggestionGroup[] = useMemo(
    () =>
      value.trim()
        ? []
        : [
            {
              id: 'recent',
              label: t('recentSearches'),
              items: recents.map((query) => ({
                id: `recent-${query}`,
                kind: 'recent' as const,
                label: query,
                query,
              })),
            },
          ],
    [recents, t, value],
  )

  const labelledGroups = useMemo(() => {
    const labels: Record<string, string> = {
      businesses: t('groupBusinesses'),
      cuisines: t('groupCuisines'),
      cities: t('groupCities'),
      categories: t('groupCategories'),
    }
    return suggestionGroups.map((g) => ({ ...g, label: labels[g.id] ?? g.label }))
  }, [suggestionGroups, t])

  const displayGroups = value.trim() ? labelledGroups : groupedRecents
  const flat = displayGroups.flatMap((g) => g.items)
  flatRef.current = flat
  activeIdRef.current = activeId

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const previous = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'

    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const getFocusable = (): HTMLElement[] =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null,
      )

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const focusable = getFocusable()
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = flatRef.current
        if (items.length === 0) return
        e.preventDefault()
        const idx = Math.max(0, items.findIndex((item) => item.id === activeIdRef.current))
        const next =
          e.key === 'ArrowDown'
            ? items[(idx + 1) % items.length]
            : items[(idx - 1 + items.length) % items.length]
        setActiveId(next.id)
      }
    }

    document.addEventListener('keydown', onKey)
    const vv = window.visualViewport
    const syncViewport = () => {
      if (!vv) return
      setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    vv?.addEventListener('resize', syncViewport)
    vv?.addEventListener('scroll', syncViewport)
    syncViewport()

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      vv?.removeEventListener('resize', syncViewport)
      vv?.removeEventListener('scroll', syncViewport)
      previous?.focus()
    }
  }, [open, onClose])

  useEffect(() => {
    setActiveId(undefined)
  }, [value])

  const duration = reduceMotion ? 0.08 : 0.18

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ paddingBottom: keyboardInset }}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 bg-[var(--search-overlay)]"
            onClick={onClose}
          />
          <motion.div
            initial={reduceMotion ? undefined : { y: 8 }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: 8 }}
            transition={{ duration }}
            className="relative z-10 flex flex-col max-h-[min(100%,32rem)] bg-[var(--bg)] border-b border-[var(--border)] pt-[env(safe-area-inset-top)]"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <SearchField
                ref={inputRef}
                variant="overlay"
                value={value}
                onChange={onChange}
                onSubmitQuery={(q) => {
                  if (activeId) {
                    const item = flat.find((s) => s.id === activeId)
                    if (item) {
                      onSelectSuggestion(item)
                      return
                    }
                  }
                  onSubmit(q)
                }}
                loading={loading}
                label={label}
                clearLabel={t('clear')}
                placeholder={placeholder}
                aria-controls={listId}
                aria-activedescendant={activeId}
              />
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 min-h-11 px-3 text-sm font-medium text-[var(--accent-text)] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {tCommon('cancel')}
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-2 pb-6">
              <SuggestionList
                groups={displayGroups}
                query={value}
                activeId={activeId}
                listId={listId}
                onSelect={onSelectSuggestion}
                onRemoveRecent={(item) => onRemoveRecent(item.label)}
                removeRecentLabel={(q) => t('removeRecent', { query: q })}
              />

              {!value.trim() && recents.length === 0 && shortcuts.length > 0 && (
                <div className="px-3 mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-2">
                    {t('groupCategories')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shortcuts.slice(0, 3).map((s) => (
                      <FilterChip key={s.id} onClick={() => onShortcut?.(s.id)}>
                        {s.label}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

