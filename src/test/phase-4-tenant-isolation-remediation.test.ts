/**
 * P0/P1 tenant isolation remediation — regression coverage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { useRbacStore, useTenantStore } from '@/stores'
import {
  invalidateTenantLoads,
  isCurrentTenantLoad,
  nextTenantLoadGeneration,
} from '@/lib/console-workspace-switch'
import { FALLBACK_TENANT } from '@/lib/mock-tenant-scope'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')

const TENANT_A = 'tenant-samoon-01'
const TENANT_B = 'tenant-brew-cafe-01'
const ROOT = path.join(__dirname, '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
})

describe('P0 — enrichment generation guard', () => {
  it('stale loadTenantById completion is ignored after invalidateTenantLoads', async () => {
    const { tenantService } = await import('@/services/tenant.service')
    const genA = nextTenantLoadGeneration()
    let resolveA!: (v: Awaited<ReturnType<typeof tenantService.getTenantById>>) => void
    const pendingA = new Promise<Awaited<ReturnType<typeof tenantService.getTenantById>>>((r) => {
      resolveA = r
    })
    const spy = vi.spyOn(tenantService, 'getTenantById').mockImplementation(async (id) => {
      if (id === TENANT_A) return pendingA
      return {
        id: TENANT_B,
        name: 'B',
        slug: 'b',
        businessTypes: ['restaurant'],
        status: 'active',
        created_at: '',
        settings: {},
      }
    })

    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: TENANT_A, roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: TENANT_A },
    )

    const loadA = useTenantStore.getState().loadTenantById(TENANT_A)
    invalidateTenantLoads()
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: TENANT_B, roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: TENANT_B },
    )
    const loadB = useTenantStore.getState().loadTenantById(TENANT_B)
    await loadB

    resolveA({
      id: TENANT_A,
      name: 'Stale A',
      slug: 'a',
      businessTypes: [],
      status: 'active',
      created_at: '',
      settings: {},
    })
    await loadA

    expect(useTenantStore.getState().tenant?.id).toBe(TENANT_B)
    expect(isCurrentTenantLoad(genA)).toBe(false)
    spy.mockRestore()
  })
})

describe('P0 — detail read isolation', () => {
  it('order detail rejects cross-tenant read', async () => {
    const { orderService } = await import('@/services/order.service')
    const order = await orderService.getOrder('ord-001', TENANT_A)
    expect(order.id).toBe('ord-001')
    await expect(orderService.getOrder('ord-001', TENANT_B)).rejects.toThrow(/not found/i)
  })

  it('reservation detail rejects cross-tenant read', async () => {
    const { adminService } = await import('@/services/admin.service')
    const list = await adminService.getAdminReservations({ tenantId: TENANT_A })
    const id = list.results[0]?.id
    expect(id).toBeTruthy()
    await expect(adminService.getAdminReservation(id!, TENANT_B)).rejects.toThrow(/not found/i)
  })

  it('vendor detail rejects cross-tenant read', async () => {
    const { vendorService } = await import('@/services/vendor.service')
    await expect(vendorService.getVendor('vendor-1', TENANT_B)).rejects.toThrow(/not found/i)
  })

  it('branch detail rejects cross-tenant read', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getTenantsBranches(TENANT_A)
    const id = branches[0]?.id
    expect(id).toBeTruthy()
    await expect(branchManagementService.getBranch(id!, TENANT_B)).rejects.toThrow(/not found/i)
  })

  it('audit log detail rejects cross-tenant read', async () => {
    const { auditLogService } = await import('@/services/audit-log.service')
    const logs = await auditLogService.getAuditLogs({ tenantId: TENANT_A })
    const id = logs.results[0]?.id
    expect(id).toBeTruthy()
    const ok = await auditLogService.getAuditLog(id!, TENANT_A)
    expect(ok).toBeTruthy()
    const blocked = await auditLogService.getAuditLog(id!, TENANT_B)
    expect(blocked).toBeNull()
  })

  it('notification detail rejects cross-tenant read', async () => {
    const { notificationRichService } = await import('@/services/notification.service')
    const page = await notificationRichService.getNotifications({ tenantId: TENANT_A })
    const id = page.results[0]?.id
    expect(id).toBeTruthy()
    const ok = await notificationRichService.getNotification(id!, TENANT_A)
    expect(ok).toBeTruthy()
    const blocked = await notificationRichService.getNotification(id!, TENANT_B)
    expect(blocked).toBeNull()
  })
})

describe('P0 — mutation isolation', () => {
  it('updateOrderStatus rejects cross-tenant mutation', async () => {
    const { adminService } = await import('@/services/admin.service')
    await expect(adminService.updateOrderStatus('ord-001', 'accepted', TENANT_B)).rejects.toThrow(/not found/i)
  })

  it('confirmReservation rejects cross-tenant mutation', async () => {
    const { adminService } = await import('@/services/admin.service')
    const list = await adminService.getAdminReservations({ tenantId: TENANT_A })
    const id = list.results[0]?.id
    expect(id).toBeTruthy()
    await expect(adminService.confirmReservation(id!, TENANT_B)).rejects.toThrow(/not found/i)
  })

  it('updateVendor rejects cross-tenant mutation', async () => {
    const { vendorService } = await import('@/services/vendor.service')
    await expect(vendorService.updateVendor('vendor-1', TENANT_B, { name: 'Hacked' })).rejects.toThrow(/not found/i)
  })
})

describe('P1 — promotions and analytics tenant scope', () => {
  it('getPromotions filters by tenantId', async () => {
    const { promotionService } = await import('@/services/promotion.service')
    const a = await promotionService.getPromotions(TENANT_A)
    const b = await promotionService.getPromotions(TENANT_B)
    expect(a.length).toBeGreaterThan(0)
    expect(b).toHaveLength(0)
  })

  it('getPromotion scopes detail by tenantId', async () => {
    const { promotionService } = await import('@/services/promotion.service')
    await expect(promotionService.getPromotion('promo-happy-hour-1', TENANT_B)).rejects.toThrow(/not found/i)
  })

  it('analytics summary differs by tenantId in mock mode', async () => {
    const { analyticsService } = await import('@/services/analytics.service')
    const a = await analyticsService.getAnalyticsSummary(TENANT_A)
    const b = await analyticsService.getAnalyticsSummary(TENANT_B)
    expect(a.totalRevenue).toBeGreaterThan(b.totalRevenue)
  })
})

describe('P1 — feature flag authority uses tenantId only', () => {
  it('useUpdateFeatureFlag does not require alignedTenant object', () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('export function useUpdateFeatureFlag'), src.indexOf('// ── P7.8 Phase H'))
    expect(block).toContain('useConsoleTenantId()')
    expect(block).toContain('updateFlagForTenant')
    expect(block).not.toContain('alignedTenant')
  })
})

describe('P2 — query key hardening in hooks', () => {
  it('detail hooks include tenantId in query keys', () => {
    const src = readSrc('hooks/index.ts')
    expect(src).toMatch(/useConsoleOrder[\s\S]*queryKey:\s*\['order',\s*tenantId,\s*id\]/)
    expect(src).toMatch(/useAdminReservation[\s\S]*queryKey:\s*\['admin-reservation',\s*tenantId,\s*id\]/)
    expect(src).toMatch(/useVendor[\s\S]*queryKey:\s*\['vendor',\s*tenantId,\s*id\]/)
    expect(src).toMatch(/useAdminBranch[\s\S]*queryKey:\s*\['admin-branch',\s*tenantId,\s*id\]/)
    expect(src).toMatch(/useAuditLog[\s\S]*queryKey:\s*\['audit-log',\s*tenantId,\s*id\]/)
    expect(src).toMatch(/useNotification[\s\S]*queryKey:\s*\['rich-notification',\s*tenantId,\s*id\]/)
    expect(src).toMatch(/usePromotion[\s\S]*queryKey:\s*\['promotion',\s*tenantId,\s*id\]/)
  })
})

describe('P2 — module nav uses aligned tenant only', () => {
  it('useAdminModuleNav guards businessTypes by active tenant', () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('export function useAdminModuleNav'), src.indexOf('// ── Auth Hooks'))
    expect(block).toContain('useConsoleTenantId()')
    expect(block).toContain('alignedTenant')
    expect(block).toContain('alignedTenant?.businessTypes')
  })
})

describe('P0 — switchTenant invalidates enrichment', () => {
  it('console-workspace calls invalidateTenantLoads on tenant switch', () => {
    const src = readSrc('stores/console-workspace.ts')
    expect(src).toContain('invalidateTenantLoads()')
  })
})

describe('constants', () => {
  it('FALLBACK_TENANT matches samoon mock tenant', () => {
    expect(FALLBACK_TENANT).toBe(TENANT_A)
  })
})
