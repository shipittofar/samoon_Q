/**
 * SEO Localization Infrastructure — P9.5.1B Phase N
 *
 * Prepares the data this platform will need for `hreflang`/localized-sitemap
 * generation (per `docs/P9.5.0_LOCALIZATION_ARCHITECTURE.md`'s SEO strategy
 * §5) without making a routing change. `hreflang` only makes sense once each
 * language has its own distinct URL, and this phase's constraints are
 * explicit: **no routing changes yet**. So this module exposes the
 * building blocks (which languages are eligible, their hreflang codes) as
 * pure functions — ready for whichever URL strategy P9.5.1B/the phase after
 * it picks (path-prefix, subdomain, or query param) — rather than emitting
 * `alternates.languages` into `src/app/layout.tsx`'s metadata today, which
 * would be incorrect (every alternate would point at the same URL).
 */
import { resolveSupportedLocales, getLanguageInfo } from './runtime'

export interface HreflangAlternate {
  /** The BCP 47 hreflang value — the language registry's own id, no separate mapping table. */
  hreflang: string
  locale: string
}

/** The languages eligible for a `hreflang` tag today — enabled per Configuration. */
export function getHreflangEligibleLocales(): HreflangAlternate[] {
  return resolveSupportedLocales().map((locale) => ({
    hreflang: getLanguageInfo(locale)?.bcp47 ?? locale,
    locale,
  }))
}

/**
 * Builds `{ hreflang: url }` alternates for a given path once a URL
 * strategy exists — `buildLocalizedUrl` is the one seam a future
 * path-prefixed/subdomain router plugs into; everything else here is
 * already strategy-agnostic.
 */
export function buildHreflangAlternates(
  path: string,
  buildLocalizedUrl: (locale: string, path: string) => string,
): Record<string, string> {
  const alternates: Record<string, string> = {}
  for (const { hreflang, locale } of getHreflangEligibleLocales()) {
    alternates[hreflang] = buildLocalizedUrl(locale, path)
  }
  return alternates
}
