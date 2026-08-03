/**
 * Public tenant feature-flag resolution — fail-closed checks and path-based loadTenant sync.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Tenant } from '@/types'
import { useTenantStore } from '@/stores'
import { tenantService } from '@/services/tenant.service'
import { featureFlagsService } from '@/services/feature-flags.service'
import {
  resolveOrderingEnabled,
  buildPublicCTAs,
} from '@/utils/public-context'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-path-01',
    name: 'Path Tenant',
    slug: 'path-tenant',
    businessTypes: ['restaurant'],
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z',
    settings: { featureFlags: {} },
    ...overrides,
  }
}

describe('public-context — fail-closed ordering/menu flags', () => {
  it('resolveOrderingEnabled: explicit true → enabled', () => {
    expect(
      resolveOrderingEnabled({ 'ordering.enabled': true, 'menu.enabled': true }, true),
    ).toBe(true)
  })

  it('resolveOrderingEnabled: explicit false → disabled', () => {
    expect(
      resolveOrderingEnabled({ 'ordering.enabled': false, 'menu.enabled': true }, true),
    ).toBe(false)
  })

  it('resolveOrderingEnabled: missing flags → disabled (not fail-open)', () => {
    expect(resolveOrderingEnabled({}, true)).toBe(false)
  })

  it('buildPublicCTAs: missing menu.enabled → no menu CTA', () => {
    const ctas = buildPublicCTAs({
      tenantSlug: 'brew-cafe',
      branchSlug: 'midtown',
      featureFlags: { 'ordering.enabled': true },
      meta: { branchCount: 1, primaryBranchSlug: 'midtown' },
    })
    expect(ctas.menu).toBeNull()
  })

  it('buildPublicCTAs: resolved true flags → menu CTA present', () => {
    const ctas = buildPublicCTAs({
      tenantSlug: 'brew-cafe',
      branchSlug: 'midtown',
      featureFlags: { 'menu.enabled': true, 'ordering.enabled': true },
      meta: { branchCount: 1, primaryBranchSlug: 'midtown' },
    })
    expect(ctas.menu).not.toBeNull()
  })
})

describe('useTenantStore.loadTenant — path-based feature flag sync', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
    vi.restoreAllMocks()
  })

  it('resolves ordering.enabled=true after loading /[tenantSlug]', async () => {
    const tenant = makeTenant({
      settings: { featureFlags: { 'ordering.enabled': true, 'menu.enabled': true } },
    })
    vi.spyOn(tenantService, 'getTenantById').mockResolvedValue(tenant)

    await useTenantStore.getState().loadTenant('path-tenant', { cachedTenants: [tenant] })

    const state = useTenantStore.getState()
    expect(state.tenant?.slug).toBe('path-tenant')
    expect(state.tenantState).toBe('resolved')
    expect(state.featureFlagsInitialized).toBe(true)
    expect(state.featureFlags['ordering.enabled']).toBe(true)
    expect(state.featureFlags).toEqual(featureFlagsService.resolve(tenant))
  })

  it('resolves ordering.enabled=false after loading /[tenantSlug]', async () => {
    const tenant = makeTenant({
      settings: { featureFlags: { 'ordering.enabled': false, 'menu.enabled': true } },
    })
    vi.spyOn(tenantService, 'getTenantById').mockResolvedValue(tenant)

    await useTenantStore.getState().loadTenant('path-tenant', { cachedTenants: [tenant] })

    expect(useTenantStore.getState().featureFlags['ordering.enabled']).toBe(false)
  })

  it('does not treat unresolved empty store flags as ordering.enabled=true', () => {
    expect(useTenantStore.getState().featureFlags['ordering.enabled']).toBeUndefined()
    expect(resolveOrderingEnabled(useTenantStore.getState().featureFlags, true)).toBe(false)
  })

  it('applies module/capability defaults when tenant has no explicit ordering override', async () => {
    const tenant = makeTenant({ settings: { featureFlags: {} } })
    vi.spyOn(tenantService, 'getTenantById').mockResolvedValue(tenant)

    await useTenantStore.getState().loadTenant('path-tenant', { cachedTenants: [tenant] })

    const resolved = useTenantStore.getState().featureFlags
    expect(resolved['ordering.enabled']).toBe(
      featureFlagsService.resolve(tenant)['ordering.enabled'],
    )
    expect(resolveOrderingEnabled({}, true)).toBe(false)
  })
})
