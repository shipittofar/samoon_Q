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
import { useTranslations } from 'next-intl'
import { History, RotateCcw } from 'lucide-react'
import { configurationValidator, resolveConfigText } from '@/config'
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
  /** P9.3 Phase E — additionally notifies the Studio shell's Inspector panel which field is selected. Purely additive; the inline inspector toggle below is unchanged. */
  onInspect?: (fieldId: string) => void
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ConfigurationFieldRow({
  field, resolved, currentValue, isDirty, canEdit, enabled, onChange, onReset, auditEntries, onInspect,
}: ConfigurationFieldRowProps) {
  const t = useTranslations('console')
  const tFields = useTranslations('configFields')
  const [showInspector, setShowInspector] = useState(false)
  const state = deriveFieldState(field, resolved)
  const validation = configurationValidator.validate(field, currentValue)
  const isArchived = field.lifecycle === 'archived'
  const editable = canEdit && enabled && !isArchived

  const title = field.display?.displayName ?? resolveConfigText(tFields, field.id, 'title', field.title)
  const description = resolveConfigText(tFields, field.id, 'description', field.description)
  const lastEntry = auditEntries[0]

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"data-field-id={field.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={field.id} className="text-sm font-semibold text-[var(--fg)]">{title}</label>
            <ConfigurationFieldBadges field={field} state={state} isDirty={isDirty} />
          </div>
          {description && (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{description}</p>
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
            onClick={() => { setShowInspector((v) => !v); onInspect?.(field.id) }}
            aria-expanded={showInspector}
            aria-label={t('auditHistoryAndDetailsAria')}
            className="rounded-lg p-1.5 text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
            title={t('auditHistoryAndDetailsAria')}
          >
            <History className="h-3.5 w-3.5"/>
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={onReset}
              aria-label={t('resetFieldToSavedValueAria', { field: title })}
              className="rounded-lg p-1.5 text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
              title={t('resetToSavedValueTitle')}
            >
              <RotateCcw className="h-3.5 w-3.5"/>
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
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('disabledDependencyNotMet')}</p>
        )}
        {!canEdit && enabled && (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('noPermissionToEditField')}</p>
        )}
        {isArchived && (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('archivedReadOnlyExplanation')}</p>
        )}
        {(field.validation?.min !== undefined || field.validation?.max !== undefined) && (
          <p className="mt-1 text-[11px] text-[var(--fg-muted)] opacity-70">
            {field.validation?.min !== undefined && t('minValueLabel', { min: field.validation.min })}
            {field.validation?.min !== undefined && field.validation?.max !== undefined && ' · '}
            {field.validation?.max !== undefined && t('maxValueLabel', { max: field.validation.max })}
          </p>
        )}
        {field.validation?.warningMessage && (
          <p className="mt-1 text-xs text-[var(--warning-text)]">{field.validation.warningMessage}</p>
        )}
        {!validation.valid && (
          <p className="mt-1 text-xs text-[var(--danger-text)]"role="alert">
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
            <p className="text-[var(--fg-muted)]">{t('configurationPath')}</p>
            <p className="font-mono text-[var(--fg)]">{field.id}</p>
          </div>
          <div>
            <p className="text-[var(--fg-muted)]">{t('defaultLabel')}</p>
            <p className="font-mono text-[var(--fg)]">{JSON.stringify(field.default)}</p>
          </div>
          <div>
            <p className="text-[var(--fg-muted)]">{t('currentLabel')}</p>
            <p className="font-mono text-[var(--fg)]">{JSON.stringify(resolved.value)}</p>
          </div>
          <div>
            <p className="text-[var(--fg-muted)]">{t('resolvedFrom')}</p>
            <p className="font-mono capitalize text-[var(--fg)]">{resolved.resolvedFrom}</p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="mb-1 text-[var(--fg-muted)]">{t('auditHistoryLabel')}</p>
            {auditEntries.length === 0 ? (
              <p className="text-[var(--fg-muted)] opacity-70">{t('noChangesRecordedYet')}</p>
            ) : (
              <ul className="space-y-1">
                {auditEntries.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="text-[var(--fg)]">
                    <span className="font-medium">{entry.actorName}</span> {t('changedThisTo')}{' '}
                    <span className="font-mono">{JSON.stringify(entry.newValue)}</span> {t('onDateLabel', { date: formatTimestamp(entry.timestamp) })}
                    {entry.reason && <span className="text-[var(--fg-muted)]"> — &ldquo;{entry.reason}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            )}
            {lastEntry && (
              <p className="mt-1 text-[var(--fg-muted)] opacity-70">
                {t('lastModifiedByOn', { actor: lastEntry.actorName, date: formatTimestamp(lastEntry.timestamp) })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
