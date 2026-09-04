'use client'

import { useCallback, useState } from 'react'

const MAX_RECENTS = 5

function read(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

function write(key: string, items: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_RECENTS)))
}

/** Recent queries the user actually submitted. Not personalization. */
export function useRecentSearches(scope: 'discover' | 'menu') {
  const key = `samoon-recent-searches-${scope}`
  const [items, setItems] = useState<string[]>(() => read(key))

  const add = useCallback(
    (query: string) => {
      const next = query.trim()
      if (!next) return
      setItems((prev) => {
        const updated = [next, ...prev.filter((item) => item.toLowerCase() !== next.toLowerCase())].slice(0, MAX_RECENTS)
        write(key, updated)
        return updated
      })
    },
    [key],
  )

  const remove = useCallback(
    (query: string) => {
      setItems((prev) => {
        const updated = prev.filter((item) => item !== query)
        write(key, updated)
        return updated
      })
    },
    [key],
  )

  return { items, add, remove }
}
