'use client'

/**
 * ConfigurationCommandPalette — P9.3 Phase H (Framework Improvement)
 *
 * Ctrl/Cmd+K universal command surface for the Studio: jump to any
 * registered module, jump straight to any field across every module, or
 * run the currently-active module's Save/Discard. Built entirely from
 * `platformConfigurationRegistry` + the shared `buildSearchHaystack` — a
 * future module's fields are searchable here the moment it registers, with
 * zero changes to this file. Reuses the existing `Modal` primitive for its
 * focus-trap/Escape-to-close behavior rather than re-implementing either.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, RotateCcw, Save, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { platformConfigurationRegistry, resolveConfigText } from '@/config'
import { platformSearchRegistry } from '@/platform-admin/search'
import { buildSearchHaystack } from './configUiHelpers'
import type { ConfigurationDraftStatus, ConfigurationModuleActions } from './ConfigurationStudioToolbar'

interface PaletteCommand {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

export interface ConfigurationCommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigateToModule: (moduleId: string) => void
  onNavigateToField: (moduleId: string, fieldId: string) => void
  draftStatus: ConfigurationDraftStatus | null
  actions: ConfigurationModuleActions | null
}

export function ConfigurationCommandPalette({
  open, onClose, onNavigateToModule, onNavigateToField, draftStatus, actions,
}: ConfigurationCommandPaletteProps) {
  const t = useTranslations('console')
  const tFields = useTranslations('configFields')
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0) }
  }, [open])

  const commands = useMemo(() => {
    const list: PaletteCommand[] = []

    if (draftStatus?.isDirty && actions) {
      list.push({ id: 'save', label: t('saveChangesCommand'), hint: t('unsavedBadge', { count: draftStatus.dirtyCount }), icon: <Save className="h-4 w-4" />, run: () => { actions.save(); onClose() } })
      list.push({ id: 'discard', label: t('discardChangesCommand'), icon: <RotateCcw className="h-4 w-4" />, run: () => { actions.discard(); onClose() } })
    }

    for (const mod of platformConfigurationRegistry.getModules()) {
      const modName = resolveConfigText(tFields, mod.id, 'name', mod.name) ?? mod.name
      list.push({
        id: `module:${mod.id}`,
        label: t('goToModule', { name: modName }),
        hint: mod.category,
        icon: <ArrowRight className="h-4 w-4" />,
        run: () => { onNavigateToModule(mod.id); onClose() },
      })
      for (const section of mod.sections) {
        const sectionTitle = resolveConfigText(tFields, section.id, 'title', section.title) ?? section.title
        for (const field of section.fields) {
          list.push({
            id: `field:${field.id}`,
            label: field.display?.displayName ?? resolveConfigText(tFields, field.id, 'title', field.title) ?? field.title,
            hint: `${modName} · ${sectionTitle}`,
            icon: <Search className="h-4 w-4" />,
            run: () => { onNavigateToField(mod.id, field.id); onClose() },
          })
        }
      }
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStatus, actions])

  // P9.4 Phase F — cross-entity search hits (Businesses/Platform Users/
  // Countries, or any future registered provider) merge into the same
  // result list rather than a second search surface. Empty registry (no
  // provider registered, e.g. when this component renders without
  // '@/platform-admin' ever having been imported) is a silent no-op.
  const entityHits = useMemo(() => {
    if (!query.trim()) return []
    return platformSearchRegistry.searchAll(query).map((hit) => ({
      id: `entity:${hit.id}`,
      label: hit.label,
      hint: hit.hint,
      icon: <Search className="h-4 w-4" />,
      run: () => { onNavigateToModule(hit.moduleId); onClose() },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 20)
    const matched = commands.filter((c) => buildSearchHaystack([c.label, c.hint]).includes(q))
    return [...matched, ...entityHits].slice(0, 20)
  }, [commands, entityHits, query])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && filtered[activeIndex]) { filtered[activeIndex].run() }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" showClose={false}>
      <div className="-m-6">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={onKeyDown}
            placeholder={t('paletteSearchPlaceholder')}
            aria-label={t('paletteAria')}
            role="combobox"
            aria-expanded="true"
            aria-controls="configuration-command-palette-list"
            className="w-full bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)]"
          />
          <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">{t('escKey')}</kbd>
        </div>
        <div id="configuration-command-palette-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <EmptyState title={t('noMatches')} description={t('nothingMatchesQuery', { query })} className="py-8" />
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onClick={cmd.run}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  i === activeIndex ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'text-[var(--fg)]'
                }`}
              >
                <span className="text-[var(--fg-muted)]">{cmd.icon}</span>
                <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                {cmd.hint && <span className="shrink-0 text-xs text-[var(--fg-muted)]">{cmd.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
