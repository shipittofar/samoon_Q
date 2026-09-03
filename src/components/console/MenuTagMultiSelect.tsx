'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import type { ConsoleMenuTag } from '@/types'
import { MenuTagBadge } from '@/components/menu/MenuTagBadge'
import { cn } from '@/utils'

interface MenuTagMultiSelectProps {
  tags: ConsoleMenuTag[]
  value: number[]
  onChange: (tagIds: number[]) => void
  disabled?: boolean
  isLoading?: boolean
}

export function MenuTagMultiSelect({
  tags,
  value,
  onChange,
  disabled = false,
  isLoading = false,
}: MenuTagMultiSelectProps) {
  const t = useTranslations('console')
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)

  const selectedTags = useMemo(
    () => tags.filter((tag) => value.includes(tag.id)),
    [tags, value],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tags.filter((tag) => {
      if (value.includes(tag.id)) return false
      if (!q) return true
      return tag.name.toLowerCase().includes(q) || tag.slug.toLowerCase().includes(q)
    })
  }, [tags, value, search])

  useEffect(() => {
    setHighlightIndex(0)
  }, [search, open])

  const toggleTag = (tagId: number) => {
    onChange(
      value.includes(tagId)
        ? value.filter((id) => id !== tagId)
        : [...value, tagId],
    )
    setSearch('')
    inputRef.current?.focus()
  }

  const removeTag = (tagId: number) => {
    onChange(value.filter((id) => id !== tagId))
  }

  const clearAll = () => onChange([])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && filtered[highlightIndex]) {
      event.preventDefault()
      toggleTag(filtered[highlightIndex].id)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Backspace' && !search && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--fg)]"htmlFor={`${listboxId}-input`}>
        {t('menuTagsLabel')}
      </label>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {selectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => removeTag(tag.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
              aria-label={t('removeTagAria', { name: tag.name })}
            >
              <MenuTagBadge tag={tag} className="pe-1"/>
              <X className="h-3 w-3 text-[var(--fg-muted)]"aria-hidden="true"/>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline-offset-2 hover:underline"
          >
            {t('clearTagSelection')}
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"aria-hidden="true"/>
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="search"
          value={search}
          disabled={disabled || isLoading}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? t('loadingEllipsis') : t('searchTagsPlaceholder')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)]"
        />

        {open && !disabled && !isLoading && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t('menuTagsLabel')}
            className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--fg-muted)]">{t('noTagsMatchSearch')}</li>
            ) : (
              filtered.map((tag, index) => (
                <li key={tag.id} role="option"aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'w-full px-3 py-2 text-start text-sm flex items-center gap-2 transition-colors',
                      index === highlightIndex
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                        : 'hover:bg-[var(--card-hover)] text-[var(--fg)]',
                    )}
                  >
                    <MenuTagBadge tag={tag} />
                    {!tag.is_active && (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                        {t('inactive')}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {tags.length === 0 && !isLoading && (
        <p className="text-xs text-[var(--fg-muted)]">{t('noTagsAvailable')}</p>
      )}
    </div>
  )
}
