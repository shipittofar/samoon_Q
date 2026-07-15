import type { MenuItem } from '@/types'

// ── Platform WebSite Schema ───────────────────────────────────────────────────
// P8.8.1 — replaced single-restaurant RestaurantSchema with a platform-level
// WebSite schema. The platform is a multi-tenant hospitality marketplace, not
// a restaurant. Tenant/branch pages emit their own restaurant-typed schemas.
export function PlatformSchema() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Samoon',
    description: 'Discover restaurants, cafés, bars, food trucks, and more. Browse menus, book tables, and order from local businesses.',
    url: baseUrl,
    image: `${baseUrl}/og-image.jpg`,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/discover?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

/** @deprecated Use PlatformSchema instead. Kept for any tenant pages that imported it directly. */
export const RestaurantSchema = PlatformSchema

// ── Menu Product Schema ────────────────────────────────────────────────────────
export function MenuItemSchema({ item }: { item: MenuItem }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    description: item.description,
    image: item.image,
    offers: {
      '@type': 'Offer',
      price: item.discounted_price ?? item.price,
      priceCurrency: 'USD',
      availability: item.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: item.rating,
      reviewCount: item.rating_count,
    },
    nutrition: item.calories
      ? {
          '@type': 'NutritionInformation',
          calories: `${item.calories} calories`,
        }
      : undefined,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// ── BreadcrumbList Schema ─────────────────────────────────────────────────────
export function BreadcrumbSchema({
  items,
}: {
  items: { name: string; href: string }[]
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${process.env.NEXT_PUBLIC_APP_URL}${item.href}`,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// ── FAQ Schema ────────────────────────────────────────────────────────────────
export function FAQSchema({
  faqs,
}: {
  faqs: { question: string; answer: string }[]
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
