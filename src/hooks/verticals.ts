'use client'

/**
 * Phase 1 — vertical-aware hooks.
 *
 * useTenantVertical() resolves the active tenant's vertical (food menu,
 * beauty salon, clinic, …); useCatalogTerms() returns wording for it.
 *
 * Wording lookup order (i18n namespace `verticals`):
 *   terms.<verticalKey>.<key>  →  terms.<family>.<key>
 * so a vertical only overrides the few words that differ from its family
 * (e.g. a clinic says "Services & fees" where a salon says "Services").
 */
import { useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useTenantStore } from '@/stores'
import { resolveVertical, type VerticalDefinition } from '@/verticals'

export function useTenantVertical(): VerticalDefinition {
  const businessTypes = useTenantStore((s) => s.tenant?.businessTypes)
  return useMemo(() => resolveVertical(businessTypes), [businessTypes])
}

export type CatalogTermKey =
  | 'pageSubtitle'
  | 'preview'
  | 'selectBranch'
  | 'loading'
  | 'loadFailed'
  | 'categoriesHint'
  | 'viewFull'
  | 'catalog'
  | 'catalogItem'
  | 'catalogItems'
  | 'addItem'
  | 'itemName'
  | 'newItemTitle'
  | 'editItemTitle'
  | 'emptyState'
  | 'searchPlaceholder'

export function useCatalogTerms(vertical?: VerticalDefinition) {
  const tenantVertical = useTenantVertical()
  const active = vertical ?? tenantVertical
  const t = useTranslations('verticals')

  const term = useCallback(
    (key: CatalogTermKey): string => {
      const specific = `terms.${active.key}.${key}`
      return t.has(specific) ? t(specific) : t(`terms.${active.family}.${key}`)
    },
    [t, active],
  )

  return { vertical: active, term }
}

/**
 * Public CTA / footer links are built in plain utils (public-context.ts) with
 * English labels. This maps those known labels to localized, vertical-aware
 * text ("Reserve a Table" → "Book an appointment" for a salon). Unknown
 * labels (e.g. owner-customized ones) are returned unchanged.
 */
const PUBLIC_LINK_KEYS: Readonly<Record<string, string>> = {
  'Order Online': 'orderOnline',
  'View Menu': 'viewMenu',
  'Reserve a Table': 'reserve',
  Loyalty: 'loyalty',
  'Choose a Location': 'chooseLocation',
  Home: 'home',
  Menu: 'menu',
  Reservations: 'reservations',
  Locations: 'locations',
  'Discover More': 'discoverMore',
}

export function usePublicLinkLabel() {
  const { vertical } = useCatalogTerms()
  const t = useTranslations('verticals')
  return useCallback(
    (label: string): string => {
      const key = PUBLIC_LINK_KEYS[label]
      if (!key) return label
      const scoped = `publicLinks.${vertical.family}.${key}`
      if (t.has(scoped)) return t(scoped)
      const common = `publicLinks.common.${key}`
      return t.has(common) ? t(common) : label
    },
    [t, vertical.family],
  )
}
