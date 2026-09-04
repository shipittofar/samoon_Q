/**
 * Phase 5.5 — Admin Customers Management
 *
 * Console list uses GET /orders/console-orders/tenants/{tenantId}/customers/
 * with branch_id, search, page, page_size. Loyalty tier and spend stats are
 * not provided by that API and must not be faked from the current page.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../')
function src(rel: string) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }

const page = src('src/app/console/customers/page.tsx')
const hooks = src('src/hooks/index.ts')
const types = src('src/types/index.ts')
const adminServiceSrc = src('src/services/admin.service.ts')
const endpoints = src('src/services/endpoints.ts')
const workspaceHooks = src('src/hooks/console-workspace.ts')

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

describe('Admin customers page — useAdminCustomers', () => {
  it('B: imports useAdminCustomers', () => {
    expect(page).toMatch(/useAdminCustomers/)
  })

  it('B: calls useAdminCustomers with memoized filters', () => {
    expect(page).toMatch(/useAdminCustomers\s*\(\s*filters/)
  })

  it('B: consumes data.results', () => {
    expect(page).toMatch(/data\?\.results/)
  })

  it('B: hook definition exists in hooks/index.ts', () => {
    expect(hooks).toMatch(/export function useAdminCustomers/)
  })
})

describe('Admin customers page — ConsoleCustomer list fields', () => {
  it('C: uses orders_count (not order_count or c.orders)', () => {
    expect(page).toMatch(/orders_count/)
    expect(page).not.toMatch(/order_count/)
    expect(page).not.toMatch(/c\.orders\b/)
  })

  it('C: uses reservations_count', () => {
    expect(page).toMatch(/reservations_count/)
  })

  it('C: uses last_activity_at', () => {
    expect(page).toMatch(/last_activity_at/)
  })

  it('C: does not render spend/AOV/joined from the list DTO', () => {
    expect(page).not.toMatch(/total_spent/)
    expect(page).not.toMatch(/avg_order_value/)
    expect(page).not.toMatch(/c\.created_at/)
  })

  it('C: ConsoleCustomer type is defined', () => {
    expect(types).toMatch(/export interface ConsoleCustomer/)
    expect(types).toMatch(/orders_count:\s*number/)
    expect(types).toMatch(/reservations_count:\s*number/)
    expect(types).toMatch(/last_activity_at/)
  })
})

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

describe('Admin customers page — loading state', () => {
  it('E: isLoading from useAdminCustomers', () => {
    expect(page).toMatch(/isLoading/)
  })

  it('E: renders loading UI', () => {
    expect(page).toMatch(/showLoading/)
  })

  it('E: stats cards show placeholder when loading', () => {
    expect(page).toMatch(/showLoading \? '—'/)
  })
})

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

describe('Admin customers page — empty state', () => {
  it('G: empty state when customers.length === 0', () => {
    expect(page).toMatch(/customers\.length\s*===\s*0/)
  })

  it('G: empty state has user-facing message', () => {
    expect(page).toMatch(/t\('noCustomersFound'\)/)
  })
})

describe('Admin customers page — search filter', () => {
  it('H: search state exists', () => {
    expect(page).toMatch(/const \[search.*useState/)
  })

  it('H: search is debounced (Users-page pattern)', () => {
    expect(page).toMatch(/debouncedSearch/)
    expect(page).toMatch(/setTimeout\(\s*\(\)\s*=>\s*setDebouncedSearch\(search\.trim\(\)\),\s*300\)/)
  })

  it('H: debounced search wired into memoized filters', () => {
    expect(page).toMatch(/debouncedSearch \? \{ search: debouncedSearch \}/)
  })

  it('H: memoized filters object used', () => {
    expect(page).toMatch(/useMemo/)
  })
})

describe('Admin customers page — tier filter isolated from API', () => {
  it('I: tierFilter state exists', () => {
    expect(page).toMatch(/tierFilter/)
  })

  it('I: TIERS array uses AdminCustomerTier values', () => {
    expect(page).toMatch(/vip.*regular.*new|new.*regular.*vip/)
  })

  it('I: AdminCustomerTier imported from @/types', () => {
    expect(page).toMatch(/AdminCustomerTier/)
  })

  it('I: tier is not passed in list filters to the customer API', () => {
    const filtersBlock = page.slice(page.indexOf('const filters = useMemo'), page.indexOf('useAdminCustomers'))
    expect(filtersBlock).not.toMatch(/tier/)
  })

  it('I: selecting a tier shows an unavailable notice instead of fake filtering', () => {
    expect(page).toMatch(/tierFilterUnavailable/)
  })
})

describe('Admin customers page — pagination', () => {
  it('J: page and page_size are sent in filters', () => {
    expect(page).toMatch(/page_size:\s*ADMIN_CUSTOMERS_PAGE_SIZE/)
    expect(page).toMatch(/const \[page, setPage\]/)
  })

  it('J: PaginationControls is used', () => {
    expect(page).toMatch(/PaginationControls/)
  })

  it('J: page resets when search, tenant, branch, or All Branches scope changes', () => {
    expect(page).toMatch(/setPage\(1\)/)
    expect(page).toMatch(/customersScope, activeTenantId, selectedBranchId, debouncedSearch/)
  })
})

describe('Admin customers page — analytics honesty', () => {
  it('K: total customers uses data.count for the current scope', () => {
    expect(page).toMatch(/data\?\.count/)
    expect(page).toMatch(/totalCount/)
  })

  it('K: does not sum current-page spend for revenue', () => {
    expect(page).not.toMatch(/total_spent/)
    expect(page).not.toMatch(/reduce\(\(s, c\) => s \+ c\.total_spent/)
  })

  it('K: VIP/revenue/AOV use explicit unavailable state', () => {
    expect(page).toMatch(/customerStatUnavailable/)
  })
})

describe('API contract — console customers endpoint', () => {
  it('defines CONSOLE_CUSTOMERS next to other console-orders helpers', () => {
    expect(endpoints).toMatch(/CONSOLE_CUSTOMERS:\s*\(tenantId:\s*string\)\s*=>/)
    expect(endpoints).toMatch(/\/orders\/console-orders\/tenants\/\$\{tenantId\}\/customers\//)
  })

  it('getCustomers live path uses CONSOLE_CUSTOMERS, not /admin/customers/', () => {
    const fn = adminServiceSrc.slice(adminServiceSrc.indexOf('async getCustomers'))
    const live = fn.slice(0, fn.indexOf('async getCustomer('))
    expect(live).toMatch(/ENDPOINTS\.ORDERS\.CONSOLE_CUSTOMERS/)
    expect(live).not.toMatch(/ENDPOINTS\.ADMIN\.CUSTOMERS/)
  })

  it('live params include branch_id, search, page, page_size and exclude tier', () => {
    const start = adminServiceSrc.indexOf('function buildConsoleCustomerListParams')
    const end = adminServiceSrc.indexOf('export const ADMIN_ORDERS_PAGE_SIZE', start)
    const builder = adminServiceSrc.slice(start, end)
    expect(builder).toMatch(/params\.branch_id = branchId/)
    expect(builder).toMatch(/params\.search = filters\.search/)
    expect(builder).toMatch(/params\.page = filters\.page/)
    expect(builder).toMatch(/params\.page_size = filters\.page_size/)
    expect(builder).not.toMatch(/tier/)
  })

  it('useAdminCustomers query key matches Orders scoped/global convention', () => {
    const block = hooks.slice(hooks.indexOf('export function useAdminCustomers'))
    expect(block).toMatch(/options: \{ scope\?: AdminOrdersScope \}/)
    expect(block).toMatch(/\['admin-customers', scope, tenantId, branchId, filters\]/)
    expect(block).toMatch(/\['admin-customers', scope, tenantId, filters\]/)
    expect(block).toMatch(/enabled:\s*scoped \? !!\(tenantId && branchId\) : !!tenantId/)
    expect(block).toMatch(/scoped \? \{ branchId: branchId \?\? undefined \} : \{\}/)
  })

  it('admin-customers is branch-scoped for workspace invalidation', () => {
    expect(workspaceHooks).toMatch(/'admin-customers'/)
  })
})

describe('Customers page — Orders-style branch / all-branches scope', () => {
  it('uses allCustomersMode + AdminOrdersScope like orders allOrdersMode', () => {
    expect(page).toMatch(/allCustomersMode/)
    expect(page).toMatch(/setAllCustomersMode/)
    expect(page).toMatch(/customersScope: AdminOrdersScope/)
    expect(page).toMatch(/allCustomersMode \? 'global' : 'scoped'/)
  })

  it('passes scope into useAdminCustomers', () => {
    expect(page).toMatch(/useAdminCustomers\(filters, \{ scope: customersScope \}\)/)
  })

  it('does not add an in-page branch dropdown', () => {
    expect(page).not.toMatch(/filterByBranchAria/)
    expect(page).not.toMatch(/useAdminBranches/)
    expect(page).not.toMatch(/<select/)
  })

  it('reuses This Branch / All Branches labels from existing console copy', () => {
    expect(page).toMatch(/t\('ordersScopeBranch'\)/)
    expect(page).toMatch(/t\('allBranches'\)/)
  })

  it('waits for workspace branch only in scoped mode', () => {
    expect(page).toMatch(/awaitingScope = !allCustomersMode && \(!activeTenantId \|\| !selectedBranchId\)/)
    expect(page).toMatch(/!allCustomersMode && \(tenantLoading \|\| branchLoading\)/)
  })

  it('live params omit fake All Branches branch_id values', () => {
    const start = adminServiceSrc.indexOf('function resolveConsoleCustomerBranchId')
    const end = adminServiceSrc.indexOf('export const ADMIN_ORDERS_PAGE_SIZE', start)
    const builder = adminServiceSrc.slice(start, end)
    expect(builder).toMatch(/value === 'all'/)
    expect(builder).toMatch(/value === '0'/)
    expect(builder).toMatch(/value === 'null'/)
    expect(builder).toMatch(/value === 'undefined'/)
    expect(builder).toMatch(/params\.branch_id = branchId/)
  })
})

describe('Mock mode compatibility', () => {
  it('adminService.getCustomers returns paginated results', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers()
    expect(result).toHaveProperty('results')
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.count).toBeGreaterThan(0)
  })

  it('adminService.getCustomers ignores tier (not a list API param)', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const all = await adminService.getCustomers({ tenantId: 'tenant-samoon-01' })
    const withTier = await adminService.getCustomers({ tenantId: 'tenant-samoon-01', tier: 'vip' })
    expect(withTier.count).toBe(all.count)
  })

  it('adminService.getCustomers filters by search', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers({ search: 'alice' })
    expect(result.results.length).toBeGreaterThan(0)
    result.results.forEach((c) =>
      expect(`${c.first_name} ${c.last_name} ${c.email}`.toLowerCase()).toMatch(/alice/),
    )
  })

  it('adminService.getCustomers paginates with page and page_size', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const page1 = await adminService.getCustomers({ tenantId: 'tenant-samoon-01', page: 1, page_size: 5 })
    expect(page1.results.length).toBeLessThanOrEqual(5)
    expect(page1.count).toBeGreaterThan(page1.results.length)
  })

  it('adminService.getCustomers scopes by branch_id', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const tenant = await adminService.getCustomers({ tenantId: 'tenant-samoon-01' })
    const branch = await adminService.getCustomers({ tenantId: 'tenant-samoon-01', branchId: 'branch-rest-01' })
    expect(branch.count).toBeGreaterThan(0)
    expect(branch.count).toBeLessThan(tenant.count)
  })

  it('adminService.getCustomers omits fake All Branches branch_id values', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const tenant = await adminService.getCustomers({ tenantId: 'tenant-samoon-01' })
    const asAll = await adminService.getCustomers({ tenantId: 'tenant-samoon-01', branchId: 'all' })
    expect(asAll.count).toBe(tenant.count)
  })

  it('adminService.getCustomerStats returns typed stats', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const stats = await adminService.getCustomerStats('u1')
    expect(stats).toHaveProperty('customer_id', 'u1')
    expect(typeof stats.order_count).toBe('number')
    expect(typeof stats.total_spent).toBe('number')
  })

  it('ConsoleCustomer has required list fields in mock data', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers()
    const customer = result.results[0]
    expect(customer).toHaveProperty('orders_count')
    expect(customer).toHaveProperty('reservations_count')
    expect(customer).toHaveProperty('last_activity_at')
    expect(typeof customer.id).toBe('number')
    expect(customer).not.toHaveProperty('tier')
    expect(customer).not.toHaveProperty('total_spent')
  })
})

describe('Backend blockers — documented in page', () => {
  it('page uses PermissionGuard for customers.view', () => {
    expect(page).toMatch(/PermissionGuard|customers\.view/)
  })
})

describe('Regression — user-related hooks', () => {
  it('useAddresses hook still present', () => {
    expect(hooks).toMatch(/useAddresses/)
  })

  it('useFavoritesList hook still exported', () => {
    expect(hooks).toMatch(/useFavoritesList/)
  })
})

describe('Regression — admin auth guard', () => {
  it('admin layout still enforces dashboard:access', () => {
    const layout = src('src/app/console/layout.tsx')
    expect(layout).toMatch(/dashboard:access/)
  })
})

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
