import { configurationService } from '@/config'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}

/** Resolved media/CDN origin for storage keys — env first, then platform config. */
export function getMediaBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim()
  if (fromEnv) return trimTrailingSlash(fromEnv)

  const fromConfig = configurationService.resolveField('storage.cdn_base_url', {}).value
  if (typeof fromConfig === 'string' && fromConfig.trim()) {
    return trimTrailingSlash(fromConfig.trim())
  }

  return ''
}

function isPassThroughMediaUrl(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('blob:') ||
    value.startsWith('data:')
  )
}

/**
 * Canonical MenuItem image resolver.
 * Storage keys (e.g. `menu_items/abc.webp`) are joined to the configured media base URL.
 */
/** True when next/image cannot optimize the URL (blob, data, or empty). */
export function isUnoptimizedMediaUrl(path: string | null | undefined): boolean {
  if (!path) return true
  return path.startsWith('blob:') || path.startsWith('data:')
}

export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (isPassThroughMediaUrl(trimmed)) return trimmed

  const base = getMediaBaseUrl()
  if (!base) return trimmed

  const relative = trimmed.replace(/^\/+/, '')
  return `${base}/${relative}`
}
