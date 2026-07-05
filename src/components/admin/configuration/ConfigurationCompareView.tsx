'use client'

/**
 * ConfigurationCompareView — P9.3 Phase L (Framework Improvement)
 *
 * Side-by-side comparison of any two "snapshots" of one field's value:
 * the current effective value, an in-progress draft, each inheritance
 * level's raw layer, and every prior audit entry. Entirely generic — the
 * snapshot list is built from `configurationService.getFieldLayers` +
 * `configurationAudit.listForField`, the same primitives the Inheritance
 * tree and History timeline already use, so a future module gets Compare
 * mode for free the moment it registers a field.
 */
import { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { CONFIG_INHERITANCE_CHAIN, configurationAudit, configurationService } from '@/config'
import type { ConfigFieldDefinition, ConfigResolutionScope } from '@/config'

interface CompareSnapshot {
  id: string
  label: string
  value: unknown
}

const LEVEL_LABEL: Record<string, string> = { platform: 'Platform', tenant: 'Tenant', branch: 'Branch', user: 'User' }

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function buildSnapshots(field: ConfigFieldDefinition, scope: ConfigResolutionScope, draftValue?: unknown): CompareSnapshot[] {
  const snapshots: CompareSnapshot[] = []
  const resolved = configurationService.resolveField(field.id, scope)
  snapshots.push({ id: 'current', label: 'Current (Effective)', value: resolved.value })
  if (draftValue !== undefined) snapshots.push({ id: 'draft', label: 'Draft (Unsaved)', value: draftValue })

  const layers = configurationService.getFieldLayers(field.id, scope)
  for (const level of CONFIG_INHERITANCE_CHAIN) {
    if (layers[level] !== undefined) snapshots.push({ id: `layer-${level}`, label: `${LEVEL_LABEL[level]} Override`, value: layers[level] })
  }
  snapshots.push({ id: 'default', label: 'Schema Default', value: field.default })

  for (const entry of configurationAudit.listForField(field.id)) {
    snapshots.push({ id: `audit-${entry.id}`, label: `${formatTimestamp(entry.timestamp)} — ${entry.actorName}`, value: entry.newValue })
  }
  return snapshots
}

export function ConfigurationCompareView({ field, scope, draftValue }: { field: ConfigFieldDefinition; scope: ConfigResolutionScope; draftValue?: unknown }) {
  const snapshots = useMemo(() => buildSnapshots(field, scope, draftValue), [field, scope, draftValue])
  const [leftId, setLeftId] = useState(snapshots[0]?.id)
  const [rightId, setRightId] = useState(snapshots[1]?.id ?? snapshots[0]?.id)

  const left = snapshots.find((s) => s.id === leftId) ?? snapshots[0]
  const right = snapshots.find((s) => s.id === rightId) ?? snapshots[0]
  const differ = JSON.stringify(left?.value) !== JSON.stringify(right?.value)

  if (snapshots.length < 2) {
    return <p className="text-sm text-[var(--fg-muted)]">Not enough history yet to compare — this field only has its current value.</p>
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <select
          value={leftId}
          onChange={(e) => setLeftId(e.target.value)}
          aria-label="Compare left snapshot"
          className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-[var(--fg)]"
        >
          {snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <ArrowLeftRight className="mx-auto hidden h-4 w-4 text-[var(--fg-muted)] sm:block" aria-hidden="true" />
        <select
          value={rightId}
          onChange={(e) => setRightId(e.target.value)}
          aria-label="Compare right snapshot"
          className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-[var(--fg)]"
        >
          {snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${differ ? '' : ''}`}>
        {[left, right].map((snapshot, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 ${differ ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-[var(--border)] bg-[var(--card)]'}`}
          >
            <p className="mb-1 text-xs font-medium text-[var(--fg-muted)]">{snapshot?.label}</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--fg)]">
              {JSON.stringify(snapshot?.value, null, 2)}
            </pre>
          </div>
        ))}
      </div>
      {differ ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">These two snapshots differ.</p>
      ) : (
        <p className="text-xs text-[var(--fg-muted)]">These two snapshots are identical.</p>
      )}
    </div>
  )
}
