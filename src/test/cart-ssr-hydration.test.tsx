/**
 * Cart SSR / client hydration safety.
 *
 * Proves that browser-persisted cart state cannot affect the SSR / first
 * client paint (which caused Header aria-label "0 items" vs "9 items").
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { readFileSync } from 'fs'
import { join } from 'path'
import { useCartStore, useCartItemCount, useCartHasHydrated } from '@/stores'
import { CART_KEY } from '@/constants'
import type { MenuItem } from '@/types'
import en from '@/i18n/locales/en.json'

const ROOT = join(__dirname, '..')

function mockMenuItem(id: string, branchId = 'branch-1'): MenuItem {
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

function CountProbe() {
  const count = useCartItemCount()
  const hydrated = useCartHasHydrated()
  return (
    <div>
      <span data-testid="hydrated">{hydrated ? 'yes' : 'no'}</span>
      <span data-testid="count">{count}</span>
      <span data-testid="aria">{`Cart with ${count} items`}</span>
    </div>
  )
}

describe('Cart SSR hydration safety', () => {
  beforeEach(() => {
    localStorage.removeItem(CART_KEY)
    useCartStore.setState({
      items: [],
      discountCode: '',
      discountAmount: 0,
      isOpen: false,
      hasHydrated: false,
    })
  })

  afterEach(() => {
    localStorage.removeItem(CART_KEY)
    useCartStore.setState({
      items: [],
      discountCode: '',
      discountAmount: 0,
      isOpen: false,
      hasHydrated: false,
    })
  })

  it('store defaults to hasHydrated=false (SSR / pre-rehydrate)', () => {
    expect(useCartStore.getState().hasHydrated).toBe(false)
    expect(useCartStore.getState().items).toEqual([])
  })

  it('useCartItemCount is 0 before hydration even if items exist in memory', () => {
    useCartStore.getState().addItem(mockMenuItem('a'), 9)
    expect(useCartStore.getState().getItemCount()).toBe(9)
    expect(useCartStore.getState().hasHydrated).toBe(false)

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CountProbe />
      </NextIntlClientProvider>,
    )

    expect(screen.getByTestId('hydrated')).toHaveTextContent('no')
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByTestId('aria')).toHaveTextContent('Cart with 0 items')
    expect(screen.queryByText('9')).not.toBeInTheDocument()
  })

  it('after hasHydrated=true, useCartItemCount shows the real count (9)', async () => {
    useCartStore.getState().addItem(mockMenuItem('a'), 9)
    expect(useCartStore.getState().getItemCount()).toBe(9)

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CountProbe />
      </NextIntlClientProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent('0')

    await act(async () => {
      useCartStore.setState({ hasHydrated: true })
    })

    expect(screen.getByTestId('hydrated')).toHaveTextContent('yes')
    expect(screen.getByTestId('count')).toHaveTextContent('9')
    expect(screen.getByTestId('aria')).toHaveTextContent('Cart with 9 items')
  })

  it('persist.rehydrate restores localStorage cart and sets hasHydrated', async () => {
    const item = mockMenuItem('burger')
    // Build a persisted payload without going through the live store write path
    // (setState would overwrite localStorage with the empty reset below).
    const line = {
      id: `${item.id}-test`,
      branch_id: item.branch_id,
      menu_item: item,
      quantity: 9,
      extras: [] as [],
      unit_price: item.price,
      total_price: item.price * 9,
    }
    const persisted = {
      state: {
        items: [line],
        discountCode: '',
        discountAmount: 0,
        isOpen: false,
      },
      version: 0,
    }

    // Reset to pre-hydration defaults (as on a fresh page load).
    useCartStore.setState({
      items: [],
      discountCode: '',
      discountAmount: 0,
      isOpen: false,
      hasHydrated: false,
    })
    // Write storage AFTER the empty setState so persist does not clobber it.
    localStorage.setItem(CART_KEY, JSON.stringify(persisted))

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CountProbe />
      </NextIntlClientProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByTestId('aria')).toHaveTextContent('Cart with 0 items')

    await act(async () => {
      await useCartStore.persist.rehydrate()
    })

    await waitFor(() => {
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes')
      expect(screen.getByTestId('count')).toHaveTextContent('9')
      expect(screen.getByTestId('aria')).toHaveTextContent('Cart with 9 items')
    })
  })

  it('cart badge is absent before hydration and present after (count > 0)', async () => {
    useCartStore.getState().addItem(mockMenuItem('x'), 3)

    function BadgeProbe() {
      const count = useCartItemCount()
      return (
        <button aria-label={`Cart with ${count} items`}>
          {count > 0 ? <span data-testid="badge">{count}</span> : null}
        </button>
      )
    }

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BadgeProbe />
      </NextIntlClientProvider>,
    )

    expect(screen.queryByTestId('badge')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Cart with 0 items')

    await act(async () => {
      useCartStore.setState({ hasHydrated: true })
    })

    expect(screen.getByTestId('badge')).toHaveTextContent('3')
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Cart with 3 items')
  })

  it('existing cart mutations still work after hydration', () => {
    useCartStore.setState({ hasHydrated: true })
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem(mockMenuItem('a'), 2)
    useCartStore.getState().addItem(mockMenuItem('a'), 1)
    expect(useCartStore.getState().getItemCount()).toBe(3)
    expect(useCartStore.getState().items).toHaveLength(1)
  })
})

describe('Cart hydration wiring (source)', () => {
  it('cart persist uses skipHydration', () => {
    const src = readFileSync(join(ROOT, 'stores', 'index.ts'), 'utf8')
    expect(src).toContain('skipHydration: true')
    expect(src).toContain('hasHydrated')
    expect(src).toContain('partialize:')
  })

  it('CartHydrationBootstrapper calls persist.rehydrate', () => {
    const src = readFileSync(join(ROOT, 'providers', 'index.tsx'), 'utf8')
    expect(src).toContain('CartHydrationBootstrapper')
    expect(src).toContain('useCartStore.persist.rehydrate()')
  })

  it('Header and TenantHeader use useCartItemCount', () => {
    const header = readFileSync(join(ROOT, 'components', 'layout', 'Header.tsx'), 'utf8')
    const tenantHeader = readFileSync(join(ROOT, 'components', 'layout', 'TenantHeader.tsx'), 'utf8')
    expect(header).toContain('useCartItemCount')
    expect(header).not.toContain('getItemCount()')
    expect(tenantHeader).toContain('useCartItemCount')
    expect(tenantHeader).not.toContain('getItemCount()')
  })

  it('Checkout waits for cartHasHydrated before empty-cart branch', () => {
    const src = readFileSync(join(ROOT, 'app', 'checkout', 'page.tsx'), 'utf8')
    expect(src).toContain('useCartHasHydrated')
    expect(src).toContain('if (!cartHasHydrated)')
    const emptyIdx = src.indexOf('items.length === 0')
    const hydrateIdx = src.indexOf('!cartHasHydrated')
    expect(hydrateIdx).toBeGreaterThan(-1)
    expect(hydrateIdx).toBeLessThan(emptyIdx)
  })
})
