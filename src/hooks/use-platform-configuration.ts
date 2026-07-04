/**
 * Platform Configuration Hooks — P9.0 / Phase F
 *
 * Thin React bindings over ConfigurationService. No screens are built on top
 * of these yet — they exist so P9.1+ settings pages can consume resolved,
 * permission-checked, audited configuration without reaching into
 * src/config/* internals directly.
 *
 * Scope (tenantId/branchId/userId) is derived automatically from the existing
 * tenant/branch/auth stores so callers never have to thread it through props.
 */
import { useMemo } from 'react'
import { configurationService } from '@/config'
import type { ConfigModuleDefinition, ConfigResolutionScope, ResolvedConfigValue } from '@/config'
import { useAuthStore, useBranchStore, useTenantStore } from '@/stores'
import { usePermissions } from '@/hooks'

function useConfigScope(): ConfigResolutionScope {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const branchId = useBranchStore((s) => s.adminActiveBranch?.id)
  const userId = useAuthStore((s) => s.user?.id)
  return useMemo(() => ({ tenantId, branchId, userId }), [tenantId, branchId, userId])
}

/**
 * Returns every registered configuration module (metadata only — no values).
 * The future Console settings index page reads this to render module cards.
 */
export function usePlatformConfiguration(): ConfigModuleDefinition[] {
  return useMemo(() => configurationService.getModules(), [])
}

/**
 * Returns one module's metadata plus every field in it resolved for the
 * current tenant/branch/user scope.
 */
export function useConfigurationModule(moduleId: string): {
  configModule: ConfigModuleDefinition | undefined
  values: Record<string, ResolvedConfigValue>
} {
  const scope = useConfigScope()
  return useMemo(() => {
    const configModule = configurationService.getModule(moduleId)
    const values = configModule ? configurationService.resolveModule(moduleId, scope) : {}
    return { configModule, values }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, scope.tenantId, scope.branchId, scope.userId])
}

/**
 * Returns a single field's definition plus its resolved value for the
 * current scope. Safe to call for an unregistered id — returns `undefined`
 * field and a null-ish resolved value rather than throwing, so speculative
 * UI can render a loading/empty state instead of crashing.
 */
export function useConfigurationField(fieldId: string): {
  field: ReturnType<typeof configurationService.getField>
  resolved: ResolvedConfigValue | undefined
} {
  const scope = useConfigScope()
  return useMemo(() => {
    const field = configurationService.getField(fieldId)
    const resolved = field ? configurationService.resolveField(fieldId, scope) : undefined
    return { field, resolved }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, scope.tenantId, scope.branchId, scope.userId])
}

/**
 * Returns whether the current user may view/edit the given field, per the
 * field's declared `permissions.view` / `permissions.edit` keys and the
 * effective P7 permissions already computed by usePermissions().
 */
export function useConfigurationPermissions(fieldId: string): { canView: boolean; canEdit: boolean } {
  const permissions = usePermissions()
  const field = configurationService.getField(fieldId)
  if (!field) return { canView: false, canEdit: false }
  return {
    canView: configurationService.canView(field, permissions),
    canEdit: configurationService.canEdit(field, permissions),
  }
}

/**
 * Returns the preview descriptor for a field alongside its resolved value —
 * a future settings UI uses `preview.kind` to pick a renderer (swatch,
 * font-sample, json, image) without hardcoding a switch per field.
 */
export function useConfigurationPreview(fieldId: string): {
  kind: 'none' | 'swatch' | 'font-sample' | 'json' | 'image'
  value: unknown
} {
  const { field, resolved } = useConfigurationField(fieldId)
  return { kind: field?.preview.kind ?? 'none', value: resolved?.value }
}
