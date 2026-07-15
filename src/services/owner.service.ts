// ============================================================
// P10.2.1 — Owner Entity Service (data model foundation)
//
// Implements the Owner entity from docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md
// §1.1/§4.2 as a standalone mock service, following the same USE_MOCK
// pattern as every other service in src/services/. Nothing here is wired
// into permission.service.ts, branch-access.service.ts, hooks, stores, or
// UI — see docs/P10.2.1_OWNERSHIP_DATA_MODEL_IMPLEMENTATION.md for what is
// explicitly deferred to P10.2.2/P10.3.
//
// Real-mode calls target the endpoints documented in
// docs/BACKEND_API_CONTRACT.md §39.2 — those endpoints do not exist on any
// backend yet, so USE_MOCK=false will 404 until a backend implements them,
// exactly like every other "contract only" service in this codebase.
// ============================================================
import api from './axios.instance'
import type { Owner, OwnerStatus } from '@/types/ownership'
import type { Tenant } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms))

// ── Mock data ─────────────────────────────────────────────────────────────────
//
// Realized against the EXISTING tenant/staff mock fixtures
// (tenant.service.ts MOCK_TENANTS, staff.service.ts INITIAL_MOCK_STAFF) —
// not a parallel invented dataset. Satisfies P10.1 §9's minimum fixture
// requirements: ≥2 Owners, at least one owning ≥2 Tenants.
//
// Ownership assignment (documented here since it's the single source of
// truth other mock rebuilds in this phase read from):
//   owner-001 (Olivia Owner)  → tenant-samoon-01, tenant-brew-cafe-01
//   owner-002 (Drew Owner)    → tenant-oak-bar-01
//   owner-003 (Jordan Owner)  → tenant-central-fc-01, tenant-wheels-brews-01
//   owner-004 (Sam Owner)     → tenant-road-bites-01 (suspended)
//
// This deliberately consolidates two legacy "owner"-role tenants under a
// single Owner apiece (samoon+brew-cafe under Olivia; central-fc+wheels-
// brews under Jordan) to realize the target hierarchy's "one Owner owns
// multiple Tenants" shape. The legacy staff members who previously held
// the 'owner' role on the now-consolidated tenants (Blake on brew-cafe,
// Riley on wheels-brews) are NOT deleted — they remain real StaffMember
// records and receive a StaffAssignment instead (see
// staff-assignment.service.ts), which is exactly the "owner role collapses
// into a Staff assignment" migration story from P10.1 §8.2.

const MOCK_OWNERS: Owner[] = [
  {
    ownerId: 'owner-001',
    userId: 'user-owner-01',
    status: 'active',
    plan: 'enterprise',
    maxTenants: null,
    billing: { customerId: 'cus_owner001', billingEmail: 'owner@samoon.com' },
    createdAt: '2023-01-01T00:00:00Z',
    verifiedAt: '2023-01-02T00:00:00Z',
  },
  {
    ownerId: 'owner-002',
    userId: 'user-oakbar-owner-01',
    status: 'active',
    plan: 'starter',
    maxTenants: 1,
    billing: { customerId: 'cus_owner002', billingEmail: 'owner@theoakbar.com' },
    createdAt: '2023-07-01T00:00:00Z',
    verifiedAt: '2023-07-02T00:00:00Z',
  },
  {
    ownerId: 'owner-003',
    userId: 'user-centralfc-owner-01',
    status: 'active',
    plan: 'growth',
    maxTenants: 3,
    billing: { customerId: 'cus_owner003', billingEmail: 'owner@centralfoodcourt.com' },
    createdAt: '2024-04-01T00:00:00Z',
    verifiedAt: '2024-04-03T00:00:00Z',
  },
  {
    ownerId: 'owner-004',
    userId: 'user-roadbites-owner-01',
    status: 'suspended',
    plan: 'starter',
    maxTenants: 1,
    billing: { customerId: 'cus_owner004', billingEmail: 'owner@roadbites.com' },
    createdAt: '2024-05-01T00:00:00Z',
    // Never completed verification — realizes 'pending_verification'-adjacent,
    // suspended-before-verified state for lifecycle test coverage.
  },
]

/** FK map documented above, exported so mock-data rebuilds in other
 *  services (tenant.service.ts, staff.service.ts) stay in sync with this
 *  single source of truth instead of hand-duplicating the mapping. */
export const MOCK_TENANT_OWNER_MAP: Record<string, string> = {
  'tenant-samoon-01': 'owner-001',
  'tenant-brew-cafe-01': 'owner-001',
  'tenant-oak-bar-01': 'owner-002',
  'tenant-central-fc-01': 'owner-003',
  'tenant-wheels-brews-01': 'owner-003',
  'tenant-road-bites-01': 'owner-004',
}

let _ownerStore: Owner[] = MOCK_OWNERS.map((o) => ({ ...o }))

// ── Service ───────────────────────────────────────────────────────────────────

export const ownerService = {
  async getOwners(): Promise<Owner[]> {
    if (USE_MOCK) {
      await delay()
      return _ownerStore.map((o) => ({ ...o }))
    }
    const { data } = await api.get<Owner[]>('/admin/platform/owners/')
    return data
  },

  async getOwner(ownerId: string): Promise<Owner | undefined> {
    if (USE_MOCK) {
      await delay()
      const owner = _ownerStore.find((o) => o.ownerId === ownerId)
      return owner ? { ...owner } : undefined
    }
    const { data } = await api.get<Owner>(`/admin/platform/owners/${ownerId}/`)
    return data
  },

  async getOwnerByUserId(userId: string): Promise<Owner | undefined> {
    if (USE_MOCK) {
      await delay()
      const owner = _ownerStore.find((o) => o.userId === userId)
      return owner ? { ...owner } : undefined
    }
    const owners = await this.getOwners()
    return owners.find((o) => o.userId === userId)
  },

  /**
   * P10.2.2 — Synchronous counterpart to `getOwnerByUserId()`, mock-mode
   * only. Called from `usePermissions()` (a plain memoized selector that
   * cannot await a promise) via `ownership-resolution.service.ts`.
   */
  getOwnerByUserIdSync(userId: string): Owner | undefined {
    if (!USE_MOCK) return undefined
    const owner = _ownerStore.find((o) => o.userId === userId)
    return owner ? { ...owner } : undefined
  },

  /**
   * Derived, not stored — P10.1 §1.1: "currentTenantCount ... derived,
   * not stored authoritatively (computed from Tenant.ownerId count)."
   */
  countOwnedTenants(ownerId: string, tenants: Tenant[]): number {
    return tenants.filter((t) => t.ownerId === ownerId).length
  },

  getOwnedTenants(ownerId: string, tenants: Tenant[]): Tenant[] {
    return tenants.filter((t) => t.ownerId === ownerId)
  },

  async updateOwnerStatus(ownerId: string, status: OwnerStatus): Promise<Owner> {
    if (USE_MOCK) {
      await delay(150)
      const idx = _ownerStore.findIndex((o) => o.ownerId === ownerId)
      if (idx === -1) throw new Error(`Owner not found: ${ownerId}`)
      _ownerStore[idx] = { ..._ownerStore[idx], status }
      return { ..._ownerStore[idx] }
    }
    const { data } = await api.patch<Owner>(`/admin/platform/owners/${ownerId}/`, { status })
    return data
  },

  /** Test helper — resets the mock store to initial state. */
  _resetMockStore(): void {
    _ownerStore = MOCK_OWNERS.map((o) => ({ ...o }))
  },
}
