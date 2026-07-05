'use client'

/**
 * ConfigurationInspector — P9.3 Phase E (Framework Improvement)
 *
 * The Studio's right-side panel — completely generic, driven only by a
 * `fieldId` resolved through `configurationService`/`configurationAudit`/
 * `configurationValidator`. It has never heard of Authentication or
 * Countries; any field from any module (including a `'collection'`
 * property, which is itself a `ConfigFieldDefinition`) renders through the
 * same 9 tabs. Reuses `ConfigurationFieldPreview`, `ConfigurationFieldBadges`,
 * `ConfigurationInheritanceTree`, `ConfigurationHistoryTimeline`, and
 * `ConfigurationCompareView` rather than re-implementing any of them.
 */
import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { configurationAudit, configurationService, configurationValidator } from '@/config'
import type { ConfigActor } from '@/config'
import { useConfigScope } from '@/hooks/use-platform-configuration'
import { usePermissions } from '@/hooks'
import { ConfigurationFieldBadges } from './ConfigurationFieldBadges'
import { ConfigurationFieldPreview } from './ConfigurationFieldPreview'
import { ConfigurationInheritanceTree } from './ConfigurationInheritanceTree'
import { ConfigurationHistoryTimeline } from './ConfigurationHistoryTimeline'
import { deriveFieldState, evaluateCondition } from './configUiHelpers'

type InspectorTab = 'overview' | 'inheritance' | 'dependencies' | 'validation' | 'audit' | 'history' | 'preview' | 'statistics' | 'documentation'

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'inheritance', label: 'Inheritance' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'validation', label: 'Validation' },
  { id: 'audit', label: 'Audit' },
  { id: 'history', label: 'History' },
  { id: 'preview', label: 'Preview' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'documentation', label: 'Documentation' },
]

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export interface ConfigurationInspectorProps {
  fieldId: string | null
  actor: ConfigActor
}

export function ConfigurationInspector({ fieldId, actor }: ConfigurationInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>('overview')
  const scope = useConfigScope()
  const permissions = usePermissions()

  const field = fieldId ? configurationService.getField(fieldId) : undefined

  const ownerModule = useMemo(
    () => (fieldId ? configurationService.getModules().find((m) => m.sections.some((s) => s.fields.some((f) => f.id === fieldId))) : undefined),
    [fieldId],
  )
  const moduleValues = useMemo(
    () => (ownerModule ? configurationService.resolveModule(ownerModule.id, scope) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownerModule, scope.tenantId, scope.branchId, scope.userId],
  )

  if (!field || !fieldId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<Info className="h-6 w-6" />}
          title="No field selected"
          description="Click a setting's inspector icon to see its inheritance, dependencies, audit history, and more here."
        />
      </div>
    )
  }

  const resolved = configurationService.resolveField(fieldId, scope)
  const validation = configurationValidator.validate(field, resolved.value)
  const auditEntries = configurationAudit.listForField(fieldId)
  const canEdit = configurationService.canEdit(field, permissions)
  const state = deriveFieldState(field, resolved)
  const title = field.display?.displayName ?? field.title

  return (
    <div className="flex h-full flex-col" data-inspector-field-id={fieldId}>
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--fg)]">{title}</h2>
          <ConfigurationFieldBadges field={field} state={state} isDirty={false} />
        </div>
        {field.description && <p className="mt-1 text-xs text-[var(--fg-muted)]">{field.description}</p>}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === t.id ? 'bg-orange-500 text-white' : 'text-[var(--fg-muted)] hover:bg-[var(--card-hover)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {tab === 'overview' && (
          <div className="space-y-2">
            <Row label="Configuration Path" value={field.id} mono />
            <Row label="Type" value={field.type} />
            <Row label="Category" value={field.category} />
            <Row label="Owning Level" value={field.inheritance.level} />
            <Row label="Resolved From" value={resolved.resolvedFrom} />
            <Row label="Current Value" value={JSON.stringify(resolved.value)} mono />
            <Row label="Default Value" value={JSON.stringify(field.default)} mono />
          </div>
        )}

        {tab === 'inheritance' && <ConfigurationInheritanceTree field={field} scope={scope} />}

        {tab === 'dependencies' && (
          <div className="space-y-2">
            {!field.dependency?.hiddenWhen && !field.dependency?.enabledWhen ? (
              <p className="text-[var(--fg-muted)]">This field declares no dependency conditions.</p>
            ) : (
              <>
                {field.dependency?.hiddenWhen && (
                  <div className="rounded-lg border border-[var(--border)] p-2 text-xs">
                    <p className="font-medium text-[var(--fg)]">Hidden When</p>
                    <p className="text-[var(--fg-muted)]">
                      {field.dependency.hiddenWhen.fieldId} — currently {evaluateCondition(field.dependency.hiddenWhen, moduleValues) ? 'holds (hidden)' : 'does not hold (visible)'}
                    </p>
                  </div>
                )}
                {field.dependency?.enabledWhen && (
                  <div className="rounded-lg border border-[var(--border)] p-2 text-xs">
                    <p className="font-medium text-[var(--fg)]">Enabled When</p>
                    <p className="text-[var(--fg-muted)]">
                      {field.dependency.enabledWhen.fieldId} — currently {evaluateCondition(field.dependency.enabledWhen, moduleValues) ? 'holds (enabled)' : 'does not hold (disabled)'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'validation' && (
          <div className="space-y-2">
            <Row label="Valid" value={validation.valid ? 'Yes' : 'No'} />
            {validation.errors.length > 0 && (
              <ul className="list-inside list-disc text-red-500">
                {validation.errors.map((e, i) => <li key={i}>{e.message}</li>)}
              </ul>
            )}
            {field.validation?.min !== undefined && <Row label="Min" value={String(field.validation.min)} />}
            {field.validation?.max !== undefined && <Row label="Max" value={String(field.validation.max)} />}
            {field.validation?.pattern && <Row label="Pattern" value={field.validation.pattern} mono />}
          </div>
        )}

        {tab === 'audit' && (
          auditEntries.length === 0 ? (
            <EmptyState title="No audit entries" description="No changes have been recorded for this field yet." />
          ) : (
            <ul className="space-y-1.5 text-xs">
              {auditEntries.slice(0, 5).map((e) => (
                <li key={e.id} className="text-[var(--fg)]">
                  <span className="font-medium">{e.actorName}</span> — {formatTimestamp(e.timestamp)}
                  {e.reason && <span className="text-[var(--fg-muted)]"> — “{e.reason}”</span>}
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'history' && <ConfigurationHistoryTimeline fieldId={fieldId} actor={actor} canEdit={canEdit} />}

        {tab === 'preview' && (
          field.preview.kind === 'none'
            ? <p className="text-[var(--fg-muted)]">No preview is configured for this field.</p>
            : <ConfigurationFieldPreview field={field} value={resolved.value} />
        )}

        {tab === 'statistics' && (
          <div className="space-y-2">
            <Row label="Audit entries" value={String(auditEntries.length)} />
            <Row label="Lifecycle" value={field.lifecycle} />
            <Row label="Version" value={field.version} />
            <Row label="Sensitive" value={field.audit.sensitive ? 'Yes' : 'No'} />
          </div>
        )}

        {tab === 'documentation' && (
          <div className="space-y-2">
            {field.helpText && <p className="text-[var(--fg-muted)]">{field.helpText}</p>}
            {field.display?.documentationLink ? (
              <a href={field.display.documentationLink} target="_blank" rel="noreferrer" className="text-orange-500 underline">
                Open documentation
              </a>
            ) : (
              <p className="text-[var(--fg-muted)]">No documentation link is set for this field.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className={`text-right text-[var(--fg)] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
