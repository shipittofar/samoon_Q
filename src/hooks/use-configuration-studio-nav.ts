'use client'

/**
 * useConfigurationStudioNav — P9.3 Phase C (Framework Improvement)
 *
 * Pinned/recent module tracking for the Studio's navigation rail — pure
 * localStorage-backed state, no module-specific logic. Any module id works;
 * the hook has never heard of Authentication or Countries.
 */
import { useCallback, useEffect, useState } from 'react'

const PINNED_KEY = 'configuration-studio.pinned-modules'
const RECENT_KEY = 'configuration-studio.recent-modules'
const MAX_RECENT = 5

function readList(key: string): string[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[]) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // localStorage may be blocked (private browsing) — pinning/recents just won't persist
  }
}

export function useConfigurationStudioNav() {
  const [pinned, setPinned] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setPinned(readList(PINNED_KEY))
    setRecent(readList(RECENT_KEY))
  }, [])

  const togglePinned = useCallback((moduleId: string) => {
    setPinned((prev) => {
      const next = prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
      writeList(PINNED_KEY, next)
      return next
    })
  }, [])

  const isPinned = useCallback((moduleId: string) => pinned.includes(moduleId), [pinned])

  const recordVisit = useCallback((moduleId: string) => {
    setRecent((prev) => {
      const next = [moduleId, ...prev.filter((id) => id !== moduleId)].slice(0, MAX_RECENT)
      writeList(RECENT_KEY, next)
      return next
    })
  }, [])

  return { pinned, recent, togglePinned, isPinned, recordVisit }
}
