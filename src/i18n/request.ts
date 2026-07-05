import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { resolveRequestLocale, loadMessages, recordMissingTranslation } from './runtime'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
  const acceptLanguage = headerStore.get('accept-language')

  // Phase I — priority chain: explicit override (none in this phase, no
  // routing change) -> saved cookie preference -> browser Accept-Language
  // -> platform default (`languages.default`, Configuration-driven) -> 'en'.
  const locale = resolveRequestLocale({ cookieLocale, acceptLanguage })

  // Phase D/E — one dynamic import per request, walking the fallback chain
  // if this locale has no message file yet, never bundling every language.
  const { messages } = await loadMessages(locale)

  return {
    locale,
    messages,
    // Phase F — missing translation handler: next-intl calls onError for
    // every resolution failure (missing key, missing namespace, etc.) and
    // getMessageFallback to decide what to render instead of throwing.
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(error)
      }
    },
    getMessageFallback({ namespace, key }) {
      recordMissingTranslation({ kind: 'missing-key', locale, namespace, key })
      const dotted = namespace ? `${namespace}.${key}` : key
      // Phase H — visibly flagged only in development; production keeps the
      // exact same silent `namespace.key` fallback used since P9.5.0/P9.5.1B.
      return process.env.NODE_ENV !== 'production' ? `⚠ Missing Translation: ${dotted}` : dotted
    },
  }
})
