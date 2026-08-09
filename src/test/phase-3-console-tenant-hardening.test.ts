/**
 * Console tenant hardening — P0/P1/P2 remediation validation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { resolveConsoleTenantPhase } from '@/components/admin/ConsoleWorkspaceGate'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')

const TENANT_A = 'tenant-samoon-01'
const TENANT_B = 'tenant-brew-cafe-01'
const ROOT = path.join(__dirname, '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
  useBranchStore.getState().resetBranchResolution()
  useConsoleWorkspaceStore.getState().resetWorkspace()
})

describe('P0 — reservation mock tenant isolation', () => {
  it('getAdminReservations returns only reservations for the requested tenant', async () => {
    const { adminService } = await import('@/services/admin.service')
    const tenantA = await adminService.getAdminReservations({ tenantId: TENANT_A })
    const tenantB = await adminService.getAdminReservations({ tenantId: TENANT_B })
    expect(tenantA.results.length).toBeGreaterThanOrEqual(0)
    expect(tenantB.results).toHaveLength(0)
  })

  it('useAdminReservations injects tenantId from useConsoleTenantId in hook source', () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('export function useAdminReservations'), src.indexOf('export function useAdminReservation('))
    expect(block).toContain('useConsoleTenantId()')
    expect(block).toContain('tenantId')
    expect(block).toContain('scopedFilters')
  })
})

describe('P0 — audit log tenant isolation', () => {
  it('getAuditLogs filters by tenantId in mock mode', async () => {
    const { auditLogService } = await import('@/services/audit-log.service')
    const all = await auditLogService.getAuditLogs({})
    const tenantA = await auditLogService.getAuditLogs({ tenantId: TENANT_A })
    const tenantB = await auditLogService.getAuditLogs({ tenantId: TENANT_B })
    expect(all.results.length).toBeGreaterThan(tenantA.results.length)
    expect(tenantB.results.every((l) => l.scope.tenantId === TENANT_B)).toBe(true)
    expect(tenantA.results.every((l) => l.scope.tenantId === TENANT_A)).toBe(true)
  })

  it('audit-logs page injects useConsoleTenantId into filter memo', () => {
    const src = readSrc('app/console/audit-logs/page.tsx')
    expect(src).toContain('useConsoleTenantId')
    expect(src).toMatch(/tenantId.*useConsoleTenantId|useConsoleTenantId[\s\S]*tenantId/)
  })
})

describe('P0 — vendor tenant isolation', () => {
  it('getVendors scopes results to tenant ownership', async () => {
    const { vendorService } = await import('@/services/vendor.service')
    const samoon = await vendorService.getVendors(TENANT_A)
    const brew = await vendorService.getVendors(TENANT_B)
    expect(samoon.length).toBeGreaterThan(0)
    expect(brew).toHaveLength(0)
  })
})

describe('P1 — useConsoleExtras and reservations page authority', () => {
  it('defines useConsoleExtras with useConsoleTenantId', () => {
    const hooksSrc = readSrc('hooks/index.ts')
    expect(hooksSrc).toContain('export function useConsoleExtras')
    expect(hooksSrc).toMatch(/useConsoleExtras[\s\S]*useConsoleTenantId/)
    expect(hooksSrc).toContain("queryKey: ['console-extras', tenantId")
  })

  it('console extras page uses useConsoleExtras, not useExtras', () => {
    const src = readSrc('app/console/extras/page.tsx')
    expect(src).toContain('useConsoleExtras')
    expect(src).not.toMatch(/useExtras\(/)
  })

  it('reservations page does not import useBranches', () => {
    const src = readSrc('app/console/reservations/page.tsx')
    expect(src).not.toContain('useBranches')
    expect(src).toContain('useAdminBranches')
  })
})

describe('P1 — useUpdateFeatureFlag session authority', () => {
  it('uses tenantId-only feature flag mutation', () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('export function useUpdateFeatureFlag'), src.indexOf('// ── P7.8 Phase H'))
    expect(block).toContain('useConsoleTenantId()')
    expect(block).toContain('updateFlagForTenant')
    expect(block).not.toContain('alignedTenant')
  })
})

describe('P1 — membership shell enrichment', () => {
  it('switchTenant schedules ensureFullTenantRecord after shell hydrate', async () => {
    const hydration = await import('@/lib/console-membership-hydration')
    const enrichSpy = vi.spyOn(hydration, 'ensureFullTenantRecord').mockResolvedValue()

    useRbacStore.getState().setSessionMemberships(
      [{
        tenantId: TENANT_A,
        tenantName: 'Samoon',
        tenantSlug: 'samoon',
        roles: ['owner'],
        branchAccess: { scope: 'all' },
      }],
      { tenantId: TENANT_A },
    )
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)

    await useConsoleWorkspaceStore.getState().switchTenant(TENANT_A)

    expect(enrichSpy).toHaveBeenCalledWith(TENANT_A)
    enrichSpy.mockRestore()
  })
})

describe('P2 — staff detail tenant isolation', () => {
  it('getStaffMember rejects cross-tenant access in mock mode', async () => {
    const { staffService } = await import('@/services/staff.service')
    const member = await staffService.getStaffMember('staff-owner-01', TENANT_A)
    expect(member.tenantId).toBe(TENANT_A)
    await expect(staffService.getStaffMember('staff-owner-01', TENANT_B)).rejects.toThrow(/not found/i)
  })
})

describe('P2 — gate hardening', () => {
  it('blocks resolved when activeTenantId is set but resolvedTenantId is missing', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 1,
        activeTenantId: TENANT_A,
        resolvedTenantId: undefined,
        tenantState: 'resolved',
        hasDashboardAccess: true,
        retryCount: 0,
      }),
    ).toBe('tenant_loading')
  })

  it('impossible: activeMembership=A, tenant.id=B, gate=resolved', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 1,
        activeTenantId: TENANT_A,
        resolvedTenantId: TENANT_B,
        tenantState: 'resolved',
        hasDashboardAccess: true,
        retryCount: 0,
      }),
    ).not.toBe('resolved')
  })
})

describe('P2 — chrome display uses membership authority', () => {
  it('AdminHeader reads display name from session, not raw tenant store', () => {
    const src = readSrc('components/admin/AdminHeader.tsx')
    expect(src).toContain('getTenantDisplayName')
    expect(src).toContain('useConsoleTenantId')
    expect(src).not.toContain('useTenantStore')
  })

  it('PreviewButton resolves slug from membership metadata', () => {
    const src = readSrc('components/admin/PreviewButton.tsx')
    expect(src).toContain('useConsoleTenantId')
    expect(src).toContain('sessionMemberships')
    expect(src).not.toContain('useTenantStore')
  })
})
