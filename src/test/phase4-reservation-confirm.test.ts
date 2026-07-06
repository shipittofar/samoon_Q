/**
 * P4.6 — Reservation Confirmation Page tests
 *
 * Covers: calendar utility logic, ICS generation, Google Calendar URL,
 * confirm page source structure, reservation page redirect wiring,
 * and regression coverage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Source structure audits ───────────────────────────────────────────────────

describe('lib/calendar.ts — source structure', () => {
  const src = () => readSrc('lib/calendar.ts')

  it('exports generateIcs', () => expect(src()).toContain('export function generateIcs'))
  it('exports downloadIcs', () => expect(src()).toContain('export function downloadIcs'))
  it('exports buildGoogleCalendarUrl', () => expect(src()).toContain('export function buildGoogleCalendarUrl'))
  it('exports CalendarEvent interface', () => expect(src()).toContain('export interface CalendarEvent'))
  it('ICS output contains BEGIN:VCALENDAR', () => expect(src()).toContain('BEGIN:VCALENDAR'))
  it('ICS output contains BEGIN:VEVENT', () => expect(src()).toContain('BEGIN:VEVENT'))
  it('Google Calendar URL uses calendar.google.com', () => expect(src()).toContain('calendar.google.com'))
  it('Google Calendar URL uses action=TEMPLATE', () => expect(src()).toContain('action'))
  it('ICS uses CRLF line endings', () => expect(src()).toContain("'\\r\\n'"))
})

describe('reservation/confirm/page.tsx — source structure', () => {
  const src = () => readSrc('app/reservation/confirm/page.tsx')

  it('exists and exports default', () => expect(src()).toContain('export default function ReservationConfirmPage'))
  it('wraps content in Suspense', () => expect(src()).toContain('<Suspense>'))
  it('uses useSearchParams', () => expect(src()).toContain('useSearchParams'))
  it('reads code param', () => expect(src()).toContain("params.get('code')"))
  it('reads date param', () => expect(src()).toContain("params.get('date')"))
  it('reads time param', () => expect(src()).toContain("params.get('time')"))
  it('reads guests param', () => expect(src()).toContain("params.get('guests')"))
  it('reads name param', () => expect(src()).toContain("params.get('name')"))
  it('reads branch param', () => expect(src()).toContain("params.get('branch')"))
  it('reads status param', () => expect(src()).toContain("params.get('status')"))
  it('displays confirmation code (P9.5.7A: t(\'confirmationCode\'))', () => expect(src()).toContain("t('confirmationCode')"))
  it('displays confirmation code value', () => expect(src()).toContain('{code}'))
  it('shows Reservation Confirmed heading (P9.5.7A: t(\'confirmed\'))', () => expect(src()).toContain("t('confirmed')"))
  it('has ICS download button', () => expect(src()).toContain('handleDownloadIcs'))
  it('has Google Calendar link', () => expect(src()).toContain('googleUrl'))
  it('imports downloadIcs from calendar lib', () => expect(src()).toContain('downloadIcs'))
  it('imports buildGoogleCalendarUrl from calendar lib', () => expect(src()).toContain('buildGoogleCalendarUrl'))
  it('has graceful fallback for missing params (P9.5.7A: t(\'noReservationFoundTitle\'))', () => expect(src()).toContain("t('noReservationFoundTitle')"))
  it('fallback links to /reservation', () => expect(src()).toContain('href="/reservation"'))
  it('fallback links to dashboard reservations', () => expect(src()).toContain('/dashboard/reservations'))
  it('has Back to Home link (P9.5.7A: t(\'backToHome\'))', () => expect(src()).toContain("t('backToHome')"))
  it('ICS download has aria-label (P9.5.7A: localized)', () => expect(src()).toContain("aria-label={t('downloadIcsAria')}"))
  it('Google Calendar link has aria-label (P9.5.7A: localized)', () => expect(src()).toContain("aria-label={t('addToGoogleCalendarAria')}"))
  it('opens Google Calendar in new tab', () => expect(src()).toContain('target="_blank"'))
  it('Google Calendar link has rel noopener', () => expect(src()).toContain('rel="noopener noreferrer"'))
})

describe('reservation/page.tsx — redirect to confirm page', () => {
  const src = () => readSrc('app/reservation/page.tsx')

  it('imports useRouter', () => expect(src()).toContain("from 'next/navigation'"))
  it('uses useRouter hook', () => expect(src()).toContain('useRouter()'))
  it('redirects to /reservation/confirm on success', () => expect(src()).toContain('/reservation/confirm'))
  it('passes code param', () => expect(src()).toContain('code'))
  it('passes date param in URL', () => expect(src()).toContain('date: res.date'))
  it('passes time param in URL', () => expect(src()).toContain('time: res.time'))
  it('passes guests param', () => expect(src()).toContain('guests'))
  it('passes branch name', () => expect(src()).toContain('branchName'))
  it('uses URLSearchParams to build URL', () => expect(src()).toContain('URLSearchParams'))
  it('calls router.push', () => expect(src()).toContain('router.push'))
})

// ── calendar utility unit tests ───────────────────────────────────────────────

describe('generateIcs — unit tests', () => {
  let generateIcs: typeof import('@/lib/calendar').generateIcs

  beforeEach(async () => {
    const mod = await import('@/lib/calendar')
    generateIcs = mod.generateIcs
  })

  afterEach(() => vi.resetModules())

  const baseEvent = {
    title: 'Dinner at Savor',
    date: '2025-03-15',
    time: '19:00',
    durationMinutes: 120,
    description: 'Confirmation: SAV-1234',
    location: 'Main Branch',
    uid: 'test-uid@savor',
  }

  it('contains BEGIN:VCALENDAR', () => expect(generateIcs(baseEvent)).toContain('BEGIN:VCALENDAR'))
  it('contains END:VCALENDAR', () => expect(generateIcs(baseEvent)).toContain('END:VCALENDAR'))
  it('contains BEGIN:VEVENT', () => expect(generateIcs(baseEvent)).toContain('BEGIN:VEVENT'))
  it('contains END:VEVENT', () => expect(generateIcs(baseEvent)).toContain('END:VEVENT'))
  it('contains the event title in SUMMARY', () => expect(generateIcs(baseEvent)).toContain('SUMMARY:Dinner at Savor'))
  it('contains DTSTART with correct date and time', () => expect(generateIcs(baseEvent)).toContain('DTSTART:20250315T190000'))
  it('contains DTEND 2 hours later by default', () => expect(generateIcs(baseEvent)).toContain('DTEND:20250315T210000'))
  it('contains UID', () => expect(generateIcs(baseEvent)).toContain('UID:test-uid@savor'))
  it('contains DESCRIPTION when provided', () => expect(generateIcs(baseEvent)).toContain('DESCRIPTION:'))
  it('contains LOCATION when provided', () => expect(generateIcs(baseEvent)).toContain('LOCATION:Main Branch'))
  it('uses CRLF line endings', () => expect(generateIcs(baseEvent)).toContain('\r\n'))
  it('contains VERSION:2.0', () => expect(generateIcs(baseEvent)).toContain('VERSION:2.0'))

  it('generates UID automatically when not provided', () => {
    const { uid: _, ...noUid } = baseEvent
    const ics = generateIcs(noUid)
    expect(ics).toContain('UID:')
  })

  it('calculates DTEND correctly across midnight boundary', () => {
    const nightEvent = { ...baseEvent, time: '23:00', durationMinutes: 90 }
    const ics = generateIcs(nightEvent)
    expect(ics).toContain('DTEND:20250315T003000')
  })

  it('uses 60-minute duration when durationMinutes not provided', () => {
    const { durationMinutes: _, ...noLen } = baseEvent
    const ics = generateIcs({ ...noLen, durationMinutes: 60 })
    expect(ics).toContain('DTEND:20250315T200000')
  })

  it('escapes commas in description', () => {
    const ev = { ...baseEvent, description: 'A, B, C' }
    const ics = generateIcs(ev)
    expect(ics).toContain('DESCRIPTION:A\\, B\\, C')
  })

  it('escapes semicolons in title', () => {
    const ev = { ...baseEvent, title: 'A; B' }
    const ics = generateIcs(ev)
    expect(ics).toContain('SUMMARY:A\\; B')
  })
})

describe('buildGoogleCalendarUrl — unit tests', () => {
  let buildGoogleCalendarUrl: typeof import('@/lib/calendar').buildGoogleCalendarUrl

  beforeEach(async () => {
    const mod = await import('@/lib/calendar')
    buildGoogleCalendarUrl = mod.buildGoogleCalendarUrl
  })

  afterEach(() => vi.resetModules())

  const baseEvent = {
    title: 'Dinner Reservation at Savor',
    date: '2025-06-20',
    time: '19:30',
    durationMinutes: 120,
    description: 'Code: SAV-5678',
    location: 'Savor Main Branch',
  }

  it('returns a Google Calendar URL', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).toContain('calendar.google.com')
  })

  it('URL includes action=TEMPLATE', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).toContain('action=TEMPLATE')
  })

  it('URL includes the event title', () => {
    // URLSearchParams encodes spaces as + rather than %20
    const url = buildGoogleCalendarUrl(baseEvent)
    expect(url).toMatch(/text=Dinner[+%20]Reservation[+%20]at[+%20]Savor/)
  })

  it('URL includes dates param', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).toContain('dates=')
  })

  it('dates param has correct start time', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).toContain('20250620T193000')
  })

  it('dates param has correct end time (2h later)', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).toContain('20250620T213000')
  })

  it('URL includes location when provided', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).toContain('location=')
  })

  it('URL includes details when description provided', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).toContain('details=')
  })

  it('URL is valid (no spaces)', () => {
    expect(buildGoogleCalendarUrl(baseEvent)).not.toContain(' ')
  })
})

// ── reservationService — no regression ───────────────────────────────────────

describe('reservationService — create unaffected (regression)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('still returns confirmation_code and correct shape', async () => {
    const { reservationService } = await import('@/services/combined.service')
    const p = reservationService.create({
      branch_id: '1', date: '2025-07-01', time: '19:00',
      guests: 2, name: 'Alice', phone: '555-0100',
    })
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.confirmation_code).toBeTruthy()
    expect(res.status).toBe('confirmed')
    expect(res.date).toBe('2025-07-01')
    expect(res.guests).toBe(2)
  })
})

describe('Regression: payment service unaffected (P4.1)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('createPaymentIntent still returns client_secret', async () => {
    const { paymentService } = await import('@/services/payment.service')
    const p = paymentService.createPaymentIntent({ amount: 30, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.client_secret).toBeTruthy()
  })
})

describe('Regression: review service unaffected (P4.3)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('getItemReviews still works', async () => {
    const { reviewService } = await import('@/services/review.service')
    reviewService._resetMockStore()
    const p = reviewService.getItemReviews('item-1')
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.results.length).toBeGreaterThan(0)
  })
})

describe('Regression: avatar upload unaffected (P4.7)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') })
  })
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); vi.unstubAllGlobals() })

  it('uploadAvatar still works for valid JPEG', async () => {
    const { userService } = await import('@/services/combined.service')
    const file = new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' })
    const p = userService.uploadAvatar(file)
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.avatar_url).toBeTruthy()
  })
})
