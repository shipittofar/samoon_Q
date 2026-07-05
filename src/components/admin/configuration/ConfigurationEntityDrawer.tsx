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
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/Modal'
import { Badge } from '@/components/ui'
import { configCollection, configurationAudit, resolveConfigText } from '@/config'
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

const TAB_IDS: DrawerTab[] = ['configuration', 'overrides', 'dependencies', 'audit', 'statistics', 'inheritance', 'preview']

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ConfigurationEntityDrawer({ field, entry, canEdit, onClose, onChangeEntity }: ConfigurationEntityDrawerProps) {
  const t = useTranslations('console')
  const tFields = useTranslations('configFields')
  const propTitle = (prop: ConfigFieldDefinition) => prop.display?.displayName ?? resolveConfigText(tFields, prop.id, 'title', prop.title)
  const propDescription = (prop: ConfigFieldDefinition) => resolveConfigText(tFields, prop.id, 'description', prop.description)
  const [tab, setTab] = useState<DrawerTab>('configuration')
  const TABS: { id: DrawerTab; label: string }[] = TAB_IDS.map((id) => ({ id, label: t(`entityDrawerTab_${id}`) }))
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
          <Badge variant="secondary">{field.collection?.entityIdLabel ?? t('idColumnDefault')}: {entry.entityId}</Badge>
          {overriddenProps.length > 0 && <Badge variant="info">{t('overriddenCount', { count: overriddenProps.length })}</Badge>}
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
                    {propTitle(prop)}
                  </label>
                  <ConfigurationFieldBadges
                    field={prop}
                    state={JSON.stringify(entry.values[prop.id]) === JSON.stringify(defaults[prop.id]) ? 'default' : 'modified'}
                    isDirty={false}
                  />
                </div>
                {propDescription(prop) && <p className="mb-1 text-xs text-[var(--fg-muted)]">{propDescription(prop)}</p>}
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
              <p className="text-[var(--fg-muted)]">{t('noOverriddenProperties')}</p>
            ) : (
              overriddenProps.map((prop) => (
                <div key={prop.id} className="rounded-lg border border-[var(--border)] p-2">
                  <p className="font-medium text-[var(--fg)]">{propTitle(prop)}</p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {t('defaultLabel')}: <span className="font-mono">{JSON.stringify(defaults[prop.id])}</span>
                    {' → '}
                    {t('currentLabel')}: <span className="font-mono">{JSON.stringify(entry.values[prop.id])}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'dependencies' && (
          <div className="space-y-2 text-sm">
            {schema.filter((p) => p.dependency?.hiddenWhen || p.dependency?.enabledWhen).length === 0 ? (
              <p className="text-[var(--fg-muted)]">{t('noDependencies')}</p>
            ) : (
              schema
                .filter((p) => p.dependency?.hiddenWhen || p.dependency?.enabledWhen)
                .map((prop) => (
                  <div key={prop.id} className="rounded-lg border border-[var(--border)] p-2 text-xs">
                    <p className="font-medium text-[var(--fg)]">{propTitle(prop)}</p>
                    {prop.dependency?.hiddenWhen && (
                      <p className="text-[var(--fg-muted)]">
                        {t('hiddenUnless', { fieldId: prop.dependency.hiddenWhen.fieldId, state: isVisible(prop) ? t('visibleState') : t('hiddenState') })}
                      </p>
                    )}
                    {prop.dependency?.enabledWhen && (
                      <p className="text-[var(--fg-muted)]">
                        {t('enabledWhen', { fieldId: prop.dependency.enabledWhen.fieldId, state: isEnabled(prop) ? t('enabledState') : t('disabledState') })}
                      </p>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-2 text-sm">
            {auditEntries.length === 0 ? (
              <p className="text-[var(--fg-muted)]">{t('noAuditEntries')}</p>
            ) : (
              <ul className="space-y-1">
                {auditEntries.slice(0, 10).map((e) => (
                  <li key={e.id} className="text-[var(--fg)]">
                    <span className="font-medium">{e.actorName}</span> {t('updatedThisOn', { date: formatTimestamp(e.timestamp) })}
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
              <p className="text-[var(--fg-muted)]">{t('totalProperties')}</p>
              <p className="font-semibold text-[var(--fg)]">{schema.length}</p>
            </div>
            <div>
              <p className="text-[var(--fg-muted)]">{t('overriddenProperties')}</p>
              <p className="font-semibold text-[var(--fg)]">{overriddenProps.length}</p>
            </div>
            <div>
              <p className="text-[var(--fg-muted)]">{t('recordedChanges')}</p>
              <p className="font-semibold text-[var(--fg)]">{auditEntries.length}</p>
            </div>
          </div>
        )}

        {tab === 'inheritance' && (
          <div className="space-y-2 text-sm">
            <p className="text-[var(--fg-muted)]">
              {t('inheritanceExplainer', { fieldId: field.id })}
            </p>
            <p><span className="text-[var(--fg-muted)]">{t('owningLevel')}:</span> <span className="font-medium capitalize text-[var(--fg)]">{field.inheritance.level}</span></p>
            <p><span className="text-[var(--fg-muted)]">{t('modeLabel')}:</span> <span className="font-medium capitalize text-[var(--fg)]">{field.inheritance.mode}</span></p>
          </div>
        )}

        {tab === 'preview' && (
          <div className="space-y-3">
            {/* P9.5.6 Phase C/D — Device Preview. Generic: gated only on the
                entity's OWN schema having 'fontFamily'/'direction' property
                ids (any typography-bearing collection qualifies, not just
                Languages), never on which collection module this is. This
                is a simulated content preview (real font-family/direction
                values from this entity, representative sample copy) — a
                true live iframe of the six named pages would require
                plumbing an explicit locale override through middleware and
                request.ts, which this phase deliberately does not touch
                (see the Final Report's honest scope statement). */}
            {schema.some((p) => p.id === 'fontFamily') && schema.some((p) => p.id === 'direction') && (
              <DevicePreview values={entry.values} sampleText={previewPairs['Sample (RTL-aware)']} />
            )}
            {Object.keys(previewPairs).length === 0 && schema.every((p) => p.preview.kind === 'none') && (
              <p className="text-sm text-[var(--fg-muted)]">{t('noPreviewAvailable', { entity: field.collection?.entityLabel.toLowerCase() ?? t('defaultEntityLabelSingular') })}</p>
            )}
            {Object.entries(previewPairs).map(([label2, val]) => (
              <div key={label2} className="rounded-lg border border-[var(--border)] p-2 text-sm">
                <p className="text-xs text-[var(--fg-muted)]">{label2}</p>
                <p className="font-mono text-[var(--fg)]">{val}</p>
              </div>
            ))}
            {schema.filter((p) => p.preview.kind !== 'none').map((prop) => (
              <div key={prop.id}>
                <p className="mb-1 text-xs text-[var(--fg-muted)]">{propTitle(prop)}</p>
                <ConfigurationFieldPreview field={prop} value={entry.values[prop.id]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}

const DEVICE_FRAMES = [
  { id: 'desktop', label: 'Desktop', width: '100%' },
  { id: 'tablet', label: 'Tablet', width: '420px' },
  { id: 'mobile', label: 'Mobile', width: '260px' },
] as const

/**
 * Device Preview (P9.5.6 Phase C/D) — renders representative sample content
 * (heading/body/button) at the entity's own font-family, direction, and
 * font-scale, inside three fixed-width frames. Not a live iframe of a real
 * route — see the doc comment at its call site for why that's out of
 * scope for this phase.
 */
function DevicePreview({ values, sampleText }: { values: Record<string, unknown>; sampleText?: string }) {
  const t = useTranslations('console')
  const direction = values.direction === 'rtl' ? 'rtl' : 'ltr'
  const fontFamily = typeof values.fontFamily === 'string' ? values.fontFamily : undefined
  const headingFontFamily = typeof values.headingFontFamily === 'string' ? values.headingFontFamily : fontFamily
  const fontScale = typeof values.fontScale === 'number' ? values.fontScale : 1
  const body = sampleText || (direction === 'rtl' ? '← نص تجريبي' : 'Sample text →')

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--fg-muted)]">{t('devicePreviewTitle')}</p>
      <div className="flex flex-wrap gap-3">
        {DEVICE_FRAMES.map((frame) => (
          <div key={frame.id} style={{ width: frame.width, maxWidth: '100%' }} className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">{frame.label}</p>
            <div
              dir={direction}
              className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg,var(--bg))] p-3"
            >
              <p style={{ fontFamily: headingFontFamily, fontSize: `${1.1 * fontScale}rem` }} className="font-semibold text-[var(--fg)]">
                {t('devicePreviewHeading')}
              </p>
              <p style={{ fontFamily, fontSize: `${0.9 * fontScale}rem` }} className="text-[var(--fg-muted)]">
                {body}
              </p>
              <span style={{ fontFamily, fontSize: `${0.85 * fontScale}rem` }} className="inline-block rounded-md bg-orange-500 px-3 py-1.5 text-white">
                {t('devicePreviewButton')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
