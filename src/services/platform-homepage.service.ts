import { getAccessToken } from './axios.instance'
import type { PlatformHomepageHero } from '@/types/website-builder'

const HERO_PATH = '/api/platform/homepage/hero/'
const MEDIA_PATH = '/api/platform/homepage/hero/media/'

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

  async uploadMedia(file: File): Promise<{ url: string }> {
    const form = new FormData()
    form.append('image', file)
    const res = await fetch(MEDIA_PATH, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(false),
      body: form,
    })
    if (!res.ok) throw new Error(`platform_homepage_media_${res.status}`)
    return res.json() as Promise<{ url: string }>
  },
}
