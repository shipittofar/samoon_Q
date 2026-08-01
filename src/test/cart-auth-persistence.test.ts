/**
 * Guest cart must survive authentication transitions (checkout → login → checkout).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, useTenantStore } from '@/stores'
import type { MenuItem } from '@/types'

function mockMenuItem(id: string, branchId = 'branch-1'): MenuItem {
  return {
    id,
    branch_id: branchId,
    name: `Item ${id}`,
    description: '',
    price: 10,
    image: '/img.png',
    category_id: 'cat-1',
    is_available: true,
    extras: [],
    created_at: '2024-01-01T00:00:00.000Z',
  }
}

describe('Cart auth persistence', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('cart items survive simulated auth session teardown (no clearCart on logout path)', () => {
    useCartStore.getState().addItem(mockMenuItem('burger'), 2)
    const before = useCartStore.getState().items
    expect(before.length).toBe(1)
    expect(before[0].quantity).toBe(2)
    expect(before[0].menu_item.name).toBe('Item burger')

    // Simulate auth teardown without cart clear — mirrors clearSession/useLogout.
    useTenantStore.getState().reset()

    const after = useCartStore.getState().items
    expect(after).toEqual(before)
    expect(after[0].menu_item.image).toBeTruthy()
    expect(useCartStore.getState().getItemCount()).toBe(2)
  })

  it('reconcileItems repairs flat persisted lines missing menu_item', () => {
    useCartStore.setState({
      items: [
        {
          id: '5-legacy',
          branch_id: 'branch-1',
          name: 'Legacy Item',
          image: 'https://example.com/legacy.jpg',
          quantity: 2,
          unit_price: 15,
          total_price: 30,
          extras: [],
        } as never,
      ],
    })

    useCartStore.getState().reconcileItems()
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].menu_item.name).toBe('Legacy Item')
    expect(items[0].menu_item.image).toBe('https://example.com/legacy.jpg')
    expect(items[0].menu_item.id).toBe('5')
  })

  it('tenant layout bootstrap does not clear cart when tenant is null (re-entry after checkout)', () => {
    useCartStore.getState().addItem(mockMenuItem('pizza'), 1)
    useTenantStore.getState().reset()

    const tenant = useTenantStore.getState().tenant
    const tenantState = useTenantStore.getState().tenantState
    const tenantSlug = 'samoon'

    // Mirrors [tenantSlug]/layout.tsx guard — only clear on resolved tenant switch.
    const shouldClear =
      tenantState === 'resolved' &&
      tenant?.slug &&
      tenant.slug !== tenantSlug

    expect(shouldClear).toBe(false)
    expect(useCartStore.getState().items.length).toBe(1)
  })
})
