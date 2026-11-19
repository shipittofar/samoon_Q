/**
 * Phase 1 — business verticals (docs/BUSINESS_SERVICES_ROADMAP.md).
 * Registry, attribute serialization, payload shaping, modules, provisioning.
 */
import { describe, it, expect } from 'vitest'
import {
  VERTICALS,
  DEFAULT_VERTICAL,
  resolveVertical,
  attributesForKind,
  effectiveItemKind,
  serializeAttributes,
  attributesToFormValues,
  numericAttribute,
} from '@/verticals'
import { menuItemFormToWriteRequest, menuItemToFormInput, type MenuItemFormInput } from '@/types/menu-item'
import { getModule, getAdminNav, hasCapability } from '@/modules/registry'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'
import { buildCustomerJourney } from '@/utils/journey'
import type { MenuItem } from '@/types'
import en from '@/i18n/locales/en.json'

const BASE_FORM: MenuItemFormInput = {
  name: 'Haircut', description: 'Wash, cut & style', price: '450000', discount: '', calories: '120',
  preparation_time: '20', image: { file: null, existingUrl: '', cleared: false }, category_id: 'cat-1',
  available: true, is_active: true, is_featured: false, is_popular: false, extra_group_ids: [], tag_ids: [],
}

describe('vertical registry', () => {
  it('resolves food tenants (and unknown/empty types) to the default food vertical', () => {
    expect(resolveVertical(['restaurant'])).toBe(DEFAULT_VERTICAL)
    expect(resolveVertical(['cafe']).family).toBe('food')
    expect(resolveVertical([])).toBe(DEFAULT_VERTICAL)
    expect(resolveVertical(undefined)).toBe(DEFAULT_VERTICAL)
    expect(resolveVertical(['not-a-type'])).toBe(DEFAULT_VERTICAL)
  })

  it('resolves service verticals', () => {
    expect(resolveVertical(['beauty_salon']).family).toBe('service')
    expect(resolveVertical(['clinic']).family).toBe('service')
  })

  it('every food vertical keeps cart + food fields; service verticals have neither', () => {
    for (const v of Object.values(VERTICALS)) {
      if (v.family === 'food') {
        expect(v.supportsCart && v.usesFoodFields).toBe(true)
        expect(v.itemKinds).toEqual(['product'])
      } else {
        expect(v.supportsCart || v.usesFoodFields).toBe(false)
        expect(v.itemKinds[0]).toBe('service')
      }
    }
  })

  it('attributesForKind filters by appliesTo', () => {
    const salon = VERTICALS.beauty_salon
    expect(attributesForKind(salon, 'service').map((a) => a.key)).toContain('duration_minutes')
    expect(attributesForKind(salon, 'product').map((a) => a.key)).not.toContain('duration_minutes')
  })

  it('effectiveItemKind falls back to the vertical default for missing/invalid kinds', () => {
    expect(effectiveItemKind(VERTICALS.clinic, undefined)).toBe('service')
    expect(effectiveItemKind(VERTICALS.clinic, 'product')).toBe('service') // clinic has no products
    expect(effectiveItemKind(VERTICALS.beauty_salon, 'product')).toBe('product')
  })
})

describe('attribute serialization', () => {
  const salon = VERTICALS.beauty_salon

  it('types values and drops empty / out-of-range / unknown ones', () => {
    const out = serializeAttributes(salon, 'service', {
      duration_minutes: '45',
      price_is_starting: true,
      requires_appointment: false,
      audience: 'women',
      unknown_field: 'x',
    })
    expect(out).toEqual({ duration_minutes: 45, price_is_starting: true, requires_appointment: false, audience: 'women' })
    expect(serializeAttributes(salon, 'service', { duration_minutes: '' })).toEqual({})
    expect(serializeAttributes(salon, 'service', { duration_minutes: '2' })).toEqual({}) // below min 5
    expect(serializeAttributes(salon, 'service', { audience: 'aliens' })).toEqual({})
  })

  it('drops fields that do not apply to the selected kind', () => {
    expect(serializeAttributes(salon, 'product', { duration_minutes: '30' })).toEqual({})
  })

  it('round-trips through form values', () => {
    const attrs = { duration_minutes: 30, price_is_starting: true, audience: 'men' }
    expect(serializeAttributes(salon, 'service', attributesToFormValues(attrs))).toEqual(attrs)
  })

  it('numericAttribute only returns finite numbers', () => {
    expect(numericAttribute({ duration_minutes: 30 }, 'duration_minutes')).toBe(30)
    expect(numericAttribute({ duration_minutes: '30' }, 'duration_minutes')).toBeUndefined()
    expect(numericAttribute(undefined, 'duration_minutes')).toBeUndefined()
  })
})

describe('menuItemFormToWriteRequest — payload shaping per vertical', () => {
  it('food (default): identical legacy payload, no item_kind/attributes', () => {
    const req = menuItemFormToWriteRequest(BASE_FORM)
    expect(req.calories).toBe(120)
    expect(req.preparation_time).toBe(20)
    expect(req).not.toHaveProperty('item_kind')
    expect(req).not.toHaveProperty('attributes')
    expect(menuItemFormToWriteRequest(BASE_FORM, VERTICALS.cafe)).toEqual(req)
  })

  it('service: no food fields; item_kind + typed attributes', () => {
    const req = menuItemFormToWriteRequest(
      { ...BASE_FORM, item_kind: 'service', attributes: { duration_minutes: '60', requires_appointment: true } },
      VERTICALS.clinic,
    )
    expect(req).not.toHaveProperty('calories')
    expect(req).not.toHaveProperty('preparation_time')
    expect(req.item_kind).toBe('service')
    expect(req.attributes).toEqual({ duration_minutes: 60, requires_appointment: true })
  })

  it('service with no kind chosen sends the vertical default', () => {
    expect(menuItemFormToWriteRequest(BASE_FORM, VERTICALS.beauty_salon).item_kind).toBe('service')
  })

  it('menuItemToFormInput carries item_kind and attributes back into the form', () => {
    const item = {
      id: 'i1', branch_id: 'b1', category_id: 'c1', name: 'Consultation', slug: 'consultation', description: '',
      price: 1, image: '', preparation_time: 0, rating: 0, rating_count: 0, available: true, is_active: true,
      item_kind: 'service', attributes: { duration_minutes: 20, requires_appointment: true },
    } as MenuItem
    const form = menuItemToFormInput(item)
    expect(form.item_kind).toBe('service')
    expect(form.attributes).toEqual({ duration_minutes: '20', requires_appointment: true })
  })
})

describe('service vertical modules', () => {
  for (const key of ['beauty_salon', 'clinic'] as const) {
    it(`${key}: registered, has the catalog, no ordering/QR/kitchen`, () => {
      const mod = getModule(key)
      expect(mod?.businessTypes).toEqual([key])
      expect(hasCapability([key], 'menu')).toBe(true)
      expect(hasCapability([key], 'ordering')).toBe(false)
      expect(hasCapability([key], 'qr_table')).toBe(false)
      const hrefs = getAdminNav([key]).map((i) => i.href)
      expect(hrefs).toContain('/console/menu')
      expect(hrefs).toContain('/console/reservations')
      expect(hrefs).not.toContain('/console/orders')
      expect(hrefs).not.toContain('/console/kitchen')
      expect(hrefs).not.toContain('/console/extras')
      expect(getAdminNav([key]).find((i) => i.href === '/console/menu')?.labelKey).toBe('servicesNav')
    })
  }
})

describe('provisioning', () => {
  for (const key of ['beauty_salon', 'clinic'] as const) {
    it(`${key}: template exists, ordering off, reservations on`, () => {
      const flags = tenantProvisioningService.generateFeatureFlags(key)
      expect(flags['menu.enabled']).toBe(true)
      expect(flags['ordering.enabled']).toBe(false)
      expect(flags['reservations.enabled']).toBe(true)
      expect(tenantProvisioningService.generateModuleConfiguration(key).moduleKey).toBe(key)
    })

    it(`${key}: passes validation`, () => {
      const r = tenantProvisioningService.validateTenantConfiguration({
        name: 'Test', description: 'x', businessType: key, branding: { primaryColor: '#123456' },
      })
      expect(r.errors).toEqual([])
    })
  }
})

describe('public journey + wording', () => {
  it('service verticals put booking first', () => {
    const ctas = {
      menu: { key: 'menu', href: '/m', label: 'm' },
      reservation: { key: 'reservation', href: '/r', label: 'r' },
      locations: null, loyalty: null,
    } as never
    expect(buildCustomerJourney({ businessTypes: ['clinic'], ctas }).primaryCTA?.href).toBe('/r')
    expect(buildCustomerJourney({ businessTypes: ['beauty_salon'], ctas }).navPriority[0]).toBe('menu')
  })

  it('every attribute and select option in the registry has an English label', () => {
    const v = en.verticals as {
      attributes: Record<string, string>
      attributeOptions: Record<string, Record<string, string>>
      itemKinds: Record<string, string>
      labels: Record<string, string>
    }
    for (const vertical of Object.values(VERTICALS)) {
      expect(v.labels[vertical.key]).toBeTruthy()
      for (const kind of vertical.itemKinds) expect(v.itemKinds[kind]).toBeTruthy()
      for (const a of vertical.attributes) {
        expect(v.attributes[a.key]).toBeTruthy()
        for (const opt of a.options ?? []) expect(v.attributeOptions[a.key]?.[opt]).toBeTruthy()
      }
    }
  })
})
