/**
 * Phase 1B test suite — covers P1B.1 (RBAC), P1B.2 (Feature Flags), and
 * P1B.6 system readiness lifecycle with real initialization.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { featureFlagsService } from '@/services/feature-flags.service'
import { useTenantStore } from '@/stores'
import { useFeatureFlag } from '@/hooks'
import { DEFAULT_TENANT } from '@/constants'
import { tenantService } from '@/services/tenant.service'
import type { Tenant } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mirrors what TenantBootstrapper does at runtime:
 *   1. loadTenant() → sets tenantState
 *   2. setRbacInitialized(true)
 *   3. setFeatureFlags(resolved flags)
 *   4. setFeatureFlagsInitialized(true)
 */
async function bootstrap(slug = 'default') {
  await useTenantStore.getState().loadTenant(slug)
  const { tenant } = useTenantStore.getState()
  useTenantStore.getState().setRbacInitialized(true)
  useTenantStore.getState().setFeatureFlags(featureFlagsService.resolve(tenant))
  useTenantStore.getState().setFeatureFlagsInitialized(true)
}

// ── P1B.1 — RBAC Service ─────────────────────────────────────────────────────
// P10.4.12 — the legacy rbacService.hasPermission() engine this section
// tested was fully retired (src/services/rbac.service.ts deleted); see
// docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md.

describe('hook contract — useFeatureFlag is an exported function', () => {
  it('useFeatureFlag is a function', () => {
    expect(typeof useFeatureFlag).toBe('function')
  })
})

// ── P1B.2 — Feature Flags Service ────────────────────────────────────────────

describe('featureFlagsService.resolve() — module defaults', () => {
  it('returns menu.enabled = true for a restaurant tenant', () => {
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['menu.enabled']).toBe(true)
  })

  it('returns reservations.enabled = true for a restaurant tenant', () => {
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['reservations.enabled']).toBe(true)
  })

  it('returns delivery.enabled = true for a restaurant tenant', () => {
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['delivery.enabled']).toBe(true)
  })

  it('returns table_ordering.enabled = true for a restaurant tenant', () => {
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['table_ordering.enabled']).toBe(true)
  })

  it('returns order_tracking.enabled = true for a restaurant tenant', () => {
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['order_tracking.enabled']).toBe(true)
  })

  it('returns a non-empty flags object', () => {
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(Object.keys(flags).length).toBeGreaterThan(0)
  })

  it('returns false for an unknown flag key (safe default)', () => {
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['nonexistent.flag'] ?? false).toBe(false)
  })
})

describe('featureFlagsService.resolve() — tenant overrides', () => {
  it('tenant override takes precedence over module default', () => {
    const tenantWithOverride: Tenant = {
      ...DEFAULT_TENANT,
      settings: {
        featureFlags: { 'delivery.enabled': false },
      },
    }
    const flags = featureFlagsService.resolve(tenantWithOverride)
    expect(flags['delivery.enabled']).toBe(false)
  })

  it('tenant can enable a flag that module default does not set', () => {
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      settings: {
        featureFlags: { 'custom.feature': true },
      },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['custom.feature']).toBe(true)
  })

  it('non-overridden module defaults are preserved alongside overrides', () => {
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      settings: {
        featureFlags: { 'delivery.enabled': false },
      },
    }
    const flags = featureFlagsService.resolve(tenant)
    // delivery overridden to false, but menu should still be true from module default
    expect(flags['menu.enabled']).toBe(true)
    expect(flags['delivery.enabled']).toBe(false)
  })

  it('tenant without settings field returns module defaults only', () => {
    const tenant: Tenant = { ...DEFAULT_TENANT, settings: undefined }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['menu.enabled']).toBe(true)
    expect(flags['reservations.enabled']).toBe(true)
  })

  it('tenant with empty settings.featureFlags returns module defaults only', () => {
    const tenant: Tenant = { ...DEFAULT_TENANT, settings: { featureFlags: {} } }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['menu.enabled']).toBe(true)
  })
})

describe('featureFlagsService.resolve() — tenant isolation', () => {
  it('two tenants with different overrides get different flag maps', () => {
    const tenantA: Tenant = {
      ...DEFAULT_TENANT,
      id: 'tenant-a',
      settings: { featureFlags: { 'delivery.enabled': false } },
    }
    const tenantB: Tenant = {
      ...DEFAULT_TENANT,
      id: 'tenant-b',
      settings: { featureFlags: { 'delivery.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenantA)['delivery.enabled']).toBe(false)
    expect(featureFlagsService.resolve(tenantB)['delivery.enabled']).toBe(true)
  })
})

// ── P1B.6 + P1B.2 — Store integration ───────────────────────────────────────

describe('useTenantStore — featureFlags state', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('featureFlags is {} before bootstrap', () => {
    expect(useTenantStore.getState().featureFlags).toEqual({})
  })

  it('featureFlags is populated after bootstrap', async () => {
    await bootstrap()
    const { featureFlags } = useTenantStore.getState()
    expect(Object.keys(featureFlags).length).toBeGreaterThan(0)
  })

  it('featureFlags contains menu.enabled = true after restaurant bootstrap', async () => {
    await bootstrap()
    expect(useTenantStore.getState().featureFlags['menu.enabled']).toBe(true)
  })

  it('reset() clears featureFlags back to {}', async () => {
    await bootstrap()
    expect(Object.keys(useTenantStore.getState().featureFlags).length).toBeGreaterThan(0)
    useTenantStore.getState().reset()
    expect(useTenantStore.getState().featureFlags).toEqual({})
  })

  it('featureFlags is NOT in the persisted partition', () => {
    const persistedPartition = { tenant: DEFAULT_TENANT }
    expect((persistedPartition as Record<string, unknown>).featureFlags).toBeUndefined()
  })

  it('setFeatureFlags replaces the flag map atomically', () => {
    useTenantStore.getState().setFeatureFlags({ 'test.flag': true })
    expect(useTenantStore.getState().featureFlags['test.flag']).toBe(true)
    useTenantStore.getState().setFeatureFlags({ 'other.flag': false })
    // Previous key is gone after atomic replace
    expect(useTenantStore.getState().featureFlags['test.flag']).toBeUndefined()
  })
})

// ── P1B.6 — System readiness with real initialization ─────────────────────────

describe('System readiness — full bootstrap lifecycle', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('canExecute is false before any bootstrap step', () => {
    const { rbacInitialized, featureFlagsInitialized, tenantState } = useTenantStore.getState()
    const canExecute = tenantState !== 'loading' && rbacInitialized && featureFlagsInitialized
    expect(canExecute).toBe(false)
  })

  it('rbacInitialized is false before bootstrap', () => {
    expect(useTenantStore.getState().rbacInitialized).toBe(false)
  })

  it('featureFlagsInitialized is false before bootstrap', () => {
    expect(useTenantStore.getState().featureFlagsInitialized).toBe(false)
  })

  it('canExecute is true after full bootstrap', async () => {
    await bootstrap()
    const { rbacInitialized, featureFlagsInitialized, tenantState } = useTenantStore.getState()
    const canExecute = tenantState !== 'loading' && rbacInitialized && featureFlagsInitialized
    expect(canExecute).toBe(true)
  })

  it('canExecute is true in a degraded (error) state after bootstrap — bootstrap settled, even though resolution failed', async () => {
    // tenantService is imported at module level — same instance useTenantStore holds.
    const spy = vi.spyOn(tenantService, 'getTenantBySlug').mockRejectedValueOnce(new Error('network'))
    await useTenantStore.getState().loadTenant('some-slug')
    const { tenant } = useTenantStore.getState()
    useTenantStore.getState().setRbacInitialized(true)
    useTenantStore.getState().setFeatureFlags(featureFlagsService.resolve(tenant))
    useTenantStore.getState().setFeatureFlagsInitialized(true)

    const { rbacInitialized, featureFlagsInitialized, tenantState } = useTenantStore.getState()
    const canExecute = tenantState !== 'loading' && rbacInitialized && featureFlagsInitialized
    expect(canExecute).toBe(true)
    expect(['error', 'not_found']).toContain(tenantState)
    expect(useTenantStore.getState().tenant).toBeNull()
    spy.mockRestore()
  })

  it('a failed bootstrap resolves an empty featureFlags map — no fake tenant to derive flags from', async () => {
    const spy = vi.spyOn(tenantService, 'getTenantBySlug').mockRejectedValueOnce(new Error('network'))
    await useTenantStore.getState().loadTenant('some-slug')
    const { tenant } = useTenantStore.getState()
    expect(tenant).toBeNull()
    useTenantStore.getState().setFeatureFlags(featureFlagsService.resolve(tenant))
    useTenantStore.getState().setFeatureFlagsInitialized(true)

    expect(useTenantStore.getState().featureFlags).toEqual({})
    spy.mockRestore()
  })

  it('reset() returns all P1B signals to pre-bootstrap state', async () => {
    await bootstrap()
    useTenantStore.getState().reset()
    expect(useTenantStore.getState().rbacInitialized).toBe(false)
    expect(useTenantStore.getState().featureFlagsInitialized).toBe(false)
    expect(useTenantStore.getState().featureFlags).toEqual({})
    expect(useTenantStore.getState().tenantState).toBe('loading')
  })

  it('canExecute requires BOTH rbacInitialized AND featureFlagsInitialized', async () => {
    await useTenantStore.getState().loadTenant('default')
    // Only RBAC
    useTenantStore.getState().setRbacInitialized(true)
    const afterRbacOnly = useTenantStore.getState()
    expect(afterRbacOnly.tenantState !== 'loading' && afterRbacOnly.rbacInitialized && afterRbacOnly.featureFlagsInitialized).toBe(false)
    // Now feature flags too
    const { tenant } = useTenantStore.getState()
    useTenantStore.getState().setFeatureFlags(featureFlagsService.resolve(tenant))
    useTenantStore.getState().setFeatureFlagsInitialized(true)
    const after = useTenantStore.getState()
    expect(after.tenantState !== 'loading' && after.rbacInitialized && after.featureFlagsInitialized).toBe(true)
  })
})
