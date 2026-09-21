import { getAccessToken } from './axios.instance'
import type { PlatformHomepageHero } from '@/types/website-builder'

const HERO_PATH = '/api/platform/homepage/hero/'

function authHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/**
 * Platform Homepage CMS client.
 * Reads/writes the Next BFF (`/api/platform/homepage/*`), which enforces
 * Platform Super Admin on mutations. Never writes tenant websiteBuilder.
 * Media uses the shared direct-upload service, not this BFF.
 */
export const platformHomepageService = {
  async getHero(): Promise<PlatformHomepageHero> {
    const res = await fetch(HERO_PATH, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(`platform_homepage_${res.status}`)
    return res.json() as Promise<PlatformHomepageHero>
  },

  async saveHero(hero: PlatformHomepageHero): Promise<PlatformHomepageHero> {
    const res = await fetch(HERO_PATH, {
      method: 'PUT',
      credentials: 'include',
      headers: authHeaders(true),
      body: JSON.stringify(hero),
    })
    if (!res.ok) throw new Error(`platform_homepage_${res.status}`)
    return res.json() as Promise<PlatformHomepageHero>
  },
}
