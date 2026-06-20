/**
 * Sitemap — Phase 4 (P4.4.5)
 *
 * Generates a valid Next.js sitemap for all publicly indexable routes.
 * Dashboard routes are excluded (auth-gated, not intended for indexing).
 * Checkout is excluded (transactional, not meaningful to crawlers).
 */
import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

const now = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/menu`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/reservation`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/restaurant`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Category-filtered menu pages — meaningful to crawlers and links well
  const menuCategories = ['pizza', 'burger', 'pasta', 'drinks', 'desserts']
  const categoryRoutes: MetadataRoute.Sitemap = menuCategories.map((cat) => ({
    url: `${BASE_URL}/menu?category=${cat}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...categoryRoutes]
}
