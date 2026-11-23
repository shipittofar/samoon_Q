import type { ImageFieldValue } from '@/components/ImageUploader'
import type { MenuItem } from './index'
import type { AssetId } from '@/types/upload'
import {
  DEFAULT_VERTICAL,
  attributesToFormValues,
  effectiveItemKind,
  serializeAttributes,
  type CatalogAttributeFormValues,
  type CatalogItemAttributes,
  type CatalogItemKind,
  type VerticalDefinition,
} from '@/verticals'

/**
 * Menu item form input — separate from API response models.
 * `image.file` is local until submit; `existingUrl` is for preview only.
 */
export interface MenuItemFormInput {
  name: string
  description: string
  price: string
  discount: string
  calories: string
  preparation_time: string
  image: ImageFieldValue
  category_id: string
  available: boolean
  is_active: boolean
  is_featured: boolean
  is_popular: boolean
  extra_group_ids: string[]
  tag_ids: number[]
  /** Phase 1 — '' means "the vertical's default kind". Optional for legacy callers. */
  item_kind?: CatalogItemKind | ''
  /** Phase 1 — raw vertical attribute inputs, serialized on submit. */
  attributes?: CatalogAttributeFormValues
  /** Owner's own prices in other currencies (code -> amount text; '' = convert by rate). */
  prices?: Record<string, string>
}

/**
 * JSON write request. Images are attached via `image_asset_id`.
 * Response model `MenuItem.image` remains a CDN URL string.
 */
export interface MenuItemWriteRequest {
  name?: string
  description?: string
  price?: number
  discount?: number
  calories?: number
  preparation_time?: number
  category_id?: string
  available?: boolean
  is_active?: boolean
  is_featured?: boolean
  is_popular?: boolean
  tag_ids?: number[]
  image_asset_id?: AssetId | null
  /** Phase 1 — sent only for non-food verticals (see menuItemFormToWriteRequest). */
  item_kind?: CatalogItemKind
  attributes?: CatalogItemAttributes
  /** Replaces the item's per-currency prices; omitted = unchanged. */
  prices?: Record<string, string>
}

/**
 * Maps form text fields. Image files are uploaded separately before send.
 *
 * Phase 1: `vertical` shapes the payload. Food verticals (the default) send
 * exactly the legacy payload — no item_kind/attributes — so existing tenants
 * and backends are unaffected. Service verticals drop the food fields and
 * send item_kind + typed attributes instead.
 */
export function menuItemFormToWriteRequest(
  form: MenuItemFormInput,
  vertical: VerticalDefinition = DEFAULT_VERTICAL,
): MenuItemWriteRequest {
  const foodFields = vertical.usesFoodFields
    ? {
        calories: form.calories ? parseInt(form.calories, 10) : undefined,
        preparation_time: parseInt(form.preparation_time, 10) || 15,
      }
    : {}
  const request: MenuItemWriteRequest = {
    name: form.name,
    description: form.description,
    price: parseFloat(form.price) || 0,
    discount: form.discount ? parseFloat(form.discount) : undefined,
    ...foodFields,
    category_id: form.category_id,
    available: form.available,
    is_active: form.is_active,
    is_featured: form.is_featured,
    is_popular: form.is_popular,
    tag_ids: form.tag_ids,
  }

  if (!form.image.file && form.image.cleared) {
    request.image_asset_id = null
  }

  if (form.prices) {
    request.prices = Object.fromEntries(
      Object.entries(form.prices).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, v.trim()]),
    )
  }

  if (vertical.family !== 'food') {
    const kind = effectiveItemKind(vertical, form.item_kind)
    request.item_kind = kind
    request.attributes = serializeAttributes(vertical, kind, form.attributes ?? {})
  }

  return request
}

/** Maps a server MenuItem into form input for edit modals. */
export function menuItemToFormInput(item: MenuItem): MenuItemFormInput {
  return {
    name: item.name,
    description: item.description,
    price: String(item.price),
    discount: String(item.discount ?? ''),
    calories: String(item.calories ?? ''),
    preparation_time: String(item.preparation_time),
    image: {
      file: null,
      existingUrl: item.image ?? '',
      cleared: false,
    },
    category_id: item.category_id,
    available: item.available,
    is_active: item.is_active,
    is_featured: item.is_featured ?? false,
    is_popular: item.is_popular ?? false,
    extra_group_ids: item.extra_group_ids ?? [],
    tag_ids: item.tags?.map((tag) => tag.id) ?? [],
    item_kind: item.item_kind ?? '',
    attributes: attributesToFormValues(item.attributes),
    prices: Object.fromEntries(Object.entries(item.prices ?? {}).map(([k, v]) => [k, String(v)])),
  }
}
