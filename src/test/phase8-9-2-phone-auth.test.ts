/**
 * P8.9.2 — Phone Auth UX Foundation: regression tests.
 *
 * Tests cover:
 * - Country data integrity
 * - Phone number utilities
 * - DEMO_PHONE_TO_EMAIL mapping
 * - Auth redirect completeness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  COUNTRIES,
  getFlagEmoji,
  getSortedCountries,
  searchCountries,
  guessCountryFromLocale,
  PREFERRED_COUNTRY_CODES,
} from '@/data/countries'
import { DEMO_PHONE_TO_EMAIL } from '@/utils/auth-redirect'
import { getDemoRedirect } from '@/utils/auth-redirect'

// ── Country data ───────────────────────────────────────────────────────────────

describe('COUNTRIES data', () => {
  it('has at least 150 countries', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(150)
  })

  it('every country has a non-empty code, name, dialCode, and placeholder', () => {
    for (const c of COUNTRIES) {
      expect(c.code, `${c.name} code`).toMatch(/^[A-Z]{2}$/)
      expect(c.name, `${c.code} name`).toBeTruthy()
      expect(c.dialCode, `${c.code} dialCode`).toMatch(/^\+\d+$/)
      expect(c.placeholder, `${c.code} placeholder`).toBeTruthy()
    }
  })

  it('all ISO codes are unique', () => {
    const codes = COUNTRIES.map((c) => c.code)
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
  })

  it('contains all preferred countries', () => {
    const codes = new Set(COUNTRIES.map((c) => c.code))
    for (const p of PREFERRED_COUNTRY_CODES) {
      expect(codes.has(p), `preferred country ${p}`).toBe(true)
    }
  })

  it('includes US, GB, IN, DE, FR, JP, BR, AU, AE', () => {
    const codes = new Set(COUNTRIES.map((c) => c.code))
    for (const code of ['US', 'GB', 'IN', 'DE', 'FR', 'JP', 'BR', 'AU', 'AE']) {
      expect(codes.has(code), code).toBe(true)
    }
  })
})

// ── getFlagEmoji ───────────────────────────────────────────────────────────────

describe('getFlagEmoji', () => {
  it('returns a two-codepoint string for US', () => {
    const flag = getFlagEmoji('US')
    expect([...flag].length).toBe(2) // each flag = 2 regional indicators
  })

  it('is case-insensitive', () => {
    expect(getFlagEmoji('us')).toBe(getFlagEmoji('US'))
  })

  it('produces correct US flag: 🇺🇸', () => {
    expect(getFlagEmoji('US')).toBe('🇺🇸')
  })

  it('produces correct GB flag: 🇬🇧', () => {
    expect(getFlagEmoji('GB')).toBe('🇬🇧')
  })
})

// ── getSortedCountries ─────────────────────────────────────────────────────────

describe('getSortedCountries', () => {
  it('returns all countries', () => {
    expect(getSortedCountries().length).toBe(COUNTRIES.length)
  })

  it('places preferred countries first', () => {
    const sorted = getSortedCountries()
    const firstCodes = sorted.slice(0, PREFERRED_COUNTRY_CODES.length).map((c) => c.code)
    expect(firstCodes).toEqual(PREFERRED_COUNTRY_CODES)
  })

  it('remainder is sorted alphabetically', () => {
    const sorted = getSortedCountries()
    const rest = sorted.slice(PREFERRED_COUNTRY_CODES.length)
    for (let i = 1; i < rest.length; i++) {
      expect(rest[i].name.localeCompare(rest[i - 1].name)).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── searchCountries ────────────────────────────────────────────────────────────

describe('searchCountries', () => {
  it('returns all countries on empty query', () => {
    expect(searchCountries('').length).toBe(COUNTRIES.length)
  })

  it('finds US by name', () => {
    const results = searchCountries('united states')
    expect(results.some((c) => c.code === 'US')).toBe(true)
  })

  it('finds US by code', () => {
    const results = searchCountries('us')
    expect(results.some((c) => c.code === 'US')).toBe(true)
  })

  it('finds UK by dial code', () => {
    const results = searchCountries('+44')
    expect(results.some((c) => c.code === 'GB')).toBe(true)
  })

  it('returns empty array for nonsense query', () => {
    expect(searchCountries('zzzzz').length).toBe(0)
  })

  it('is case-insensitive', () => {
    const lower = searchCountries('germany')
    const upper = searchCountries('GERMANY')
    expect(lower.length).toBe(upper.length)
    expect(lower[0]?.code).toBe(upper[0]?.code)
  })
})

// ── guessCountryFromLocale ─────────────────────────────────────────────────────

describe('guessCountryFromLocale', () => {
  const originalNavigator = global.navigator

  afterEach(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, writable: true, configurable: true })
  })

  it('returns US for en-US locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
      configurable: true,
    })
    const result = guessCountryFromLocale()
    expect(result?.code).toBe('US')
  })

  it('returns DE for de-DE locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'de-DE' },
      writable: true,
      configurable: true,
    })
    const result = guessCountryFromLocale()
    expect(result?.code).toBe('DE')
  })

  it('returns null for bare language without region', () => {
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en' },
      writable: true,
      configurable: true,
    })
    const result = guessCountryFromLocale()
    expect(result).toBeNull()
  })
})

// ── DEMO_PHONE_TO_EMAIL ────────────────────────────────────────────────────────

describe('DEMO_PHONE_TO_EMAIL', () => {
  it('has exactly 10 entries', () => {
    expect(Object.keys(DEMO_PHONE_TO_EMAIL).length).toBe(10)
  })

  it('all keys are E.164 format', () => {
    for (const phone_number of Object.keys(DEMO_PHONE_TO_EMAIL)) {
      expect(phone_number, phone_number).toMatch(/^\+\d{10,15}$/)
    }
  })

  it('all values are samoon.com emails', () => {
    for (const email of Object.values(DEMO_PHONE_TO_EMAIL)) {
      expect(email, email).toMatch(/@samoon\.com$/)
    }
  })

  it('maps correct phones to correct emails', () => {
    expect(DEMO_PHONE_TO_EMAIL['+14155550101']).toBe('demo@samoon.com')
    expect(DEMO_PHONE_TO_EMAIL['+14155550104']).toBe('kitchen@samoon.com')
    expect(DEMO_PHONE_TO_EMAIL['+14155550105']).toBe('marketing@samoon.com')
    expect(DEMO_PHONE_TO_EMAIL['+14155550109']).toBe('platform@samoon.com')
    expect(DEMO_PHONE_TO_EMAIL['+14155550110']).toBe('multirole@samoon.com')
  })
})

// ── getDemoRedirect via phone_number → email chain ────────────────────────────────────

describe('getDemoRedirect (via phone_number→email chain)', () => {
  it('kitchen phone_number eventually maps to /console/kitchen', () => {
    const email = DEMO_PHONE_TO_EMAIL['+14155550104']
    expect(getDemoRedirect(email)).toBe('/console/kitchen')
  })

  it('marketing phone_number eventually maps to /console/analytics', () => {
    const email = DEMO_PHONE_TO_EMAIL['+14155550105']
    expect(getDemoRedirect(email)).toBe('/console/analytics')
  })

  it('platform phone_number eventually maps to /console/tenants', () => {
    const email = DEMO_PHONE_TO_EMAIL['+14155550109']
    expect(getDemoRedirect(email)).toBe('/console/tenants')
  })
})
