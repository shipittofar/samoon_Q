import type { Category, MenuItem } from '@/types'

/** Anchor for the unfiltered All menu. Quick navigation scrolls here without filtering. */
export const MENU_ALL_ANCHOR_ID = 'menu-all'

export function menuCategorySectionId(categoryId: string): string {
  return `menu-category-${categoryId}`
}

export interface MenuCategorySection {
  id: string
  name: string
  items: MenuItem[]
}

export interface GroupedMenuSections {
  /** Categories that have at least one item in the loaded result set, in category order. */
  sections: MenuCategorySection[]
  /** Loaded items whose category_id is missing or not in the category list. */
  unmatched: MenuItem[]
}

/**
 * Groups the current item page by `category_id`.
 * Category order follows `sort_order`, then the categories array order.
 * Item order inside a category stays the order of `items` (the API sort).
 * Does not read `item.category`.
 */
export function groupMenuItemsByCategory(
  categories: Category[] | undefined,
  items: MenuItem[],
): GroupedMenuSections {
  if (!categories || items.length === 0) {
    return { sections: [], unmatched: items }
  }

  const byCategory = new Map<string, MenuItem[]>()

  for (const item of items) {
    const categoryId = item.category_id
    if (!categoryId) continue
    const bucket = byCategory.get(categoryId)
    if (bucket) bucket.push(item)
    else byCategory.set(categoryId, [item])
  }

  const ordered = categories
    .map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const byOrder = (a.category.sort_order ?? 0) - (b.category.sort_order ?? 0)
      return byOrder !== 0 ? byOrder : a.index - b.index
    })

  const sections: MenuCategorySection[] = []
  const consumed = new Set<string>()

  for (const { category } of ordered) {
    const sectionItems = byCategory.get(category.id)
    if (!sectionItems?.length) continue
    consumed.add(category.id)
    sections.push({
      id: category.id,
      name: category.name,
      items: sectionItems,
    })
  }

  const unmatched = items.filter(
    (item) => !item.category_id || !consumed.has(item.category_id),
  )

  return { sections, unmatched }
}

/**
 * Scroll-spy: the active category is the last section whose top has reached
 * the sticky activation line. Before that, All (`''`) stays active.
 */
export interface AnchorBox {
  left: number
  right: number
  top: number
  bottom: number
}

export interface ViewportBox {
  width: number
  height: number
}

export interface CategoryQuickNavPlacement {
  top: number
  left: number
  width: number
  maxHeight: number
}

const QUICK_NAV_MARGIN = 12
const QUICK_NAV_GAP = 8
/** Compact cap so a wide desktop does not stretch the panel to a full half-screen. */
const QUICK_NAV_MAX_WIDTH = 28 * 16

/**
 * Places the category popover under its trigger.
 * Desktop width is at most half the viewport and at most 28rem.
 * Narrow screens use the viewport width minus side margins.
 * The box is clamped so it stays inside the viewport.
 */
export function placeCategoryQuickNav(
  anchor: AnchorBox,
  viewport: ViewportBox,
  dir: 'ltr' | 'rtl',
): CategoryQuickNavPlacement {
  const margin = QUICK_NAV_MARGIN
  const narrow = viewport.width < 640
  const preferred = narrow
    ? viewport.width - margin * 2
    : Math.min(viewport.width * 0.5, QUICK_NAV_MAX_WIDTH)
  const width = Math.max(0, Math.min(preferred, viewport.width - margin * 2))

  const aligned = dir === 'rtl' ? anchor.left : anchor.right - width
  const left = Math.min(Math.max(aligned, margin), Math.max(margin, viewport.width - width - margin))

  const belowTop = anchor.bottom + QUICK_NAV_GAP
  const spaceBelow = viewport.height - belowTop - margin
  const spaceAbove = anchor.top - QUICK_NAV_GAP - margin
  const preferAbove = spaceBelow < 160 && spaceAbove > spaceBelow

  const available = Math.max(preferAbove ? spaceAbove : spaceBelow, 0)
  const maxHeight = Math.min(viewport.height * 0.5, available)
  const top = preferAbove
    ? Math.max(margin, anchor.top - QUICK_NAV_GAP - maxHeight)
    : belowTop

  return { top, left, width, maxHeight }
}

export function resolveActiveMenuCategory(
  sectionIds: string[],
  tops: ReadonlyMap<string, number>,
  activationLine: number,
): string {
  let active = ''
  for (const sectionId of sectionIds) {
    const top = tops.get(menuCategorySectionId(sectionId))
    if (top == null) continue
    if (top <= activationLine) active = sectionId
  }
  return active
}
