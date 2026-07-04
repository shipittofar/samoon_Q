'use client'

/**
 * ConfigurationEntityDrawer — P9.2 Phase H (Framework Improvement)
 *
 * Generic detail panel for one entity inside a `type: 'collection'` field —
 * Configuration / Overrides / Dependencies / Audit / Statistics /
 * Inheritance / Preview tabs, all derived from `field.collection.schema`
 * and the shared field-render components already built in P9.1.3
 * (`ConfigurationFieldControl`/`Badges`/`Preview`). Nothing here is
 * Countries-specific; a future Branches/Tenants collection reuses this
 * exact component, per P9.2 Phase K/H.
 */
import { useState } from 'react'
import { Drawer } from '@/components/ui/Modal'
import { Badge } from '@/components/ui'
import { configCollection, configurationAudit } from '@/config'
import type { ConfigCollectionEntry, ConfigFieldDefinition, ResolvedConfigValue } from '@/config'
import { ConfigurationFieldControl } from './ConfigurationFieldControl'
import { ConfigurationFieldBadges } from './ConfigurationFieldBadges'
import { ConfigurationFieldPreview } from './ConfigurationFieldPreview'
import { evaluateCondition } from './configUiHelpers'

export interface ConfigurationEntityDrawerProps {
  field: ConfigFieldDefinition
  entry: ConfigCollectionEntry
  canEdit: boolean
  onClose: () => void
  onChangeEntity: (patch: Record<string, unknown>) => void
}

type DrawerTab = 'configuration' | 'overrides' | 'dependencies' | 'audit' | 'statistics' | 'inheritance' | 'preview'

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'configuration', label: 'Configuration' },
  { id: 'overrides', label: 'Overrides' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'audit', label: 'Audit' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'inheritance', label: 'Inheritance' },
  { id: 'preview', label: 'Preview' },
]

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ConfigurationEntityDrawer({ field, entry, canEdit, onClose, onChangeEntity }: ConfigurationEntityDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('configuration')
  const schema = configCollection.getSchema(field)
  const defaults = configCollection.getEntityDefaults(field)
  const label = configCollection.getEntityLabel(field, entry.entityId)

  // Every schema property's condition (if any) references another property
  // id *within this same entity* — the collection analogue of the module-
  // level dependency engine, reusing the identical evaluateCondition logic
  // against a resolved-value shape built from this one entity's values.
  const resolvedForConditions: Record<string, ResolvedConfigValue> = Object.fromEntries(
    Object.entries(entry.values).map(([id, v]) => [id, { fieldId: id, value: v, resolvedFrom: 'platform' as const, overrideBlocked: false }]),
  )
  const isVisible = (prop: ConfigFieldDefinition) => {
    const hiddenWhen = prop.dependency?.hiddenWhen
    return !(hiddenWhen && evaluateCondition(hiddenWhen, resolvedForConditions))
  }
  const isEnabled = (prop: ConfigFieldDefinition) => {
    const enabledWhen = prop.dependency?.enabledWhen
    return !enabledWhen || evaluateCondition(enabledWhen, resolvedForConditions)
  }

  const overriddenProps = schema.filter((prop) => JSON.stringify(entry.values[prop.id]) !== JSON.stringify(defaults[prop.id]))

  const auditEntries = configurationAudit.listForField(field.id)
    .filter((e) => {
      const oldSlice = (e.previousValue as Record<string, unknown> | undefined)?.[entry.entityId]
      const newSlice = (e.newValue as Record<string, unknown> | undefined)?.[entry.entityId]
      return JSON.stringify(oldSlice) !== JSON.stringify(newSlice)
    })

  const previewPairs = field.collection?.buildPreview?.(entry.values) ?? {}

  return (
    <Drawer open onClose={onClose} title={label} size="lg">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{field.collection?.entityIdLabel ?? 'ID'}: {entry.entityId}</Badge>
          {overriddenProps.length > 0 && <Badge variant="info">{overriddenProps.length} overridden</Badge>}
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-orange-500 text-white' : 'text-[var(--fg-muted)] hover:bg-[var(--card-hover)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'configuration' && (
          <div className="space-y-4">
            {schema.filter(isVisible).map((prop) => (
              <div key={prop.id}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <label htmlFor={`${field.id}.${entry.entityId}.${prop.id}`} className="text-sm font-medium text-[var(--fg)]">
                    {prop.display?.displayName ?? prop.title}
                  </label>
                  <ConfigurationFieldBadges
                    field={prop}
                    state={JSON.stringify(entry.values[prop.id]) === JSON.stringify(defaults[prop.id]) ? 'default' : 'modified'}
                    isDirty={false}
                  />
                </div>
                {prop.description && <p className="mb-1 text-xs text-[var(--fg-muted)]">{prop.description}</p>}
                <div id={`${field.id}.${entry.entityId}.${prop.id}`}>
                  <ConfigurationFieldControl
                    field={prop}
                    value={entry.values[prop.id]}
                    onChange={(v) => onChangeEntity({ [prop.id]: v })}
                    disabled={!canEdit || !isEnabled(prop)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'overrides' && (
          <div className="space-y-2 text-sm">
            {overriddenProps.length === 0 ? (
              <p className="text-[var(--fg-muted)]">No properties differ from the schema defaults.</p>
            ) : (
              overriddenProps.map((prop) => (
                <div key={prop.id} className="rounded-lg border border-[var(--border)] p-2">
                  <p className="font-medium text-[var(--fg)]">{prop.display?.displayName ?? prop.title}</p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    Default: <span className="font-mono">{JSON.stringify(defaults[prop.id])}</span>
                    {' → '}
                    Current: <span className="font-mono">{JSON.stringify(entry.values[prop.id])}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'dependencies' && (
          <div className="space-y-2 text-sm">
            {schema.filter((p) => p.dependency?.hiddenWhen || p.dependency?.enabledWhen).length === 0 ? (
              <p className="text-[var(--fg-muted)]">No property in this schema declares a dependency.</p>
            ) : (
              schema
                .filter((p) => p.dependency?.hiddenWhen || p.dependency?.enabledWhen)
                .map((prop) => (
                  <div key={prop.id} className="rounded-lg border border-[var(--border)] p-2 text-xs">
                    <p className="font-medium text-[var(--fg)]">{prop.display?.displayName ?? prop.title}</p>
                    {prop.dependency?.hiddenWhen && (
                      <p className="text-[var(--fg-muted)]">Hidden unless {prop.dependency.hiddenWhen.fieldId} condition fails — currently {isVisible(prop) ? 'visible' : 'hidden'}.</p>
                    )}
                    {prop.dependency?.enabledWhen && (
                      <p className="text-[var(--fg-muted)]">Enabled when {prop.dependency.enabledWhen.fieldId} condition holds — currently {isEnabled(prop) ? 'enabled' : 'disabled'}.</p>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-2 text-sm">
            {auditEntries.length === 0 ? (
              <p className="text-[var(--fg-muted)]">No changes recorded for this entity yet.</p>
            ) : (
              <ul className="space-y-1">
                {auditEntries.slice(0, 10).map((e) => (
                  <li key={e.id} className="text-[var(--fg)]">
                    <span className="font-medium">{e.actorName}</span> updated this on {formatTimestamp(e.timestamp)}
                    {e.reason && <span className="text-[var(--fg-muted)]"> — “{e.reason}”</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'statistics' && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[var(--fg-muted)]">Total properties</p>
              <p className="font-semibold text-[var(--fg)]">{schema.length}</p>
            </div>
            <div>
              <p className="text-[var(--fg-muted)]">Overridden properties</p>
              <p className="font-semibold text-[var(--fg)]">{overriddenProps.length}</p>
            </div>
            <div>
              <p className="text-[var(--fg-muted)]">Recorded changes</p>
              <p className="font-semibold text-[var(--fg)]">{auditEntries.length}</p>
            </div>
          </div>
        )}

        {tab === 'inheritance' && (
          <div className="space-y-2 text-sm">
            <p className="text-[var(--fg-muted)]">
              Every entity in this collection is stored inside one field (<span className="font-mono">{field.id}</span>),
              so inheritance is resolved once for the whole collection, not per entity.
            </p>
            <p><span className="text-[var(--fg-muted)]">Owning level:</span> <span className="font-medium capitalize text-[var(--fg)]">{field.inheritance.level}</span></p>
            <p><span className="text-[var(--fg-muted)]">Mode:</span> <span className="font-medium capitalize text-[var(--fg)]">{field.inheritance.mode}</span></p>
          </div>
        )}

        {tab === 'preview' && (
          <div className="space-y-3">
            {Object.keys(previewPairs).length === 0 && schema.every((p) => p.preview.kind === 'none') && (
              <p className="text-sm text-[var(--fg-muted)]">No preview is available for this {field.collection?.entityLabel.toLowerCase() ?? 'entity'}.</p>
            )}
            {Object.entries(previewPairs).map(([label2, val]) => (
              <div key={label2} className="rounded-lg border border-[var(--border)] p-2 text-sm">
                <p className="text-xs text-[var(--fg-muted)]">{label2}</p>
                <p className="font-mono text-[var(--fg)]">{val}</p>
              </div>
            ))}
            {schema.filter((p) => p.preview.kind !== 'none').map((prop) => (
              <div key={prop.id}>
                <p className="mb-1 text-xs text-[var(--fg-muted)]">{prop.display?.displayName ?? prop.title}</p>
                <ConfigurationFieldPreview field={prop} value={entry.values[prop.id]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}
