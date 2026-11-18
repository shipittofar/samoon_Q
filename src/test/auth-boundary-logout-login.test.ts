/**
 * Auth-boundary regression: User A → logout → User B must not inherit
 * User A's tenant / branch / request-slug / workspace state.
 *
 * Proves the lifecycle fix in `clearAuthenticatedClientState` (shared by
 * useLogout and AuthBootstrapper.clearSession). No hard reload.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  useAuthStore,
  useTenantStore,
  useRbacStore,
  useBranchStore,
  useCartStore,
  useDineInStore,
  useRecentlyViewedStore,
} from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { clearAuthenticatedClientState } from '@/lib/auth-session-teardown'
import {
  setActiveTenantSlugForRequests,
  resolveTenantSlugForApi,
} from '@/lib/tenant-request-context'
import { clearTokens, setTokens } from '@/services/axios.instance'
import { MOCK_TENANT_ID } from '@/config/mock-data'
import { MOCK_BREW_CAFE_TENANT_ID } from '@/lib/mock-console-memberships'
import type { Tenant, Branch } from '@/types'
import type { Branch as AdminBranch } from '@/types/branch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.samoon.test')
// Prevent resolveTenantSlugForApi from falling through to env after clear
vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', '')

const tenantA: Tenant = {
  id: MOCK_TENANT_ID,
  name: 'Samoon Restaurant',
  slug: 'samoon',
  businessTypes: ['restaurant'],
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
}

const tenantB: Tenant = {
  id: MOCK_BREW_CAFE_TENANT_ID,
  name: 'Brew Cafe',
  slug: 'brew-cafe',
  businessTypes: ['cafe'],
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
}

const branchA: AdminBranch = {
  id: 'branch-rest-01',
  name: 'Main Branch',
  slug: 'main',
  tenantId: MOCK_TENANT_ID,
  status: 'active',
} as AdminBranch

const storefrontBranchA: Branch = {
  id: 'branch-rest-01',
  name: 'Main Branch',
  slug: 'main',
} as Branch

/** Legacy logout sequence (pre-fix) — missing tenant/slug/storefront branch teardown. */
function legacyLogoutMissingTenantReset(qc: QueryClient) {
  useAuthStore.getState().logout()
  clearTokens()
  useRbacStore.getState()._resetStore()
  useConsoleWorkspaceStore.getState().resetWorkspace()
  useBranchStore.getState().setAdminActiveBranch(null)
  useDineInStore.getState().clearTable()
  useRecentlyViewedStore.getState().clear()
  qc.clear()
}

function seedUserAAuthenticatedState() {
  setTokens('access-a', 'refresh-a')
  useAuthStore.getState().setUser({
    id: 'user-a',
    email: 'owner@samoon.com',
    accountType: 'business',
  } as never)
  useTenantStore.setState({
    tenant: tenantA,
    tenantState: 'resolved',
    isLoading: false,
    rbacInitialized: true,
    featureFlagsInitialized: true,
  })
  setActiveTenantSlugForRequests('samoon')
  useRbacStore.getState().setSessionMemberships(
    [
      {
        tenantId: MOCK_TENANT_ID,
        tenantName: 'Samoon Restaurant',
        tenantSlug: 'samoon',
        roles: ['owner'],
        branchAccess: { scope: 'all' },
        branches: [],
        status: 'active',
      },
    ],
    { tenantId: MOCK_TENANT_ID, branchId: 'branch-rest-01' },
  )
  useBranchStore.setState({
    selectedBranch: branchA,
    selectedBranchId: branchA.id,
    adminActiveBranch: branchA,
    branchState: 'ready',
    branches: [branchA],
    activeBranch: storefrontBranchA,
  })
  useConsoleWorkspaceStore.setState({
    selectedTenantId: MOCK_TENANT_ID,
    workspacePhase: 'ready',
    _bootstrapped: true,
  })
}

beforeEach(() => {
  clearTokens()
  setActiveTenantSlugForRequests(undefined)
  useAuthStore.getState().setUser(null)
  useRbacStore.getState()._resetStore()
  useTenantStore.getState().reset()
  useConsoleWorkspaceStore.getState().resetWorkspace()
  useBranchStore.getState().resetBranchResolution()
  useBranchStore.setState({ activeBranch: null })
  useCartStore.getState().clearCart()
})

afterEach(() => {
  vi.restoreAllMocks()
  clearTokens()
  setActiveTenantSlugForRequests(undefined)
})

describe('Auth boundary — legacy gap (User A state survives incomplete logout)', () => {
  it('proves the pre-fix logout left tenant + request slug for User B to inherit', () => {
    const qc = new QueryClient()
    seedUserAAuthenticatedState()
    expect(useTenantStore.getState().tenant?.id).toBe(MOCK_TENANT_ID)
    expect(resolveTenantSlugForApi()).toBe('samoon')

    legacyLogoutMissingTenantReset(qc)

    // Auth/RBAC cleared…
    expect(useAuthStore.getState().user).toBeNull()
    expect(useRbacStore.getState().sessionMemberships).toBeNull()
    // …but tenant + slug + storefront branch survived — this is the bug.
    expect(useTenantStore.getState().tenant?.id).toBe(MOCK_TENANT_ID)
    expect(useTenantStore.getState().tenantState).toBe('resolved')
    expect(resolveTenantSlugForApi()).toBe('samoon')
    expect(useBranchStore.getState().activeBranch?.id).toBe('branch-rest-01')
  })
})

describe('Auth boundary — clearAuthenticatedClientState (User A → logout → User B)', () => {
  it('clears tenant, slug, admin branch, storefront branch, and workspace on logout', () => {
    const qc = new QueryClient()
    seedUserAAuthenticatedState()
    // The cart needs a branch context; without branch_id addItem() rejects
    // with missing_context and the "cart preserved" assertion is vacuous.
    const added = useCartStore.getState().addItem(
      { id: 'item-a', branch_id: 'branch-rest-01', name: 'A', price: 10, category: 'x', description: '', image: '' } as never,
      1,
    )
    expect(added.ok).toBe(true)

    clearAuthenticatedClientState({ queryClient: qc })

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useRbacStore.getState().sessionMemberships).toBeNull()
    expect(useRbacStore.getState().activeMembership).toBeNull()
    expect(useTenantStore.getState().tenant).toBeNull()
    expect(useTenantStore.getState().tenantState).toBe('loading')
    expect(resolveTenantSlugForApi()).toBeUndefined()
    expect(useBranchStore.getState().selectedBranch).toBeNull()
    expect(useBranchStore.getState().adminActiveBranch).toBeNull()
    expect(useBranchStore.getState().activeBranch).toBeNull()
    expect(useBranchStore.getState().branchState).toBe('idle')
    expect(useConsoleWorkspaceStore.getState().selectedTenantId).toBeNull()
    expect(useConsoleWorkspaceStore.getState().workspacePhase).toBe('idle')
    expect(useConsoleWorkspaceStore.getState()._bootstrapped).toBe(false)
    // Cart intentionally preserved across auth boundary
    expect(useCartStore.getState().items.length).toBeGreaterThan(0)
  })

  it('User B login after teardown cannot reuse User A tenant/slug; seeds only B membership', () => {
    const qc = new QueryClient()
    seedUserAAuthenticatedState()
    clearAuthenticatedClientState({ queryClient: qc })

    // After teardown, no User A tenant/slug remains
    expect(useTenantStore.getState().tenant).toBeNull()
    expect(resolveTenantSlugForApi()).toBeUndefined()

    // Simulate User B session hydration (establishAuthenticatedSession shape)
    useAuthStore.getState().setUser({
      id: 'user-b',
      email: 'cashier@brew.com',
      accountType: 'business',
    } as never)
    useRbacStore.getState().setSessionMemberships(
      [
        {
          tenantId: MOCK_BREW_CAFE_TENANT_ID,
          tenantName: 'Brew Cafe',
          tenantSlug: 'brew-cafe',
          roles: ['cashier'],
          branchAccess: { scope: 'selected', branchIds: ['branch-brewcafe-01'] },
          branches: [],
          status: 'active',
        },
      ],
      { tenantId: MOCK_BREW_CAFE_TENANT_ID, branchId: 'branch-brewcafe-01' },
    )
    // Correct seed key = activeMembership.tenantId (not leftover store tenant)
    const seedTenantId = useRbacStore.getState().activeMembership?.tenantId
    expect(seedTenantId).toBe(MOCK_BREW_CAFE_TENANT_ID)
    // setSessionMemberships may publish B's slug for API headers — never A's
    expect(resolveTenantSlugForApi()).not.toBe('samoon')

    // Console workspace would load Tenant B fresh — not early-return on Tenant A
    useTenantStore.setState({
      tenant: tenantB,
      tenantState: 'resolved',
      isLoading: false,
    })
    setActiveTenantSlugForRequests('brew-cafe')

    expect(useTenantStore.getState().tenant?.id).toBe(MOCK_BREW_CAFE_TENANT_ID)
    expect(useTenantStore.getState().tenant?.id).not.toBe(MOCK_TENANT_ID)
    expect(resolveTenantSlugForApi()).toBe('brew-cafe')
    expect(useAuthStore.getState().user?.email).toBe('cashier@brew.com')
  })

  it('User B → logout → User A also clears B before A hydrates', () => {
    const qc = new QueryClient()
    useTenantStore.setState({ tenant: tenantB, tenantState: 'resolved', isLoading: false })
    setActiveTenantSlugForRequests('brew-cafe')
    useAuthStore.getState().setUser({ id: 'user-b', email: 'b@x.com', accountType: 'business' } as never)

    clearAuthenticatedClientState({ queryClient: qc })
    expect(useTenantStore.getState().tenant).toBeNull()
    expect(resolveTenantSlugForApi()).toBeUndefined()

    useAuthStore.getState().setUser({ id: 'user-a', email: 'a@x.com', accountType: 'business' } as never)
    useTenantStore.setState({ tenant: tenantA, tenantState: 'resolved', isLoading: false })
    setActiveTenantSlugForRequests('samoon')
    expect(useTenantStore.getState().tenant?.slug).toBe('samoon')
  })
})

describe('Auth boundary — wiring', () => {
  it('useLogout and AuthBootstrapper clearSession call clearAuthenticatedClientState', () => {
    const hooksSrc = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const providersSrc = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    const logoutStart = hooksSrc.indexOf('export function useLogout')
    const logoutBody = hooksSrc.slice(logoutStart, logoutStart + 600)
    expect(logoutBody).toContain('clearAuthenticatedClientState')
    expect(providersSrc).toContain('clearAuthenticatedClientState({ queryClient: qc })')
  })

  it('establishAuthenticatedSession seeds against activeMembership.tenantId, not leftover store tenant', () => {
    const hooksSrc = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const start = hooksSrc.indexOf('async function establishAuthenticatedSession')
    const body = hooksSrc.slice(start, start + 1200)
    expect(body).toContain('data.activeMembership?.tenantId')
    expect(body).toContain('seedTenantSession(seedTenantId')
    expect(body).not.toMatch(/const tenant = useTenantStore\.getState\(\)\.tenant/)
  })
})
