import { parseDecimal } from '@/utils/decimal'
import { resolveMediaUrl } from '@/utils/media-url'
import type { DecimalFieldValue, Extra, MenuItem, PaginatedResponse, TenantStatus } from '@/types'

/** Wire shape for menu extras — Django serializes DecimalField as a string. */
export type ExtraWire = Omit<Extra, 'price'> & { price: DecimalFieldValue }

/** Wire shape for menu items — price fields may arrive as decimal strings. */
export type MenuItemWire = Omit<MenuItem, 'price' | 'discounted_price' | 'extras' | 'is_active'> & {
  price: DecimalFieldValue
  discounted_price?: DecimalFieldValue
  extras?: ExtraWire[]
  is_active?: boolean
}

/** Tenant block embedded on public menu list responses. */
export interface MenuResponseTenant {
  id: string
  name: string
  slug: string
  is_active: boolean
  status: TenantStatus
}

/**
 * Body of the public menu alias endpoints (related, featured, popular, search).
 * `results` is always an array, including when there are zero items.
 */
export interface MenuItemsEnvelope {
  tenant: MenuResponseTenant
  results: MenuItemWire[]
}

/** Body of GET /menu/items/branches/{branchId}/ — paginated list plus tenant. */
export type BranchMenuItemsResponse = PaginatedResponse<MenuItemWire> & {
  tenant: MenuResponseTenant
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

/** Normalizes a MenuItem, including nested inline extras and image URLs. */
export function normalizeMenuItem(raw: MenuItemWire): MenuItem {
  const category_id = raw.category_id ?? raw.category?.id ?? ''
  const image = resolveMediaUrl(raw.image)
  const images = raw.images
    ?.map((entry) => resolveMediaUrl(entry))
    .filter((entry) => entry.length > 0)
  return {
    ...raw,
    category_id,
    is_active: raw.is_active ?? true,
    price: parseDecimal(raw.price),
    discounted_price:
      raw.discounted_price != null ? parseDecimal(raw.discounted_price) : undefined,
    image,
    images: images?.length ? images : undefined,
    extras: raw.extras?.map(normalizeExtra),
  }
}

export function normalizeMenuItems(raw: MenuItemWire[]): MenuItem[] {
  if (!Array.isArray(raw)) {
    const received = raw === null ? 'null' : typeof raw
    const envelope =
      received === 'object' && raw !== null && 'results' in (raw as object)
        ? ' Pass the results array, not the response envelope.'
        : ''
    throw new TypeError(
      `normalizeMenuItems expected an array of menu items, received ${received}.${envelope}`,
    )
  }
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
