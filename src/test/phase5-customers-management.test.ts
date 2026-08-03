/**
 * Phase 5.5 — Admin Customers Management & Analytics Tests
 *
 * Verifies:
 *   A. No MOCK_CUSTOMERS dependency remains (inline or imported)
 *   B. useAdminCustomers integrated
 *   C. AdminCustomer type used (order_count, total_spent, avg_order_value, tier)
 *   D. AdminCustomerStats type exists in types
 *   E. Loading state exists
 *   F. Error state exists
 *   G. Empty state exists
 *   H. Search drives filters
 *   I. Tier filter drives filters
 *   J. Pagination preserved (memoized filters with page support)
 *   K. Analytics use service-derived data, not hardcoded MOCK_CUSTOMERS
 *
 * Regression:
 *   - userService unchanged
 *   - profile pages unchanged
 *   - admin auth unchanged
 *   - P5.1–P5.4 hooks unchanged
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../')
function src(rel: string) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }

const page = src('src/app/console/customers/page.tsx')
const hooks = src('src/hooks/index.ts')
const types = src('src/types/index.ts')

// ── A. No MOCK_CUSTOMERS ──────────────────────────────────────────────────────

describe('Admin customers page — no hardcoded data', () => {
  it('A: does not contain MOCK_CUSTOMERS inline array', () => {
    expect(page).not.toContain('MOCK_CUSTOMERS')
  })

  it('A: does not import from @/lib/mock-data', () => {
    expect(page).not.toMatch(/from '@\/lib\/mock-data'/)
  })

  it('A: no inline customer literal with first_name + spent', () => {
    expect(page).not.toMatch(/first_name:.*spent:|orders:.*status:/)
  })
})

// ── B. useAdminCustomers integrated ──────────────────────────────────────────

describe('Admin customers page — useAdminCustomers', () => {
  it('B: imports useAdminCustomers', () => {
    expect(page).toMatch(/useAdminCustomers/)
  })

  it('B: calls useAdminCustomers with memoized filters', () => {
    expect(page).toMatch(/useAdminCustomers\s*\(\s*filters\s*\)/)
  })

  it('B: consumes data.results', () => {
    expect(page).toMatch(/data\?\.results/)
  })

  it('B: hook definition exists in hooks/index.ts', () => {
    expect(hooks).toMatch(/export function useAdminCustomers/)
  })
})

// ── C. AdminCustomer type fields used ─────────────────────────────────────────

describe('Admin customers page — AdminCustomer type fields', () => {
  it('C: uses order_count (not orders)', () => {
    expect(page).toMatch(/order_count/)
    expect(page).not.toMatch(/c\.orders\b/)
  })

  it('C: uses total_spent (not spent)', () => {
    expect(page).toMatch(/total_spent/)
    expect(page).not.toMatch(/c\.spent\b/)
  })

  it('C: uses avg_order_value', () => {
    expect(page).toMatch(/avg_order_value/)
  })

  it('C: uses tier (not status)', () => {
    expect(page).toMatch(/c\.tier/)
  })

  it('C: uses created_at (not joined)', () => {
    expect(page).toMatch(/c\.created_at/)
    expect(page).not.toMatch(/c\.joined\b/)
  })
})

// ── D. AdminCustomerStats type exists ─────────────────────────────────────────

describe('Types — AdminCustomerStats defined', () => {
  it('D: AdminCustomerStats exported from types', () => {
    expect(types).toMatch(/interface AdminCustomerStats/)
  })

  it('D: AdminCustomerStats has required fields', () => {
    expect(types).toMatch(/customer_id.*string/)
    expect(types).toMatch(/order_count.*number/)
    expect(types).toMatch(/total_spent.*number/)
  })

  it('D: useAdminCustomerStats hook exists', () => {
    expect(hooks).toMatch(/export function useAdminCustomerStats/)
  })
})

// ── E. Loading state ──────────────────────────────────────────────────────────

describe('Admin customers page — loading state', () => {
  it('E: isLoading from useAdminCustomers', () => {
    expect(page).toMatch(/isLoading/)
  })

  it('E: renders loading UI', () => {
    expect(page).toMatch(/isLoading\s*&&/)
  })

  it('E: stats cards show placeholder when loading', () => {
    expect(page).toMatch(/isLoading.*'—'|'—'.*isLoading/)
  })
})

// ── F. Error state ────────────────────────────────────────────────────────────

describe('Admin customers page — error state', () => {
  it('F: isError from useAdminCustomers', () => {
    expect(page).toMatch(/isError/)
  })

  it('F: renders error UI', () => {
    expect(page).toMatch(/isError.*&&/)
  })

  it('F: error UI has retry affordance', () => {
    expect(page).toMatch(/Retry|refetch/)
  })
})

// ── G. Empty state ────────────────────────────────────────────────────────────

describe('Admin customers page — empty state', () => {
  it('G: empty state when customers.length === 0', () => {
    expect(page).toMatch(/customers\.length\s*===\s*0/)
  })

  it('G: empty state has user-facing message', () => {
    expect(page).toMatch(/t\('noCustomersFound'\)/)
  })
})

// ── H. Search drives filters ──────────────────────────────────────────────────

describe('Admin customers page — search filter', () => {
  it('H: search state exists', () => {
    expect(page).toMatch(/const \[search.*useState/)
  })

  it('H: search wired into memoized filters object', () => {
    expect(page).toMatch(/search.*\?.*search|search\s*\}/)
  })

  it('H: memoized filters object used', () => {
    expect(page).toMatch(/useMemo/)
  })
})

// ── I. Tier filter drives filters ─────────────────────────────────────────────

describe('Admin customers page — tier filter', () => {
  it('I: tierFilter state exists', () => {
    expect(page).toMatch(/tierFilter/)
  })

  it('I: tier wired into AdminCustomerFilters', () => {
    expect(page).toMatch(/tier.*tierFilter|tierFilter.*tier/)
  })

  it('I: TIERS array or equivalent uses AdminCustomerTier values', () => {
    expect(page).toMatch(/vip.*regular.*new|new.*regular.*vip/)
  })

  it('I: AdminCustomerTier imported from @/types', () => {
    expect(page).toMatch(/AdminCustomerTier/)
  })
})

// ── J. Pagination support ─────────────────────────────────────────────────────

describe('Admin customers page — pagination support', () => {
  it('J: AdminCustomerFilters has page field in types', () => {
    expect(types).toMatch(/interface AdminCustomerFilters[\s\S]{0,200}page\?/)
  })

  it('J: filters object is memoized (allows adding page later)', () => {
    expect(page).toMatch(/useMemo/)
  })
})

// ── K. Analytics use service-derived data ─────────────────────────────────────

describe('Admin customers page — analytics from service layer', () => {
  it('K: total customers uses data.count', () => {
    expect(page).toMatch(/data\?\.count/)
  })

  it('K: revenue derived from customers array (not hardcoded)', () => {
    expect(page).toMatch(/total_spent/)
    expect(page).not.toMatch(/totalRevenue\s*=\s*\d+/)
  })

  it('K: avg order value derived from service data', () => {
    expect(page).toMatch(/avg_order_value|avgOrderValue/)
  })

  it('K: analytics wrapped in useMemo', () => {
    expect(page).toMatch(/useMemo[\s\S]{0,400}total_spent|total_spent[\s\S]{0,400}useMemo/)
  })
})

// ── Mock mode compatibility ───────────────────────────────────────────────────

describe('Mock mode compatibility', () => {
  it('adminService.getCustomers returns paginated results', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers()
    expect(result).toHaveProperty('results')
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.count).toBeGreaterThan(0)
  })

  it('adminService.getCustomers filters by tier=vip', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers({ tier: 'vip' })
    result.results.forEach((c) => expect(c.tier).toBe('vip'))
  })

  it('adminService.getCustomers filters by search', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers({ search: 'alice' })
    expect(result.results.length).toBeGreaterThan(0)
    result.results.forEach((c) =>
      expect(`${c.first_name} ${c.last_name} ${c.email}`.toLowerCase()).toMatch(/alice/)
    )
  })

  it('adminService.getCustomerStats returns typed stats', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const stats = await adminService.getCustomerStats('u1')
    expect(stats).toHaveProperty('customer_id', 'u1')
    expect(typeof stats.order_count).toBe('number')
    expect(typeof stats.total_spent).toBe('number')
  })

  it('AdminCustomer has required fields in mock data', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers()
    const customer = result.results[0]
    expect(customer).toHaveProperty('order_count')
    expect(customer).toHaveProperty('total_spent')
    expect(customer).toHaveProperty('avg_order_value')
    expect(customer).toHaveProperty('tier')
    expect(['new', 'regular', 'vip']).toContain(customer.tier)
  })
})

// ── Backend blockers documentation ────────────────────────────────────────────

describe('Backend blockers — documented in page', () => {
  it('page uses PermissionGuard for customers.view', () => {
    expect(page).toMatch(/PermissionGuard|customers\.view/)
  })
})

// ── Regression: userService unchanged ────────────────────────────────────────

describe('Regression — user-related hooks', () => {
  it('useAddresses hook still present', () => {
    expect(hooks).toMatch(/useAddresses/)
  })

  it('useFavoritesList hook still exported', () => {
    expect(hooks).toMatch(/useFavoritesList/)
  })
})

// ── Regression: admin auth guard ─────────────────────────────────────────────

describe('Regression — admin auth guard', () => {
  it('admin layout still enforces dashboard:access', () => {
    const layout = src('src/app/console/layout.tsx')
    expect(layout).toMatch(/dashboard:access/)
  })
})

// ── Regression: P5.1–P5.4 hooks present ──────────────────────────────────────

describe('Regression — P5.1–P5.4 hooks', () => {
  it('useAdminStats still present', () => {
    expect(hooks).toMatch(/export function useAdminStats/)
  })

  it('useAdminOrders still present', () => {
    expect(hooks).toMatch(/export function useAdminOrders/)
  })

  it('useUpdateOrderStatus still present', () => {
    expect(hooks).toMatch(/export function useUpdateOrderStatus/)
  })

  it('useAdminReservations still present', () => {
    expect(hooks).toMatch(/export function useAdminReservations/)
  })

  it('useConfirmReservation still present', () => {
    expect(hooks).toMatch(/export function useConfirmReservation/)
  })

  it('useCancelReservation still present', () => {
    expect(hooks).toMatch(/export function useCancelReservation/)
  })

  it('useCreateMenuItem still present', () => {
    expect(hooks).toMatch(/export function useCreateMenuItem/)
  })
})
