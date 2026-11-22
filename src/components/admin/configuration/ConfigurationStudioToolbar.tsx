'use client'

/**
 * ConfigurationStudioToolbar — P9.3 Phase D (Framework Improvement)
 *
 * The Studio's persistent top bar — breadcrumb, environment/lifecycle
 * status, a live unsaved-changes indicator, and Save/Discard/Publish/
 * History/Compare/Export/Import/Refresh actions. Entirely generic: it
 * never owns save/discard logic itself (that stays in
 * `useConfigurationDraft`/` ConfigurationModulePage`, reached here only via
 * the `actions` prop the module page hands up through `onActionsReady`),
 * and every button works identically regardless of which module is active.
 *
 * "Publish" is deliberately an alias for the same save pipeline: this
 * system has no separate draft/staging storage for a module as a whole
 * (only per-field inheritance levels), so a literal draft->published
 * promotion isn't a real state to model yet — see
 * docs/P9.3_CONFIGURATION_STUDIO.md's Known Limitations section.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import { ChevronRight, Download, History, Loader2, Redo2, RefreshCw, RotateCcw, Save, Search, Upload } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { configurationAudit, configurationService, platformConfigurationRegistry } from '@/config'
import type { ConfigActor, ConfigModuleDefinition } from '@/config'
import { formatTimestamp, rollbackAuditEntryWithFeedback } from './ConfigurationHistoryTimeline'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const LIFECYCLE_BADGE_VARIANT = {
  draft: 'secondary',
  testing: 'purple',
  published: 'success',
  deprecated: 'warning',
  archived: 'outline',
} as const

export interface ConfigurationDraftStatus {
  isDirty: boolean
  dirtyCount: number
  isSaving: boolean
}

export interface ConfigurationModuleActions {
  save: () => void
  discard: () => void
}

export interface ConfigurationStudioToolbarProps {
  activeModule: ConfigModuleDefinition | undefined
  draftStatus: ConfigurationDraftStatus | null
  actions: ConfigurationModuleActions | null
  actor: ConfigActor
  onOpenCommandPalette: () => void
  onRefresh: () => void
}

export function ConfigurationStudioToolbar({
  activeModule, draftStatus, actions, actor, onOpenCommandPalette, onRefresh,
}: ConfigurationStudioToolbarProps) {
  const t = useTranslations('console')
  const tNotifications = useTranslations('notifications')
  const [historyOpen, setHistoryOpen] = useState(false)

  const lifecycle = activeModule ? platformConfigurationRegistry.getModuleLifecycle(activeModule.id) : undefined
  const isDraftLifecycle = lifecycle === 'draft' || lifecycle === 'testing'

  const moduleAuditEntries = activeModule
    ? activeModule.sections
        .flatMap((s) => s.fields.flatMap((f) => configurationAudit.listForField(f.id).map((entry) => ({ entry, fieldTitle: f.display?.displayName ?? f.title }))))
        .sort((a, b) => (a.entry.timestamp < b.entry.timestamp ? 1 : -1))
    : []

  function handleExport() {
    if (!activeModule) return
    const values = configurationService.resolveModule(activeModule.id, {})
    const payload = Object.fromEntries(Object.entries(values).map(([id, v]) => [id, v.value]))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeModule.id}.config.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(tNotifications('exported', { name: activeModule.name }))
  }

  return (
    <header aria-label={t('toolbarAria')} className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="text-[var(--fg-muted)]">{t('configurationLabel')}</span>
        {activeModule && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--fg-muted)]"aria-hidden="true"/>
            <span className="truncate font-medium text-[var(--fg)]">{activeModule.name}</span>
          </>
        )}
        {lifecycle && <Badge variant={LIFECYCLE_BADGE_VARIANT[lifecycle]}>{lifecycle}</Badge>}
        <Badge variant={USE_MOCK ? 'warning' : 'success'}>{USE_MOCK ? t('mock') : t('live')}</Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50 sm:flex"
        >
          <Search className="h-3.5 w-3.5"aria-hidden="true"/>
          {t('searchOrJumpTo')}
          <kbd className="ms-2 rounded border border-[var(--border)] px-1 text-[10px]">⌘K</kbd>
        </button>

        <Button variant="ghost"size="sm"onClick={() => { onRefresh(); toast.success(tNotifications('configurationRefreshed')) }} aria-label={t('refreshAria')}>
          <RefreshCw className="h-3.5 w-3.5"/>
        </Button>
        <Button variant="ghost"size="sm"onClick={() => setHistoryOpen(true)} aria-label={t('viewHistoryAria')} disabled={!activeModule}>
          <History className="h-3.5 w-3.5"/>
        </Button>
        <Button variant="ghost"size="sm"onClick={handleExport} aria-label={t('exportModuleAria')} disabled={!activeModule}>
          <Download className="h-3.5 w-3.5"/>
        </Button>
        <Button variant="ghost"size="sm"aria-label={t('importComingSoonAria')} disabled title={t('importPlaceholderTitle')}>
          <Upload className="h-3.5 w-3.5"/>
        </Button>

        {draftStatus?.isDirty && (
          <>
            <Badge variant="warning">{t('unsavedBadge', { count: draftStatus.dirtyCount })}</Badge>
            <Button variant="secondary"size="sm"onClick={() => actions?.discard()} disabled={draftStatus.isSaving}>
              {t('discard')}
            </Button>
            <Button
              size="sm"
              onClick={() => actions?.save()}
              disabled={draftStatus.isSaving}
              leftIcon={draftStatus.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : (isDraftLifecycle ? <Redo2 className="h-3.5 w-3.5"/> : <Save className="h-3.5 w-3.5"/>)}
            >
              {isDraftLifecycle ? t('publish') : t('save')}
            </Button>
          </>
        )}
      </div>

      <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title={activeModule ? t('historyDrawerTitle', { module: activeModule.name }) : t('historyDrawerTitleDefault')} side="right"size="lg">
        <div className="p-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {moduleAuditEntries.length === 0 ? (
            <EmptyState icon={<History className="h-6 w-6"/>} title={t('noHistoryYetTitle')} description={t('noHistoryYetDesc')} />
          ) : (
            <ol className="space-y-2 border-l border-[var(--border)] pl-4">
              {moduleAuditEntries.map(({ entry, fieldTitle }) => (
                <li key={entry.id} className="relative text-xs">
                  <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-[var(--accent)]"aria-hidden="true"/>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[var(--fg)]"><span className="font-medium">{fieldTitle}</span> — {entry.actorName}</p>
                      <p className="mt-0.5 font-mono text-[var(--fg-muted)]">{JSON.stringify(entry.previousValue)} → {JSON.stringify(entry.newValue)}</p>
                      {entry.reason && <p className="mt-0.5 italic text-[var(--fg-muted)]">“{entry.reason}”</p>}
                      <p className="mt-0.5 text-[10px] text-[var(--fg-muted)] opacity-70">{formatTimestamp(entry.timestamp)}</p>
                    </div>
                    <Button variant="ghost"size="sm"onClick={() => void rollbackAuditEntryWithFeedback(entry, actor)} aria-label={t('rollbackAria', { field: fieldTitle })}>
                      <RotateCcw className="h-3.5 w-3.5"/>
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Drawer>
    </header>
  )
}
