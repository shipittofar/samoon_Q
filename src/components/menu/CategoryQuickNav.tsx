'use client'

import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/utils'
import { placeCategoryQuickNav } from '@/lib/menu-category-sections'

export interface CategoryQuickNavItem {
  id: string
  name: string
}

interface CategoryQuickNavProps {
  open: boolean
  anchorRef: RefObject<HTMLButtonElement | null>
  sections: CategoryQuickNavItem[]
  activeId: string
  title: string
  allLabel: string
  closeLabel: string
  listLabel: string
  onClose: () => void
  onSelect: (categoryId: string) => void
}

const FOCUSABLE = 'button:not([disabled])'

export function CategoryQuickNav({
  open,
  anchorRef,
  sections,
  activeId,
  title,
  allLabel,
  closeLabel,
  listLabel,
  onClose,
  onSelect,
}: CategoryQuickNavProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const titleId = useId()

  const applyPlacement = () => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const rect = anchor.getBoundingClientRect()
    const dir = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'
    const placed = placeCategoryQuickNav(
      { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      { width: window.innerWidth, height: window.innerHeight },
      dir,
    )
    panel.style.top = `${placed.top}px`
    panel.style.left = `${placed.left}px`
    panel.style.width = `${placed.width}px`
    if (listRef.current) {
      const headerAllowance = 64
      listRef.current.style.maxHeight = `${Math.max(placed.maxHeight - headerAllowance, 80)}px`
    }
  }

  useLayoutEffect(() => {
    if (!open) return
    applyPlacement()
    const onReflow = () => applyPlacement()
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return
      applyPlacement()
    }
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onScroll, true)
    }
    // Placement reads the live anchor; sections only affect height after paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRef, sections.length])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const list = listRef.current
    if (!panel) return

    const frame = requestAnimationFrame(() => {
      const current = list?.querySelector<HTMLElement>('[aria-current="location"]')
      const initial = current ?? panel.querySelector<HTMLElement>(FOCUSABLE)
      initial?.focus({ preventScroll: true })
      if (current && list) {
        const top = current.offsetTop
        const bottom = top + current.offsetHeight
        if (top < list.scrollTop) list.scrollTop = top
        else if (bottom > list.scrollTop + list.clientHeight) {
          list.scrollTop = bottom - list.clientHeight
        }
      }
    })

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    const onPointer = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panel.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, onClose, anchorRef])

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    if (buttons.length === 0) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next = 0
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    else if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % buttons.length
    else next = index < 0 ? buttons.length - 1 : (index - 1 + buttons.length) % buttons.length
    event.preventDefault()
    buttons[next]?.focus({ preventScroll: true })
  }

  if (!open || typeof document === 'undefined') return null

  const entries = [{ id: '', name: allLabel }, ...sections]

  return createPortal(
    <div
      ref={panelRef}
      id="menu-category-quick-nav"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 shrink-0">
        <h2 id={titleId} className="font-[var(--font-display)] text-base font-semibold text-[var(--fg)]">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={cn(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--fg-muted)]',
            'hover:bg-[var(--card-hover)] hover:text-[var(--fg)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ul
        ref={listRef}
        aria-label={listLabel}
        onKeyDown={onListKeyDown}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {entries.map((entry) => {
          const selected = activeId === entry.id
          return (
            <li key={entry.id || 'all'}>
              <button
                type="button"
                aria-current={selected ? 'location' : undefined}
                onClick={() => onSelect(entry.id)}
                className={cn(
                  'flex w-full min-h-11 items-center rounded-xl px-3 text-start text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                  selected
                    ? 'bg-[var(--accent-subtle)] font-semibold text-[var(--fg)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]',
                )}
              >
                <span className="truncate">{entry.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>,
    document.body,
  )
}
