/**
 * Promotion Service — Phase 6 (P6.10)
 *
 * Provides customer-facing and admin-facing promotion / happy-hour operations.
 * Feature-flag gated: visible when `promotions.enabled` is true for cafe / bar tenants.
 *
 * USE_MOCK pattern: when NEXT_PUBLIC_USE_MOCK=true, all methods return realistic
 * in-memory data without hitting the network. Mock state resets on module reload
 * but persists within a session via module-level variables.
 */

import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type { PromotionRule, PromotionSchedule, PromotionType, Weekday } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms))

// ── Schedule helpers ──────────────────────────────────────────────────────────

/**
 * Returns true when the current wall-clock time falls within a promotion's schedule.
 * Checks: date range, weekday filter, time window.
 */
export function isPromotionActive(promotion: PromotionRule, now = new Date()): boolean {
  if (!promotion.active) return false

  const { schedule } = promotion

  // Date range
  if (now < new Date(schedule.startAt)) return false
  if (schedule.endAt && now > new Date(schedule.endAt)) return false

  // Weekday filter (ISO 1=Mon … 7=Sun)
  if (schedule.weekdays?.length) {
    const day = now.getDay() // 0=Sun, 1=Mon … 6=Sat
    // Convert JS getDay() to ISO weekday
    const isoDay = day === 0 ? 7 : day
    if (!schedule.weekdays.includes(isoDay as Weekday)) return false
  }

  // Time window
  if (schedule.timeWindowStart || schedule.timeWindowEnd) {
    const hhmm = (d: Date) => d.getHours() * 60 + d.getMinutes()
    const current = hhmm(now)
    if (schedule.timeWindowStart) {
      const [h, m] = schedule.timeWindowStart.split(':').map(Number)
      if (current < h * 60 + m) return false
    }
    if (schedule.timeWindowEnd) {
      const [h, m] = schedule.timeWindowEnd.split(':').map(Number)
      if (current >= h * 60 + m) return false
    }
  }

  return true
}

/**
 * Returns true when the given time string (HH:MM) falls within the schedule's
 * time window. Used for schedule validation.
 */
export function isTimeInWindow(
  timeStr: string,
  schedule: Pick<PromotionSchedule, 'timeWindowStart' | 'timeWindowEnd'>,
): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const t = toMins(timeStr)
  if (schedule.timeWindowStart && t < toMins(schedule.timeWindowStart)) return false
  if (schedule.timeWindowEnd && t >= toMins(schedule.timeWindowEnd)) return false
  return true
}

/**
 * Validates a PromotionSchedule and returns a list of error strings.
 * Empty array means valid.
 */
export function validateSchedule(schedule: PromotionSchedule): string[] {
  const errors: string[] = []

  if (!schedule.startAt) {
    errors.push('startAt is required')
  }

  if (schedule.endAt && schedule.startAt && new Date(schedule.endAt) <= new Date(schedule.startAt)) {
    errors.push('endAt must be after startAt')
  }

  if (schedule.weekdays) {
    const valid: Weekday[] = [1, 2, 3, 4, 5, 6, 7]
    const invalid = schedule.weekdays.filter((d) => !valid.includes(d))
    if (invalid.length) errors.push(`Invalid weekdays: ${invalid.join(', ')}`)
  }

  if (schedule.timeWindowStart && schedule.timeWindowEnd) {
    const toMins = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    if (toMins(schedule.timeWindowEnd) <= toMins(schedule.timeWindowStart)) {
      errors.push('timeWindowEnd must be after timeWindowStart')
    }
  }

  return errors
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const TOMORROW = new Date(Date.now() + 86_400_000).toISOString()
const IN_30_DAYS = new Date(Date.now() + 30 * 86_400_000).toISOString()
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString()
const IN_7_DAYS = new Date(Date.now() + 7 * 86_400_000).toISOString()

let mockPromotions: PromotionRule[] = [
  {
    id: 'promo-happy-hour-1',
    name: 'Afternoon Happy Hour',
    description: 'Get 20% off all drinks Monday–Friday from 4pm to 7pm.',
    type: 'happy_hour',
    discountPercent: 20,
    applicableItemIds: [],
    schedule: {
      startAt: YESTERDAY,
      endAt: IN_30_DAYS,
      weekdays: [1, 2, 3, 4, 5],
      timeWindowStart: '16:00',
      timeWindowEnd: '19:00',
    },
    active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'promo-10-percent',
    name: '10% Off Your Next Order',
    description: '10% off for all customers this month.',
    type: 'percentage_discount',
    discountPercent: 10,
    applicableItemIds: [],
    schedule: {
      startAt: YESTERDAY,
      endAt: IN_30_DAYS,
    },
    active: true,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'promo-bogo-latte',
    name: 'Buy One Get One Latte',
    description: 'Buy any latte and get a second one free.',
    type: 'buy_one_get_one',
    applicableItemIds: ['item-latte'],
    schedule: {
      startAt: YESTERDAY,
      endAt: IN_7_DAYS,
      weekdays: [6, 7],
    },
    active: true,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'promo-fixed-2-off',
    name: '$2 Off Any Pastry',
    description: 'Get $2 off any pastry item.',
    type: 'fixed_discount',
    discountAmount: 2,
    applicableItemIds: [],
    schedule: {
      startAt: TOMORROW,
      endAt: IN_30_DAYS,
    },
    active: true,
    created_at: '2024-01-04T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'promo-disabled',
    name: 'Expired Weekend Deal',
    description: 'This promotion has been disabled.',
    type: 'percentage_discount',
    discountPercent: 15,
    applicableItemIds: [],
    schedule: {
      startAt: YESTERDAY,
      endAt: YESTERDAY,
    },
    active: false,
    created_at: '2023-12-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
]

// ── Payload / response types ──────────────────────────────────────────────────

export type CreatePromotionPayload = Omit<PromotionRule, 'id' | 'created_at' | 'updated_at'>
export type UpdatePromotionPayload = Partial<Omit<PromotionRule, 'id' | 'created_at'>>

// ── Service ───────────────────────────────────────────────────────────────────

export const promotionService = {
  async getPromotions(): Promise<PromotionRule[]> {
    if (USE_MOCK) {
      await delay(400)
      return [...mockPromotions]
    }
    const { data } = await api.get<PromotionRule[]>(ENDPOINTS.PROMOTIONS.LIST)
    return data
  },

  async getActivePromotions(now = new Date()): Promise<PromotionRule[]> {
    if (USE_MOCK) {
      await delay(350)
      return mockPromotions.filter((p) => isPromotionActive(p, now))
    }
    const { data } = await api.get<PromotionRule[]>(ENDPOINTS.PROMOTIONS.ACTIVE)
    return data
  },

  async createPromotion(payload: CreatePromotionPayload): Promise<PromotionRule> {
    if (USE_MOCK) {
      await delay(600)
      const errors = validateSchedule(payload.schedule)
      if (errors.length) throw new Error(`Invalid schedule: ${errors.join('; ')}`)

      const promotion: PromotionRule = {
        ...payload,
        id: `promo-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      mockPromotions = [...mockPromotions, promotion]
      return promotion
    }
    const { data } = await api.post<PromotionRule>(ENDPOINTS.PROMOTIONS.LIST, payload)
    return data
  },

  async updatePromotion(id: string, payload: UpdatePromotionPayload): Promise<PromotionRule> {
    if (USE_MOCK) {
      await delay(500)
      const idx = mockPromotions.findIndex((p) => p.id === id)
      if (idx === -1) throw new Error(`Promotion "${id}" not found`)
      if (payload.schedule) {
        const errors = validateSchedule({ ...mockPromotions[idx].schedule, ...payload.schedule })
        if (errors.length) throw new Error(`Invalid schedule: ${errors.join('; ')}`)
      }
      mockPromotions = mockPromotions.map((p) =>
        p.id === id ? { ...p, ...payload, updated_at: new Date().toISOString() } : p,
      )
      return mockPromotions.find((p) => p.id === id)!
    }
    const { data } = await api.patch<PromotionRule>(ENDPOINTS.PROMOTIONS.DETAIL(id), payload)
    return data
  },

  async disablePromotion(id: string): Promise<PromotionRule> {
    return promotionService.updatePromotion(id, { active: false })
  },

  async activatePromotion(id: string): Promise<PromotionRule> {
    return promotionService.updatePromotion(id, { active: true })
  },

  isPromotionActive,
  validateSchedule,
  isTimeInWindow,

  _resetMockStore() {
    mockPromotions = mockPromotions.map((p) => ({ ...p, active: p.id !== 'promo-disabled' }))
  },
}
