import { describe, it, expect } from 'vitest'
import { endTime } from '@/components/admin/ReservationDuration'
import { RULE_FIELDS, ruleOutOfRange, type RuleLimits } from '@/services/reservation-rules.service'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import ar from '@/i18n/locales/ar.json'

const limits = {
  slot_minutes: [5, 720], duration_minutes: [5, 1440], last_before_close_minutes: [0, 1440],
  lead_minutes: [0, 43200], max_days_ahead: [1, 365], max_concurrent: [1, 1000],
} as RuleLimits

describe('reservation rules', () => {
  it('empty is inherited; anything else must be a whole number in range', () => {
    expect(ruleOutOfRange('slot_minutes', null, limits)).toBe(false)
    expect(ruleOutOfRange('slot_minutes', 60, limits)).toBe(false)
    expect(ruleOutOfRange('lead_minutes', 0, limits)).toBe(false)
    for (const bad of [4, 721, 30.5, NaN]) expect(ruleOutOfRange('slot_minutes', bad, limits)).toBe(true)
  })

  it('end time wraps past midnight', () => {
    expect(endTime('19:00', 90)).toBe('20:30')
    expect(endTime('23:30', 60)).toBe('00:30')
  })

  it('names every field in every language', () => {
    for (const l of [en, fa, ar]) {
      for (const group of ['fields', 'hints'] as const) {
        expect(Object.keys(l.console.reservationRules[group]).sort()).toEqual([...RULE_FIELDS].sort())
      }
    }
  })
})
