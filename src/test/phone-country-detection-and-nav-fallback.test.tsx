import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import en from '@/i18n/locales/en.json'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { IP_COUNTRY_KEY, LAST_SELECTED_KEY } from '@/data/countries'
import { getAdminNav, getAdminNavForBusinessTypes } from '@/modules/registry'
import { BUSINESS_TYPE_VALUES } from '@/services/superadmin.service'

const srcFile = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

function renderPhone(props: Partial<React.ComponentProps<typeof PhoneInput>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PhoneInput label="Phone" {...props} />
    </NextIntlClientProvider>,
  )
}

/** The country trigger button's aria-label names the selected country. */
function selectedCountryLabel(): string {
  const btn = screen.getAllByRole('button').find((b) => /\+\d/.test(b.getAttribute('aria-label') ?? ''))
  return btn?.getAttribute('aria-label') ?? ''
}

const spies: Array<{ mockRestore: () => void }> = []

function mockTimeZone(tz: string) {
  const real = Intl.DateTimeFormat
  spies.push(vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((...args: unknown[]) => {
    const fmt = new (real as unknown as new (...a: unknown[]) => Intl.DateTimeFormat)(...args)
    const resolved = fmt.resolvedOptions()
    fmt.resolvedOptions = () => ({ ...resolved, timeZone: tz })
    return fmt
  }) as unknown as typeof Intl.DateTimeFormat))
}

function mockLanguage(lang: string) {
  spies.push(vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(lang))
}

describe('phone country detection', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    spies.splice(0).forEach((s) => s.mockRestore())
    vi.unstubAllGlobals()
  })

  it('time zone wins over the browser language (en-US browser in Tehran → Iran)', () => {
    mockTimeZone('Asia/Tehran')
    mockLanguage('en-US')
    renderPhone()
    expect(selectedCountryLabel()).toContain('Iran')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('last chosen country wins over the time zone', () => {
    localStorage.setItem(LAST_SELECTED_KEY, 'DE')
    mockTimeZone('Asia/Tehran')
    renderPhone()
    expect(selectedCountryLabel()).toContain('Germany')
  })

  it('unknown time zone: asks the backend for the IP country and uses it', async () => {
    mockTimeZone('Etc/UTC')
    mockLanguage('en-US')
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ country: 'AE' }) })
    renderPhone()
    await waitFor(() => expect(selectedCountryLabel()).toContain('United Arab Emirates'))
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/core\/geo\/country\/$/)
    expect(sessionStorage.getItem(IP_COUNTRY_KEY)).toBe('AE')
  })

  it('no time zone, no IP answer, no region in the language → Iran, not the US', async () => {
    mockTimeZone('Etc/UTC')
    mockLanguage('fa')
    sessionStorage.setItem(IP_COUNTRY_KEY, '')
    renderPhone()
    expect(selectedCountryLabel()).toContain('Iran')
  })

  it('login pages no longer pin the country to the US', () => {
    expect(srcFile('app/login/LoginClientPage.tsx')).not.toContain('defaultCountry="US"')
    expect(srcFile('components/auth/AuthSessionPanel.tsx')).not.toContain('defaultCountry="US"')
  })
})

describe('console nav fallback', () => {
  it('a business type with no console module still gets a menu', () => {
    expect(getAdminNav(['gym'])).toHaveLength(0)
    const nav = getAdminNavForBusinessTypes(['gym'])
    expect(nav.length).toBeGreaterThan(5)
    const hrefs = nav.map((i) => i.href)
    expect(hrefs).toContain('/console/menu')
    expect(hrefs).toContain('/console/staff')
    expect(hrefs).toContain('/console/settings')
  })

  it('known types keep their own nav', () => {
    expect(getAdminNavForBusinessTypes(['cafe'])).toEqual(getAdminNav(['cafe']))
  })

  it('no types → no nav (unchanged)', () => {
    expect(getAdminNavForBusinessTypes([])).toEqual(getAdminNav([]))
  })

  it('every type the register form offers has console nav', () => {
    for (const t of BUSINESS_TYPE_VALUES) {
      expect(getAdminNavForBusinessTypes([t]).length, t).toBeGreaterThan(0)
    }
  })
})
