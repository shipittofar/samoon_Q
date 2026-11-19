/**
 * Shared mock tenant ↔ branch scoping helpers for console isolation tests and services.
 */

export const FALLBACK_TENANT = 'tenant-samoon-01'

/** Mock branch → tenant map (matches branch.service INITIAL_MOCK_BRANCHES). */
export const MOCK_BRANCH_TENANT_IDS: Record<string, string> = {
  '1': FALLBACK_TENANT,
  'branch-rest-01': FALLBACK_TENANT,
  'branch-rest-02': FALLBACK_TENANT,
  'branch-rest-03': FALLBACK_TENANT,
  'branch-cafe-01': FALLBACK_TENANT,
  'branch-cafe-02': FALLBACK_TENANT,
  'branch-bar-01': FALLBACK_TENANT,
  'branch-fc-01': FALLBACK_TENANT,
  'branch-fc-02': FALLBACK_TENANT,
  // Phase 1 — service verticals (demo)
  'branch-glow-01': 'tenant-glow-studio-01',
  'branch-mehr-01': 'tenant-mehr-clinic-01',
}

export function mockBranchTenantId(branchId: string): string | undefined {
  return MOCK_BRANCH_TENANT_IDS[branchId]
}

export function branchBelongsToMockTenant(branchId: string | undefined, tenantId: string): boolean {
  if (!branchId) return false
  return mockBranchTenantId(branchId) === tenantId
}

export function assertMockTenantResource(
  belongs: boolean,
  label = 'Resource',
): asserts belongs is true {
  if (!belongs) throw new Error(`${label} not found`)
}
