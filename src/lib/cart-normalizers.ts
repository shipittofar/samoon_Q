import { normalizeExtra, normalizeMenuItem, type MenuItemWire } from '@/lib/menu-normalizers'
import { parseDecimal } from '@/utils/decimal'
import type { CartItem, Extra, MenuItem } from '@/types'

const PLACEHOLDER_IMAGE = '/placeholder-food.png'

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readString(raw: RawRecord, key: string): string | undefined {
  const value = raw[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readNumber(raw: RawRecord, key: string): number | undefined {
  const value = raw[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseDecimal(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Builds a complete MenuItem when the API/persistence layer only supplied partial fields. */
export function buildMenuItemStub(
  partial: RawRecord,
  fallbackBranchId?: string,
): MenuItem {
  const id = readString(partial, 'id') ?? 'unknown'
  const name = readString(partial, 'name') ?? 'Menu item'
  const price = readNumber(partial, 'price') ?? readNumber(partial, 'unit_price') ?? 0
  const branch_id = readString(partial, 'branch_id') ?? fallbackBranchId ?? ''
  const slug = readString(partial, 'slug') ?? id
  const image = readString(partial, 'image') ?? PLACEHOLDER_IMAGE

  const wire: MenuItemWire = {
    id,
    branch_id,
    category_id: readString(partial, 'category_id') ?? '',
    name,
    slug,
    description: readString(partial, 'description') ?? '',
    price,
    discounted_price: readNumber(partial, 'discounted_price'),
    image,
    preparation_time: readNumber(partial, 'preparation_time') ?? 0,
    rating: readNumber(partial, 'rating') ?? 0,
    rating_count: readNumber(partial, 'rating_count') ?? 0,
    available: partial.available !== false,
    is_active: partial.is_active !== false,
    extras: Array.isArray(partial.extras)
      ? (partial.extras as MenuItemWire['extras'])
      : undefined,
    // Kept so a restored cart shows the same prices as the menu (display
    // currency, the owner's own per-currency prices, discount).
    currency: readString(partial, 'currency'),
    prices:
      partial.prices && typeof partial.prices === 'object' && !Array.isArray(partial.prices)
        ? (partial.prices as Record<string, string | number>)
        : undefined,
    discount: readNumber(partial, 'discount'),
  }

  return normalizeMenuItem(wire)
}

function normalizeExtrasList(raw: unknown): Extra[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isRecord)
    .map((entry) => normalizeExtra(entry as Parameters<typeof normalizeExtra>[0]))
}

function extractMenuItemId(raw: RawRecord): string | undefined {
  if (typeof raw.menu_item === 'string') return raw.menu_item
  const menuItemId = readString(raw, 'menu_item_id')
  if (menuItemId) return menuItemId
  const cartLineId = readString(raw, 'id')
  if (cartLineId?.includes('-')) return cartLineId.split('-')[0]
  return readString(raw, 'id')
}

/**
 * Normalizes any persisted/API cart line into the canonical CartItem shape.
 * Guest and authenticated carts must produce identical objects.
 */
export function normalizeCartItem(raw: unknown, fallbackBranchId?: string): CartItem | null {
  if (!isRecord(raw)) return null

  const branch_id = readString(raw, 'branch_id') ?? fallbackBranchId ?? ''
  const quantity = readNumber(raw, 'quantity') ?? 1
  const extras = normalizeExtrasList(raw.extras)
  const notes = readString(raw, 'notes')

  let menu_item: MenuItem
  if (isRecord(raw.menu_item)) {
    menu_item = buildMenuItemStub(raw.menu_item, branch_id)
  } else {
    const menuItemId = extractMenuItemId(raw)
    if (!menuItemId) return null
    menu_item = buildMenuItemStub({
      id: menuItemId,
      branch_id,
      name: readString(raw, 'name'),
      image: readString(raw, 'image'),
      price: readNumber(raw, 'unit_price') ?? readNumber(raw, 'price'),
      slug: readString(raw, 'slug'),
      description: readString(raw, 'description'),
    }, branch_id)
  }

  const unit_price = readNumber(raw, 'unit_price') ?? menu_item.discounted_price ?? menu_item.price
  const total_price = readNumber(raw, 'total_price') ?? unit_price * quantity
  const id = readString(raw, 'id') ?? `${menu_item.id}-${Date.now()}`

  return {
    id,
    branch_id: branch_id || menu_item.branch_id,
    menu_item,
    quantity,
    extras,
    notes,
    unit_price,
    total_price,
  }
}

export function normalizeCartItems(raw: unknown, fallbackBranchId?: string): CartItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => normalizeCartItem(entry, fallbackBranchId))
    .filter((item): item is CartItem => item !== null)
}

function extrasSignature(extras: Extra[]): string {
  return JSON.stringify(extras.map((e) => e.id).sort())
}

/**
 * Merges guest and server cart lines without duplicates or data loss.
 * Same product + same modifiers → quantities combined; different modifiers → separate lines.
 */
export function mergeCartItems(primary: CartItem[], secondary: CartItem[]): CartItem[] {
  const merged = normalizeCartItems(primary)

  for (const incoming of normalizeCartItems(secondary)) {
    const existing = merged.find(
      (line) =>
        line.menu_item.id === incoming.menu_item.id &&
        extrasSignature(line.extras) === extrasSignature(incoming.extras),
    )

    if (existing) {
      existing.quantity += incoming.quantity
      existing.total_price = existing.unit_price * existing.quantity
      if (incoming.notes && !existing.notes) existing.notes = incoming.notes
    } else {
      merged.push(incoming)
    }
  }

  return merged
}

export function isCanonicalCartItem(item: unknown): boolean {
  if (!isRecord(item)) return false
  return isRecord(item.menu_item) && typeof item.menu_item.id === 'string'
}
