'use client'

import { useCallback } from 'react'
import { useCartStore, useTenantStore, useBranchStore } from '@/stores'
import {
  buildCartOwnershipFromStores,
  type AddToCartResult,
  type CartOwnershipInput,
} from '@/lib/active-cart'
import type { Extra, MenuItem } from '@/types'

/**
 * Single storefront entry for adding to the active cart.
 * Stamps TARGET ordering context from the item + optional override, never from
 * console selectedBranch.
 */
export function useAddToCart() {
  const tenant = useTenantStore((s) => s.tenant)
  const activeBranch = useBranchStore((s) => s.activeBranch)

  const addToCart = useCallback(
    (
      item: MenuItem,
      quantity = 1,
      extras: Extra[] = [],
      notes?: string,
      override?: CartOwnershipInput | null,
    ): AddToCartResult => {
      const target = buildCartOwnershipFromStores({
        item,
        tenant,
        branch: activeBranch,
        override,
      })
      return useCartStore.getState().addItem(item, quantity, extras, notes, target)
    },
    [tenant, activeBranch],
  )

  return { addToCart }
}
