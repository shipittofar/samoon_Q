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
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { configurationService } from '@/config'
import type { ConfigFieldPreview, ConfigModuleDefinition, ConfigResolutionScope, ResolvedConfigValue } from '@/config'
import { useAuthStore, useBranchStore } from '@/stores'
import { usePermissions } from '@/hooks'
import { useConsoleTenantId } from '@/hooks/console-workspace'
import { loadTenantConfigOverrides } from '@/config/platform-overrides-client'

/** Exported (P9.3) so the Studio's Inspector/Inheritance components can resolve the same tenant/branch/user scope other hooks in this file use, without re-deriving it from the stores themselves. */
export function useConfigScope(): ConfigResolutionScope {
  const tenantId = useConsoleTenantId()
  const branchId = useBranchStore((s) => s.adminActiveBranch?.id)
  const userId = useAuthStore((s) => s.user?.id)
  return useMemo(() => ({ tenantId, branchId, userId }), [tenantId, branchId, userId])
}

/**
 * Re-renders when saved values arrive from Django (platform values at load,
 * a business's values when it is opened, or a save's answer) and loads the
 * given business's tenant-level values. Returns a version number to put in
 * memo dependencies.
 */
export function useConfigOverridesVersion(tenantId?: string | null): number {
  const version = useSyncExternalStore(
    configurationService.onOverridesHydrated,
    configurationService.getOverridesVersion,
    configurationService.getOverridesVersion,
  )
  useEffect(() => {
    void loadTenantConfigOverrides(tenantId)
  }, [tenantId])
  return version
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
  const version = useConfigOverridesVersion(scope.tenantId)
  return useMemo(() => {
    const configModule = configurationService.getModule(moduleId)
    const values = configModule ? configurationService.resolveModule(moduleId, scope) : {}
    return { configModule, values }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, scope.tenantId, scope.branchId, scope.userId, version])
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
  const version = useConfigOverridesVersion(scope.tenantId)
  return useMemo(() => {
    const field = configurationService.getField(fieldId)
    const resolved = field ? configurationService.resolveField(fieldId, scope) : undefined
    return { field, resolved }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, scope.tenantId, scope.branchId, scope.userId, version])
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
  kind: ConfigFieldPreview['kind']
  value: unknown
} {
  const { field, resolved } = useConfigurationField(fieldId)
  return { kind: field?.preview.kind ?? 'none', value: resolved?.value }
}
