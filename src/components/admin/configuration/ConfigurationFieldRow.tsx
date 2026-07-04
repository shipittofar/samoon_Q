'use client'

/**
 * ConfigurationFieldRow — P9.1.3
 *
 * Renders exactly one field: label, description/help, control, badges,
 * preview, live validation, and the audit/inspector panel (Phase K). This
 * is the unit every module's Console page repeats once per field — nothing
 * in this file references "authentication" or any other module by name.
 */
import { useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { configurationValidator } from '@/config'
import type { ConfigAuditEntry, ConfigFieldDefinition, ResolvedConfigValue } from '@/config'
import { ConfigurationFieldControl } from './ConfigurationFieldControl'
import { ConfigurationFieldBadges } from './ConfigurationFieldBadges'
import { ConfigurationFieldPreview } from './ConfigurationFieldPreview'
import { ConfigurationCollectionTable } from './ConfigurationCollectionTable'
import { deriveFieldState } from './configUiHelpers'

export interface ConfigurationFieldRowProps {
  field: ConfigFieldDefinition
  resolved: ResolvedConfigValue
  currentValue: unknown
  isDirty: boolean
  canEdit: boolean
  enabled: boolean
  onChange: (value: unknown) => void
  onReset: () => void
  auditEntries: ConfigAuditEntry[]
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ConfigurationFieldRow({
  field, resolved, currentValue, isDirty, canEdit, enabled, onChange, onReset, auditEntries,
}: ConfigurationFieldRowProps) {
  const [showInspector, setShowInspector] = useState(false)
  const state = deriveFieldState(field, resolved)
  const validation = configurationValidator.validate(field, currentValue)
  const isArchived = field.lifecycle === 'archived'
  const editable = canEdit && enabled && !isArchived

  const title = field.display?.displayName ?? field.title
  const lastEntry = auditEntries[0]

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" data-field-id={field.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={field.id} className="text-sm font-semibold text-[var(--fg)]">{title}</label>
            <ConfigurationFieldBadges field={field} state={state} isDirty={isDirty} />
          </div>
          {field.description && (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{field.description}</p>
          )}
          {field.helpText && (
            <p className="mt-1 text-xs text-[var(--fg-muted)] opacity-80">{field.helpText}</p>
          )}
          {field.display?.defaultExplanation && (
            <p className="mt-1 text-[11px] italic text-[var(--fg-muted)] opacity-70">{field.display.defaultExplanation}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowInspector((v) => !v)}
            aria-expanded={showInspector}
            aria-label="Audit history and details"
            className="rounded-lg p-1.5 text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
            title="Audit history and details"
          >
            <History className="h-3.5 w-3.5" />
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={onReset}
              aria-label={`Reset ${title} to its saved value`}
              className="rounded-lg p-1.5 text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
              title="Reset to saved value"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={field.type === 'collection' ? 'mt-3' : 'mt-3 max-w-md'}>
        <div id={field.id}>
          {field.type === 'collection' ? (
            <ConfigurationCollectionTable field={field} value={currentValue} onChange={onChange} disabled={!editable} />
          ) : (
            <ConfigurationFieldControl field={field} value={currentValue} onChange={onChange} disabled={!editable} />
          )}
        </div>
        {!enabled && (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">Disabled because a dependency isn&apos;t met.</p>
        )}
        {!canEdit && enabled && (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">You don&apos;t have permission to edit this field.</p>
        )}
        {isArchived && (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">Archived — read only; resolves to its default regardless of any stored override.</p>
        )}
        {(field.validation?.min !== undefined || field.validation?.max !== undefined) && (
          <p className="mt-1 text-[11px] text-[var(--fg-muted)] opacity-70">
            {field.validation?.min !== undefined && `Min ${field.validation.min}`}
            {field.validation?.min !== undefined && field.validation?.max !== undefined && ' · '}
            {field.validation?.max !== undefined && `Max ${field.validation.max}`}
          </p>
        )}
        {field.validation?.warningMessage && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{field.validation.warningMessage}</p>
        )}
        {!validation.valid && (
          <p className="mt-1 text-xs text-red-500" role="alert">
            {field.validation?.errorMessage ?? validation.errors[0]?.message}
          </p>
        )}
      </div>

      {field.preview.kind !== 'none' && (
        <div className="mt-3">
          <ConfigurationFieldPreview field={field} value={currentValue} />
        </div>
      )}

      {showInspector && (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)] p-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-[var(--fg-muted)]">Configuration Path</p>
            <p className="font-mono text-[var(--fg)]">{field.id}</p>
          </div>
          <div>
            <p className="text-[var(--fg-muted)]">Default Value</p>
            <p className="font-mono text-[var(--fg)]">{JSON.stringify(field.default)}</p>
          </div>
          <div>
            <p className="text-[var(--fg-muted)]">Current Value</p>
            <p className="font-mono text-[var(--fg)]">{JSON.stringify(resolved.value)}</p>
          </div>
          <div>
            <p className="text-[var(--fg-muted)]">Resolved From</p>
            <p className="font-mono capitalize text-[var(--fg)]">{resolved.resolvedFrom}</p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="mb-1 text-[var(--fg-muted)]">Audit History</p>
            {auditEntries.length === 0 ? (
              <p className="text-[var(--fg-muted)] opacity-70">No changes recorded yet.</p>
            ) : (
              <ul className="space-y-1">
                {auditEntries.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="text-[var(--fg)]">
                    <span className="font-medium">{entry.actorName}</span> changed this to{' '}
                    <span className="font-mono">{JSON.stringify(entry.newValue)}</span> on {formatTimestamp(entry.timestamp)}
                    {entry.reason && <span className="text-[var(--fg-muted)]"> — &ldquo;{entry.reason}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            )}
            {lastEntry && (
              <p className="mt-1 text-[var(--fg-muted)] opacity-70">
                Last modified by {lastEntry.actorName} on {formatTimestamp(lastEntry.timestamp)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
