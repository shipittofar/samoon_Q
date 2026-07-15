/**
 * Sitemap — Phase 4 (P4.4.5) / P8.8.1
 *
 * Generates a valid Next.js sitemap for all publicly indexable routes.
 * Dashboard routes are excluded (auth-gated, not intended for indexing).
 * Checkout is excluded (transactional, not meaningful to crawlers).
 *
 * P8.8.1: /discover added at high priority as the primary marketplace entry
 * point. Category query routes updated from single-restaurant menu categories
 * to platform-level business-type discovery routes.
 */
import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

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
      url: `${BASE_URL}/discover`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/menu`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/reservation`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/restaurant`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
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

  // Business-type discovery routes — platform-level categories
  const businessTypes = ['restaurant', 'cafe', 'bar', 'food_truck', 'food_court', 'mobile_cafe']
  const categoryRoutes: MetadataRoute.Sitemap = businessTypes.map((type) => ({
    url: `${BASE_URL}/discover?category=${type}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...categoryRoutes]
}
