'use client'

/**
 * ConfigurationModulePage — P9.1.3
 *
 * The reusable Platform Configuration Console page shell: header (status /
 * environment / last modified / publish status), live search, collapsible
 * sections rendered from the registry, and a sticky save bar. Authentication
 * is the first module to use it; any future module renders through this
 * exact same component by passing a different `moduleId` — no per-module
 * page code, per the P9.1.3 "gold standard blueprint" goal.
 */
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronDown, Loader2, RotateCcw, Save, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { configurationService, platformConfigurationRegistry } from '@/config'
import { seedAuthenticationMockOverrides } from '@/config/mock-data'
import { usePermission, usePermissions } from '@/hooks'
import { useConfigurationDraft } from '@/hooks/use-configuration-draft'
import { ConfigurationFieldRow } from './ConfigurationFieldRow'
import { isFieldEnabled, isFieldVisible, matchesSearch } from './configUiHelpers'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const LIFECYCLE_BADGE_VARIANT = {
  draft: 'secondary',
  testing: 'purple',
  published: 'success',
  deprecated: 'warning',
  archived: 'outline',
} as const

export function ConfigurationModulePage({ moduleId }: { moduleId: string }) {
  // P9.1.3 Phase N — seeds a handful of real (not merely displayed) config
  // overrides + audit history the first time the Authentication Console is
  // opened in mock mode, so the page has "Modified" fields and audit entries
  // to show immediately rather than an all-defaults empty state. Idempotent
  // (see seedAuthenticationMockOverrides' internal guard); called during
  // render, before useConfigurationDraft resolves values below, so the very
  // first paint already reflects the seeded state — no extra re-render needed.
  if (moduleId === 'authentication' && USE_MOCK) {
    seedAuthenticationMockOverrides()
  }

  const {
    configModule, values, dirtyFieldIds, isDirty, isFieldDirty, isSaving, requiresReason,
    setFieldDraft, resetField, resetSection, resetModule, save, auditHistoryFor, drafts,
  } = useConfigurationDraft(moduleId)

  const permissions = usePermissions()
  const isPlatformAdmin = usePermission('tenant.manage')
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const lastModified = useMemo(() => {
    if (!configModule) return undefined
    const allEntries = configModule.sections.flatMap((s) => s.fields.flatMap((f) => auditHistoryFor(f.id)))
    if (allEntries.length === 0) return undefined
    return allEntries.reduce((latest, e) => (e.timestamp > latest.timestamp ? e : latest))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configModule, dirtyFieldIds.length])

  // Phase E (Dependency Engine) must react to in-progress edits, not just
  // saved values — otherwise toggling a switch off doesn't hide its
  // dependents until after Save, which fails the phase brief's own example
  // ("OTP OFF → hide OTP Length…") for the common case of a live edit.
  // `effectiveValues` overlays any pending draft on top of the resolved
  // value so `isFieldVisible`/`isFieldEnabled` always see the live state.
  const effectiveValues = useMemo(() => {
    if (Object.keys(drafts).length === 0) return values
    const merged = { ...values }
    for (const [fieldId, draftValue] of Object.entries(drafts)) {
      if (merged[fieldId]) merged[fieldId] = { ...merged[fieldId], value: draftValue }
    }
    return merged
  }, [values, drafts])

  const sectionsWithVisibleFields = useMemo(() => {
    if (!configModule) return []
    return configModule.sections
      .map((section) => {
        const fields = section.fields
          .filter((field) => {
            if (!configurationService.canView(field, permissions)) return false
            if (field.governance?.internalOnly && !isPlatformAdmin) return false
            if (!isFieldVisible(field, effectiveValues)) return false
            if (!matchesSearch(field, search)) return false
            return true
          })
          .sort((a, b) => (a.display?.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.display?.displayOrder ?? Number.MAX_SAFE_INTEGER))
        return { section, fields }
      })
      .filter(({ fields }) => fields.length > 0)
  }, [configModule, permissions, isPlatformAdmin, effectiveValues, search])

  if (!configModule) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-sm text-[var(--fg-muted)]">
        Unknown configuration module &ldquo;{moduleId}&rdquo;.
      </div>
    )
  }

  const lifecycle = platformConfigurationRegistry.getModuleLifecycle(moduleId)

  function toggleSection(sectionId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  async function handleSave() {
    const result = await save(reason || undefined)
    if (result.ok) {
      toast.success('Configuration saved.')
      setReason('')
    } else if (result.errors?._reason) {
      toast.error(result.errors._reason[0])
    } else if (result.errors) {
      const count = Object.keys(result.errors).length
      toast.error(`${count} field${count === 1 ? '' : 's'} failed validation.`)
    } else {
      toast.error('Could not save configuration.')
    }
  }

  function handleDiscard() {
    resetModule()
    setReason('')
    toast('Changes discarded.', { icon: '↩️' })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold text-[var(--fg)]">
                <ShieldCheck className="h-5 w-5 text-orange-500" aria-hidden="true" />
                {configModule.name}
              </h1>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{configModule.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={LIFECYCLE_BADGE_VARIANT[lifecycle]}>{lifecycle}</Badge>
              <Badge variant={USE_MOCK ? 'warning' : 'success'}>{USE_MOCK ? 'Mock Environment' : 'Live Environment'}</Badge>
              <Badge variant="secondary">v{configModule.version}</Badge>
              {lastModified && (
                <span className="text-[var(--fg-muted)]">
                  Last modified {new Date(lastModified.timestamp).toLocaleDateString()} by {lastModified.actorName}
                </span>
              )}
            </div>
          </div>

          {/* ── Search (Phase G) ── */}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${configModule.name.toLowerCase()} settings…`}
              aria-label={`Search ${configModule.name} settings`}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
        </div>
      </div>

      {/* ── Sections ── */}
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {sectionsWithVisibleFields.length === 0 && (
          <p className="py-16 text-center text-sm text-[var(--fg-muted)]">
            {search ? `No settings match "${search}".` : 'No settings are visible with your current permissions.'}
          </p>
        )}

        {sectionsWithVisibleFields.map(({ section, fields }) => {
          const isCollapsed = collapsed.has(section.id)
          return (
            <section key={section.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isCollapsed}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                  <span className="text-sm font-semibold text-[var(--fg)]">{section.title}</span>
                  {section.description && <span className="hidden text-xs text-[var(--fg-muted)] sm:inline">— {section.description}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => resetSection(section.id)}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
                  aria-label={`Reset ${section.title} section`}
                  title="Reset this section's unsaved changes"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
              {!isCollapsed && (
                <div className="space-y-3 p-4">
                  {fields.map((field) => {
                    const resolved = values[field.id]
                    if (!resolved) return null
                    const currentValue = field.id in drafts ? drafts[field.id] : resolved.value
                    const canEdit = configurationService.canEdit(field, permissions)
                    const enabled = isFieldEnabled(field, effectiveValues)
                    return (
                      <ConfigurationFieldRow
                        key={field.id}
                        field={field}
                        resolved={resolved}
                        currentValue={currentValue}
                        isDirty={isFieldDirty(field.id)}
                        canEdit={canEdit}
                        enabled={enabled}
                        onChange={(value) => setFieldDraft(field.id, value)}
                        onReset={() => resetField(field.id)}
                        auditEntries={auditHistoryFor(field.id)}
                      />
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* ── Save bar (Phase J) — appears only when dirty, per Shopify pattern ── */}
      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--card)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <Badge variant="warning">{dirtyFieldIds.length} unsaved change{dirtyFieldIds.length === 1 ? '' : 's'}</Badge>
              {requiresReason && (
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for this change (required)"
                  className="w-64 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleDiscard} disabled={isSaving}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} leftIcon={isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
