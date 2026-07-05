'use client'

/**
 * ConfigurationCollectionTable — P9.2 Phase C/D/E/F/G (Framework Improvement)
 *
 * Generic list/table renderer for any `type: 'collection'` field: search,
 * filter, sort, grouping, bulk selection with statistics, and a row-click
 * into `ConfigurationEntityDrawer`. Countries is the first consumer, but
 * nothing below reads a country-specific id — every capability is derived
 * from `field.collection` (schema, entityLabel, defaultGroupBy) plus the
 * shared `configCollection`/`configUiHelpers` framework helpers, so a future
 * Branches or Tenants collection field renders through this exact same
 * component, per P9.2 Phase K.
 */
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Search } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { configCollection } from '@/config'
import type { ConfigBulkActionKind, ConfigCollectionEntry, ConfigFieldDefinition } from '@/config'
import { useConfigurationBulkActions } from '@/hooks/use-configuration-bulk-actions'
import { deriveCollectionFilterOptions, matchesCollectionEntryFilters, matchesCollectionEntrySearch } from './configUiHelpers'
import { ConfigurationEntityDrawer } from './ConfigurationEntityDrawer'

export interface ConfigurationCollectionTableProps {
  field: ConfigFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

function summarizeBooleanProperty(entries: ConfigCollectionEntry[], propertyId: string): { on: number; off: number } {
  let on = 0
  for (const entry of entries) if (entry.values[propertyId]) on += 1
  return { on, off: entries.length - on }
}

export function ConfigurationCollectionTable({ field, value, onChange, disabled }: ConfigurationCollectionTableProps) {
  const t = useTranslations('console')

  // 'import' is intentionally not in this list — unlike every other bulk
  // action it doesn't operate on `selectedIds` (it patches whichever entity
  // ids the imported payload names), so it gets its own standalone trigger
  // below rather than being gated behind a non-empty selection.
  const BULK_ACTIONS: { kind: ConfigBulkActionKind; label: string }[] = [
    { kind: 'enable', label: t('bulkEnable') },
    { kind: 'disable', label: t('bulkDisable') },
    { kind: 'publish', label: t('bulkPublish') },
    { kind: 'archive', label: t('bulkArchive') },
    { kind: 'reset', label: t('bulkReset') },
    { kind: 'export', label: t('bulkExport') },
  ]

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<{ propertyId: string; value: unknown } | null>(null)
  const [groupBy, setGroupBy] = useState<string | undefined>(field.collection?.defaultGroupBy)
  const [sortBy, setSortBy] = useState<string>('__entity__')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openEntityId, setOpenEntityId] = useState<string | null>(null)
  // P9.5.6 Phase G — 'import' needs a payload the admin pastes in, unlike
  // every other bulk action which just needs the current selection.
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [importText, setImportText] = useState('')

  const { computeBulkAction, lastResult } = useConfigurationBulkActions(field)

  const schema = configCollection.getSchema(field)
  const allEntries = useMemo(() => configCollection.getCollectionEntries(field, value), [field, value])
  // P9.5.6 Phase H — any collection module can supply a cross-entity
  // validator (see ConfigCollectionMeta.validateEntries); when it does, its
  // errors are surfaced here generically rather than each module building
  // its own banner UI.
  const crossEntityErrors = useMemo(
    () => field.collection?.validateEntries?.(value as Record<string, Record<string, unknown>>) ?? [],
    [field, value],
  )
  const filterOptions = useMemo(() => deriveCollectionFilterOptions(field), [field])
  const groupableProperties = schema.filter((p) => p.type === 'select' || p.type === 'string')
  const enabledProperty = schema.find((p) => p.id === 'enabled')
  const statusProperty = schema.find((p) => p.id === 'status')

  const filteredEntries = useMemo(() => {
    return allEntries
      .filter((entry) => matchesCollectionEntrySearch(field, entry, search))
      .filter((entry) => !activeFilter || matchesCollectionEntryFilters(entry.values, { [activeFilter.propertyId]: activeFilter.value as never }))
  }, [allEntries, field, search, activeFilter])

  const sortedEntries = useMemo(() => {
    const copy = [...filteredEntries]
    copy.sort((a, b) => {
      const av = sortBy === '__entity__' ? configCollection.getEntityLabel(field, a.entityId) : a.values[sortBy]
      const bv = sortBy === '__entity__' ? configCollection.getEntityLabel(field, b.entityId) : b.values[sortBy]
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filteredEntries, sortBy, sortDir, field])

  const groups = useMemo(() => {
    if (!groupBy) return [{ key: undefined, entries: sortedEntries }]
    const map = new Map<string, ConfigCollectionEntry[]>()
    for (const entry of sortedEntries) {
      const key = String(entry.values[groupBy] ?? 'Ungrouped')
      map.set(key, [...(map.get(key) ?? []), entry])
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entries]) => ({ key, entries }))
  }, [groupBy, sortedEntries])

  function toggleSelected(entityId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(entityId)) next.delete(entityId)
      else next.add(entityId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === sortedEntries.length ? new Set() : new Set(sortedEntries.map((e) => e.entityId))))
  }

  function runBulk(kind: ConfigBulkActionKind) {
    if (kind === 'import') {
      setShowImportPanel(true)
      return
    }
    const { nextValue } = computeBulkAction(kind, value, Array.from(selectedIds))
    if (nextValue !== undefined) onChange(nextValue)
    if (kind !== 'export') setSelectedIds(new Set())
  }

  function applyImport() {
    const { result, nextValue } = computeBulkAction('import', value, [], importText)
    if (nextValue !== undefined) {
      onChange(nextValue)
      setShowImportPanel(false)
      setImportText('')
    }
    return result
  }

  const openEntry = openEntityId ? allEntries.find((e) => e.entityId === openEntityId) : undefined

  return (
    <div className="space-y-3">
      {/* ── Statistics (Phase C) ── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{t('totalCount', { count: allEntries.length })}</Badge>
        {enabledProperty && (() => {
          const { on, off } = summarizeBooleanProperty(allEntries, 'enabled')
          return (
            <>
              <Badge variant="success">{t('enabledCount', { count: on })}</Badge>
              <Badge variant="outline">{t('disabledCount', { count: off })}</Badge>
            </>
          )
        })()}
        {filteredEntries.length !== allEntries.length && <Badge variant="info">{t('matchingFiltersCount', { count: filteredEntries.length })}</Badge>}
        {selectedIds.size > 0 && <Badge variant="warning">{t('selectedCount', { count: selectedIds.size })}</Badge>}
      </div>

      {/* ── Cross-entity validation banner (P9.5.6 Phase H) ── */}
      {crossEntityErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-500">
          <p className="mb-1 font-semibold">{t('validationErrorsTitle', { count: crossEntityErrors.length })}</p>
          <ul className="list-inside list-disc space-y-0.5">
            {crossEntityErrors.map((err, i) => (
              <li key={`${err.code}-${i}`}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Search + filter + group + sort (Phase E/F/G) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchEntityPlaceholder', { entity: (field.collection?.entityLabel ?? t('defaultEntityLabel')).toLowerCase() })}
            aria-label={t('searchEntityAria', { entity: field.collection?.entityLabel ?? t('defaultEntityLabel') })}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>

        <select
          value={activeFilter ? `${activeFilter.propertyId}=${String(activeFilter.value)}` : ''}
          onChange={(e) => {
            if (!e.target.value) return setActiveFilter(null)
            const opt = filterOptions.find((o) => `${o.propertyId}=${String(o.value)}` === e.target.value)
            setActiveFilter(opt ? { propertyId: opt.propertyId, value: opt.value } : null)
          }}
          aria-label={t('filterAria')}
          className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-2 text-xs text-[var(--fg)]"
        >
          <option value="">{t('allStatuses')}</option>
          {filterOptions.map((opt) => (
            <option key={`${opt.propertyId}=${String(opt.value)}`} value={`${opt.propertyId}=${String(opt.value)}`}>{opt.label}</option>
          ))}
        </select>

        {groupableProperties.length > 0 && (
          <select
            value={groupBy ?? ''}
            onChange={(e) => setGroupBy(e.target.value || undefined)}
            aria-label={t('groupByAria')}
            className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-2 text-xs text-[var(--fg)]"
          >
            <option value="">{t('noGrouping')}</option>
            {groupableProperties.map((prop) => (
              <option key={prop.id} value={prop.id}>{t('groupByLabel', { property: prop.display?.displayName ?? prop.title })}</option>
            ))}
          </select>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label={t('sortByAria')}
          className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-2 text-xs text-[var(--fg)]"
        >
          <option value="__entity__">{t('sortByEntity', { entity: field.collection?.entityIdLabel ?? t('idColumnDefault') })}</option>
          {schema.map((prop) => (
            <option key={prop.id} value={prop.id}>{t('sortByProperty', { property: prop.display?.displayName ?? prop.title })}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          aria-label={t('sortDirectionAria', { direction: sortDir === 'asc' ? t('ascending') : t('descending') })}
          className="rounded-lg border border-[var(--border)] p-2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sortDir === 'asc' ? '' : 'rotate-180'}`} />
        </button>
        {!disabled && (
          <Button size="sm" variant="secondary" onClick={() => setShowImportPanel((s) => !s)}>
            {t('bulkImport')}
          </Button>
        )}
      </div>

      {/* ── Import panel (P9.5.6 Phase G) — pastes back the exact JSON shape
          the Export action produces; see docs/BACKEND_API_CONTRACT.md for
          the documented (not-yet-implemented) CSV/XLIFF/PO/YAML formats. ── */}
      {showImportPanel && !disabled && (
        <div className="space-y-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)] p-3">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={t('importPlaceholder')}
            rows={6}
            aria-label={t('importTextareaAria')}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-2 font-mono text-xs text-[var(--fg)]"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={applyImport}>{t('importApply')}</Button>
            <Button size="sm" variant="secondary" onClick={() => { setShowImportPanel(false); setImportText('') }}>{t('importCancel')}</Button>
          </div>
        </div>
      )}

      {/* ── Bulk action toolbar (Phase D) ── */}
      {!disabled && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)] p-2">
          {BULK_ACTIONS.map((action) => (
            <Button key={action.kind} size="sm" variant="secondary" onClick={() => runBulk(action.kind)}>
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {lastResult?.message && lastResult.action !== 'export' && (
        <p className="text-xs text-[var(--fg-muted)]">{lastResult.message}</p>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--bg)] text-xs text-[var(--fg-muted)]">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === sortedEntries.length}
                  onChange={toggleSelectAll}
                  aria-label={t('selectAllAria')}
                />
              </th>
              <th className="px-3 py-2">{field.collection?.entityIdLabel ?? t('idColumnDefault')}</th>
              {enabledProperty && <th className="px-3 py-2">{t('enabledColumn')}</th>}
              {statusProperty && <th className="px-3 py-2">{t('statusColumn')}</th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <FragmentGroup key={group.key ?? '__all__'} groupKey={group.key}>
                {group.entries.map((entry) => (
                  <tr
                    key={entry.entityId}
                    className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--card-hover)]"
                    onClick={() => setOpenEntityId(entry.entityId)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.entityId)}
                        onChange={() => toggleSelected(entry.entityId)}
                        aria-label={t('selectEntityAria', { entity: configCollection.getEntityLabel(field, entry.entityId) })}
                      />
                    </td>
                    <td className="px-3 py-2 text-[var(--fg)]">
                      {configCollection.getEntityLabel(field, entry.entityId)}
                      <span className="ms-1.5 font-mono text-xs text-[var(--fg-muted)]">{entry.entityId}</span>
                    </td>
                    {enabledProperty && (
                      <td className="px-3 py-2">
                        <Badge variant={entry.values.enabled ? 'success' : 'outline'}>{entry.values.enabled ? t('enabledBadge') : t('disabledBadge')}</Badge>
                      </td>
                    )}
                    {statusProperty && (
                      <td className="px-3 py-2 capitalize text-[var(--fg-muted)]">{String(entry.values.status ?? '')}</td>
                    )}
                  </tr>
                ))}
              </FragmentGroup>
            ))}
            {sortedEntries.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon={<Search className="h-6 w-6" />}
                    title={t('noMatchesTitle')}
                    description={search || activeFilter ? t('noMatchesFilterDesc') : t('noEntriesDesc')}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openEntry && (
        <ConfigurationEntityDrawer
          field={field}
          entry={openEntry}
          canEdit={!disabled}
          onClose={() => setOpenEntityId(null)}
          onChangeEntity={(patch) => onChange(configCollection.buildMergedCollectionValue(value, openEntry.entityId, patch))}
        />
      )}
    </div>
  )
}

function FragmentGroup({ groupKey, children }: { groupKey?: string; children: React.ReactNode }) {
  if (groupKey === undefined) return <>{children}</>
  return (
    <>
      <tr>
        <td colSpan={4} className="border-t border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          {groupKey}
        </td>
      </tr>
      {children}
    </>
  )
}
