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
import { getDefaultFeatureFlags, getCapabilityFeatureFlags } from '@/modules/registry'
import type { Tenant } from '@/types'

export const featureFlagsService = {
  /**
   * Resolves the full feature flag map for a tenant.
   *
   * Three-layer merge (later layers override earlier):
   *   Layer 1 — module defaultFeatureFlags  (named flags declared per module)
   *   Layer 2 — capability-derived flags     (P6.2: from ModuleCapabilitySet declarations)
   *   Layer 3 — tenant.settings.featureFlags (per-tenant overrides; highest priority)
   *
   * @param tenant - The fully resolved Tenant object (ready or fallback)
   * @returns Merged flag map; missing keys default to false when read via useFeatureFlag().
   */
  resolve(tenant: Tenant): Record<string, boolean> {
    // Layer 1: named flags declared in Module.defaultFeatureFlags
    const moduleDefaults = getDefaultFeatureFlags(tenant.businessTypes)

    // Layer 2: flags derived from Module.capabilities (P6.2)
    const capabilityFlags = getCapabilityFeatureFlags(tenant.businessTypes)

    // Layer 3: per-tenant overrides stored in tenant.settings.featureFlags
    const overrides =
      (tenant.settings?.featureFlags as Record<string, boolean> | undefined) ?? {}

    return { ...moduleDefaults, ...capabilityFlags, ...overrides }
  },
}
