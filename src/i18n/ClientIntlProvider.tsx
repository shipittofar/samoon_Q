'use client'

/**
 * ClientIntlProvider — P9.5.4 Phase H
 *
 * Wraps `NextIntlClientProvider` so the missing-translation handling
 * already wired server-side (`src/i18n/request.ts`) also applies to
 * translations resolved on the client (e.g. after a client-side
 * navigation re-renders a component with a key that turns out to be
 * missing). `onError`/`getMessageFallback` are plain closures defined
 * inside this client component — they can't be passed in as props from
 * the server-rendered `RootLayout`, since functions can't cross the
 * server/client boundary, so this thin wrapper is the one place they're
 * declared for the client tree.
 *
 * Never crashes: `onError` only logs (matching request.ts's existing
 * production-safe behavior), and `getMessageFallback` always returns a
 * string instead of letting next-intl throw. In development the fallback
 * is prefixed with a visible "⚠ Missing Translation" marker so a missing
 * key is impossible to miss during review; production keeps the exact
 * same silent `namespace.key` fallback this app has used since P9.5.0/
 * P9.5.1B — no behavior change for end users.
 */
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import type { ReactNode } from 'react'
import { recordMissingTranslation } from './runtime'

export function ClientIntlProvider({ locale, messages, children }: { locale: string; messages: AbstractIntlMessages; children: ReactNode }) {
  return (
    <NextIntlClientProvider
      messages={messages}
      onError={(error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(error)
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        recordMissingTranslation({ kind: 'missing-key', locale, namespace, key })
        const dotted = namespace ? `${namespace}.${key}` : key
        return process.env.NODE_ENV !== 'production' ? `⚠ Missing Translation: ${dotted}` : dotted
      }}
    >
      {children}
    </NextIntlClientProvider>
  )
}
