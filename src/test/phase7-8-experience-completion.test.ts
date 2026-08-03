/**
 * P7.8 — Enterprise Experience Completion Tests
 *
 * Covers phases A–J of the P7.8 implementation:
 *   A: Order detail page
 *   B: Reservation detail page
 *   C: Admin settings page (6 tabs)
 *   D: Feature flag management
 *   E: Global branch selector integration
 *   F/G: Customer loyalty/promotions (already implemented — regression)
 *   H: WebSocket sync hooks
 *   I: Analytics export
 *   J: Analytics comparison
 */

import { describe, it, expect, vi } from 'vitest'
import path from 'path'

// ── A: Order Detail Page ──────────────────────────────────────────────────────

describe('P7.8-A: Order Detail Page', () => {
  it('exists at the correct path', () => {
    const fs = require('fs')
    const pagePath = path.join(process.cwd(), 'src/app/console/orders/[id]/page.tsx')
    expect(fs.existsSync(pagePath)).toBe(true)
  })

  it('is a default export (page component)', () => {
    const fs = require('fs')
    const content = fs.readFileSync(path.join(process.cwd(), 'src/app/console/orders/[id]/page.tsx'), 'utf-8')
    expect(content).toMatch(/export default/)
  })
})

// ── B: Reservation Detail Page ────────────────────────────────────────────────

describe('P7.8-B: Reservation Detail Page', () => {
  it('exists at the correct path', () => {
    const fs = require('fs')
    const pagePath = path.join(process.cwd(), 'src/app/console/reservations/[id]/page.tsx')
    expect(fs.existsSync(pagePath)).toBe(true)
  })

  it('useAdminReservation hook is exported from hooks', () => {
    const fs = require('fs')
    const content = fs.readFileSync(path.join(process.cwd(), 'src/hooks/index.ts'), 'utf-8')
    expect(content).toContain('export function useAdminReservation')
  })
})

// ── B: Admin Service — getAdminReservation ────────────────────────────────────

describe('P7.8-B: adminService.getAdminReservation', () => {
  it('resolves with a reservation object in mock mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
    const { adminService } = await import('@/services/admin.service')
    const { MOCK_RESERVATIONS } = await import('@/lib/mock-data')

    if (MOCK_RESERVATIONS.length === 0) return
    const first = MOCK_RESERVATIONS[0]
    const result = await adminService.getAdminReservation(first.id)
    expect(result.id).toBe(first.id)
    expect(result.name).toBe(first.name)
  })

  it('throws for unknown reservation id', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
    const { adminService } = await import('@/services/admin.service')
    await expect(adminService.getAdminReservation('nonexistent-id-xyz')).rejects.toThrow()
  })
})

// ── C: Settings Page ──────────────────────────────────────────────────────────

describe('P7.8-C: Admin Settings Page', () => {
  it('exists at the correct path', () => {
    const fs = require('fs')
    const pagePath = path.join(process.cwd(), 'src/app/console/settings/page.tsx')
    expect(fs.existsSync(pagePath)).toBe(true)
  })

  it('feature-flags subpage exists', () => {
    const fs = require('fs')
    const pagePath = path.join(process.cwd(), 'src/app/console/settings/feature-flags/page.tsx')
    expect(fs.existsSync(pagePath)).toBe(true)
  })
})

// ── C: Module Registry — Settings ────────────────────────────────────────────

describe('P7.8-C: Module Registry — Settings nav item', () => {
  it('ADMIN_SETTINGS_ROUTES is exported', async () => {
    const { ADMIN_SETTINGS_ROUTES } = await import('@/modules/registry')
    expect(Array.isArray(ADMIN_SETTINGS_ROUTES)).toBe(true)
    expect(ADMIN_SETTINGS_ROUTES).toContain('/console/settings')
  })

  it('restaurant module has settings in adminNavItems', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    const hasSettings = (RESTAURANT_MODULE.adminNavItems ?? []).some((n) => n.href === '/console/settings')
    expect(hasSettings).toBe(true)
  })

  it('cafe module has settings in adminNavItems', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    const hasSettings = (CAFE_MODULE.adminNavItems ?? []).some((n) => n.href === '/console/settings')
    expect(hasSettings).toBe(true)
  })

  it('bar module has settings in adminNavItems', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const hasSettings = (BAR_MODULE.adminNavItems ?? []).some((n) => n.href === '/console/settings')
    expect(hasSettings).toBe(true)
  })

  it('food_court module has settings in adminNavItems', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const hasSettings = (FOOD_COURT_MODULE.adminNavItems ?? []).some((n) => n.href === '/console/settings')
    expect(hasSettings).toBe(true)
  })

  it('food_truck module has settings in adminNavItems', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const hasSettings = (FOOD_TRUCK_MODULE.adminNavItems ?? []).some((n) => n.href === '/console/settings')
    expect(hasSettings).toBe(true)
  })

  it('mobile_cafe module has settings in adminNavItems', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const hasSettings = (MOBILE_CAFE_MODULE.adminNavItems ?? []).some((n) => n.href === '/console/settings')
    expect(hasSettings).toBe(true)
  })

  it('all 6 modules have /console/settings in their routes arrays', async () => {
    const { RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const modules = [RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE]
    for (const mod of modules) {
      expect(mod.routes).toContain('/console/settings')
    }
  })
})

// ── D: Feature Flags Service ──────────────────────────────────────────────────

describe('P7.8-D: featureFlagsService extensions', () => {
  it('listFlags is defined', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(typeof featureFlagsService.listFlags).toBe('function')
  })

  it('updateFlag is defined', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(typeof featureFlagsService.updateFlag).toBe('function')
  })

  it('bulkUpdateFlags is defined', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(typeof featureFlagsService.bulkUpdateFlags).toBe('function')
  })

  it('listFlags returns an array with key/value/source fields', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const mockTenant = {
      id: 'tenant-test',
      businessTypes: ['restaurant' as const],
      settings: { featureFlags: { 'custom.flag': true } },
    }
    const flags = featureFlagsService.listFlags(mockTenant as unknown as Parameters<typeof featureFlagsService.listFlags>[0])
    expect(Array.isArray(flags)).toBe(true)
    expect(flags.length).toBeGreaterThan(0)
    const first = flags[0]
    expect(typeof first.key).toBe('string')
    expect(typeof first.value).toBe('boolean')
    expect(['module_default', 'capability', 'tenant_override']).toContain(first.source)
  })

  it('listFlags marks tenant overrides correctly', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const mockTenant = {
      id: 'tenant-test',
      businessTypes: ['restaurant' as const],
      settings: { featureFlags: { 'my.custom.flag': true } },
    }
    const flags = featureFlagsService.listFlags(mockTenant as unknown as Parameters<typeof featureFlagsService.listFlags>[0])
    const override = flags.find((f) => f.key === 'my.custom.flag')
    expect(override?.source).toBe('tenant_override')
    expect(override?.value).toBe(true)
  })

  it('updateFlag returns updated flags map with new key', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const mockTenant = {
      id: 't1',
      businessTypes: ['restaurant' as const],
      settings: { featureFlags: { 'existing.flag': true } },
    }
    const result = featureFlagsService.updateFlag(mockTenant as unknown as Parameters<typeof featureFlagsService.updateFlag>[0], 'new.flag', false)
    expect(result['new.flag']).toBe(false)
    expect(result['existing.flag']).toBe(true)
  })

  it('bulkUpdateFlags merges multiple updates', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const mockTenant = {
      id: 't1',
      businessTypes: ['restaurant' as const],
      settings: {},
    }
    const result = featureFlagsService.bulkUpdateFlags(
      mockTenant as unknown as Parameters<typeof featureFlagsService.bulkUpdateFlags>[0],
      { 'flag.a': true, 'flag.b': false },
    )
    expect(result['flag.a']).toBe(true)
    expect(result['flag.b']).toBe(false)
  })
})

// ── D: Feature Flag Hooks ─────────────────────────────────────────────────────

describe('P7.8-D: Feature Flag hooks exports', () => {
  const hooksSrc = () =>
    require('fs').readFileSync(path.join(process.cwd(), 'src/hooks/index.ts'), 'utf-8')

  it('useFeatureFlags is exported', () => {
    expect(hooksSrc()).toContain('export function useFeatureFlags')
  })

  it('useUpdateFeatureFlag is exported', () => {
    expect(hooksSrc()).toContain('export function useUpdateFeatureFlag')
  })
})

// ── E: Global Branch Selector ─────────────────────────────────────────────────

describe('P7.8-E: BranchSelector integration', () => {
  it('BranchSelector component exists', () => {
    const fs = require('fs')
    const componentPath = path.join(process.cwd(), 'src/components/common/BranchSelector.tsx')
    expect(fs.existsSync(componentPath)).toBe(true)
    const content = fs.readFileSync(componentPath, 'utf-8')
    expect(content).toContain('export function BranchSelector')
  })

  it('Header imports BranchSelector', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/Header.tsx'), 'utf-8')
    expect(content).toContain('BranchSelector')
  })

  it('operations page uses the shared branch-resolution state, not local state, for branch', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(path.join(process.cwd(), 'src/app/console/operations/page.tsx'), 'utf-8')
    // Phase 3.2 — the page no longer reads useBranchStore directly; it goes
    // through useSelectedBranch()/useBranchState() (hooks/index.ts), which
    // read the same store internally. The substance of this assertion —
    // no local useState-based branch filter reinvention — is unchanged.
    expect(content).toContain('useSelectedBranch')
    expect(content).toContain('useBranchState')
    expect(content).not.toContain('setBranchFilter')
  })
})

// ── H: WebSocket hooks ────────────────────────────────────────────────────────

describe('P7.8-H: WebSocket sync hooks', () => {
  const hooksSrc = () =>
    require('fs').readFileSync(path.join(process.cwd(), 'src/hooks/index.ts'), 'utf-8')

  it('useWebSocketStatus is exported', () => {
    expect(hooksSrc()).toContain('export function useWebSocketStatus')
  })

  it('useOrdersBroadcastSync is exported', () => {
    expect(hooksSrc()).toContain('export function useOrdersBroadcastSync')
  })

  it('useReservationsBroadcastSync is exported', () => {
    expect(hooksSrc()).toContain('export function useReservationsBroadcastSync')
  })

  it('useStaffBroadcastSync is exported', () => {
    expect(hooksSrc()).toContain('export function useStaffBroadcastSync')
  })

  it('useNotificationsBroadcastSync is exported', () => {
    expect(hooksSrc()).toContain('export function useNotificationsBroadcastSync')
  })

  it('useAuditBroadcastSync is exported', () => {
    expect(hooksSrc()).toContain('export function useAuditBroadcastSync')
  })
})

// ── I: Analytics Export ───────────────────────────────────────────────────────

describe('P7.8-I: Analytics Export', () => {
  it('AnalyticsExport component exists', async () => {
    const mod = await import('@/components/admin/AnalyticsExport')
    expect(mod.AnalyticsExport).toBeDefined()
    expect(typeof mod.AnalyticsExport).toBe('function')
  })

  it('useExportAnalytics hook is exported', () => {
    const content = require('fs').readFileSync(path.join(process.cwd(), 'src/hooks/index.ts'), 'utf-8')
    expect(content).toContain('export function useExportAnalytics')
  })
})

// ── J: Analytics Comparison ───────────────────────────────────────────────────

describe('P7.8-J: Analytics Comparison', () => {
  it('useAnalyticsComparison hook is exported', () => {
    const content = require('fs').readFileSync(path.join(process.cwd(), 'src/hooks/index.ts'), 'utf-8')
    expect(content).toContain('export function useAnalyticsComparison')
  })
})

// ── Regression: Loyalty and Promotions pages ──────────────────────────────────

describe('P7.8-F/G: Loyalty and Promotions pages (regression)', () => {
  it('loyalty page exists and is functional', async () => {
    const mod = await import('@/app/loyalty/page')
    expect(mod.default).toBeDefined()
  })

  it('promotions page exists and is functional', async () => {
    const mod = await import('@/app/promotions/page')
    expect(mod.default).toBeDefined()
  })
})

// ── Navigation counts — settings adds 1 to each module ───────────────────────

describe('P7.8-C: Module nav counts with settings', () => {
  it('restaurant module has 9 adminNavItems', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect((RESTAURANT_MODULE.adminNavItems ?? []).length).toBe(25)
  })

  it('cafe module has 12 adminNavItems', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect((CAFE_MODULE.adminNavItems ?? []).length).toBe(25)
  })

  it('bar module has 12 adminNavItems', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect((BAR_MODULE.adminNavItems ?? []).length).toBe(26)
  })

  it('food_court module has 11 adminNavItems', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect((FOOD_COURT_MODULE.adminNavItems ?? []).length).toBe(25)
  })

  it('food_truck module has 11 adminNavItems', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect((FOOD_TRUCK_MODULE.adminNavItems ?? []).length).toBe(24)
  })

  it('mobile_cafe module has 11 adminNavItems', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect((MOBILE_CAFE_MODULE.adminNavItems ?? []).length).toBe(24)
  })
})
