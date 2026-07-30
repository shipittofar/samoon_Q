import { parseDecimal } from '@/utils/decimal'
import type { DecimalFieldValue, Extra, MenuItem, PaginatedResponse } from '@/types'

/** Wire shape for menu extras — Django serializes DecimalField as a string. */
export type ExtraWire = Omit<Extra, 'price'> & { price: DecimalFieldValue }

/** Wire shape for menu items — price fields may arrive as decimal strings. */
export type MenuItemWire = Omit<MenuItem, 'price' | 'discounted_price' | 'extras' | 'is_active'> & {
  price: DecimalFieldValue
  discounted_price?: DecimalFieldValue
  extras?: ExtraWire[]
  is_active?: boolean
}

/** Normalizes a single Extra from API transport into the domain model. */
export function normalizeExtra(raw: ExtraWire): Extra {
  return {
    ...raw,
    price: parseDecimal(raw.price),
  }
}

export function normalizeExtras(raw: ExtraWire[]): Extra[] {
  return raw.map(normalizeExtra)
}

/** Normalizes a MenuItem, including nested inline extras. */
export function normalizeMenuItem(raw: MenuItemWire): MenuItem {
  const category_id = raw.category_id ?? raw.category?.id ?? ''
  return {
    ...raw,
    category_id,
    is_active: raw.is_active ?? true,
    price: parseDecimal(raw.price),
    discounted_price:
      raw.discounted_price != null ? parseDecimal(raw.discounted_price) : undefined,
    extras: raw.extras?.map(normalizeExtra),
  }
}

export function normalizeMenuItems(raw: MenuItemWire[]): MenuItem[] {
  return raw.map(normalizeMenuItem)
}

export function normalizePaginatedMenuItems(
  raw: PaginatedResponse<MenuItemWire>,
): PaginatedResponse<MenuItem> {
  return {
    ...raw,
    results: normalizeMenuItems(raw.results),
  }
}
