'use client'

/**
 * useConfigurationDraft — P9.1.3 Phase J (Save Experience)
 *
 * Generic dirty-state/save/discard/reset engine for any Platform
 * Configuration module's Console page. Nothing here is Authentication-
 * specific — this is the reusable piece every future module's Control
 * Center (Countries, Themes, Payments, …) is meant to share, per the
 * "gold standard blueprint" goal of P9.1.3.
 *
 * Writes always target each dirty field's own `inheritance.level` (the
 * level ConfigurationService always permits writing at, per the P9.0.1
 * direction-check hardening) rather than a hardcoded 'platform' — so this
 * hook works unmodified for a future module with tenant/branch-owned
 * fields, not just Authentication's currently-all-platform-owned schema.
 */
import { useCallback, useMemo, useState } from 'react'
import { configurationAudit, configurationService, configurationValidator } from '@/config'
import type { ConfigAuditEntry, ConfigInheritanceLevel, ConfigResolutionScope } from '@/config'
import { useAuthStore, useBranchStore } from '@/stores'
import { useConfigurationModule } from './use-platform-configuration'
import { useConsoleTenantId } from '@/hooks/console-workspace'

export interface ConfigurationSaveResult {
  ok: boolean
  errors?: Record<string, string[]>
}

export function useConfigurationDraft(moduleId: string) {
  const { configModule, values } = useConfigurationModule(moduleId)
  const [drafts, setDrafts] = useState<Record<string, unknown>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const tenantId = useConsoleTenantId()
  const branchId = useBranchStore((s) => s.adminActiveBranch?.id)
  const actorUser = useAuthStore((s) => s.user)

  const setFieldDraft = useCallback((fieldId: string, value: unknown) => {
    setDrafts((prev) => ({ ...prev, [fieldId]: value }))
  }, [])

  const resetField = useCallback((fieldId: string) => {
    setDrafts((prev) => {
      if (!(fieldId in prev)) return prev
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
  }, [])

  const resetSection = useCallback((sectionId: string) => {
    setDrafts((prev) => {
      const section = configModule?.sections.find((s) => s.id === sectionId)
      if (!section) return prev
      const idsInSection = new Set(section.fields.map((f) => f.id))
      return Object.fromEntries(Object.entries(prev).filter(([id]) => !idsInSection.has(id)))
    })
  }, [configModule])

  const resetModule = useCallback(() => setDrafts({}), [])

  const dirtyFieldIds = useMemo(
    () => Object.keys(drafts).filter((fieldId) => JSON.stringify(drafts[fieldId]) !== JSON.stringify(values[fieldId]?.value)),
    [drafts, values],
  )

  const isFieldDirty = useCallback((fieldId: string) => dirtyFieldIds.includes(fieldId), [dirtyFieldIds])

  const scopeForLevel = useCallback((level: ConfigInheritanceLevel): ConfigResolutionScope => {
    if (level === 'platform') return {}
    if (level === 'tenant') return { tenantId }
    if (level === 'branch') return { tenantId, branchId }
    return { tenantId, branchId, userId: actorUser?.id }
  }, [tenantId, branchId, actorUser?.id])

  const validateDrafts = useCallback((): Record<string, string[]> => {
    const errors: Record<string, string[]> = {}
    for (const fieldId of dirtyFieldIds) {
      const field = configurationService.getField(fieldId)
      if (!field) continue
      const result = configurationValidator.validate(field, drafts[fieldId])
      if (!result.valid) errors[fieldId] = result.errors.map((e) => e.message)
    }
    return errors
  }, [dirtyFieldIds, drafts])

  const requiresReason = useMemo(
    () => dirtyFieldIds.some((id) => configurationService.getField(id)?.audit.requireReason),
    [dirtyFieldIds],
  )

  const save = useCallback(async (reason?: string): Promise<ConfigurationSaveResult> => {
    const errors = validateDrafts()
    if (Object.keys(errors).length > 0) return { ok: false, errors }
    if (requiresReason && !reason?.trim()) {
      return { ok: false, errors: { _reason: ['A reason is required for this change.'] } }
    }

    setIsSaving(true)
    setLastError(null)
    try {
      // ConfigurationService is synchronous (in-memory store) — this delay
      // exists only to give the Console a realistic "Saving…" state in mock
      // mode, matching the MOCK_DELAY convention used elsewhere.
      await new Promise((resolve) => setTimeout(resolve, 400))

      const actorName = actorUser ? `${actorUser.first_name} ${actorUser.last_name}`.trim() : 'Platform Administrator'
      for (const fieldId of dirtyFieldIds) {
        const field = configurationService.getField(fieldId)
        if (!field) continue
        configurationService.updateField({
          fieldId,
          value: drafts[fieldId],
          level: field.inheritance.level,
          scope: scopeForLevel(field.inheritance.level),
          actor: { id: actorUser?.id ?? 'platform-admin', name: actorName },
          reason,
        })
      }
      setDrafts({})
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes.'
      setLastError(message)
      return { ok: false, errors: { _save: [message] } }
    } finally {
      setIsSaving(false)
    }
  }, [dirtyFieldIds, drafts, scopeForLevel, actorUser, validateDrafts, requiresReason])

  const auditHistoryFor = useCallback((fieldId: string): ConfigAuditEntry[] => configurationAudit.listForField(fieldId), [])

  return {
    configModule,
    values,
    drafts,
    dirtyFieldIds,
    isDirty: dirtyFieldIds.length > 0,
    isFieldDirty,
    isSaving,
    lastError,
    requiresReason,
    setFieldDraft,
    resetField,
    resetSection,
    resetModule,
    save,
    validateDrafts,
    auditHistoryFor,
  }
}
