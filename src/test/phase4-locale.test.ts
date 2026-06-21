/**
 * P4.8 — Locale Switching Without Reload tests
 *
 * Covers: cookie writing, store update, hook wiring, source-structure audits,
 * and regression coverage for all completed Phase 4 items.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Source structure audits ───────────────────────────────────────────────────

describe('stores/index.ts — setLocale writes NEXT_LOCALE cookie', () => {
  const src = () => readSrc('stores/index.ts')

  it('setLocale writes NEXT_LOCALE cookie', () =>
    expect(src()).toContain('NEXT_LOCALE='))

  it('cookie has path=/ set', () =>
    expect(src()).toContain('path=/'))

  it('cookie has SameSite=Lax', () =>
    expect(src()).toContain('SameSite=Lax'))

  it('cookie is written via document.cookie', () =>
    expect(src()).toContain('document.cookie'))
})

describe('hooks/index.ts — useSetLocale hook', () => {
  const src = () => readSrc('hooks/index.ts')

  it('exports useSetLocale', () =>
    expect(src()).toContain('export function useSetLocale'))

  it('useSetLocale imports useRouter', () =>
    expect(src()).toContain("from 'next/navigation'"))

  it('useSetLocale calls setLocale from useLangStore', () =>
    expect(src()).toContain('useLangStore'))

  it('useSetLocale calls router.refresh()', () =>
    expect(src()).toContain('router.refresh()'))

  it('useSetLocale does not call window.location.reload', () =>
    expect(src()).not.toContain('window.location.reload'))
})

describe('Header.tsx — uses useSetLocale', () => {
  const src = () => readSrc('components/layout/Header.tsx')

  it('imports useSetLocale from @/hooks', () =>
    expect(src()).toContain('useSetLocale'))

  it('does not destructure setLocale from useLangStore', () => {
    // locale is still read from store; setLocale comes from useSetLocale
    expect(src()).not.toContain('setLocale } = useLangStore')
  })

  it('still reads locale from useLangStore', () =>
    expect(src()).toContain('locale } = useLangStore'))
})

describe('settings/page.tsx — uses useSetLocale', () => {
  const src = () => readSrc('app/dashboard/settings/page.tsx')

  it('imports useSetLocale', () =>
    expect(src()).toContain('useSetLocale'))

  it('does not destructure setLocale from useLangStore', () =>
    expect(src()).not.toContain('setLocale } = useLangStore'))

  it('still reads locale from useLangStore', () =>
    expect(src()).toContain('locale } = useLangStore'))
})

// ── useLangStore unit tests ───────────────────────────────────────────────────

describe('useLangStore.setLocale — cookie & DOM side-effects', () => {
  let cookieJar: string

  beforeEach(() => {
    cookieJar = ''
    // jsdom does not implement document.cookie setter robustly; stub it
    Object.defineProperty(document, 'cookie', {
      get: () => cookieJar,
      set: (v: string) => { cookieJar = v },
      configurable: true,
    })
  })

  afterEach(() => vi.resetModules())

  it('setLocale("fa") writes NEXT_LOCALE=fa cookie', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('fa')
    expect(cookieJar).toContain('NEXT_LOCALE=fa')
  })

  it('setLocale("ar") writes NEXT_LOCALE=ar cookie', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('ar')
    expect(cookieJar).toContain('NEXT_LOCALE=ar')
  })

  it('setLocale("en") writes NEXT_LOCALE=en cookie', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('en')
    expect(cookieJar).toContain('NEXT_LOCALE=en')
  })

  it('setLocale updates the zustand locale state', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('fa')
    expect(useLangStore.getState().locale).toBe('fa')
  })

  it('setLocale sets document.documentElement.lang', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('ar')
    expect(document.documentElement.lang).toBe('ar')
  })

  it('setLocale sets dir=rtl for fa', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('fa')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('setLocale sets dir=rtl for ar', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('setLocale sets dir=ltr for en', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('repeated locale switches each write the cookie', async () => {
    const { useLangStore } = await import('@/stores')
    const writes: string[] = []
    Object.defineProperty(document, 'cookie', {
      set: (v: string) => { writes.push(v) },
      get: () => '',
      configurable: true,
    })
    useLangStore.getState().setLocale('fa')
    useLangStore.getState().setLocale('ar')
    useLangStore.getState().setLocale('en')
    expect(writes.length).toBe(3)
    expect(writes[0]).toContain('NEXT_LOCALE=fa')
    expect(writes[1]).toContain('NEXT_LOCALE=ar')
    expect(writes[2]).toContain('NEXT_LOCALE=en')
  })

  it('cookie value includes path=/', async () => {
    const { useLangStore } = await import('@/stores')
    useLangStore.getState().setLocale('en')
    expect(cookieJar).toContain('path=/')
  })
})

// ── Regression: Phase 4 services unaffected ───────────────────────────────────

describe('Regression: P4.1 payment service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('createPaymentIntent still returns client_secret', async () => {
    const { paymentService } = await import('@/services/payment.service')
    const p = paymentService.createPaymentIntent({ amount: 30, branch_id: '1' })
    await vi.runAllTimersAsync()
    expect((await p).client_secret).toBeTruthy()
  })
})

describe('Regression: P4.3 review service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.resetModules() })

  it('getItemReviews still returns results', async () => {
    const { reviewService } = await import('@/services/review.service')
    reviewService._resetMockStore()
    const p = reviewService.getItemReviews('item-1')
    await vi.runAllTimersAsync()
    expect((await p).results.length).toBeGreaterThan(0)
  })
})

describe('Regression: P4.7 avatar upload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') })
  })
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); vi.unstubAllGlobals() })

  it('uploadAvatar still works', async () => {
    const { userService } = await import('@/services/combined.service')
    const file = new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' })
    const p = userService.uploadAvatar(file)
    await vi.runAllTimersAsync()
    expect((await p).avatar_url).toBeTruthy()
  })
})

describe('Regression: P4.6 calendar utilities', () => {
  afterEach(() => vi.resetModules())

  it('generateIcs still produces valid ICS', async () => {
    const { generateIcs } = await import('@/lib/calendar')
    const ics = generateIcs({ title: 'Test', date: '2025-07-01', time: '19:00' })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20250701T190000')
  })

  it('buildGoogleCalendarUrl still returns correct URL', async () => {
    const { buildGoogleCalendarUrl } = await import('@/lib/calendar')
    const url = buildGoogleCalendarUrl({ title: 'Test', date: '2025-07-01', time: '19:00' })
    expect(url).toContain('calendar.google.com')
    expect(url).toContain('action=TEMPLATE')
  })
})
