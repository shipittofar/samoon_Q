import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { url: BASE_URL, changeFrequency: 'daily' as const, priority: 1 },
    { url: `${BASE_URL}/menu`, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${BASE_URL}/reservation`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${BASE_URL}/restaurant`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE_URL}/login`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${BASE_URL}/register`, changeFrequency: 'yearly' as const, priority: 0.3 },
  ]

  const categoryRoutes = ['pizza', 'burger', 'pasta', 'drinks', 'desserts'].map((cat) => ({
    url: `${BASE_URL}/menu?category=${cat}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...categoryRoutes].map((route) => ({
    ...route,
    lastModified: new Date(),
  }))
}
