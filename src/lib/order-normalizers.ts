import { buildMenuItemStub } from '@/lib/cart-normalizers'
import { normalizeExtra } from '@/lib/menu-normalizers'
import { resolveMediaUrl } from '@/utils/media-url'
import type { Extra, Order, OrderItem } from '@/types'

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
  return undefined
}

/** Normalizes order line items so menu_item is always a full object — never an id reference. */
export function normalizeOrderItem(raw: unknown): OrderItem | null {
  if (!isRecord(raw)) return null

  const flatName = readString(raw, 'name')
  const flatImage = readString(raw, 'image')
  const quantity = readNumber(raw, 'quantity') ?? 1
  const unit_price = readNumber(raw, 'unit_price') ?? 0
  const total_price = readNumber(raw, 'total_price') ?? unit_price * quantity
  const extras = Array.isArray(raw.extras)
    ? raw.extras
        .filter(isRecord)
        .map((e) => normalizeExtra(e as Parameters<typeof normalizeExtra>[0]))
    : []

  let menu_item: OrderItem['menu_item']
  if (isRecord(raw.menu_item)) {
    menu_item = buildMenuItemStub(raw.menu_item, readString(raw, 'branch_id'))
  } else {
    const menuItemId =
      typeof raw.menu_item === 'string'
        ? raw.menu_item
        : readString(raw, 'menu_item_id') ?? readString(raw, 'id') ?? 'unknown'
    menu_item = buildMenuItemStub({
      id: menuItemId,
      branch_id: readString(raw, 'branch_id'),
      name: flatName,
      image: flatImage,
      price: unit_price,
    })
  }

  return {
    id: readString(raw, 'id') ?? `${menu_item.id}-${quantity}`,
    menu_item,
    quantity,
    unit_price,
    total_price,
    notes: readString(raw, 'notes'),
    extras,
    image: resolveMediaUrl(flatImage ?? menu_item.image),
    name: flatName ?? menu_item.name,
  }
}

export function normalizeOrderItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => normalizeOrderItem(entry))
    .filter((item): item is OrderItem => item !== null)
}

export function normalizeOrder(raw: unknown): Order {
  if (!isRecord(raw)) return raw as Order
  return {
    ...(raw as Order),
    items: normalizeOrderItems(raw.items),
  }
}

export function normalizeOrderList(raw: unknown): Order[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => normalizeOrder(entry))
}
