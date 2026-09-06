/**
 * Active cart ownership, conflict detection, persistence, and checkout branch identity.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { useCartStore, useBranchStore, useTenantStore } from '@/stores'
import { CART_KEY } from '@/constants'
import {
  canAddItem,
  coalesceCartOwnership,
  getActiveCartContext,
  hasOrderingConflict,
  isSameOrderingContext,
  resolveCartMenuUrl,
  resolveCheckoutBranchId,
} from '@/lib/active-cart'
import type { MenuItem } from '@/types'
import type { Branch } from '@/types'

const ROOT = join(__dirname, '..')

function menuItem(id: string, branchId: string): MenuItem {
  return {
    id,
    branch_id: branchId,
    name: `Item ${id}`,
    slug: id,
    description: '',
    price: 10,
    image: '/img.png',
    category_id: 'cat-1',
    available: true,
    is_active: true,
    preparation_time: 10,
    rating: 0,
    rating_count: 0,
    extras: [],
  }
}

const tenantA = {
  tenantId: 'tenant-a',
  tenantSlug: 'alpha',
  tenantName: 'Alpha Kitchen',
  branchId: 'branch-a',
  branchSlug: 'downtown',
  branchName: 'Downtown',
}

const tenantABranchB = {
  ...tenantA,
  branchId: 'branch-b',
  branchSlug: 'airport',
  branchName: 'Airport',
}

const tenantB = {
  tenantId: 'tenant-b',
  tenantSlug: 'bravo',
  tenantName: 'Bravo Cafe',
  branchId: 'branch-c',
  branchSlug: 'main',
  branchName: 'Main',
}

describe('Active cart architecture', () => {
  beforeEach(() => {
    localStorage.removeItem(CART_KEY)
    useCartStore.getState().clearCart()
    useCartStore.setState({ hasHydrated: true, isOpen: false, conflictOpen: false })
  })

  afterEach(() => {
    useCartStore.getState().clearCart()
    localStorage.removeItem(CART_KEY)
  })

  it('same branch: adding another item succeeds and keeps ownership', () => {
    const first = useCartStore.getState().addItem(menuItem('soup', 'branch-a'), 1, [], undefined, tenantA)
    const second = useCartStore.getState().addItem(menuItem('salad', 'branch-a'), 1, [], undefined, tenantA)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(useCartStore.getState().items).toHaveLength(2)
    expect(useCartStore.getState().ownership?.branchId).toBe('branch-a')
    expect(useCartStore.getState().ownership?.tenantId).toBe('tenant-a')
  })

  it('different branch: cart is unchanged, conflict is detected, no silent replacement', () => {
    useCartStore.getState().addItem(menuItem('soup', 'branch-a'), 2, [], undefined, tenantA)
    const before = useCartStore.getState().items
    const result = useCartStore.getState().addItem(menuItem('fries', 'branch-b'), 1, [], undefined, tenantABranchB)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('conflict')
    expect(useCartStore.getState().items).toEqual(before)
    expect(useCartStore.getState().items[0].quantity).toBe(2)
    expect(useCartStore.getState().conflictOpen).toBe(true)
    expect(hasOrderingConflict(before, useCartStore.getState().ownership, tenantABranchB)).toBe(true)
    expect(canAddItem(before, useCartStore.getState().ownership, tenantABranchB)).toBe(false)
  })

  it('different tenant: cart is unchanged and conflict is detected', () => {
    useCartStore.getState().addItem(menuItem('soup', 'branch-a'), 1, [], undefined, tenantA)
    const before = structuredClone(useCartStore.getState().items)
    const result = useCartStore.getState().addItem(menuItem('tea', 'branch-c'), 1, [], undefined, tenantB)
    expect(result.ok).toBe(false)
    if (result.ok === false && result.reason === 'conflict') {
      expect(result.ownership.tenantId).toBe('tenant-a')
    }
    expect(useCartStore.getState().items).toEqual(before)
    expect(useCartStore.getState().ownership?.tenantId).toBe('tenant-a')
  })

  it('navigation / tenant reset does not clear the cart', () => {
    useCartStore.getState().addItem(menuItem('soup', 'branch-a'), 1, [], undefined, tenantA)
    useTenantStore.getState().reset()
    useBranchStore.getState().setActiveBranch({
      id: 'branch-b',
      slug: 'airport',
      name: 'Airport',
      tenant_id: 'tenant-a',
      address: '',
      city: '',
      phone_number: '',
      lat: 0,
      lng: 0,
      working_hours: [],
      is_active: true,
    } as Branch)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().ownership?.branchId).toBe('branch-a')
  })

  it('setActiveBranch does not call clearCart', () => {
    const src = readFileSync(join(ROOT, 'stores', 'index.ts'), 'utf-8')
    const setter = src.slice(src.indexOf('setActiveBranch:'), src.indexOf('selectedBranch:'))
    expect(setter).not.toContain('clearCart')
  })

  it('global cart host is the only CartDrawer mount for storefront chrome', () => {
    const host = readFileSync(join(ROOT, 'components', 'cart', 'GlobalCartHost.tsx'), 'utf-8')
    const providers = readFileSync(join(ROOT, 'providers', 'index.tsx'), 'utf-8')
    const homepage = readFileSync(join(ROOT, 'app', '[tenantSlug]', 'TenantHomepageClient.tsx'), 'utf-8')
    expect(host).toContain('<CartDrawer')
    expect(providers).toContain('GlobalCartHost')
    expect(homepage).not.toContain('<CartDrawer')
  })

  it('reload: persist rehydrate restores ownership and items', async () => {
    const item = menuItem('soup', 'branch-a')
    const line = {
      id: `${item.id}-test`,
      branch_id: item.branch_id,
      menu_item: item,
      quantity: 2,
      extras: [] as [],
      unit_price: item.price,
      total_price: item.price * 2,
    }
    useCartStore.setState({
      items: [],
      ownership: null,
      discountCode: '',
      discountAmount: 0,
      isOpen: false,
      hasHydrated: false,
    })
    localStorage.setItem(
      CART_KEY,
      JSON.stringify({
        state: {
          items: [line],
          discountCode: '',
          discountAmount: 0,
          isOpen: false,
          ownership: tenantA,
        },
        version: 1,
      }),
    )
    await useCartStore.persist.rehydrate()
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(2)
    expect(useCartStore.getState().ownership?.tenantId).toBe('tenant-a')
    expect(useCartStore.getState().ownership?.branchId).toBe('branch-a')
  })

  it('legacy persisted cart without ownership infers branch from items', async () => {
    const item = menuItem('old', 'branch-legacy')
    const line = {
      id: 'legacy-1',
      branch_id: 'branch-legacy',
      menu_item: item,
      quantity: 1,
      extras: [] as [],
      unit_price: 10,
      total_price: 10,
    }
    useCartStore.setState({
      items: [],
      ownership: null,
      discountCode: '',
      discountAmount: 0,
      isOpen: false,
      hasHydrated: false,
    })
    localStorage.setItem(
      CART_KEY,
      JSON.stringify({
        state: {
          items: [line],
          discountCode: '',
          discountAmount: 0,
          isOpen: false,
        },
        version: 0,
      }),
    )
    await useCartStore.persist.rehydrate()
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().ownership?.branchId).toBe('branch-legacy')
  })

  it('checkout branch id comes from cart ownership, not current activeBranch', () => {
    useCartStore.getState().addItem(menuItem('soup', 'branch-a'), 1, [], undefined, tenantA)
    useBranchStore.getState().setActiveBranch({
      id: 'branch-b',
      slug: 'airport',
      name: 'Airport',
      tenant_id: 'tenant-a',
      address: '',
      city: '',
      phone_number: '',
      lat: 0,
      lng: 0,
      working_hours: [],
      is_active: true,
    } as Branch)
    const { items, ownership } = useCartStore.getState()
    expect(resolveCheckoutBranchId(items, ownership)).toBe('branch-a')
    expect(useBranchStore.getState().activeBranch?.id).toBe('branch-b')
  })

  it('explicit clearCart resolves the cart so a new order can start', () => {
    useCartStore.getState().addItem(menuItem('soup', 'branch-a'), 1, [], undefined, tenantA)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().ownership).toBeNull()
    const result = useCartStore.getState().addItem(menuItem('tea', 'branch-c'), 1, [], undefined, tenantB)
    expect(result.ok).toBe(true)
    expect(useCartStore.getState().ownership?.tenantId).toBe('tenant-b')
  })

  it('legacy persisted cart without ownership infers branch from items (pure)', () => {
    const items = [
      {
        id: 'legacy-1',
        branch_id: 'branch-legacy',
        menu_item: menuItem('old', 'branch-legacy'),
        quantity: 1,
        extras: [],
        unit_price: 10,
        total_price: 10,
      },
    ]
    const ownership = coalesceCartOwnership(undefined, items)
    expect(ownership?.branchId).toBe('branch-legacy')
    expect(getActiveCartContext(items, null)?.branchId).toBe('branch-legacy')
  })

  it('resolveCartMenuUrl uses stored slugs, not current route', () => {
    expect(resolveCartMenuUrl(tenantA)).toBe('/alpha/downtown/menu')
    expect(isSameOrderingContext(tenantA, tenantA)).toBe(true)
    expect(isSameOrderingContext(tenantA, tenantB)).toBe(false)
  })

  it('tenant layout no longer clears the cart on tenant switch', () => {
    const src = readFileSync(join(ROOT, 'app', '[tenantSlug]', 'layout.tsx'), 'utf-8')
    expect(src).not.toContain('clearCart')
    expect(src).not.toContain('useCartStore')
  })
})
