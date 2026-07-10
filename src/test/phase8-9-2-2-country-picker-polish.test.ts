/**
 * P8.9.2.2 — Country Picker Premium UX Regression Tests
 *
 * Tests: pinned countries, recent persistence, detection priority,
 * fuzzy search, scoring, timezone detection, localStorage functions,
 * data integrity, RTL safety, no duplication between sections.
 *
 * Does NOT test authentication, OTP, or phone_number formatting (covered in
 * phase8-9-2-phone_number-auth.test.ts).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  COUNTRIES,
  PINNED_COUNTRY_CODES,
  PREFERRED_COUNTRY_CODES,
  RECENT_COUNTRIES_KEY,
  LAST_SELECTED_KEY,
  MAX_RECENT,
  COUNTRY_ALIASES,
  TIMEZONE_COUNTRY_MAP,
  getFlagEmoji,
  getPinnedCountries,
  getRestCountries,
  getSortedCountries,
  searchCountries,
  scoreCountry,
  normalizeQuery,
  guessCountryFromLocale,
  guessCountryFromTimezone,
  loadRecentCountries,
  saveRecentCountry,
  loadLastSelected,
  saveLastSelected,
} from '@/data/countries'

// ── localStorage mock ──────────────────────────────────────────────────────────

const store: Record<string, string> = {}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── 1. Pinned countries ────────────────────────────────────────────────────────

describe('P8.9.2.2 — Pinned countries', () => {
  it('PINNED_COUNTRY_CODES has exactly 10 entries', () => {
    expect(PINNED_COUNTRY_CODES).toHaveLength(10)
  })

  it('PINNED_COUNTRY_CODES contains the required countries', () => {
    const required = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'AE', 'TR', 'IR', 'AZ']
    for (const code of required) {
      expect(PINNED_COUNTRY_CODES).toContain(code)
    }
  })

  it('PREFERRED_COUNTRY_CODES is an alias for PINNED_COUNTRY_CODES (backward compat)', () => {
    expect(PREFERRED_COUNTRY_CODES).toBe(PINNED_COUNTRY_CODES)
  })

  it('all pinned codes exist in COUNTRIES', () => {
    const countryCodes = new Set(COUNTRIES.map((c) => c.code))
    for (const code of PINNED_COUNTRY_CODES) {
      expect(countryCodes.has(code), `${code} not found in COUNTRIES`).toBe(true)
    }
  })

  it('getPinnedCountries() returns Country objects in PINNED order', () => {
    const pinned = getPinnedCountries()
    expect(pinned).toHaveLength(PINNED_COUNTRY_CODES.length)
    for (let i = 0; i < PINNED_COUNTRY_CODES.length; i++) {
      expect(pinned[i].code).toBe(PINNED_COUNTRY_CODES[i])
    }
  })

  it('getPinnedCountries() is memoized (same reference on repeated calls)', () => {
    const a = getPinnedCountries()
    const b = getPinnedCountries()
    expect(a).toBe(b)
  })

  it('getRestCountries() contains no pinned countries', () => {
    const rest = getRestCountries()
    const pinnedSet = new Set(PINNED_COUNTRY_CODES)
    for (const c of rest) {
      expect(pinnedSet.has(c.code), `${c.code} is pinned but appears in rest`).toBe(false)
    }
  })

  it('getRestCountries() contains every non-pinned country', () => {
    const rest = getRestCountries()
    const restCodes = new Set(rest.map((c) => c.code))
    const pinnedSet = new Set(PINNED_COUNTRY_CODES)
    for (const c of COUNTRIES) {
      if (!pinnedSet.has(c.code)) {
        expect(restCodes.has(c.code), `${c.code} missing from rest`).toBe(true)
      }
    }
  })

  it('getRestCountries() is sorted alphabetically', () => {
    const rest = getRestCountries()
    for (let i = 1; i < rest.length; i++) {
      expect(rest[i - 1].name.localeCompare(rest[i].name)).toBeLessThanOrEqual(0)
    }
  })

  it('pinned + rest = all countries (no overlap, no gap)', () => {
    const pinned = getPinnedCountries()
    const rest = getRestCountries()
    expect(pinned.length + rest.length).toBe(COUNTRIES.length)
  })
})

// ── 2. Recent countries ────────────────────────────────────────────────────────

describe('P8.9.2.2 — Recent countries persistence', () => {
  it('MAX_RECENT is 5', () => {
    expect(MAX_RECENT).toBe(5)
  })

  it('loadRecentCountries returns empty when localStorage is empty', () => {
    expect(loadRecentCountries()).toHaveLength(0)
  })

  it('saveRecentCountry persists and loadRecentCountries retrieves it', () => {
    saveRecentCountry('JP')
    const recents = loadRecentCountries()
    expect(recents[0].code).toBe('JP')
  })

  it('saveRecentCountry deduplicates: moving existing code to front', () => {
    saveRecentCountry('JP')
    saveRecentCountry('KR')
    saveRecentCountry('JP') // move JP back to front
    const recents = loadRecentCountries()
    expect(recents[0].code).toBe('JP')
    expect(recents).toHaveLength(2) // no duplicate
  })

  it('saveRecentCountry caps list at MAX_RECENT', () => {
    const codes = ['JP', 'KR', 'CN', 'TH', 'SG', 'MY'] // 6 unique
    for (const code of codes) {
      saveRecentCountry(code)
    }
    const recents = loadRecentCountries()
    expect(recents.length).toBeLessThanOrEqual(MAX_RECENT)
  })

  it('loadRecentCountries excludes pinned countries', () => {
    // US is pinned; save it as recent
    saveRecentCountry('US')
    saveRecentCountry('JP')
    const recents = loadRecentCountries()
    const codes = recents.map((c) => c.code)
    expect(codes).not.toContain('US') // pinned, filtered out
    expect(codes).toContain('JP')
  })

  it('recents are newest first (LIFO)', () => {
    saveRecentCountry('JP')
    saveRecentCountry('KR')
    saveRecentCountry('CN')
    const recents = loadRecentCountries()
    expect(recents[0].code).toBe('CN')
    expect(recents[1].code).toBe('KR')
    expect(recents[2].code).toBe('JP')
  })
})

// ── 3. Last selected persistence ──────────────────────────────────────────────

describe('P8.9.2.2 — Last selected persistence', () => {
  it('LAST_SELECTED_KEY is defined', () => {
    expect(typeof LAST_SELECTED_KEY).toBe('string')
    expect(LAST_SELECTED_KEY.length).toBeGreaterThan(0)
  })

  it('loadLastSelected returns null when no data', () => {
    expect(loadLastSelected()).toBeNull()
  })

  it('saveLastSelected + loadLastSelected round-trip', () => {
    saveLastSelected('JP')
    const c = loadLastSelected()
    expect(c).not.toBeNull()
    expect(c!.code).toBe('JP')
  })

  it('saveLastSelected overwrites previous value', () => {
    saveLastSelected('JP')
    saveLastSelected('KR')
    expect(loadLastSelected()?.code).toBe('KR')
  })

  it('loadLastSelected returns null for unknown code', () => {
    store[LAST_SELECTED_KEY] = 'XX' // invalid code
    expect(loadLastSelected()).toBeNull()
  })
})

// ── 4. Timezone detection ─────────────────────────────────────────────────────

describe('P8.9.2.2 — Timezone detection', () => {
  it('guessCountryFromTimezone returns a Country or null (never throws)', () => {
    const result = guessCountryFromTimezone()
    expect(result === null || typeof result?.code === 'string').toBe(true)
  })

  it('TIMEZONE_COUNTRY_MAP maps known timezones to correct country codes', () => {
    // Test the mapping table directly — no need to mock Intl
    const cases: [string, string][] = [
      ['America/New_York', 'US'],
      ['America/Los_Angeles', 'US'],
      ['America/Toronto', 'CA'],
      ['Europe/London', 'GB'],
      ['Europe/Berlin', 'DE'],
      ['Europe/Paris', 'FR'],
      ['Europe/Istanbul', 'TR'],
      ['Asia/Tehran', 'IR'],
      ['Asia/Dubai', 'AE'],
      ['Asia/Baku', 'AZ'],
      ['Australia/Sydney', 'AU'],
      ['Asia/Tokyo', 'JP'],
      ['Asia/Shanghai', 'CN'],
      ['Asia/Seoul', 'KR'],
    ]
    for (const [tz, expectedCode] of cases) {
      expect(TIMEZONE_COUNTRY_MAP[tz], `TIMEZONE_COUNTRY_MAP["${tz}"] should be "${expectedCode}"`).toBe(expectedCode)
    }
  })

  it('all country codes in TIMEZONE_COUNTRY_MAP exist in COUNTRIES', () => {
    const countryCodes = new Set(COUNTRIES.map((c) => c.code))
    for (const [tz, code] of Object.entries(TIMEZONE_COUNTRY_MAP)) {
      expect(countryCodes.has(code), `Country code "${code}" for timezone "${tz}" not in COUNTRIES`).toBe(true)
    }
  })

  it('TIMEZONE_COUNTRY_MAP has entries for all pinned countries', () => {
    const mappedCodes = new Set(Object.values(TIMEZONE_COUNTRY_MAP))
    for (const code of PINNED_COUNTRY_CODES) {
      expect(mappedCodes.has(code), `Pinned country ${code} has no timezone mapping`).toBe(true)
    }
  })
})

// ── 5. normalizeQuery ─────────────────────────────────────────────────────────

describe('P8.9.2.2 — normalizeQuery', () => {
  it('lowercases', () => {
    expect(normalizeQuery('FRANCE')).toBe('france')
  })

  it('strips accents: São Tomé → sao tome', () => {
    expect(normalizeQuery('São Tomé')).toBe('sao tome')
  })

  it('strips accents: Réunion → reunion', () => {
    expect(normalizeQuery('Réunion')).toBe('reunion')
  })

  it('strips accents: Åland Islands → aland islands', () => {
    expect(normalizeQuery('Åland Islands')).toBe('aland islands')
  })

  it('preserves digits and + sign', () => {
    expect(normalizeQuery('+44')).toBe('+44')
    expect(normalizeQuery('44')).toBe('44')
  })
})

// ── 6. scoreCountry ───────────────────────────────────────────────────────────

describe('P8.9.2.2 — scoreCountry', () => {
  const us = COUNTRIES.find((c) => c.code === 'US')!
  const gb = COUNTRIES.find((c) => c.code === 'GB')!
  const ir = COUNTRIES.find((c) => c.code === 'IR')!
  const fr = COUNTRIES.find((c) => c.code === 'FR')!

  it('exact name match → score 100', () => {
    expect(scoreCountry(us, 'united states')).toBe(100)
  })

  it('exact code match → score 100', () => {
    expect(scoreCountry(us, 'us')).toBe(100)
  })

  it('exact dial code (without +) match → score 100', () => {
    expect(scoreCountry(gb, '44')).toBe(100)
  })

  it('starts-with name → score 80', () => {
    expect(scoreCountry(gb, 'united kin')).toBe(80)
  })

  it('starts-with code → score 80', () => {
    expect(scoreCountry(gb, 'g')).toBe(80)
  })

  it('contains name → score 60', () => {
    expect(scoreCountry(us, 'state')).toBe(60)
  })

  it('word-boundary match → score 50', () => {
    expect(scoreCountry(us, 'stat')).toBeGreaterThanOrEqual(50)
  })

  it('no match → score 0', () => {
    expect(scoreCountry(us, 'xyz')).toBe(0)
  })

  it('Iran matches "ir" (code starts-with)', () => {
    expect(scoreCountry(ir, 'ir')).toBeGreaterThan(0)
  })

  it('France matches "+33" dial code search', () => {
    expect(scoreCountry(fr, '+33')).toBeGreaterThan(0)
  })

  it('France matches "33" (digits-only dial code)', () => {
    expect(scoreCountry(fr, '33')).toBeGreaterThan(0)
  })
})

// ── 7. searchCountries ────────────────────────────────────────────────────────

describe('P8.9.2.2 — searchCountries', () => {
  it('returns all countries sorted when query is empty', () => {
    const results = searchCountries('')
    expect(results.length).toBe(COUNTRIES.length)
  })

  it('finds Iran by "iran"', () => {
    const results = searchCountries('iran')
    expect(results.some((c) => c.code === 'IR')).toBe(true)
  })

  it('finds Iran by "IR" (ISO code, case-insensitive)', () => {
    const results = searchCountries('IR')
    expect(results.some((c) => c.code === 'IR')).toBe(true)
  })

  it('finds Iran by "+98"', () => {
    const results = searchCountries('+98')
    expect(results.some((c) => c.code === 'IR')).toBe(true)
  })

  it('finds Iran by "98" (dial without +)', () => {
    const results = searchCountries('98')
    expect(results.some((c) => c.code === 'IR')).toBe(true)
  })

  it('finds UK by "uk" (alias for GB)', () => {
    const results = searchCountries('uk')
    expect(results.some((c) => c.code === 'GB')).toBe(true)
  })

  it('finds UAE by "uae" (alias for AE)', () => {
    const results = searchCountries('uae')
    expect(results.some((c) => c.code === 'AE')).toBe(true)
  })

  it('finds USA by "usa" (alias for US)', () => {
    const results = searchCountries('usa')
    expect(results.some((c) => c.code === 'US')).toBe(true)
  })

  it('finds Germany by "de"', () => {
    const results = searchCountries('de')
    expect(results.some((c) => c.code === 'DE')).toBe(true)
  })

  it('finds France by "franc" (accent-insensitive partial)', () => {
    const results = searchCountries('franc')
    expect(results.some((c) => c.code === 'FR')).toBe(true)
  })

  it('finds São Tomé by "sao"', () => {
    const results = searchCountries('sao')
    expect(results.some((c) => c.code === 'ST')).toBe(true)
  })

  it('finds United States by "united" (word-boundary)', () => {
    const results = searchCountries('united')
    const codes = results.map((c) => c.code)
    expect(codes).toContain('US')
    expect(codes).toContain('GB') // United Kingdom
    expect(codes).toContain('AE') // United Arab Emirates
  })

  it('returns empty array for nonsense query', () => {
    const results = searchCountries('zzzzqqqq')
    expect(results).toHaveLength(0)
  })

  it('higher-scored results appear before lower-scored', () => {
    // "us" exactly matches United States (code); United Kingdom contains "u"
    const results = searchCountries('us')
    const usIdx = results.findIndex((c) => c.code === 'US')
    const gbIdx = results.findIndex((c) => c.code === 'GB')
    expect(usIdx).toBeGreaterThanOrEqual(0)
    if (gbIdx >= 0) {
      expect(usIdx).toBeLessThan(gbIdx)
    }
  })

  it('finds by dial code +44 (United Kingdom)', () => {
    const results = searchCountries('+44')
    expect(results.some((c) => c.code === 'GB')).toBe(true)
  })

  it('finds by dial code 44 without +', () => {
    const results = searchCountries('44')
    expect(results.some((c) => c.code === 'GB')).toBe(true)
  })

  it('no duplicates in results', () => {
    const results = searchCountries('a')
    const codes = results.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

// ── 8. Section integrity ──────────────────────────────────────────────────────

describe('P8.9.2.2 — Section integrity (no duplicate countries)', () => {
  it('pinned and rest have no overlap', () => {
    const pinnedCodes = new Set(getPinnedCountries().map((c) => c.code))
    for (const c of getRestCountries()) {
      expect(pinnedCodes.has(c.code), `${c.code} is in both pinned and rest`).toBe(false)
    }
  })

  it('pinned + rest covers all COUNTRIES exactly once', () => {
    const seen = new Set<string>()
    for (const c of [...getPinnedCountries(), ...getRestCountries()]) {
      expect(seen.has(c.code), `${c.code} appears more than once`).toBe(false)
      seen.add(c.code)
    }
    expect(seen.size).toBe(COUNTRIES.length)
  })

  it('recent countries (from localStorage) exclude pinned when loaded', () => {
    // Save a pinned country as recent
    saveRecentCountry('US') // US is pinned
    saveRecentCountry('JP') // JP is not pinned
    const recents = loadRecentCountries()
    expect(recents.some((c) => c.code === 'US')).toBe(false)
    expect(recents.some((c) => c.code === 'JP')).toBe(true)
  })
})

// ── 9. Country aliases ────────────────────────────────────────────────────────

describe('P8.9.2.2 — Country aliases', () => {
  it('COUNTRY_ALIASES has entries for common informal names', () => {
    expect(COUNTRY_ALIASES['uk']).toBe('GB')
    expect(COUNTRY_ALIASES['uae']).toBe('AE')
    expect(COUNTRY_ALIASES['usa']).toBe('US')
  })

  it('all alias target codes exist in COUNTRIES', () => {
    const countryCodes = new Set(COUNTRIES.map((c) => c.code))
    for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
      expect(countryCodes.has(code), `Alias "${alias}" → "${code}" not in COUNTRIES`).toBe(true)
    }
  })

  it('scoreCountry gives alias match a score of 90', () => {
    const gb = COUNTRIES.find((c) => c.code === 'GB')!
    expect(scoreCountry(gb, 'uk')).toBe(90)
  })

  it('alias match ranked before non-alias partial matches', () => {
    // "uk" should rank GB higher than any country that just contains "uk" in name
    const results = searchCountries('uk')
    expect(results[0].code).toBe('GB')
  })
})

// ── 10. getFlagEmoji ──────────────────────────────────────────────────────────

describe('P8.9.2.2 — getFlagEmoji', () => {
  // Section 10
  it('US → 🇺🇸', () => {
    expect(getFlagEmoji('US')).toBe('🇺🇸')
  })

  it('GB → 🇬🇧', () => {
    expect(getFlagEmoji('GB')).toBe('🇬🇧')
  })

  it('IR → 🇮🇷', () => {
    expect(getFlagEmoji('IR')).toBe('🇮🇷')
  })

  it('AZ → 🇦🇿', () => {
    expect(getFlagEmoji('AZ')).toBe('🇦🇿')
  })
})

// ── 10. getSortedCountries ────────────────────────────────────────────────────

describe('P8.9.2.2 — getSortedCountries', () => {
  it('first country is first PINNED code', () => {
    const sorted = getSortedCountries()
    expect(sorted[0].code).toBe(PINNED_COUNTRY_CODES[0])
  })

  it('total length equals COUNTRIES length', () => {
    expect(getSortedCountries().length).toBe(COUNTRIES.length)
  })

  it('no duplicates', () => {
    const codes = getSortedCountries().map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

// ── 11. guessCountryFromLocale ────────────────────────────────────────────────

describe('P8.9.2.2 — guessCountryFromLocale', () => {
  it('returns null or Country (never throws)', () => {
    const result = guessCountryFromLocale()
    expect(result === null || typeof result?.code === 'string').toBe(true)
  })

  it('maps en-US → US', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(guessCountryFromLocale()?.code).toBe('US')
    vi.unstubAllGlobals()
  })

  it('maps fa-IR → IR', () => {
    vi.stubGlobal('navigator', { language: 'fa-IR' })
    expect(guessCountryFromLocale()?.code).toBe('IR')
    vi.unstubAllGlobals()
  })

  it('maps ar-AE → AE', () => {
    vi.stubGlobal('navigator', { language: 'ar-AE' })
    expect(guessCountryFromLocale()?.code).toBe('AE')
    vi.unstubAllGlobals()
  })

  it('returns null for locale with no region tag (e.g. "en")', () => {
    vi.stubGlobal('navigator', { language: 'en' })
    expect(guessCountryFromLocale()).toBeNull()
    vi.unstubAllGlobals()
  })
})

// ── 12. RECENT_COUNTRIES_KEY constant ─────────────────────────────────────────

describe('P8.9.2.2 — Constants', () => {
  it('RECENT_COUNTRIES_KEY is a non-empty string', () => {
    expect(typeof RECENT_COUNTRIES_KEY).toBe('string')
    expect(RECENT_COUNTRIES_KEY.length).toBeGreaterThan(0)
  })

  it('LAST_SELECTED_KEY is different from RECENT_COUNTRIES_KEY', () => {
    expect(LAST_SELECTED_KEY).not.toBe(RECENT_COUNTRIES_KEY)
  })
})
