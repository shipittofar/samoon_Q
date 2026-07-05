'use client'

/**
 * ConfigurationStudioNav — P9.3 Phase C (Framework Improvement)
 *
 * The Studio's left rail: every module from `PlatformConfigurationRegistry`,
 * grouped by `category`, with search, pinning, and recents — entirely
 * driven by the registry and `useConfigurationStudioNav`'s localStorage
 * state. No module id is ever hardcoded, so a future module (Themes,
 * Payments, …) appears here automatically the moment it registers.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Bell, CreditCard, Flag, Globe2, HardDrive, LayoutTemplate, Languages,
  Palette, Pin, PinOff, Search, Server, Shield, ShieldCheck, Type, Wallet, Webhook,
  Clock, type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { platformConfigurationRegistry } from '@/config'
import type { ConfigModuleDefinition } from '@/config'
import { usePlatformConfiguration } from '@/hooks/use-platform-configuration'
import { useConfigurationStudioNav } from '@/hooks/use-configuration-studio-nav'
import { buildSearchHaystack } from './configUiHelpers'

const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  Webhook, ShieldCheck, Globe2, Flag, Languages, Activity, Bell, Wallet,
  Shield, HardDrive, CreditCard, Server, Palette, Type, LayoutTemplate,
}

const LIFECYCLE_BADGE_VARIANT = {
  draft: 'secondary',
  testing: 'purple',
  published: 'success',
  deprecated: 'warning',
  archived: 'outline',
} as const

export interface ConfigurationStudioNavProps {
  activeModuleId?: string
  onSelect: (moduleId: string) => void
}

export function ConfigurationStudioNav({ activeModuleId, onSelect }: ConfigurationStudioNavProps) {
  const modules = usePlatformConfiguration()
  const { pinned, recent, togglePinned, isPinned } = useConfigurationStudioNav()
  const [search, setSearch] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const itemRefs = useRef<HTMLButtonElement[]>([])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return modules
    return modules.filter((m) => buildSearchHaystack([m.name, m.description, m.category]).includes(q))
  }, [modules, search])

  const pinnedModules = filtered.filter((m) => isPinned(m.id))
  const recentModules = filtered.filter((m) => recent.includes(m.id) && !isPinned(m.id))
  const grouped = useMemo(() => {
    const map = new Map<string, ConfigModuleDefinition[]>()
    for (const m of filtered) {
      if (isPinned(m.id) || recent.includes(m.id)) continue
      map.set(m.category, [...(map.get(m.category) ?? []), m])
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, pinned, recent])

  const flatOrder = [...pinnedModules, ...recentModules, ...grouped.flatMap(([, mods]) => mods)]

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, flatOrder.length)
  }, [flatOrder.length])

  function onNavKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(focusedIndex + 1, flatOrder.length - 1)
      setFocusedIndex(next)
      itemRefs.current[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(focusedIndex - 1, 0)
      setFocusedIndex(prev)
      itemRefs.current[prev]?.focus()
    } else if (e.key === 'Enter' && flatOrder[focusedIndex]) {
      onSelect(flatOrder[focusedIndex].id)
    }
  }

  function renderModuleButton(mod: ConfigModuleDefinition, index: number) {
    const Icon = (mod.icon && MODULE_ICON_MAP[mod.icon]) || ShieldCheck
    const lifecycle = platformConfigurationRegistry.getModuleLifecycle(mod.id)
    const isActive = mod.id === activeModuleId
    return (
      <div key={mod.id} className="group flex items-center gap-1">
        <button
          ref={(el) => { if (el) itemRefs.current[index] = el }}
          type="button"
          onClick={() => onSelect(mod.id)}
          onFocus={() => setFocusedIndex(index)}
          aria-current={isActive ? 'page' : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
            isActive ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'text-[var(--fg)] hover:bg-[var(--card-hover)]'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{mod.name}</span>
          {lifecycle !== 'published' && (
            <Badge variant={LIFECYCLE_BADGE_VARIANT[lifecycle]} className="ml-auto shrink-0 text-[10px]">{lifecycle}</Badge>
          )}
        </button>
        <button
          type="button"
          onClick={() => togglePinned(mod.id)}
          aria-label={isPinned(mod.id) ? `Unpin ${mod.name}` : `Pin ${mod.name}`}
          className="shrink-0 rounded-lg p-1.5 text-[var(--fg-muted)] opacity-0 hover:bg-[var(--card-hover)] hover:text-[var(--fg)] focus-visible:opacity-100 group-hover:opacity-100"
        >
          {isPinned(mod.id) ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>
    )
  }

  return (
    <nav className="flex h-full flex-col" aria-label="Configuration modules" onKeyDown={onNavKeyDown}>
      <div className="border-b border-[var(--border)] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fg-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules…"
            aria-label="Search modules"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {flatOrder.length === 0 ? (
          <EmptyState title="No modules match" description={`Nothing matches "${search}".`} />
        ) : (
          <>
            {pinnedModules.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  <Pin className="h-3 w-3" /> Pinned
                </p>
                <div className="space-y-0.5">{pinnedModules.map((m) => renderModuleButton(m, flatOrder.indexOf(m)))}</div>
              </div>
            )}
            {recentModules.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  <Clock className="h-3 w-3" /> Recent
                </p>
                <div className="space-y-0.5">{recentModules.map((m) => renderModuleButton(m, flatOrder.indexOf(m)))}</div>
              </div>
            )}
            {grouped.map(([category, mods]) => (
              <div key={category}>
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{category}</p>
                <div className="space-y-0.5">{mods.map((m) => renderModuleButton(m, flatOrder.indexOf(m)))}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </nav>
  )
}
