/**
 * P6.10 — Happy Hour & Promotions Engine tests
 *
 * Covers:
 *   A. Type definitions — PromotionType, PromotionSchedule, HappyHourRule, PromotionRule
 *   B. isPromotionActive() — date range checks
 *   C. isPromotionActive() — weekday checks
 *   D. isPromotionActive() — time window checks
 *   E. isTimeInWindow() — helper
 *   F. validateSchedule() — schedule validation
 *   G. Service — getPromotions() mock
 *   H. Service — getActivePromotions() mock
 *   I. Service — createPromotion() happy path
 *   J. Service — createPromotion() schedule validation
 *   K. Service — updatePromotion()
 *   L. Service — disablePromotion() / activatePromotion()
 *   M. Service — _resetMockStore()
 *   N. Capability enforcement — promotions in cafe/bar only
 *   O. Feature flags — promotions.enabled in cafe and bar modules
 *   P. Endpoints — PROMOTIONS shape
 *   Q. Hooks — source-text existence
 *   R. Customer /promotions page — source-text structure
 *   S. Admin /console/promotions page — source-text structure
 *   T. Mock mode compatibility
 */
import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PromotionRule, PromotionSchedule } from '@/types'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

async function freshService() {
  vi.resetModules()
  return import('@/services/promotion.service')
}

// ── A. Type definitions ───────────────────────────────────────────────────────

describe('A. Promotion domain types', () => {
  it('types source defines PromotionType union', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain("'percentage_discount'")
    expect(src).toContain("'fixed_discount'")
    expect(src).toContain("'buy_one_get_one'")
    expect(src).toContain("'happy_hour'")
  })

  it('types source defines PromotionSchedule interface', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('PromotionSchedule')
    expect(src).toContain('startAt:')
    expect(src).toContain('endAt?:')
    expect(src).toContain('weekdays?:')
    expect(src).toContain('timeWindowStart?:')
    expect(src).toContain('timeWindowEnd?:')
  })

  it('types source defines HappyHourRule interface', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('HappyHourRule')
    expect(src).toContain('discountPercent:')
    expect(src).toContain('applicableItemIds:')
  })

  it('types source defines PromotionRule interface', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('PromotionRule')
    expect(src).toContain('type: PromotionType')
  })

  it('types source defines Weekday type', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('Weekday')
  })
})

// ── B. isPromotionActive() — date range ───────────────────────────────────────

describe('B. isPromotionActive() — date range', () => {
  const makePromo = (overrides: Partial<PromotionRule> = {}): PromotionRule => ({
    id: 'test',
    name: 'Test',
    description: 'Test',
    type: 'percentage_discount',
    discountPercent: 10,
    applicableItemIds: [],
    active: true,
    schedule: {
      startAt: new Date(Date.now() - 86_400_000).toISOString(),
      endAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  it('returns true when now is within startAt–endAt range', async () => {
    const { isPromotionActive } = await freshService()
    expect(isPromotionActive(makePromo())).toBe(true)
  })

  it('returns false when active=false', async () => {
    const { isPromotionActive } = await freshService()
    expect(isPromotionActive(makePromo({ active: false }))).toBe(false)
  })

  it('returns false when startAt is in the future', async () => {
    const { isPromotionActive } = await freshService()
    const promo = makePromo()
    promo.schedule.startAt = new Date(Date.now() + 3_600_000).toISOString()
    expect(isPromotionActive(promo)).toBe(false)
  })

  it('returns false when endAt is in the past', async () => {
    const { isPromotionActive } = await freshService()
    const promo = makePromo()
    promo.schedule.endAt = new Date(Date.now() - 3_600_000).toISOString()
    expect(isPromotionActive(promo)).toBe(false)
  })

  it('returns true when endAt is omitted (open-ended)', async () => {
    const { isPromotionActive } = await freshService()
    const promo = makePromo()
    delete promo.schedule.endAt
    expect(isPromotionActive(promo)).toBe(true)
  })
})

// ── C. isPromotionActive() — weekday ─────────────────────────────────────────

describe('C. isPromotionActive() — weekday filter', () => {
  it('returns true when weekdays not specified', async () => {
    const { isPromotionActive } = await freshService()
    const promo: PromotionRule = {
      id: 'w', name: 'W', description: 'W', type: 'happy_hour', discountPercent: 10,
      applicableItemIds: [], active: true,
      schedule: { startAt: new Date(Date.now() - 1000).toISOString() },
      createdAt: '', updatedAt: '',
    }
    expect(isPromotionActive(promo)).toBe(true)
  })

  it('returns false when current ISO weekday not in weekdays list', async () => {
    const { isPromotionActive } = await freshService()
    // Use a fixed "now" that is a Monday (ISO 1)
    const monday = new Date('2025-01-06T12:00:00Z') // Jan 6, 2025 is Monday
    const promo: PromotionRule = {
      id: 'w', name: 'W', description: 'W', type: 'happy_hour', discountPercent: 10,
      applicableItemIds: [], active: true,
      schedule: {
        startAt: new Date('2025-01-01').toISOString(),
        weekdays: [2, 3, 4, 5, 6], // Tue–Sat only
      },
      createdAt: '', updatedAt: '',
    }
    expect(isPromotionActive(promo, monday)).toBe(false)
  })

  it('returns true when current ISO weekday is in weekdays list', async () => {
    const { isPromotionActive } = await freshService()
    const monday = new Date('2025-01-06T12:00:00Z')
    const promo: PromotionRule = {
      id: 'w', name: 'W', description: 'W', type: 'happy_hour', discountPercent: 10,
      applicableItemIds: [], active: true,
      schedule: {
        startAt: new Date('2025-01-01').toISOString(),
        weekdays: [1, 2, 3], // Mon–Wed
      },
      createdAt: '', updatedAt: '',
    }
    expect(isPromotionActive(promo, monday)).toBe(true)
  })

  it('handles Sunday (ISO 7) correctly', async () => {
    const { isPromotionActive } = await freshService()
    const sunday = new Date('2025-01-05T12:00:00Z') // Jan 5, 2025 is Sunday
    const promo: PromotionRule = {
      id: 'w', name: 'W', description: 'W', type: 'happy_hour', discountPercent: 10,
      applicableItemIds: [], active: true,
      schedule: {
        startAt: new Date('2025-01-01').toISOString(),
        weekdays: [7],
      },
      createdAt: '', updatedAt: '',
    }
    expect(isPromotionActive(promo, sunday)).toBe(true)
  })
})

// ── D. isPromotionActive() — time window ──────────────────────────────────────

describe('D. isPromotionActive() — time window', () => {
  // Use a startAt far in the past so any 'now' we pass is within the date range.
  const FAR_PAST = '2000-01-01T00:00:00.000Z'

  const makeTimedPromo = (timeWindowStart: string, timeWindowEnd: string): PromotionRule => ({
    id: 't', name: 'T', description: 'T', type: 'happy_hour', discountPercent: 20,
    applicableItemIds: [], active: true,
    schedule: { startAt: FAR_PAST, timeWindowStart, timeWindowEnd },
    createdAt: '', updatedAt: '',
  })

  // Build test times from current date so they aren't affected by system timezone
  const todayAt = (hour: number, minute = 0) => {
    const d = new Date()
    d.setHours(hour, minute, 0, 0)
    return d
  }

  it('returns true when current time is within window', async () => {
    const { isPromotionActive } = await freshService()
    expect(isPromotionActive(makeTimedPromo('16:00', '19:00'), todayAt(17, 30))).toBe(true)
  })

  it('returns false when before time window', async () => {
    const { isPromotionActive } = await freshService()
    expect(isPromotionActive(makeTimedPromo('16:00', '19:00'), todayAt(15, 0))).toBe(false)
  })

  it('returns false when after time window', async () => {
    const { isPromotionActive } = await freshService()
    expect(isPromotionActive(makeTimedPromo('16:00', '19:00'), todayAt(20, 0))).toBe(false)
  })

  it('returns false at exactly timeWindowEnd (exclusive)', async () => {
    const { isPromotionActive } = await freshService()
    expect(isPromotionActive(makeTimedPromo('16:00', '19:00'), todayAt(19, 0))).toBe(false)
  })

  it('returns true at exactly timeWindowStart (inclusive)', async () => {
    const { isPromotionActive } = await freshService()
    expect(isPromotionActive(makeTimedPromo('16:00', '19:00'), todayAt(16, 0))).toBe(true)
  })
})

// ── E. isTimeInWindow() ───────────────────────────────────────────────────────

describe('E. isTimeInWindow()', () => {
  it('returns true for time within window', async () => {
    const { isTimeInWindow } = await freshService()
    expect(isTimeInWindow('17:00', { timeWindowStart: '16:00', timeWindowEnd: '19:00' })).toBe(true)
  })

  it('returns false for time before window', async () => {
    const { isTimeInWindow } = await freshService()
    expect(isTimeInWindow('15:59', { timeWindowStart: '16:00', timeWindowEnd: '19:00' })).toBe(false)
  })

  it('returns false for time at or after window end', async () => {
    const { isTimeInWindow } = await freshService()
    expect(isTimeInWindow('19:00', { timeWindowStart: '16:00', timeWindowEnd: '19:00' })).toBe(false)
  })

  it('returns true when no window defined', async () => {
    const { isTimeInWindow } = await freshService()
    expect(isTimeInWindow('12:00', {})).toBe(true)
  })
})

// ── F. validateSchedule() ─────────────────────────────────────────────────────

describe('F. validateSchedule()', () => {
  it('returns empty array for valid schedule', async () => {
    const { validateSchedule } = await freshService()
    const schedule: PromotionSchedule = {
      startAt: new Date(Date.now() - 1000).toISOString(),
      endAt: new Date(Date.now() + 86_400_000).toISOString(),
      weekdays: [1, 2, 3],
      timeWindowStart: '16:00',
      timeWindowEnd: '19:00',
    }
    expect(validateSchedule(schedule)).toHaveLength(0)
  })

  it('returns error when startAt missing', async () => {
    const { validateSchedule } = await freshService()
    const errors = validateSchedule({ startAt: '' })
    expect(errors.some((e) => e.includes('startAt'))).toBe(true)
  })

  it('returns error when endAt <= startAt', async () => {
    const { validateSchedule } = await freshService()
    const now = new Date().toISOString()
    const errors = validateSchedule({
      startAt: now,
      endAt: now,
    })
    expect(errors.some((e) => e.includes('endAt'))).toBe(true)
  })

  it('returns error for invalid weekday values', async () => {
    const { validateSchedule } = await freshService()
    const errors = validateSchedule({
      startAt: new Date().toISOString(),
      weekdays: [0, 8] as any,
    })
    expect(errors.some((e) => e.includes('weekday'))).toBe(true)
  })

  it('returns error when timeWindowEnd <= timeWindowStart', async () => {
    const { validateSchedule } = await freshService()
    const errors = validateSchedule({
      startAt: new Date().toISOString(),
      timeWindowStart: '19:00',
      timeWindowEnd: '16:00',
    })
    expect(errors.some((e) => e.includes('timeWindowEnd'))).toBe(true)
  })

  it('returns error when time window is equal', async () => {
    const { validateSchedule } = await freshService()
    const errors = validateSchedule({
      startAt: new Date().toISOString(),
      timeWindowStart: '16:00',
      timeWindowEnd: '16:00',
    })
    expect(errors.some((e) => e.includes('timeWindowEnd'))).toBe(true)
  })
})

// ── G. Service — getPromotions() ──────────────────────────────────────────────

describe('G. promotionService.getPromotions()', () => {
  it('returns an array', async () => {
    const { promotionService } = await freshService()
    const all = await promotionService.getPromotions()
    expect(Array.isArray(all)).toBe(true)
  })

  it('initial mock has 5 promotions', async () => {
    const { promotionService } = await freshService()
    const all = await promotionService.getPromotions()
    expect(all).toHaveLength(5)
  })

  it('includes disabled promotions', async () => {
    const { promotionService } = await freshService()
    const all = await promotionService.getPromotions()
    expect(all.some((p) => !p.active)).toBe(true)
  })

  it('promotion shape is correct', async () => {
    const { promotionService } = await freshService()
    const all = await promotionService.getPromotions()
    const p = all[0]
    expect(p).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      type: expect.stringMatching(/^(percentage_discount|fixed_discount|buy_one_get_one|happy_hour)$/),
      active: expect.any(Boolean),
      schedule: expect.objectContaining({ startAt: expect.any(String) }),
    })
  })
})

// ── H. Service — getActivePromotions() ───────────────────────────────────────

describe('H. promotionService.getActivePromotions()', () => {
  it('returns only promotions active at the given time', async () => {
    const { promotionService } = await freshService()
    // Use a Tuesday at 17:30 — happy-hour promo (Mon–Fri 16–19) should be active
    const tuesdayAfternoon = new Date('2025-06-03T17:30:00')
    const active = await promotionService.getActivePromotions(tuesdayAfternoon)
    expect(Array.isArray(active)).toBe(true)
    expect(active.every((p) => p.active)).toBe(true)
  })

  it('returns empty array when no promotions are active', async () => {
    const { promotionService } = await freshService()
    // Use a time far in the future beyond all endAt dates
    const future = new Date('2099-01-01T00:00:00')
    const active = await promotionService.getActivePromotions(future)
    expect(active).toHaveLength(0)
  })

  it('happy_hour promo is active on a weekday afternoon', async () => {
    const { promotionService } = await freshService()
    // Build a Wednesday at 17:00 that is within the mock's date range (yesterday–30 days from now)
    const now = new Date()
    const daysToWed = (3 - now.getDay() + 7) % 7 || 7 // next Wednesday (or today if Wed)
    const wednesday17 = new Date(now)
    wednesday17.setDate(now.getDate() + (daysToWed <= 6 ? daysToWed : 0))
    wednesday17.setHours(17, 0, 0, 0)
    const active = await promotionService.getActivePromotions(wednesday17)
    expect(active.some((p) => p.type === 'happy_hour')).toBe(true)
  })

  it('happy_hour promo is not active outside time window', async () => {
    const { promotionService } = await freshService()
    // Wednesday at 09:00 — within date range but outside 16:00–19:00 window
    const now = new Date()
    const daysToWed = (3 - now.getDay() + 7) % 7 || 7
    const wednesday9 = new Date(now)
    wednesday9.setDate(now.getDate() + (daysToWed <= 6 ? daysToWed : 0))
    wednesday9.setHours(9, 0, 0, 0)
    const active = await promotionService.getActivePromotions(wednesday9)
    expect(active.every((p) => p.type !== 'happy_hour')).toBe(true)
  })
})

// ── I. Service — createPromotion() happy path ─────────────────────────────────

describe('I. promotionService.createPromotion() — happy path', () => {
  it('adds the promotion to the store', async () => {
    const { promotionService } = await freshService()
    const before = (await promotionService.getPromotions()).length
    await promotionService.createPromotion({
      name: 'Test Deal',
      description: 'Test',
      type: 'percentage_discount',
      discountPercent: 15,
      applicableItemIds: [],
      active: true,
      schedule: { startAt: new Date().toISOString() },
    })
    const after = (await promotionService.getPromotions()).length
    expect(after).toBe(before + 1)
  })

  it('returns the created promotion with id and timestamps', async () => {
    const { promotionService } = await freshService()
    const promo = await promotionService.createPromotion({
      name: 'New Promo',
      description: 'Desc',
      type: 'fixed_discount',
      discountAmount: 5,
      applicableItemIds: [],
      active: true,
      schedule: { startAt: new Date().toISOString() },
    })
    expect(promo.id).toBeTruthy()
    expect(promo.createdAt).toBeTruthy()
    expect(promo.updatedAt).toBeTruthy()
    expect(promo.name).toBe('New Promo')
  })
})

// ── J. Service — createPromotion() schedule validation ───────────────────────

describe('J. promotionService.createPromotion() — schedule validation', () => {
  it('throws when endAt is before startAt', async () => {
    const { promotionService } = await freshService()
    const now = new Date()
    const past = new Date(now.getTime() - 3_600_000).toISOString()
    await expect(
      promotionService.createPromotion({
        name: 'Bad Promo',
        description: 'X',
        type: 'percentage_discount',
        discountPercent: 10,
        applicableItemIds: [],
        active: true,
        schedule: {
          startAt: now.toISOString(),
          endAt: past,
        },
      }),
    ).rejects.toThrow()
  })

  it('throws when time window is reversed', async () => {
    const { promotionService } = await freshService()
    await expect(
      promotionService.createPromotion({
        name: 'Bad Window',
        description: 'X',
        type: 'happy_hour',
        discountPercent: 10,
        applicableItemIds: [],
        active: true,
        schedule: {
          startAt: new Date().toISOString(),
          timeWindowStart: '20:00',
          timeWindowEnd: '16:00',
        },
      }),
    ).rejects.toThrow()
  })
})

// ── K. Service — updatePromotion() ───────────────────────────────────────────

describe('K. promotionService.updatePromotion()', () => {
  it('updates promotion fields', async () => {
    const { promotionService } = await freshService()
    const updated = await promotionService.updatePromotion('promo-10-percent', {
      discountPercent: 25,
    })
    expect(updated.discountPercent).toBe(25)
  })

  it('preserves unchanged fields', async () => {
    const { promotionService } = await freshService()
    const updated = await promotionService.updatePromotion('promo-10-percent', {
      discountPercent: 25,
    })
    expect(updated.name).toBe('10% Off Your Next Order')
    expect(updated.id).toBe('promo-10-percent')
  })

  it('throws when promotion not found', async () => {
    const { promotionService } = await freshService()
    await expect(
      promotionService.updatePromotion('no-such', { discountPercent: 5 }),
    ).rejects.toThrow('not found')
  })

  it('updates updatedAt timestamp', async () => {
    const { promotionService } = await freshService()
    const before = (await promotionService.getPromotions()).find((p) => p.id === 'promo-10-percent')!
    await new Promise((r) => setTimeout(r, 2))
    await promotionService.updatePromotion('promo-10-percent', { discountPercent: 5 })
    const after = (await promotionService.getPromotions()).find((p) => p.id === 'promo-10-percent')!
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updatedAt).getTime(),
    )
  })
})

// ── L. Service — disablePromotion() / activatePromotion() ────────────────────

describe('L. disablePromotion() / activatePromotion()', () => {
  it('disablePromotion sets active=false', async () => {
    const { promotionService } = await freshService()
    const result = await promotionService.disablePromotion('promo-10-percent')
    expect(result.active).toBe(false)
  })

  it('disabled promotion not returned by getActivePromotions', async () => {
    const { promotionService } = await freshService()
    await promotionService.disablePromotion('promo-10-percent')
    const active = await promotionService.getActivePromotions()
    expect(active.every((p) => p.id !== 'promo-10-percent')).toBe(true)
  })

  it('activatePromotion sets active=true', async () => {
    const { promotionService } = await freshService()
    await promotionService.disablePromotion('promo-10-percent')
    const result = await promotionService.activatePromotion('promo-10-percent')
    expect(result.active).toBe(true)
  })
})

// ── M. Service — _resetMockStore() ───────────────────────────────────────────

describe('M. promotionService._resetMockStore()', () => {
  it('restores disabled promotions to active', async () => {
    const { promotionService } = await freshService()
    await promotionService.disablePromotion('promo-happy-hour-1')
    promotionService._resetMockStore()
    const all = await promotionService.getPromotions()
    expect(all.find((p) => p.id === 'promo-happy-hour-1')?.active).toBe(true)
  })

  it('promo-disabled remains inactive after reset (it starts disabled)', async () => {
    const { promotionService } = await freshService()
    promotionService._resetMockStore()
    const all = await promotionService.getPromotions()
    expect(all.find((p) => p.id === 'promo-disabled')?.active).toBe(false)
  })
})

// ── N. Capability enforcement — promotions in cafe/bar only ───────────────────

describe('N. Capability enforcement — promotions visibility', () => {
  it('cafe module has promotions.enabled in defaultFeatureFlags', async () => {
    vi.resetModules()
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.defaultFeatureFlags['promotions.enabled']).toBe(true)
  })

  it('bar module has promotions.enabled in defaultFeatureFlags', async () => {
    vi.resetModules()
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['promotions.enabled']).toBe(true)
  })

  it('food_court module does NOT have promotions.enabled flag', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['promotions.enabled']).toBeUndefined()
  })

  it('food_truck module does NOT have promotions.enabled flag', async () => {
    vi.resetModules()
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['promotions.enabled']).toBeUndefined()
  })

  it('restaurant module does NOT have promotions.enabled flag', async () => {
    vi.resetModules()
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect((RESTAURANT_MODULE.defaultFeatureFlags as Record<string, unknown>)['promotions.enabled']).toBeUndefined()
  })

  it('mobile_cafe module does NOT have promotions.enabled flag', async () => {
    vi.resetModules()
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['promotions.enabled']).toBeUndefined()
  })
})

// ── O. Feature flags ──────────────────────────────────────────────────────────

describe('O. Feature flags in module registries', () => {
  it('cafe module has cafe.happy_hour.enabled', async () => {
    vi.resetModules()
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect('cafe.happy_hour.enabled' in CAFE_MODULE.defaultFeatureFlags).toBe(true)
  })

  it('bar module has bar.happy_hour.enabled', async () => {
    vi.resetModules()
    const { BAR_MODULE } = await import('@/modules/registry')
    expect('bar.happy_hour.enabled' in BAR_MODULE.defaultFeatureFlags).toBe(true)
  })

  it('cafe adminNavItems includes Promotions entry gated by promotions.enabled', async () => {
    vi.resetModules()
    const { CAFE_MODULE } = await import('@/modules/registry')
    const entry = CAFE_MODULE.adminNavItems?.find((n) => n.href === '/console/promotions')
    expect(entry).toBeDefined()
    expect(entry?.featureFlagKey).toBe('promotions.enabled')
  })

  it('bar adminNavItems includes Promotions entry gated by promotions.enabled', async () => {
    vi.resetModules()
    const { BAR_MODULE } = await import('@/modules/registry')
    const entry = BAR_MODULE.adminNavItems?.find((n) => n.href === '/console/promotions')
    expect(entry).toBeDefined()
    expect(entry?.featureFlagKey).toBe('promotions.enabled')
  })

  it('cafe navItems includes Promotions gated by promotions.enabled', async () => {
    vi.resetModules()
    const { CAFE_MODULE } = await import('@/modules/registry')
    const entry = CAFE_MODULE.navItems.find((n) => n.href === '/promotions')
    expect(entry).toBeDefined()
    expect(entry?.featureFlagKey).toBe('promotions.enabled')
  })

  it('bar navItems includes Promotions gated by promotions.enabled', async () => {
    vi.resetModules()
    const { BAR_MODULE } = await import('@/modules/registry')
    const entry = BAR_MODULE.navItems.find((n) => n.href === '/promotions')
    expect(entry).toBeDefined()
    expect(entry?.featureFlagKey).toBe('promotions.enabled')
  })
})

// ── P. Endpoints ──────────────────────────────────────────────────────────────

describe('P. ENDPOINTS.PROMOTIONS shape', () => {
  it('has LIST, ACTIVE, DETAIL endpoints', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.PROMOTIONS.LIST).toBe('/promotions/')
    expect(ENDPOINTS.PROMOTIONS.ACTIVE).toBe('/promotions/active/')
  })

  it('DETAIL is a function returning correct path', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.PROMOTIONS.DETAIL('abc')).toBe('/promotions/abc/')
  })

  it('ACTIVATE is a function returning correct path', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.PROMOTIONS.ACTIVATE('xyz')).toBe('/promotions/xyz/activate/')
  })
})

// ── Q. Hooks — source-text existence ─────────────────────────────────────────

describe('Q. Promotion hooks source-text', () => {
  const src = readSrc('hooks/index.ts')

  it('exports usePromotions', () => {
    expect(src).toContain('export function usePromotions')
  })

  it('exports useActivePromotions', () => {
    expect(src).toContain('export function useActivePromotions')
  })

  it('exports useCreatePromotion', () => {
    expect(src).toContain('export function useCreatePromotion')
  })

  it('exports useUpdatePromotion', () => {
    expect(src).toContain('export function useUpdatePromotion')
  })

  it('exports useDisablePromotion', () => {
    expect(src).toContain('export function useDisablePromotion')
  })

  it('exports useActivatePromotion', () => {
    expect(src).toContain('export function useActivatePromotion')
  })

  it('imports promotionService', () => {
    expect(src).toContain("from '@/services/promotion.service'")
  })

  it('invalidates active-promotions on useCreatePromotion success', () => {
    expect(src).toContain("queryKey: ['active-promotions']")
  })
})

// ── R. Customer /promotions page ──────────────────────────────────────────────

describe('R. /promotions/page.tsx source-text', () => {
  const src = readSrc('app/promotions/PromotionsClientPage.tsx')

  it('uses usePromotions', () => {
    expect(src).toContain('usePromotions')
  })

  it('uses useActivePromotions', () => {
    expect(src).toContain('useActivePromotions')
  })

  it('has Active Promotions section', () => {
    expect(src).toContain("t('activePromotions')")
  })

  it('has Happy Hour Offers section', () => {
    expect(src).toContain("t('happyHourOffers')")
  })

  it('has Upcoming Promotions section', () => {
    expect(src).toContain("t('upcomingPromotions')")
  })

  it('is a client component', () => {
    expect(src.trimStart()).toMatch(/^'use client'/)
  })

  it('uses CapabilityGuard', () => {
    expect(src).toContain('CapabilityGuard')
  })
})

// ── S. Admin /console/promotions page ──────────────────────────────────────────

describe('S. /console/promotions/page.tsx source-text', () => {
  const src = readSrc('app/console/promotions/page.tsx')

  it('uses usePromotions', () => {
    expect(src).toContain('usePromotions')
  })

  it('uses useCreatePromotion', () => {
    expect(src).toContain('useCreatePromotion')
  })

  it('uses useUpdatePromotion', () => {
    expect(src).toContain('useUpdatePromotion')
  })

  it('uses useDisablePromotion', () => {
    expect(src).toContain('useDisablePromotion')
  })

  it('uses useActivatePromotion', () => {
    expect(src).toContain('useActivatePromotion')
  })

  it('has Promotion Management heading', () => {
    expect(src).toContain('Promotion Management')
  })

  it('has Create Promotion button', () => {
    expect(src).toContain('Create Promotion')
  })

  it('has Disable button', () => {
    expect(src).toContain('Disable')
  })

  it('has Activate button', () => {
    expect(src).toContain('Activate')
  })

  it('has Edit button', () => {
    expect(src).toContain('Edit')
  })

  it('is a client component', () => {
    expect(src.trimStart()).toMatch(/^'use client'/)
  })

  it('renders weekday picker', () => {
    expect(src).toContain('Weekday')
  })

  it('renders time window inputs', () => {
    expect(src).toContain('timeWindowStart')
  })
})

// ── T. Mock mode compatibility ────────────────────────────────────────────────

describe('T. Mock mode compatibility', () => {
  it('all service methods are callable functions', async () => {
    const { promotionService } = await freshService()
    expect(typeof promotionService.getPromotions).toBe('function')
    expect(typeof promotionService.getActivePromotions).toBe('function')
    expect(typeof promotionService.createPromotion).toBe('function')
    expect(typeof promotionService.updatePromotion).toBe('function')
    expect(typeof promotionService.disablePromotion).toBe('function')
    expect(typeof promotionService.activatePromotion).toBe('function')
    expect(typeof promotionService.isPromotionActive).toBe('function')
    expect(typeof promotionService.validateSchedule).toBe('function')
    expect(typeof promotionService.isTimeInWindow).toBe('function')
    expect(typeof promotionService._resetMockStore).toBe('function')
  })

  it('service source uses USE_MOCK guard', () => {
    const src = readSrc('services/promotion.service.ts')
    expect(src).toContain('USE_MOCK')
    expect(src).toContain('NEXT_PUBLIC_USE_MOCK')
  })

  it('module-level mock state declared with let', () => {
    const src = readSrc('services/promotion.service.ts')
    expect(src).toContain('let mockPromotions')
  })

  it('state persists across calls in same module instance', async () => {
    const { promotionService } = await freshService()
    const before = (await promotionService.getPromotions()).length
    await promotionService.createPromotion({
      name: 'Persistent',
      description: 'X',
      type: 'fixed_discount',
      discountAmount: 1,
      applicableItemIds: [],
      active: true,
      schedule: { startAt: new Date().toISOString() },
    })
    const after = (await promotionService.getPromotions()).length
    expect(after).toBe(before + 1)
  })

  it('happy_hour type included in mock promotions', async () => {
    const { promotionService } = await freshService()
    const all = await promotionService.getPromotions()
    expect(all.some((p) => p.type === 'happy_hour')).toBe(true)
  })

  it('buy_one_get_one type included in mock promotions', async () => {
    const { promotionService } = await freshService()
    const all = await promotionService.getPromotions()
    expect(all.some((p) => p.type === 'buy_one_get_one')).toBe(true)
  })
})
