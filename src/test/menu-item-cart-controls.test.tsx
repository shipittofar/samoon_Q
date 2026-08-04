import { describe, expect, it, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MenuItemCartControls } from '@/components/menu/MenuItemCartControls'
import { useCartStore } from '@/stores'
import { renderWithIntl } from '@/test/test-utils'
import type { MenuItem } from '@/types'

const plainItem: MenuItem = {
  id: 'plain-1',
  branch_id: 'branch-1',
  category_id: 'cat-1',
  name: 'Fries',
  slug: 'fries',
  description: 'Crispy',
  price: 5,
  image: '/fries.jpg',
  preparation_time: 10,
  rating: 4,
  rating_count: 2,
  available: true,
  is_active: true,
}

const itemWithExtraGroups: MenuItem = {
  ...plainItem,
  id: 'config-1',
  name: 'Burger',
  extra_group_ids: ['grp-1'],
}

const itemWithOptionalExtras: MenuItem = {
  ...plainItem,
  id: 'optional-1',
  name: 'Burger',
  extras: [{ id: 'e1', name: 'Cheese', price: 1, available: true }],
}

function renderControls(
  item: MenuItem,
  props: Partial<React.ComponentProps<typeof MenuItemCartControls>> = {},
) {
  const onOpenDetail = vi.fn()
  renderWithIntl(
    <div data-testid="card" onClick={() => { /* simulate card click */ }}>
      <MenuItemCartControls item={item} onOpenDetail={onOpenDetail} {...props} />
    </div>,
  )
  return { onOpenDetail }
}

describe('MenuItemCartControls', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('adds plain items directly without opening detail', () => {
    const { onOpenDetail } = renderControls(plainItem)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onOpenDetail).not.toHaveBeenCalled()
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(1)
  })

  it('opens detail for items with assigned extra groups', () => {
    const { onOpenDetail } = renderControls(itemWithExtraGroups)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onOpenDetail).toHaveBeenCalledWith(itemWithExtraGroups)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('quick-adds items that only have optional inline extras', () => {
    const { onOpenDetail } = renderControls(itemWithOptionalExtras)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onOpenDetail).not.toHaveBeenCalled()
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('does not bubble add clicks to the parent card', () => {
    const cardClick = vi.fn()
    renderWithIntl(
      <div data-testid="card" onClick={cardClick}>
        <MenuItemCartControls item={plainItem} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(cardClick).not.toHaveBeenCalled()
  })

  it('shows quantity selector after first add and hides Add button', () => {
    renderControls(plainItem)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows trash at quantity 1 and minus at quantity 2+', () => {
    useCartStore.getState().addItem(plainItem, 2)
    renderControls(plainItem)
    expect(screen.getByLabelText(/decrease quantity/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/decrease quantity/i))
    expect(screen.getByLabelText(/remove item/i)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('removes item with trash and restores Add button', () => {
    useCartStore.getState().addItem(plainItem, 1)
    renderControls(plainItem)
    fireEvent.click(screen.getByLabelText(/remove item/i))
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('handles rapid consecutive + clicks', () => {
    useCartStore.getState().addItem(plainItem, 1)
    renderControls(plainItem)
    const increase = screen.getByLabelText(/increase quantity/i)
    fireEvent.click(increase)
    fireEvent.click(increase)
    fireEvent.click(increase)
    expect(useCartStore.getState().items[0].quantity).toBe(4)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('reflects pre-existing cart quantity on mount', () => {
    useCartStore.getState().addItem(plainItem, 3)
    renderControls(plainItem)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull()
  })

  it('keeps multiple instances of the same item synchronized', () => {
    useCartStore.getState().addItem(plainItem, 1)
    renderWithIntl(
      <>
        <MenuItemCartControls item={plainItem} />
        <MenuItemCartControls item={plainItem} />
      </>,
    )
    const quantities = screen.getAllByText('1')
    expect(quantities).toHaveLength(2)
    fireEvent.click(screen.getAllByLabelText(/increase quantity/i)[0])
    expect(screen.getAllByText('2')).toHaveLength(2)
  })
})
