/**
 * Navigation hand-off — Phase L4.
 *
 * Builds links that open a destination in the customer's navigation app.
 * Only the **destination** is put in the link: every app starts from the
 * device's live position on its own, so the customer's location never
 * leaves the device through these URLs.
 *
 * Neshan and Balad link formats are platform-configurable templates
 * (`maps.nav_neshan_url`, `maps.nav_balad_url`) so ops can follow their
 * changes without a release. Placeholders: {lat} {lng} {label}.
 */
import type { GeoPoint } from '@/types/branch'
import type { TravelMode } from '@/lib/travel'

export type NavigationAppId = 'google' | 'waze' | 'neshan' | 'balad' | 'apple' | 'geo'

export interface NavigationApp {
  id: NavigationAppId
  /** Brand names stay untranslated. */
  name: string
  /** Platforms where the app/link is meaningful. */
  platforms: readonly ('ios' | 'android' | 'desktop')[]
  /** Modes the app honours from the link (others open in its default mode). */
  modes: readonly TravelMode[]
}

export const NAVIGATION_APPS: readonly NavigationApp[] = [
  { id: 'neshan', name: 'Neshan', platforms: ['ios', 'android', 'desktop'], modes: [] },
  { id: 'balad', name: 'Balad', platforms: ['ios', 'android', 'desktop'], modes: [] },
  { id: 'google', name: 'Google Maps', platforms: ['ios', 'android', 'desktop'], modes: ['drive', 'walk', 'bike', 'taxi'] },
  { id: 'waze', name: 'Waze', platforms: ['ios', 'android', 'desktop'], modes: ['drive', 'taxi'] },
  { id: 'apple', name: 'Apple Maps', platforms: ['ios'], modes: ['drive', 'walk', 'taxi'] },
  // Android's "open with…" chooser — whatever navigation app the customer has.
  { id: 'geo', name: 'geo:', platforms: ['android'], modes: [] },
]

export const DEFAULT_NAV_TEMPLATES = {
  neshan: 'https://neshan.org/maps/@{lat},{lng},17z',
  balad: 'https://balad.ir/location?latitude={lat}&longitude={lng}&zoom=17',
} as const

export interface NavigationTemplates {
  neshan?: string
  balad?: string
}

export interface NavigationTarget {
  point: GeoPoint
  /** Shown by apps that support a label (geo:). */
  label?: string
}

const GOOGLE_MODE: Record<TravelMode, string> = { drive: 'driving', taxi: 'driving', walk: 'walking', bike: 'bicycling' }
const APPLE_MODE: Partial<Record<TravelMode, string>> = { drive: 'd', taxi: 'd', walk: 'w' }

const coord = (n: number) => n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')

function fillTemplate(template: string, target: NavigationTarget): string {
  return template
    .replace(/\{lat\}/g, coord(target.point.lat))
    .replace(/\{lng\}/g, coord(target.point.lng))
    .replace(/\{label\}/g, encodeURIComponent(target.label ?? ''))
}

/** Only http(s) templates are accepted from configuration. */
function safeTemplate(value: string | undefined, fallback: string): string {
  return value && /^https:\/\/[^\s]+$/i.test(value.trim()) ? value.trim() : fallback
}

export function buildNavigationUrl(
  app: NavigationAppId,
  target: NavigationTarget,
  mode: TravelMode = 'drive',
  templates: NavigationTemplates = {},
): string {
  const lat = coord(target.point.lat)
  const lng = coord(target.point.lng)
  switch (app) {
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${GOOGLE_MODE[mode]}`
    case 'waze':
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    case 'apple': {
      const flag = APPLE_MODE[mode]
      return `https://maps.apple.com/?daddr=${lat},${lng}${flag ? `&dirflg=${flag}` : ''}`
    }
    case 'geo':
      return `geo:${lat},${lng}?q=${lat},${lng}${target.label ? `(${encodeURIComponent(target.label)})` : ''}`
    case 'neshan':
      return fillTemplate(safeTemplate(templates.neshan, DEFAULT_NAV_TEMPLATES.neshan), target)
    case 'balad':
      return fillTemplate(safeTemplate(templates.balad, DEFAULT_NAV_TEMPLATES.balad), target)
  }
}

export type DevicePlatform = 'ios' | 'android' | 'desktop'

export function detectPlatform(userAgent: string | undefined): DevicePlatform {
  const ua = userAgent ?? ''
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && /mobile/i.test(ua))) return 'ios'
  return 'desktop'
}

/** Apps to offer on this device; the remembered one first. */
export function appsForPlatform(platform: DevicePlatform, preferred?: NavigationAppId | null): NavigationApp[] {
  const apps = NAVIGATION_APPS.filter((a) => a.platforms.includes(platform))
  if (!preferred) return apps
  const pick = apps.find((a) => a.id === preferred)
  return pick ? [pick, ...apps.filter((a) => a !== pick)] : apps
}

/**
 * Phase L5 — the whole day in one Google Maps link: stops in order, starting
 * from the device's live position (no origin in the link). Google allows up
 * to 9 waypoints in URLs; the planner caps a day at 8 stops.
 */
export function buildMultiStopGoogleUrl(stops: readonly GeoPoint[], mode: TravelMode = 'drive'): string | null {
  const valid = stops.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (!valid.length) return null
  const fmt = (p: GeoPoint) => `${coord(p.lat)},${coord(p.lng)}`
  const destination = fmt(valid[valid.length - 1])
  const waypoints = valid.slice(0, -1).slice(0, 9).map(fmt)
  return (
    `https://www.google.com/maps/dir/?api=1&destination=${destination}` +
    (waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}` : '') +
    `&travelmode=${GOOGLE_MODE[mode]}`
  )
}
