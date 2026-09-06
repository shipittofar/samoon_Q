/**
 * Active cart ownership and conflict rules.
 *
 * Navigation tenant/branch context is the TARGET for a new add.
 * Cart ownership is independent and must never be inferred from the current route.
 */

import type { Branch, BranchCheckout, CartItem, MenuItem, Tenant } from '@/types'
import { canOrderFromTenant } from '@/lib/tenant-state'
import { isBranchOrderingEnabled } from '@/lib/branch-checkout'
import { buildPublicUrl } from '@/utils/public-url'

export interface CartOwnership {
  tenantId: string
  tenantSlug: string
  tenantName: string
  branchId: string
  branchSlug: string
  branchName: string
  checkout?: BranchCheckout
  currency?: string
  tenantOperational?: boolean
}

export type CartOwnershipInput = Partial<CartOwnership>

export type AddToCartResult =
  | { ok: true }
  | { ok: false; reason: 'conflict'; ownership: CartOwnership }
  | { ok: false; reason: 'missing_context' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key]
  return typeof value === 'string' ? value : ''
}

export function parseCartOwnership(raw: unknown): CartOwnership | null {
  if (!isRecord(raw)) return null
  const branchId = readString(raw, 'branchId')
  if (!branchId) return null
  const checkout = isRecord(raw.checkout) ? (raw.checkout as unknown as BranchCheckout) : undefined
  const currency = readString(raw, 'currency') || undefined
  const tenantOperational =
    typeof raw.tenantOperational === 'boolean' ? raw.tenantOperational : undefined
  return {
    tenantId: readString(raw, 'tenantId'),
    tenantSlug: readString(raw, 'tenantSlug'),
    tenantName: readString(raw, 'tenantName'),
    branchId,
    branchSlug: readString(raw, 'branchSlug'),
    branchName: readString(raw, 'branchName'),
    checkout,
    currency,
    tenantOperational,
  }
}

export function inferCartOwnershipFromItems(items: CartItem[]): CartOwnership | null {
  const branchId = items[0]?.branch_id || items[0]?.menu_item?.branch_id
  if (!branchId) return null
  return {
    tenantId: '',
    tenantSlug: '',
    tenantName: '',
    branchId,
    branchSlug: '',
    branchName: '',
  }
}

export function coalesceCartOwnership(
  rawOwnership: unknown,
  items: CartItem[],
): CartOwnership | null {
  const parsed = parseCartOwnership(rawOwnership)
  if (parsed) return parsed
  return inferCartOwnershipFromItems(items)
}

export function getActiveCartContext(
  items: CartItem[],
  ownership: CartOwnership | null | undefined,
): CartOwnership | null {
  if (!items.length) return null
  if (ownership?.branchId) return ownership
  return inferCartOwnershipFromItems(items)
}

export function hasActiveCart(
  items: CartItem[],
  ownership?: CartOwnership | null,
): boolean {
  return getActiveCartContext(items, ownership ?? null) !== null
}

export function isSameOrderingContext(
  active: CartOwnership | null | undefined,
  target: CartOwnershipInput | null | undefined,
): boolean {
  if (!active?.branchId || !target?.branchId) return false
  if (active.branchId !== target.branchId) return false
  if (active.tenantId && target.tenantId && active.tenantId !== target.tenantId) return false
  return true
}

export function hasOrderingConflict(
  items: CartItem[],
  ownership: CartOwnership | null | undefined,
  target: CartOwnershipInput | null | undefined,
): boolean {
  const active = getActiveCartContext(items, ownership)
  if (!active) return false
  if (!target?.branchId) return false
  return !isSameOrderingContext(active, target)
}

export function canAddItem(
  items: CartItem[],
  ownership: CartOwnership | null | undefined,
  target: CartOwnershipInput | null | undefined,
): boolean {
  return !hasOrderingConflict(items, ownership, target)
}

export function resolveCartMenuUrl(ownership: CartOwnership | null | undefined): string {
  if (!ownership) return '/menu'
  return buildPublicUrl({
    tenantSlug: ownership.tenantSlug || null,
    branchSlug: ownership.branchSlug || null,
    module: 'menu',
  })
}

export function resolveCheckoutBranchId(
  items: CartItem[],
  ownership: CartOwnership | null | undefined,
): string | null {
  return getActiveCartContext(items, ownership)?.branchId ?? null
}

export function isActiveCartCheckoutEnabled(ownership: CartOwnership | null | undefined): boolean {
  if (!ownership?.branchId) return false
  if (ownership.tenantOperational === false) return false
  if (ownership.checkout) return isBranchOrderingEnabled(ownership.checkout)
  return true
}

export function buildCartOwnershipFromStores(args: {
  item: MenuItem
  tenant?: Pick<Tenant, 'id' | 'slug' | 'name' | 'status'> | null
  branch?: Pick<Branch, 'id' | 'slug' | 'name' | 'tenant_id' | 'checkout' | 'currency'> | null
  override?: CartOwnershipInput | null
}): CartOwnership | null {
  const branchId = args.override?.branchId || args.item.branch_id
  if (!branchId) return null
  const branchMatches = args.branch?.id === branchId
  const tenantOperational = args.tenant ? canOrderFromTenant(args.tenant) : args.override?.tenantOperational
  return {
    tenantId: args.override?.tenantId || args.tenant?.id || args.branch?.tenant_id || '',
    tenantSlug: args.override?.tenantSlug || args.tenant?.slug || '',
    tenantName: args.override?.tenantName || args.tenant?.name || '',
    branchId,
    branchSlug: args.override?.branchSlug || (branchMatches ? args.branch?.slug ?? '' : ''),
    branchName: args.override?.branchName || (branchMatches ? args.branch?.name ?? '' : ''),
    checkout: args.override?.checkout ?? (branchMatches ? args.branch?.checkout : undefined),
    currency: args.override?.currency ?? (branchMatches ? args.branch?.currency : undefined),
    tenantOperational,
  }
}
