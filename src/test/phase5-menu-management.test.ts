/**
 * Phase 5.3 — Admin Menu Management Tests
 *
 * Verifies:
 *   A. No MOCK_MENU_ITEMS dependency remains
 *   B. No MOCK_CATEGORIES dependency remains
 *   C. useMenuItems integrated
 *   D. useCategories integrated
 *   E. useCreateMenuItem integrated
 *   F. useUpdateMenuItem integrated
 *   G. useDeleteMenuItem integrated
 *   H. Loading state exists
 *   I. Error state exists
 *   J. Empty state exists
 *   K. Query invalidation exists in hooks
 *   L. Availability toggle uses mutation
 *
 * Regression:
 *   - Customer menu pages unchanged
 *   - Menu search unchanged
 *   - Featured items unchanged
 *   - Categories unchanged
 *   - Admin auth unchanged
 *   - P5.1/P5.2 hooks unchanged
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../')
function src(rel: string) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }

const page = src('src/app/console/menu/page.tsx')
const hooks = src('src/hooks/index.ts')

// ── A. No MOCK_MENU_ITEMS ─────────────────────────────────────────────────────

describe('Admin menu page — no MOCK_MENU_ITEMS', () => {
  it('A: does not import MOCK_MENU_ITEMS', () => {
    expect(page).not.toContain('MOCK_MENU_ITEMS')
  })

  it('A: does not import from @/lib/mock-data', () => {
    expect(page).not.toMatch(/from '@\/lib\/mock-data'/)
  })
})

// ── B. No MOCK_CATEGORIES ─────────────────────────────────────────────────────

describe('Admin menu page — no MOCK_CATEGORIES', () => {
  it('B: does not contain MOCK_CATEGORIES', () => {
    expect(page).not.toContain('MOCK_CATEGORIES')
  })
})

// ── C. useMenuItems integrated ────────────────────────────────────────────────

describe('Admin menu page — useMenuItems', () => {
  it('C: imports useMenuItems', () => {
    expect(page).toMatch(/useMenuItems/)
  })

  it('C: consumes itemsData.results', () => {
    expect(page).toMatch(/itemsData\?\.results/)
  })
})

// ── D. useCategories integrated ───────────────────────────────────────────────

describe('Admin menu page — useCategories', () => {
  it('D: imports useCategories', () => {
    expect(page).toMatch(/useCategories/)
  })

  it('D: renders categories from query result', () => {
    expect(page).toMatch(/categories.*map|\.map.*categories/)
  })
})

// ── E. useCreateMenuItem integrated ──────────────────────────────────────────

describe('Admin menu page — useCreateMenuItem', () => {
  it('E: imports useCreateMenuItem', () => {
    expect(page).toMatch(/useCreateMenuItem/)
  })

  it('E: calls createMutation.mutate', () => {
    expect(page).toMatch(/createMutation\.mutate/)
  })

  it('E: create modal closes on success', () => {
    expect(page).toMatch(/onSuccess.*setCreateOpen\(false\)|setCreateOpen\(false\)/)
  })
})

// ── F. useUpdateMenuItem integrated ──────────────────────────────────────────

describe('Admin menu page — useUpdateMenuItem', () => {
  it('F: imports useUpdateMenuItem', () => {
    expect(page).toMatch(/useUpdateMenuItem/)
  })

  it('F: calls updateMutation.mutate', () => {
    expect(page).toMatch(/updateMutation\.mutate/)
  })

  it('F: edit modal closes on success', () => {
    expect(page).toMatch(/onSuccess.*setEditOpen\(false\)|setEditOpen\(false\)/)
  })
})

// ── G. useDeleteMenuItem integrated ──────────────────────────────────────────

describe('Admin menu page — useDeleteMenuItem', () => {
  it('G: imports useDeleteMenuItem', () => {
    expect(page).toMatch(/useDeleteMenuItem/)
  })

  it('G: calls deleteMutation.mutate', () => {
    expect(page).toMatch(/deleteMutation\.mutate/)
  })

  it('G: delete confirmation dialog exists', () => {
    expect(page).toMatch(/deleteOpen|deleteTarget|Delete Item/)
  })

  it('G: confirmation closes on success', () => {
    expect(page).toMatch(/setDeleteOpen\(false\)/)
  })
})

// ── H. Loading state ──────────────────────────────────────────────────────────

describe('Admin menu page — loading state', () => {
  it('H: itemsLoading state used', () => {
    expect(page).toMatch(/itemsLoading/)
  })

  it('H: renders loading UI', () => {
    expect(page).toMatch(/itemsLoading\s*&&/)
  })

  it('H: uses Loader2 spinner', () => {
    expect(page).toContain('Loader2')
  })
})

// ── I. Error state ────────────────────────────────────────────────────────────

describe('Admin menu page — error state', () => {
  it('I: itemsError state used', () => {
    expect(page).toMatch(/itemsError/)
  })

  it('I: renders error UI', () => {
    expect(page).toMatch(/itemsError.*&&/)
  })

  it('I: error UI has retry affordance', () => {
    expect(page).toMatch(/Retry|refetch/)
  })
})

// ── J. Empty state ────────────────────────────────────────────────────────────

describe('Admin menu page — empty state', () => {
  it('J: empty state when filtered.length === 0', () => {
    expect(page).toMatch(/filtered\.length\s*===\s*0/)
  })

  it('J: empty state has user-facing message', () => {
    expect(page).toMatch(/t\('noItemsFound'\)/)
  })
})

// ── K. Query invalidation in hooks ────────────────────────────────────────────

describe('Hooks — query invalidation', () => {
  // Branch-scoped invalidation (docs/BRANCH_MENU_IMPLEMENTATION.md): mutations
  // invalidate only the active branch's cached menu-items via a predicate
  // keyed on branchId, never a blanket ['menu-items'] prefix.
  it('K: useCreateMenuItem invalidates menu-items scoped to the branch', () => {
    expect(hooks).toMatch(/export function useCreateMenuItem[\s\S]{0,400}invalidateBranchMenuItemsQueries/)
  })

  it('K: useUpdateMenuItem invalidates menu-items scoped to the branch', () => {
    expect(hooks).toMatch(/export function useUpdateMenuItem[\s\S]{0,1200}invalidateBranchMenuItemsQueries/)
  })

  it('K: useDeleteMenuItem invalidates menu-items scoped to the branch', () => {
    expect(hooks).toMatch(/export function useDeleteMenuItem[\s\S]{0,1000}invalidateBranchMenuItemsQueries/)
  })
})

// ── L. Availability toggle uses mutation ──────────────────────────────────────

describe('Admin menu page — availability toggle', () => {
  it('L: toggleAvailable calls updateMutation', () => {
    expect(page).toMatch(/toggleAvailable[\s\S]{0,200}updateMutation\.mutate/)
  })

  it('L: optimistic update in useUpdateMenuItem hook', () => {
    const block = hooks.slice(hooks.indexOf('useUpdateMenuItem'))
    expect(block.slice(0, 800)).toMatch(/onMutate|setQueriesData/)
  })

  it('L: rollback on error in useUpdateMenuItem', () => {
    const block = hooks.slice(hooks.indexOf('useUpdateMenuItem'))
    expect(block.slice(0, 800)).toMatch(/onError/)
  })
})

// ── Hooks — optimistic updates for delete ────────────────────────────────────

describe('Hooks — useDeleteMenuItem optimistic update', () => {
  it('has onMutate for optimistic removal', () => {
    const block = hooks.slice(hooks.indexOf('useDeleteMenuItem'))
    expect(block.slice(0, 600)).toMatch(/onMutate/)
  })

  it('has onError for rollback', () => {
    const block = hooks.slice(hooks.indexOf('useDeleteMenuItem'))
    expect(block.slice(0, 900)).toMatch(/onError/)
  })

  it('filters item out optimistically', () => {
    const block = hooks.slice(hooks.indexOf('useDeleteMenuItem'))
    expect(block.slice(0, 600)).toMatch(/filter/)
  })
})

// ── Mock compatibility ────────────────────────────────────────────────────────

describe('Mock mode compatibility', () => {
  it('menuService.createItem works in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { menuService } = await import('@/services/menu.service')
    const item = await menuService.createItem('main', { name: 'Test Burger', price: 9.99 })
    expect(item.name).toBe('Test Burger')
    expect(item.price).toBe(9.99)
    expect(item.id).toBeTruthy()
  })

  it('menuService.updateItem works in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { menuService } = await import('@/services/menu.service')
    const item = await menuService.updateItem('main', '1', { available: false })
    expect(item.available).toBe(false)
  })

  it('menuService.deleteItem resolves in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { menuService } = await import('@/services/menu.service')
    await expect(menuService.deleteItem('main', '1')).resolves.toBeUndefined()
  })

  it('menuService.getItems returns paginated results in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { menuService } = await import('@/services/menu.service')
    const result = await menuService.getItems('main')
    expect(result).toHaveProperty('results')
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.count).toBeGreaterThan(0)
  })
})

// ── Regression: customer menu pages ──────────────────────────────────────────

describe('Regression — customer menu pages', () => {
  it('customer menu page still exists', () => {
    const menuPage = src('src/app/menu/page.tsx')
    expect(menuPage.length).toBeGreaterThan(0)
  })

  it('customer menu page renders MenuContent, which uses useMenuItems', () => {
    // src/app/menu/page.tsx is branch-agnostic (no [branchSlug] segment), so it
    // no longer prefetches menu data itself — it delegates to MenuContent,
    // which resolves branch scope from useBranchStore. See
    // docs/BRANCH_MENU_IMPLEMENTATION.md.
    const menuPage = src('src/app/menu/page.tsx')
    expect(menuPage).toMatch(/MenuContent/)
    const menuContent = src('src/components/menu/MenuContent.tsx')
    expect(menuContent).toMatch(/useMenuItems|menuService/)
  })
})

// ── Regression: menu hooks ────────────────────────────────────────────────────

describe('Regression — menu hooks', () => {
  it('useMenuItems still present', () => {
    expect(hooks).toMatch(/export function useMenuItems/)
  })

  it('useCategories still present', () => {
    expect(hooks).toMatch(/export function useCategories/)
  })

  it('useMenuItem (single) still present', () => {
    expect(hooks).toMatch(/export function useMenuItem\b/)
  })
})

// ── Regression: admin auth guard ─────────────────────────────────────────────

describe('Regression — admin auth guard', () => {
  it('admin layout unchanged', () => {
    const layout = src('src/app/console/layout.tsx')
    expect(layout).toMatch(/dashboard:access/)
  })
})

// ── Regression: P5.1/P5.2 hooks ──────────────────────────────────────────────

describe('Regression — P5.1/P5.2 hooks', () => {
  it('useAdminOrders still present', () => {
    expect(hooks).toMatch(/export function useAdminOrders/)
  })

  it('useUpdateOrderStatus still present', () => {
    expect(hooks).toMatch(/export function useUpdateOrderStatus/)
  })

  it('useAdminStats still present', () => {
    expect(hooks).toMatch(/export function useAdminStats/)
  })
})
