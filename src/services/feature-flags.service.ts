/**
 * Feature Flag Service — Phase 1B (P1B.2)
 *
 * Resolves the effective feature flag map for a given tenant by merging two layers:
 *   1. Module defaults  — from the module registry (src/modules/registry.ts)
 *   2. Tenant overrides — from tenant.settings.featureFlags (if present)
 *
 * Resolution contract:
 *   - Layer 2 (tenant overrides) takes precedence over layer 1 (module defaults).
 *   - Any flag key absent from both layers returns false when queried via
 *     useFeatureFlag() — safe default off.
 *   - Flag resolution is pure and synchronous; results are stored in useTenantStore
 *     by TenantBootstrapper after loadTenant() completes.
 */
import { getDefaultFeatureFlags } from '@/modules/registry'
import type { Tenant } from '@/types'

export const featureFlagsService = {
  /**
   * Resolves the full feature flag map for a tenant.
   *
   * @param tenant - The fully resolved Tenant object (ready or fallback)
   * @returns Merged flag map; missing keys default to false when read.
   */
  resolve(tenant: Tenant): Record<string, boolean> {
    // Layer 1: module defaults for this tenant's active business type modules
    const defaults = getDefaultFeatureFlags(tenant.businessTypes)

    // Layer 2: per-tenant overrides stored in tenant.settings.featureFlags
    const overrides =
      (tenant.settings?.featureFlags as Record<string, boolean> | undefined) ?? {}

    return { ...defaults, ...overrides }
  },
}
