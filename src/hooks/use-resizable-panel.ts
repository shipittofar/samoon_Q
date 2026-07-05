'use client'

/**
 * useResizablePanel — P9.3 Phase B (Framework Improvement)
 *
 * Drag-to-resize + persisted width for one panel in a multi-pane layout —
 * generic, no Configuration Studio-specific logic (the Studio is simply the
 * first consumer of a "resizable side panel with a remembered width"
 * primitive). Persists to localStorage under `storageKey` so the layout
 * survives a reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseResizablePanelOptions {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** 'left' panels grow when the pointer moves right; 'right' panels grow when it moves left. */
  side: 'left' | 'right'
}

export function useResizablePanel({ storageKey, defaultWidth, minWidth, maxWidth, side }: UseResizablePanelOptions) {
  const [width, setWidth] = useState(defaultWidth)
  const [collapsed, setCollapsed] = useState(false)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (raw) {
        const parsed = JSON.parse(raw) as { width?: number; collapsed?: boolean }
        if (typeof parsed.width === 'number') setWidth(parsed.width)
        if (typeof parsed.collapsed === 'boolean') setCollapsed(parsed.collapsed)
      }
    } catch {
      // ignore — defaults already set
    }
  }, [storageKey])

  const persist = useCallback((next: { width?: number; collapsed?: boolean }) => {
    try {
      if (typeof localStorage === 'undefined') return
      const current = { width, collapsed, ...next }
      localStorage.setItem(storageKey, JSON.stringify(current))
    } catch {
      // ignore
    }
  }, [storageKey, width, collapsed])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      persist({ collapsed: !prev })
      return !prev
    })
  }, [persist])

  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragState.current = { startX: e.clientX, startWidth: width }
    const onMove = (moveEvent: PointerEvent) => {
      if (!dragState.current) return
      const delta = moveEvent.clientX - dragState.current.startX
      const signedDelta = side === 'left' ? delta : -delta
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, dragState.current.startWidth + signedDelta))
      setWidth(nextWidth)
    }
    const onUp = () => {
      dragState.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setWidth((w) => {
        persist({ width: w })
        return w
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, side, minWidth, maxWidth])

  return { width, collapsed, toggleCollapsed, onDragStart }
}
