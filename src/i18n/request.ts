import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value
  const acceptLang = headerStore.get('accept-language')?.split(',')[0]?.split('-')[0]

  const supported = ['en', 'fa', 'ar']
  const locale =
    supported.find((l) => l === localeCookie) ||
    supported.find((l) => l === acceptLang) ||
    'en'

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default,
  }
})
