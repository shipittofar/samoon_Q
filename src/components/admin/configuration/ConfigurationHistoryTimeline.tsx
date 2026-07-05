'use client'

/**
 * ConfigurationHistoryTimeline — P9.3 Phase K (Framework Improvement)
 *
 * Full audit timeline for one field — who/when/old/new, filter/search, and
 * a rollback action — reused by the Inspector's History tab and the
 * toolbar's History drawer alike. Generic: it reads `configurationAudit.
 * listForField(fieldId)` and writes back through the one sanctioned
 * `configurationService.updateField()` path, exactly like every other
 * write in the Studio (no second persistence mechanism for rollback).
 */
import { useMemo, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { configurationAudit, configurationService } from '@/config'
import type { ConfigActor, ConfigAuditEntry } from '@/config'

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/**
 * Writes an audit entry's `previousValue` back through
 * `configurationService.updateField()` — the one rollback implementation
 * shared by this timeline and the Studio toolbar's module-wide history
 * drawer, so "roll back a change" is defined exactly once (Rule 3).
 */
export function rollbackAuditEntry(entry: ConfigAuditEntry, actor: ConfigActor): void {
  configurationService.updateField({
    fieldId: entry.fieldId,
    value: entry.previousValue,
    level: entry.level,
    scope: entry.scope,
    actor,
    reason: `Rollback to the value before ${formatTimestamp(entry.timestamp)}`,
  })
}

export interface ConfigurationHistoryTimelineProps {
  fieldId: string
  actor: ConfigActor
  canEdit: boolean
  onRolledBack?: (entry: ConfigAuditEntry) => void
}

export function ConfigurationHistoryTimeline({ fieldId, actor, canEdit, onRolledBack }: ConfigurationHistoryTimelineProps) {
  const [query, setQuery] = useState('')
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)
  const allEntries = configurationAudit.listForField(fieldId)

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allEntries
    return allEntries.filter((e) =>
      e.actorName.toLowerCase().includes(q) ||
      (e.reason ?? '').toLowerCase().includes(q) ||
      e.level.toLowerCase().includes(q),
    )
  }, [allEntries, query])

  function rollback(entry: ConfigAuditEntry) {
    setRollingBackId(entry.id)
    try {
      rollbackAuditEntry(entry, actor)
      onRolledBack?.(entry)
    } finally {
      setRollingBackId(null)
    }
  }

  if (allEntries.length === 0) {
    return (
      <EmptyState
        icon={<RotateCcw className="h-6 w-6" />}
        title="No history yet"
        description="Changes to this field will appear here as soon as they're saved."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fg-muted)]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by actor, level, or reason…"
          aria-label="Filter history"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No matching history" description={`Nothing matches "${query}".`} />
      ) : (
        <ol className="space-y-2 border-l border-[var(--border)] pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="relative text-xs">
              <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[var(--fg)]">
                    <span className="font-medium">{entry.actorName}</span> changed this at <span className="capitalize">{entry.level}</span> level
                  </p>
                  <p className="mt-0.5 font-mono text-[var(--fg-muted)]">
                    {JSON.stringify(entry.previousValue)} → {JSON.stringify(entry.newValue)}
                  </p>
                  {entry.reason && <p className="mt-0.5 italic text-[var(--fg-muted)]">“{entry.reason}”</p>}
                  <p className="mt-0.5 text-[10px] text-[var(--fg-muted)] opacity-70">{formatTimestamp(entry.timestamp)}</p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rollback(entry)}
                    disabled={rollingBackId === entry.id}
                    aria-label={`Roll back to the value from ${formatTimestamp(entry.timestamp)}`}
                    className="shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
