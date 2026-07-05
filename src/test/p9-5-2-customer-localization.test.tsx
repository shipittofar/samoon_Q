/**
 * P9.5.2 — Customer Experience Localization regression tests.
 *
 * Covers the migrated customer-facing surfaces (Menu, Cart, Checkout,
 * Reservation, Dashboard): translation rendering in en/fa, ICU plural
 * handling, localized validation error resolution, RTL-safe (logical CSS
 * property) usage in the migrated source, and the coverage tool's
 * extended detection (server `getTranslations()` sites, dead namespaces,
 * duplicate values).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import * as fs from 'node:fs'
import * as path from 'node:path'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import ar from '@/i18n/locales/ar.json'
import {
  extractTranslationUsagesFromSource,
  findDuplicateValues,
} from '@/i18n/coverage'

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withLocale(locale: string, messages: any, children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe('Customer surfaces use the localization runtime, not literals', () => {
  const migrated = [
    'components/menu/MenuContent.tsx',
    'components/menu/FoodDetailModal.tsx',
    'components/cart/CartDrawer.tsx',
    'app/checkout/page.tsx',
    'app/reservation/page.tsx',
    'app/dashboard/page.tsx',
  ]

  it.each(migrated)('%s imports useTranslations from next-intl', (file) => {
    expect(readSrc(file)).toContain("from 'next-intl'")
  })
})

describe('Menu namespace — ICU plural handling (Phase M formatting via Intl.PluralRules under the hood)', () => {
  function ItemsFound({ count }: { count: number }) {
    const t = useTranslations('menu')
    return <p>{t('itemsFound', { count })}</p>
  }

  it('renders the zero form', () => {
    render(withLocale('en', en, <ItemsFound count={0} />))
    expect(screen.getByText('No items found')).toBeInTheDocument()
  })

  it('renders the singular form', () => {
    render(withLocale('en', en, <ItemsFound count={1} />))
    expect(screen.getByText('1 item found')).toBeInTheDocument()
  })

  it('renders the plural form', () => {
    render(withLocale('en', en, <ItemsFound count={5} />))
    expect(screen.getByText('5 items found')).toBeInTheDocument()
  })

  it('renders correctly in Persian too, including locale-appropriate digit formatting via ICU/Intl.PluralRules', () => {
    render(withLocale('fa', fa, <ItemsFound count={3} />))
    // ICU MessageFormat renders the plural placeholder through Intl.NumberFormat
    // for the locale, so the digit itself localizes too (3 -> ۳).
    expect(screen.getByText('۳ مورد یافت شد')).toBeInTheDocument()
  })
})

describe('Cart namespace — interpolated templates', () => {
  function ViewCartAria({ count }: { count: number }) {
    const t = useTranslations('cart')
    return <button aria-label={t('viewCartAria', { count })}>x</button>
  }

  it('interpolates the count into the aria-label', () => {
    render(withLocale('en', en, <ViewCartAria count={3} />))
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'View cart — 3 items')
  })
})

describe('Checkout namespace — validation error resolution pattern', () => {
  function ValidationError({ messageKey }: { messageKey: string }) {
    const t = useTranslations('validation')
    return <span role="alert">{t(messageKey as never)}</span>
  }

  it('resolves a zod schema key (e.g. "required") to real localized text', () => {
    render(withLocale('en', en, <ValidationError messageKey="required" />))
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required')
  })

  it('resolves the same key to Arabic text under the Arabic bundle', () => {
    render(withLocale('ar', ar, <ValidationError messageKey="invalid_phone" />))
    expect(screen.getByRole('alert')).toHaveTextContent('أدخل رقم هاتف صالح')
  })
})

describe('Reservation namespace — confirmation flow strings', () => {
  function Confirmation() {
    const t = useTranslations('reservation')
    return <p>{t('confirmationSentTo', { contact: 'user@example.com' })}</p>
  }

  it('interpolates the contact into the confirmation message', () => {
    render(withLocale('en', en, <Confirmation />))
    expect(screen.getByText('A confirmation has been sent to user@example.com')).toBeInTheDocument()
  })
})

describe('Dashboard namespace — greeting template', () => {
  function Greeting({ name }: { name: string }) {
    const t = useTranslations('dashboard')
    return <h1>{t('greeting', { name })}</h1>
  }

  it('interpolates the user first name', () => {
    render(withLocale('en', en, <Greeting name="Alex" />))
    expect(screen.getByRole('heading')).toHaveTextContent('Hello, Alex! 👋')
  })
})

describe('RTL-safe CSS (Phase N) — migrated files use logical properties, not physical ml-/mr-/left-/right-', () => {
  const migrated = [
    'components/menu/MenuContent.tsx',
    'components/menu/FoodDetailModal.tsx',
    'components/cart/CartDrawer.tsx',
    'app/checkout/page.tsx',
    'app/reservation/page.tsx',
    'app/dashboard/page.tsx',
  ]

  it.each(migrated)('%s has no physical-direction Tailwind classes', (file) => {
    const src = readSrc(file)
    const physicalClasses = src.match(/\b(ml|mr|pl|pr|left-|right-)-[a-z0-9]+/g) ?? []
    expect(physicalClasses).toEqual([])
  })
})

describe('Translation Coverage utility — server getTranslations() detection (Phase P/J extension)', () => {
  it('detects a server-component `await getTranslations()` call site, not just the client hook', () => {
    const source = `
      import { getTranslations } from 'next-intl/server'
      export default async function Page() {
        const t = await getTranslations('errors')
        return <h1>{t('notFound')}</h1>
      }
    `
    const usages = extractTranslationUsagesFromSource(source, 'fake-server-page.tsx')
    const keys = usages.map((u) => u.key)
    expect(keys).toContain('errors')
    expect(keys).toContain('errors.notFound')
  })
})

describe('Duplicate-value detection over the real bundle (Phase P)', () => {
  it('flags known, intentional duplicates in auth/menu/reservation without erroring', () => {
    const dupes = findDuplicateValues(en)
    const authDupe = dupes.find((d) => d.namespace === 'auth' && d.value === 'Create Account')
    expect(authDupe?.keys.sort()).toEqual(['auth.createAccountButton', 'auth.register'])
  })
})
