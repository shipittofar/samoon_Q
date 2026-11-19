import { MOCK_TENANT_ID } from '@/config/mock-data'
import type { MembershipBranch, Role, TenantMembership } from '@/types/rbac'
import { resolveBranchAccess } from '@/services/permission.service'

export const MOCK_BREW_CAFE_TENANT_ID = 'tenant-brew-cafe-01'

/** Restaurant branches embedded in Samoon's GET /auth/me membership (production-shaped). */
export const MOCK_SAMOON_MEMBERSHIP_BRANCHES: MembershipBranch[] = [
  { id: 'branch-rest-01', name: 'Main Branch', slug: 'main', status: 'active', isDefault: true },
  { id: 'branch-rest-02', name: 'Downtown Branch', slug: 'downtown', status: 'active' },
  { id: 'branch-rest-03', name: 'Airport Branch', slug: 'airport', status: 'maintenance' },
]

export const MOCK_BREW_CAFE_MEMBERSHIP_BRANCHES: MembershipBranch[] = [
  { id: 'branch-brewcafe-01', name: 'Brew Cafe Main', slug: 'main', status: 'active', isDefault: true },
]

export function buildSamoonMembership(roles: Role[]): TenantMembership {
  return {
    tenantId: MOCK_TENANT_ID,
    tenantName: 'Samoon Restaurant',
    tenantSlug: 'samoon',
    tenantLogo: null,
    roles,
    branchAccess: resolveBranchAccess(undefined, roles),
    branches: MOCK_SAMOON_MEMBERSHIP_BRANCHES,
    status: 'active',
  }
}

export function buildBrewCafeMembership(roles: Role[] = ['cashier']): TenantMembership {
  return {
    tenantId: MOCK_BREW_CAFE_TENANT_ID,
    tenantName: 'Brew Cafe',
    tenantSlug: 'brew-cafe',
    tenantLogo: null,
    roles,
    branchAccess: { scope: 'selected', branchIds: ['branch-brewcafe-01'] },
    branches: MOCK_BREW_CAFE_MEMBERSHIP_BRANCHES,
    status: 'active',
  }
}

// ── Phase 1 — service vertical demo owners ───────────────────────────────────

export const MOCK_GLOW_STUDIO_TENANT_ID = 'tenant-glow-studio-01'
export const MOCK_MEHR_CLINIC_TENANT_ID = 'tenant-mehr-clinic-01'

export function buildGlowStudioMembership(roles: Role[] = ['owner']): TenantMembership {
  return {
    tenantId: MOCK_GLOW_STUDIO_TENANT_ID,
    tenantName: 'Glow Studio',
    tenantSlug: 'glow-studio',
    tenantLogo: null,
    roles,
    branchAccess: resolveBranchAccess(undefined, roles),
    branches: [{ id: 'branch-glow-01', name: 'Glow Studio Downtown', slug: 'main', status: 'active', isDefault: true }],
    status: 'active',
  }
}

export function buildMehrClinicMembership(roles: Role[] = ['owner']): TenantMembership {
  return {
    tenantId: MOCK_MEHR_CLINIC_TENANT_ID,
    tenantName: 'Mehr Clinic',
    tenantSlug: 'mehr-clinic',
    tenantLogo: null,
    roles,
    branchAccess: resolveBranchAccess(undefined, roles),
    branches: [{ id: 'branch-mehr-01', name: 'Mehr Clinic — Main', slug: 'main', status: 'active', isDefault: true }],
    status: 'active',
  }
}

/** Multi-tenant persona used by runtime audits and Phase X tests. */
export const MOCK_MULTI_TENANT_MEMBERSHIPS: TenantMembership[] = [
  buildSamoonMembership(['manager']),
  buildBrewCafeMembership(['cashier']),
]
