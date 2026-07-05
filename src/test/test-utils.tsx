/**
 * Shared test render helper — P9.5.3.
 *
 * Many framework-level Console/Studio components (ConfigurationModulePage,
 * ConfigurationStudioToolbar, ConfigurationStudioLayout, etc.) now call
 * `useTranslations()` (P9.5.3 localization migration). Any test that mounts
 * them needs a `NextIntlClientProvider` in the tree, or next-intl throws
 * "no context found". This wraps `@testing-library/react`'s `render` with
 * that provider (English messages, since these are English-language
 * assertions) so existing test files only need to swap their `render`
 * import for this one — no per-test-case changes.
 */
import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import en from '@/i18n/locales/en.json'

export function renderWithIntl(ui: ReactElement, options?: RenderOptions): RenderResult {
  return rtlRender(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
    options,
  )
}
