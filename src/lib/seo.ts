/**
 * Localized Page Metadata — P9.5.4 Phase F/G
 *
 * A single helper any server page/layout calls to build its Next.js
 * `Metadata` object from the `seo` translation namespace instead of a
 * hand-written literal `Metadata` object per page — reuses the exact
 * runtime already built for everything else (`getTranslations()` from
 * `next-intl/server`, `resolveSupportedLocales()`/`LANGUAGE_REGISTRY` from
 * `src/i18n/runtime.ts`/`language-registry.ts`, P9.5.1A). No second i18n
 * engine, no new registry: `alternates.languages` (hreflang) is generated
 * once here from the same enabled-locales list every other locale-aware
 * surface already reads.
 *
 * Scope: this phase wires the root layout (`src/app/layout.tsx`) through
 * this helper as the end-to-end proof. The other ~6 page-level
 * `generateMetadata`/`metadata` exports in `src/app/**` are NOT migrated —
 * documented honestly in docs/P9.5.4_SEO_LOCALIZATION.md as remaining
 * work, since each one embeds page-specific dynamic data (tenant name,
 * branch name, menu item) that needs its own per-page key design, not a
 * single mechanical find-and-replace.
 */
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { resolveSupportedLocales } from '@/i18n/runtime'
import { getLanguageMetadata } from '@/i18n/language-registry'

export interface LocalizedPageMetadataInput {
  locale: string
  /** Path relative to the app origin, e.g. '/' or '/menu'. Used to build hreflang alternates and canonical. */
  path: string
  /** `seo` namespace key prefix, e.g. 'home' -> seo.home.title / seo.home.description / seo.home.keywords. */
  namespaceKey: string
  baseUrl: string
}

/**
 * Builds a localized `Metadata` object: title/description/keywords from
 * the `seo.<namespaceKey>.*` translation keys, OpenGraph/Twitter mirroring
 * the same localized title/description, `robots` unchanged from the
 * platform default (index/follow — no per-locale robots policy exists),
 * and `alternates.languages`/`canonical` generated from the same enabled-
 * locale list (`resolveSupportedLocales()`) every other locale-aware
 * surface reads — so adding a 7th enabled language automatically adds its
 * hreflang entry here too, with zero code change.
 */
export async function getLocalizedPageMetadata({ locale, path, namespaceKey, baseUrl }: LocalizedPageMetadataInput): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' })
  const title = t(`${namespaceKey}.title` as never)
  const description = t(`${namespaceKey}.description` as never)
  const keywordsRaw = t.has(`${namespaceKey}.keywords` as never) ? t(`${namespaceKey}.keywords` as never) : ''
  const keywords = keywordsRaw ? keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean) : undefined

  const supportedLocales = resolveSupportedLocales()
  const languages: Record<string, string> = {}
  for (const code of supportedLocales) {
    const meta = getLanguageMetadata(code)
    languages[meta?.bcp47 ?? code] = `${baseUrl}${path}${path.includes('?') ? '&' : '?'}locale=${code}`
  }

  return {
    title,
    description,
    keywords,
    openGraph: { type: 'website', siteName: 'Savor Platform', title, description },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${baseUrl}${path}`,
      languages,
    },
  }
}
