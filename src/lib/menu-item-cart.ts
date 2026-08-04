import type { CartItem, MenuItem } from '@/types'

/**
 * Whether the item must go through the detail/modal flow before adding to cart.
 * Only assigned Extra Groups require configuration — optional inline `extras`
 * on the list payload are add-ons that can be skipped for quick-add.
 */
export function menuItemRequiresConfiguration(item: MenuItem): boolean {
  return (item.extra_group_ids?.length ?? 0) > 0
}

/** Cart line for this menu item with no extras or notes (quick-add path). */
export function findPlainCartLine(items: CartItem[], menuItemId: string): CartItem | undefined {
  return items.find(
    (line) =>
      line.menu_item.id === menuItemId &&
      line.extras.length === 0 &&
      !line.notes,
  )
}

/** Quantity for the plain (no-extras) cart line of a menu item. */
export function getPlainCartQuantity(items: CartItem[], menuItemId: string): number {
  return findPlainCartLine(items, menuItemId)?.quantity ?? 0
}
