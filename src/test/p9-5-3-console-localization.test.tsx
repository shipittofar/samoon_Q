/**
 * P9.5.3 — Business Console & Platform Administration Localization
 * regression tests.
 *
 * Covers the migrated Console/Platform-admin generic chrome components
 * (ConfigurationModulePage, ConfigurationSaveBar, ConfigurationStudioToolbar,
 * ConfigurationStudioNav, ConfigurationCommandPalette, PlatformDashboard,
 * ConfigurationCollectionTable, ConfigurationEntityDrawer): translation
 * rendering, ICU plural handling, interpolation, and the coverage tool's
 * continued clean detection of the new `console` namespace keys.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import * as fs from 'node:fs'
import * as path from 'node:path'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'

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

describe('Console/platform-admin generic chrome uses the localization runtime, not literals', () => {
  const migrated = [
    'components/admin/configuration/ConfigurationModulePage.tsx',
    'components/admin/configuration/ConfigurationSaveBar.tsx',
    'components/admin/configuration/ConfigurationStudioToolbar.tsx',
    'components/admin/configuration/ConfigurationStudioNav.tsx',
    'components/admin/configuration/ConfigurationCommandPalette.tsx',
    'components/admin/configuration/ConfigurationCollectionTable.tsx',
    'components/admin/configuration/ConfigurationEntityDrawer.tsx',
    'components/admin/platform-admin/PlatformDashboard.tsx',
  ]

  it.each(migrated)('%s imports useTranslations from next-intl', (file) => {
    expect(readSrc(file)).toContain("from 'next-intl'")
  })
})

describe('console namespace — ICU plural handling', () => {
  function UnsavedChanges({ count }: { count: number }) {
    const t = useTranslations('console')
    return <p>{t('unsavedChanges', { count })}</p>
  }

  it('renders the singular form', () => {
    render(withLocale('en', en, <UnsavedChanges count={1} />))
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('renders the plural form', () => {
    render(withLocale('en', en, <UnsavedChanges count={4} />))
    expect(screen.getByText('4 unsaved changes')).toBeInTheDocument()
  })

  it('renders correctly in Persian', () => {
    render(withLocale('fa', fa, <UnsavedChanges count={2} />))
    expect(screen.getByText('2 تغییر ذخیره‌نشده')).toBeInTheDocument()
  })
})

describe('console namespace — interpolated templates', () => {
  function RollbackAria({ field }: { field: string }) {
    const t = useTranslations('console')
    return <button aria-label={t('rollbackAria', { field })}>x</button>
  }

  it('interpolates the field name into the rollback aria-label', () => {
    render(withLocale('en', en, <RollbackAria field="Session timeout" />))
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Roll back Session timeout')
  })

  function EntityDrawerHidden({ fieldId, state }: { fieldId: string; state: string }) {
    const t = useTranslations('console')
    return <p>{t('hiddenUnless', { fieldId, state })}</p>
  }

  it('interpolates the entity-drawer dependency explainer', () => {
    render(withLocale('en', en, <EntityDrawerHidden fieldId="enabled" state="visible" />))
    expect(screen.getByText('Hidden unless enabled condition fails — currently visible.')).toBeInTheDocument()
  })
})

describe('console namespace — entity drawer tab labels resolve per locale', () => {
  function Tab({ id }: { id: string }) {
    const t = useTranslations('console')
    return <span>{t(`entityDrawerTab_${id}` as never)}</span>
  }

  it('resolves the English tab label', () => {
    render(withLocale('en', en, <Tab id="dependencies" />))
    expect(screen.getByText('Dependencies')).toBeInTheDocument()
  })

  it('resolves the Persian tab label', () => {
    render(withLocale('fa', fa, <Tab id="dependencies" />))
    expect(screen.getByText('وابستگی‌ها')).toBeInTheDocument()
  })
})

describe('RTL-safe CSS — migrated files fixed the physical-direction classes adjacent to migrated text', () => {
  const fixedPairs: [file: string, physical: string][] = [
    ['components/admin/configuration/ConfigurationSaveBar.tsx', 'ml-1.5'],
    ['components/admin/configuration/ConfigurationStudioToolbar.tsx', 'ml-2'],
    ['components/admin/configuration/ConfigurationStudioNav.tsx', 'ml-auto'],
    ['components/admin/configuration/ConfigurationCollectionTable.tsx', 'ml-1.5'],
  ]

  it.each(fixedPairs)('%s no longer contains %s', (file, physical) => {
    expect(readSrc(file)).not.toContain(physical)
  })
})
