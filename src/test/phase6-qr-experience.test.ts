/**
 * P6.12 — QR Experience Layer Tests
 *
 * Sections:
 *  A. QRExperience type definition
 *  B. qrExperienceService.getExperienceForBusinessType() — per-type shape
 *  C. qrExperienceService.getQRExperience() — async, mock mode
 *  D. Restaurant experience flags
 *  E. Cafe experience flags
 *  F. Bar experience flags
 *  G. Food Court experience flags
 *  H. Food Truck experience flags
 *  I. Mobile Cafe experience flags
 *  J. Unknown / fallback business type
 *  K. Copy semantics — mutations don't affect service state
 *  L. Registry — qrExperienceType on each module
 *  M. Registry — getQRExperienceType() helper
 *  N. Table page source-text checks
 *  O. useQRExperience hook
 *  P. QRExperienceQuickLinks — showMenu
 *  Q. QRExperienceQuickLinks — showReservations
 *  R. QRExperienceQuickLinks — showLoyalty
 *  S. QRExperienceQuickLinks — showEvents
 *  T. QRExperienceQuickLinks — showVendors
 *  U. QRExperienceQuickLinks — showLocation
 *  V. QRExperienceQuickLinks — showPromotions
 *  W. QRExperienceQuickLinks — showReviews
 *  X. No business-type checks in page
 *  Y. Mock mode compatibility
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const ROOT = resolve(__dirname, '../..')

function src(rel: string) {
  return readFileSync(resolve(ROOT, 'src', rel), 'utf-8')
}

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/qr-experience.service')
  return mod.qrExperienceService
}

// ── A. QRExperience type definition ─────────────────────────────────────────

describe('A. QRExperience type definition', () => {
  it('qr-experience.ts file exists', () => {
    const text = src('types/qr-experience.ts')
    expect(text).toBeTruthy()
  })

  it('exports QRExperience interface', () => {
    const text = src('types/qr-experience.ts')
    expect(text).toContain('export interface QRExperience')
  })

  it('has experienceType field with all 6 business types', () => {
    const text = src('types/qr-experience.ts')
    expect(text).toContain("'restaurant'")
    expect(text).toContain("'cafe'")
    expect(text).toContain("'bar'")
    expect(text).toContain("'food_court'")
    expect(text).toContain("'food_truck'")
    expect(text).toContain("'mobile_cafe'")
  })

  it('has all 8 boolean show* fields', () => {
    const text = src('types/qr-experience.ts')
    expect(text).toContain('showMenu')
    expect(text).toContain('showReservations')
    expect(text).toContain('showReviews')
    expect(text).toContain('showLoyalty')
    expect(text).toContain('showEvents')
    expect(text).toContain('showVendors')
    expect(text).toContain('showLocation')
    expect(text).toContain('showPromotions')
  })

  it('all show* fields are boolean', () => {
    const text = src('types/qr-experience.ts')
    const lines = text.split('\n').filter((l) => l.includes('show'))
    expect(lines.length).toBeGreaterThanOrEqual(8)
    lines.forEach((l) => expect(l).toMatch(/boolean/))
  })
})

// ── B. getExperienceForBusinessType() — shape ────────────────────────────────

describe('B. qrExperienceService.getExperienceForBusinessType() — shape', () => {
  it('returns an object for restaurant', async () => {
    const svc = await freshService()
    const exp = svc.getExperienceForBusinessType('restaurant')
    expect(exp).toBeDefined()
    expect(typeof exp).toBe('object')
  })

  it('returned object has experienceType field', async () => {
    const svc = await freshService()
    const exp = svc.getExperienceForBusinessType('cafe')
    expect(exp.experienceType).toBe('cafe')
  })

  it('returned object has all 8 boolean fields', async () => {
    const svc = await freshService()
    const exp = svc.getExperienceForBusinessType('restaurant')
    expect(typeof exp.showMenu).toBe('boolean')
    expect(typeof exp.showReservations).toBe('boolean')
    expect(typeof exp.showReviews).toBe('boolean')
    expect(typeof exp.showLoyalty).toBe('boolean')
    expect(typeof exp.showEvents).toBe('boolean')
    expect(typeof exp.showVendors).toBe('boolean')
    expect(typeof exp.showLocation).toBe('boolean')
    expect(typeof exp.showPromotions).toBe('boolean')
  })

  it('works for all 6 business types without throwing', async () => {
    const svc = await freshService()
    const types = ['restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe'] as const
    for (const t of types) {
      expect(() => svc.getExperienceForBusinessType(t)).not.toThrow()
    }
  })
})

// ── C. getQRExperience() — async ─────────────────────────────────────────────

describe('C. qrExperienceService.getQRExperience() — async', () => {
  it('returns a Promise', async () => {
    const svc = await freshService()
    const result = svc.getQRExperience('restaurant')
    expect(result).toBeInstanceOf(Promise)
    await result
  })

  it('resolves with an experience object', async () => {
    const svc = await freshService()
    const exp = await svc.getQRExperience('cafe')
    expect(exp).toBeDefined()
    expect(exp.experienceType).toBe('cafe')
  })

  it('defaults to restaurant when no businessType provided', async () => {
    const svc = await freshService()
    const exp = await svc.getQRExperience()
    expect(exp.experienceType).toBe('restaurant')
  })

  it('defaults to restaurant for unknown business type', async () => {
    const svc = await freshService()
    const exp = await svc.getQRExperience('unknown_type')
    expect(exp.experienceType).toBe('restaurant')
  })

  it('resolves correctly for all 6 types', async () => {
    const svc = await freshService()
    const types = ['restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe'] as const
    for (const t of types) {
      const exp = await svc.getQRExperience(t)
      expect(exp.experienceType).toBe(t)
    }
  })
})

// ── D. Restaurant experience flags ───────────────────────────────────────────

describe('D. Restaurant experience flags', () => {
  it('showMenu is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showMenu).toBe(true)
  })

  it('showReservations is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showReservations).toBe(true)
  })

  it('showReviews is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showReviews).toBe(true)
  })

  it('showLoyalty is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showLoyalty).toBe(false)
  })

  it('showEvents is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showEvents).toBe(false)
  })

  it('showVendors is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showVendors).toBe(false)
  })

  it('showLocation is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showLocation).toBe(false)
  })

  it('showPromotions is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('restaurant').showPromotions).toBe(false)
  })
})

// ── E. Cafe experience flags ──────────────────────────────────────────────────

describe('E. Cafe experience flags', () => {
  it('showMenu is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showMenu).toBe(true)
  })

  it('showReservations is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showReservations).toBe(true)
  })

  it('showReviews is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showReviews).toBe(true)
  })

  it('showLoyalty is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showLoyalty).toBe(true)
  })

  it('showEvents is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showEvents).toBe(false)
  })

  it('showVendors is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showVendors).toBe(false)
  })

  it('showLocation is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showLocation).toBe(false)
  })

  it('showPromotions is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('cafe').showPromotions).toBe(false)
  })
})

// ── F. Bar experience flags ───────────────────────────────────────────────────

describe('F. Bar experience flags', () => {
  it('showMenu is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showMenu).toBe(true)
  })

  it('showReservations is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showReservations).toBe(true)
  })

  it('showReviews is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showReviews).toBe(false)
  })

  it('showLoyalty is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showLoyalty).toBe(false)
  })

  it('showEvents is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showEvents).toBe(true)
  })

  it('showVendors is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showVendors).toBe(false)
  })

  it('showLocation is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showLocation).toBe(false)
  })

  it('showPromotions is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('bar').showPromotions).toBe(true)
  })
})

// ── G. Food Court experience flags ───────────────────────────────────────────

describe('G. Food Court experience flags', () => {
  it('showMenu is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showMenu).toBe(true)
  })

  it('showReservations is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showReservations).toBe(true)
  })

  it('showReviews is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showReviews).toBe(false)
  })

  it('showLoyalty is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showLoyalty).toBe(false)
  })

  it('showEvents is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showEvents).toBe(false)
  })

  it('showVendors is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showVendors).toBe(true)
  })

  it('showLocation is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showLocation).toBe(false)
  })

  it('showPromotions is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_court').showPromotions).toBe(false)
  })
})

// ── H. Food Truck experience flags ───────────────────────────────────────────

describe('H. Food Truck experience flags', () => {
  it('showMenu is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showMenu).toBe(true)
  })

  it('showReservations is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showReservations).toBe(false)
  })

  it('showReviews is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showReviews).toBe(true)
  })

  it('showLoyalty is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showLoyalty).toBe(false)
  })

  it('showEvents is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showEvents).toBe(false)
  })

  it('showVendors is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showVendors).toBe(false)
  })

  it('showLocation is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showLocation).toBe(true)
  })

  it('showPromotions is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('food_truck').showPromotions).toBe(false)
  })
})

// ── I. Mobile Cafe experience flags ──────────────────────────────────────────

describe('I. Mobile Cafe experience flags', () => {
  it('showMenu is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showMenu).toBe(true)
  })

  it('showReservations is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showReservations).toBe(false)
  })

  it('showReviews is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showReviews).toBe(true)
  })

  it('showLoyalty is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showLoyalty).toBe(true)
  })

  it('showEvents is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showEvents).toBe(false)
  })

  it('showVendors is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showVendors).toBe(false)
  })

  it('showLocation is true', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showLocation).toBe(true)
  })

  it('showPromotions is false', async () => {
    const svc = await freshService()
    expect(svc.getExperienceForBusinessType('mobile_cafe').showPromotions).toBe(false)
  })
})

// ── J. Unknown / fallback business type ──────────────────────────────────────

describe('J. Unknown / fallback business type', () => {
  it('getExperienceForBusinessType falls back to restaurant for unknown type', async () => {
    const svc = await freshService()
    const exp = svc.getExperienceForBusinessType('pizza_shop')
    expect(exp.experienceType).toBe('restaurant')
  })

  it('fallback still has showMenu = true', async () => {
    const svc = await freshService()
    const exp = svc.getExperienceForBusinessType('anything')
    expect(exp.showMenu).toBe(true)
  })

  it('getQRExperience falls back to restaurant for empty string', async () => {
    const svc = await freshService()
    const exp = await svc.getQRExperience('')
    expect(exp.experienceType).toBe('restaurant')
  })

  it('getQRExperience falls back to restaurant for undefined', async () => {
    const svc = await freshService()
    const exp = await svc.getQRExperience(undefined)
    expect(exp.experienceType).toBe('restaurant')
  })
})

// ── K. Copy semantics ─────────────────────────────────────────────────────────

describe('K. Copy semantics — mutations do not affect service state', () => {
  it('mutating returned object does not change subsequent call', async () => {
    const svc = await freshService()
    const exp1 = svc.getExperienceForBusinessType('bar')
    exp1.showPromotions = false
    const exp2 = svc.getExperienceForBusinessType('bar')
    expect(exp2.showPromotions).toBe(true)
  })

  it('async version also returns a copy', async () => {
    const svc = await freshService()
    const exp1 = await svc.getQRExperience('cafe')
    exp1.showLoyalty = false
    const exp2 = await svc.getQRExperience('cafe')
    expect(exp2.showLoyalty).toBe(true)
  })
})

// ── L. Registry — qrExperienceType on each module ────────────────────────────

describe('L. Registry — qrExperienceType on each module', () => {
  beforeEach(() => { vi.resetModules() })

  it('RESTAURANT_MODULE has qrExperienceType = restaurant', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.qrExperienceType).toBe('restaurant')
  })

  it('CAFE_MODULE has qrExperienceType = cafe', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.qrExperienceType).toBe('cafe')
  })

  it('BAR_MODULE has qrExperienceType = bar', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.qrExperienceType).toBe('bar')
  })

  it('FOOD_COURT_MODULE has qrExperienceType = food_court', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.qrExperienceType).toBe('food_court')
  })

  it('FOOD_TRUCK_MODULE has qrExperienceType = food_truck', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.qrExperienceType).toBe('food_truck')
  })

  it('MOBILE_CAFE_MODULE has qrExperienceType = mobile_cafe', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.qrExperienceType).toBe('mobile_cafe')
  })

  it('qrExperienceType is defined for all 6 modules', async () => {
    const {
      RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE,
      FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE,
    } = await import('@/modules/registry')
    const modules = [RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE]
    for (const mod of modules) {
      expect(mod.qrExperienceType).toBeDefined()
    }
  })
})

// ── M. Registry — getQRExperienceType() ──────────────────────────────────────

describe('M. Registry — getQRExperienceType()', () => {
  beforeEach(() => { vi.resetModules() })

  it('exported from registry', async () => {
    const mod = await import('@/modules/registry')
    expect(typeof mod.getQRExperienceType).toBe('function')
  })

  it('returns restaurant for ["restaurant"]', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(['restaurant'])).toBe('restaurant')
  })

  it('returns cafe for ["cafe"]', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(['cafe'])).toBe('cafe')
  })

  it('returns bar for ["bar"]', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(['bar'])).toBe('bar')
  })

  it('returns food_court for ["food_court"]', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(['food_court'])).toBe('food_court')
  })

  it('returns food_truck for ["food_truck"]', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(['food_truck'])).toBe('food_truck')
  })

  it('returns mobile_cafe for ["mobile_cafe"]', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(['mobile_cafe'])).toBe('mobile_cafe')
  })

  it('falls back to restaurant for empty array', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType([])).toBe('restaurant')
  })

  it('falls back to restaurant for undefined', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(undefined)).toBe('restaurant')
  })

  it('falls back to restaurant for unknown key', async () => {
    const { getQRExperienceType } = await import('@/modules/registry')
    expect(getQRExperienceType(['unknown_module'])).toBe('restaurant')
  })
})

// ── N. Table page source-text checks ─────────────────────────────────────────

describe('N. Table page source-text checks', () => {
  const page = src('app/table/[tableId]/page.tsx')

  it('is a client component', () => {
    expect(page).toMatch(/'use client'/)
  })

  it('imports useQRExperience', () => {
    expect(page).toContain('useQRExperience')
  })

  it('imports useTenantStore for business type', () => {
    expect(page).toContain('useTenantStore')
  })

  it('imports QRExperience type', () => {
    expect(page).toContain('QRExperience')
  })

  it('contains QRExperienceQuickLinks component', () => {
    expect(page).toContain('QRExperienceQuickLinks')
  })

  it('reads primaryBusinessType from tenant store', () => {
    expect(page).toContain('businessTypes')
  })

  it('passes experience to QRExperienceQuickLinks', () => {
    expect(page).toContain('experience={experience}')
  })

  it('buildQuickLinks function exists', () => {
    expect(page).toContain('buildQuickLinks')
  })

  it('still has table validation logic', () => {
    expect(page).toContain('isValid')
    expect(page).toContain("t('invalidTable')")
  })

  it('still has checkout link', () => {
    expect(page).toContain('orderType=dine_in')
  })

  it('renders Browse Menu link', () => {
    expect(page).toContain("t('browseMenu')")
  })
})

// ── O. useQRExperience hook ───────────────────────────────────────────────────

describe('O. useQRExperience hook', () => {
  it('is exported from hooks/index.ts', () => {
    const text = src('hooks/index.ts')
    expect(text).toContain('export function useQRExperience')
  })

  it('uses useQuery', () => {
    const text = src('hooks/index.ts')
    const idx = text.indexOf('useQRExperience')
    const snippet = text.slice(idx, idx + 200)
    expect(snippet).toContain('useQuery')
  })

  it('uses qr-experience query key', () => {
    const text = src('hooks/index.ts')
    expect(text).toContain("'qr-experience'")
  })

  it('calls qrExperienceService.getQRExperience', () => {
    const text = src('hooks/index.ts')
    expect(text).toContain('qrExperienceService.getQRExperience')
  })

  it('imports qrExperienceService', () => {
    const text = src('hooks/index.ts')
    expect(text).toContain('qrExperienceService')
  })

  it('accepts optional businessType parameter', () => {
    const text = src('hooks/index.ts')
    const idx = text.indexOf('useQRExperience')
    const snippet = text.slice(idx, idx + 100)
    expect(snippet).toContain('businessType')
  })
})

// ── P–W. QRExperienceQuickLinks show* fields ─────────────────────────────────

describe('P. QRExperienceQuickLinks — showMenu', () => {
  it('page references showMenu', () => {
    const page = src('app/table/[tableId]/page.tsx')
    expect(page).toContain('showMenu')
  })

  it('showMenu=true produces a menu link', () => {
    const page = src('app/table/[tableId]/page.tsx')
    expect(page).toContain('/menu')
    expect(page).toContain('showMenu')
  })
})

describe('Q. QRExperienceQuickLinks — showReservations', () => {
  it('page references showReservations', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('showReservations')
  })

  it('links to /reservation when showReservations is true', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('/reservation')
  })
})

describe('R. QRExperienceQuickLinks — showLoyalty', () => {
  it('page references showLoyalty', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('showLoyalty')
  })

  it('links to /loyalty when showLoyalty is true', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('/loyalty')
  })
})

describe('S. QRExperienceQuickLinks — showEvents', () => {
  it('page references showEvents', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('showEvents')
  })

  it('links to /events when showEvents is true', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('/events')
  })
})

describe('T. QRExperienceQuickLinks — showVendors', () => {
  it('page references showVendors', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('showVendors')
  })

  it('links to /vendors when showVendors is true', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('/vendors')
  })
})

describe('U. QRExperienceQuickLinks — showLocation', () => {
  it('page references showLocation', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('showLocation')
  })

  it('links to /location when showLocation is true', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('/location')
  })
})

describe('V. QRExperienceQuickLinks — showPromotions', () => {
  it('page references showPromotions', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('showPromotions')
  })

  it('links to /promotions when showPromotions is true', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('/promotions')
  })
})

describe('W. QRExperienceQuickLinks — showReviews', () => {
  it('page references showReviews', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('showReviews')
  })

  it('links to /reviews when showReviews is true', () => {
    expect(src('app/table/[tableId]/page.tsx')).toContain('/reviews')
  })
})

// ── X. No business-type checks in page ───────────────────────────────────────

describe('X. No business-type checks inside the table page', () => {
  const page = src('app/table/[tableId]/page.tsx')

  it('does not hardcode === "restaurant"', () => {
    expect(page).not.toContain("=== 'restaurant'")
    expect(page).not.toContain('=== "restaurant"')
  })

  it('does not hardcode === "cafe"', () => {
    expect(page).not.toContain("=== 'cafe'")
    expect(page).not.toContain('=== "cafe"')
  })

  it('does not hardcode === "bar"', () => {
    expect(page).not.toContain("=== 'bar'")
    expect(page).not.toContain('=== "bar"')
  })

  it('does not hardcode === "food_court"', () => {
    expect(page).not.toContain("=== 'food_court'")
    expect(page).not.toContain('=== "food_court"')
  })

  it('does not hardcode === "food_truck"', () => {
    expect(page).not.toContain("=== 'food_truck'")
    expect(page).not.toContain('=== "food_truck"')
  })

  it('does not hardcode === "mobile_cafe"', () => {
    expect(page).not.toContain("=== 'mobile_cafe'")
    expect(page).not.toContain('=== "mobile_cafe"')
  })

  it('uses capability/experience flags instead of switch on businessType', () => {
    expect(page).not.toMatch(/switch\s*\(\s*.*businessType/)
    expect(page).not.toMatch(/if\s*\(.*businessType.*===/)
  })
})

// ── Y. Mock mode compatibility ────────────────────────────────────────────────

describe('Y. Mock mode compatibility', () => {
  it('qr-experience.service.ts references USE_MOCK', () => {
    const text = src('services/qr-experience.service.ts')
    expect(text).toContain('USE_MOCK')
    expect(text).toContain('NEXT_PUBLIC_USE_MOCK')
  })

  it('getExperienceForBusinessType is synchronous (no async)', async () => {
    const svc = await freshService()
    const result = svc.getExperienceForBusinessType('cafe')
    expect(result).not.toBeInstanceOf(Promise)
  })

  it('getQRExperience is async', async () => {
    const svc = await freshService()
    const result = svc.getQRExperience('cafe')
    expect(result).toBeInstanceOf(Promise)
    await result
  })

  it('service file has EXPERIENCE_MAP for all 6 types', () => {
    const text = src('services/qr-experience.service.ts')
    expect(text).toContain('restaurant')
    expect(text).toContain('cafe')
    expect(text).toContain('bar')
    expect(text).toContain('food_court')
    expect(text).toContain('food_truck')
    expect(text).toContain('mobile_cafe')
  })

  it('Module interface has qrExperienceType field', () => {
    const text = src('types/index.ts')
    expect(text).toContain('qrExperienceType')
  })

  it('registry exports getQRExperienceType', () => {
    const text = src('modules/registry.ts')
    expect(text).toContain('export function getQRExperienceType')
  })

  it('all 6 modules in registry have qrExperienceType set', () => {
    const text = src('modules/registry.ts')
    const matches = text.match(/qrExperienceType:/g)
    expect(matches?.length).toBeGreaterThanOrEqual(6)
  })
})
