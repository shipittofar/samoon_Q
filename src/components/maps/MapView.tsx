'use client'

/**
 * MapView — the one map component (Phase L1). Renders through the active map
 * provider (src/lib/maps) with Leaflet. Import it through `MapViewLazy`
 * (./index.ts): Leaflet touches `window`, so it must never render on the server.
 *
 * Markers use emoji `divIcon`s — no marker image assets to break under the
 * bundler, and vertical-aware (💇 🩺 🍽️) for free.
 */
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { GeoPoint, ServiceAreaMode } from '@/types/branch'
import { resolveMapRendering } from '@/lib/maps/config'
import { circleBounds } from '@/lib/geo'

export interface MapMarker {
  id: string
  position: GeoPoint
  emoji?: string
  label?: string
  highlighted?: boolean
  /** `user` = the blue "you are here" dot (never clustered). */
  variant?: 'place' | 'user'
}

export interface MapAreaCircle {
  id: string
  center: GeoPoint
  radiusKm: number
  mode?: ServiceAreaMode
  /** Explicit colour (e.g. a location-accuracy circle); overrides `mode`. */
  color?: string
}

export interface MapAreaPolygon {
  id: string
  points: GeoPoint[]
  mode?: ServiceAreaMode
}

/** Phase L4 — a route line (dashed = estimated guide, not a road route). */
export interface MapRoute {
  id: string
  points: GeoPoint[]
  color?: string
  dashed?: boolean
}

export interface MapViewProps {
  center: GeoPoint
  zoom?: number
  markers?: MapMarker[]
  circles?: MapAreaCircle[]
  polygons?: MapAreaPolygon[]
  routes?: MapRoute[]
  /** Fit the view to the first circle (e.g. a branch's service area). */
  fitToCircle?: boolean
  onMapClick?: (point: GeoPoint) => void
  onMarkerClick?: (id: string) => void
  /**
   * Picker mode: when `center` changes to a point already inside the visible
   * area (the pin was tapped), leave the view alone; otherwise recentre
   * without resetting the zoom the customer chose.
   */
  keepView?: boolean
  /** false for maps embedded in a scrolling page, so the wheel scrolls the page. */
  scrollWheelZoom?: boolean
  /** Phase L3 — fit the view to all markers whenever this key changes. */
  fitMarkersKey?: string
  /** Points to fit (default: every marker). */
  fitPoints?: GeoPoint[]
  /** Phase L3 — group nearby place markers into count bubbles. */
  cluster?: boolean
  /** Phase L3 — the customer moved or zoomed the map (programmatic moves are ignored). */
  onUserPan?: (center: GeoPoint, zoom: number, bounds: [number, number, number, number]) => void
  className?: string
  /** Accessible name for the map region. */
  ariaLabel?: string
}

const MODE_COLORS: Record<ServiceAreaMode, string> = {
  delivery: '#2563eb',
  on_site: '#9333ea',
  visit_only: '#059669',
}

function emojiIcon(emoji: string, highlighted?: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${highlighted ? 40 : 32}px;height:${highlighted ? 40 : 32}px;border-radius:9999px;background:#fff;border:2px solid ${highlighted ? '#f97316' : '#111827'};box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:${highlighted ? 20 : 16}px;line-height:1">${emoji}</div>`,
    iconSize: highlighted ? [40, 40] : [32, 32],
    iconAnchor: highlighted ? [20, 20] : [16, 16],
  })
}

const userIcon = () =>
  L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:9999px;background:#0ea5e9;border:3px solid #fff;box-shadow:0 0 0 6px rgba(14,165,233,.25),0 1px 4px rgba(0,0,0,.4)"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

function clusterIcon(count: number) {
  const size = count < 10 ? 36 : 44
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:#111827;color:#fff;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);font:600 14px/1 system-ui">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/**
 * Maps moving because of our own setView/fitBounds, until when (ms epoch).
 * A time window, not a one-shot flag: one refit can emit several moveend
 * events (centre, then fit, then the zoom animation finishing).
 */
const programmaticUntil = new WeakMap<L.Map, number>()
const PROGRAMMATIC_WINDOW_MS = 1200
function moveProgrammatically(map: L.Map, move: () => void) {
  programmaticUntil.set(map, Date.now() + PROGRAMMATIC_WINDOW_MS)
  move()
}
/**
 * A move that ends this soon after wheel/dblclick/key/zoom-button input is the
 * customer's (zoom animations start on the next frame, which background tabs
 * delay a lot).
 */
const USER_INPUT_WINDOW_MS = 3000
const isProgrammatic = (map: L.Map) => (programmaticUntil.get(map) ?? 0) > Date.now()

function ClickHandler({
  onMapClick,
  onUserPan,
}: {
  onMapClick?: (p: GeoPoint) => void
  onUserPan?: (center: GeoPoint, zoom: number, bounds: [number, number, number, number]) => void
}) {
  // A move counts as the customer's only right after they touched the map
  // (pointer, wheel, touch, keyboard) — layout resizes and our own fitting
  // also emit moveend and must not offer "Search this area".
  const lastInputRef = useRef(0)
  // Set when a movement *starts* because of the customer; reported when it
  // ends (drag inertia and zoom animations can take a while).
  const userMoveRef = useRef(false)
  const map = useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
    dragstart() {
      userMoveRef.current = true
    },
    moveend() {
      const byInput = Date.now() - lastInputRef.current < USER_INPUT_WINDOW_MS && !isProgrammatic(map)
      if (!userMoveRef.current && !byInput) return
      userMoveRef.current = false
      lastInputRef.current = 0
      const c = map.getCenter()
      const b = map.getBounds()
      onUserPan?.({ lat: c.lat, lng: c.lng }, map.getZoom(), [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()])
    },
  })
  useEffect(() => {
    if (!onUserPan) return
    const el = map.getContainer()
    const mark = () => {
      lastInputRef.current = Date.now()
    }
    // Inputs that zoom/pan without a drag: wheel, double-click, keyboard,
    // pinch, and the +/− zoom buttons.
    const onPointer = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.('.leaflet-control-zoom')) mark()
    }
    const onTouch = (e: Event) => {
      if ((e as TouchEvent).touches?.length > 1) mark()
    }
    const listeners: [string, (e: Event) => void][] = [
      ['wheel', mark],
      ['dblclick', mark],
      ['keydown', mark],
      ['pointerdown', onPointer],
      ['touchstart', onTouch],
    ]
    listeners.forEach(([ev, fn]) => el.addEventListener(ev, fn, { passive: true }))
    return () => listeners.forEach(([ev, fn]) => el.removeEventListener(ev, fn))
  }, [map, onUserPan])
  return null
}

/** Fits the view to every marker when `fitKey` changes. */
function FitMarkers({ points, fitKey }: { points: GeoPoint[]; fitKey?: string }) {
  const map = useMap()
  useEffect(() => {
    if (!fitKey || points.length === 0) return
    if (points.length === 1) {
      moveProgrammatically(map, () => map.setView([points[0].lat, points[0].lng], 13))
      return
    }
    moveProgrammatically(map, () =>
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [40, 40],
        maxZoom: 15,
      }),
    )
  }, [map, fitKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const CLUSTER_PX = 44

/**
 * Greedy screen-space clustering at the current zoom — enough for a
 * Discover page (tens to a few hundred pins) without a plugin dependency.
 * Highlighted markers always stay individual.
 */
function PlaceMarkers({
  markers,
  cluster,
  onMarkerClick,
}: {
  markers: MapMarker[]
  cluster: boolean
  onMarkerClick?: (id: string) => void
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

  const groups = useMemo(() => {
    if (!cluster) return markers.map((m) => [m])
    const out: { px: L.Point; items: MapMarker[] }[] = []
    for (const m of markers) {
      const px = map.project([m.position.lat, m.position.lng], zoom)
      const hit = m.highlighted ? undefined : out.find((g) => !g.items[0].highlighted && g.px.distanceTo(px) < CLUSTER_PX)
      if (hit) hit.items.push(m)
      else out.push({ px, items: [m] })
    }
    return out.map((g) => g.items)
  }, [markers, cluster, zoom, map])

  return (
    <>
      {groups.map((items) => {
        if (items.length === 1) {
          const m = items[0]
          return (
            <Marker
              key={m.id}
              position={[m.position.lat, m.position.lng]}
              icon={emojiIcon(m.emoji ?? '📍', m.highlighted)}
              zIndexOffset={m.highlighted ? 1000 : 0}
              eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
            >
              {m.label && <Tooltip direction="top" offset={[0, -14]}>{m.label}</Tooltip>}
            </Marker>
          )
        }
        const bounds = L.latLngBounds(items.map((m) => [m.position.lat, m.position.lng] as [number, number]))
        const c = bounds.getCenter()
        return (
          <Marker
            key={`cluster-${items.map((m) => m.id).join('|')}`}
            position={c}
            icon={clusterIcon(items.length)}
            eventHandlers={{ click: () => moveProgrammatically(map, () => map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 })) }}
          >
            <Tooltip direction="top" offset={[0, -18]}>{items.map((m) => m.label).filter(Boolean).join(' · ')}</Tooltip>
          </Marker>
        )
      })}
    </>
  )
}

/** Keeps the view in sync when the centre / fitted circle changes. */
function ViewSync({ center, zoom, fit, keepView }: { center: GeoPoint; zoom: number; fit?: MapAreaCircle; keepView?: boolean }) {
  const map = useMap()
  const firstRef = useRef(true)
  useEffect(() => {
    const first = firstRef.current
    firstRef.current = false
    if (keepView && !first && !fit) {
      if (map.getBounds().contains([center.lat, center.lng])) return
      moveProgrammatically(map, () => map.setView([center.lat, center.lng], map.getZoom()))
      return
    }
    if (fit && fit.radiusKm > 0) {
      const [s, w, n, e] = circleBounds(fit.center, fit.radiusKm)
      moveProgrammatically(map, () => map.fitBounds([[s, w], [n, e]], { padding: [16, 16] }))
    } else {
      moveProgrammatically(map, () => map.setView([center.lat, center.lng], zoom))
    }
  }, [map, center.lat, center.lng, zoom, fit?.center.lat, fit?.center.lng, fit?.radiusKm]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function MapView({
  center,
  zoom = 13,
  markers = [],
  circles = [],
  polygons = [],
  routes = [],
  fitToCircle = false,
  onMapClick,
  onMarkerClick,
  keepView = false,
  scrollWheelZoom = true,
  fitMarkersKey,
  fitPoints,
  cluster = false,
  onUserPan,
  className,
  ariaLabel,
}: MapViewProps) {
  const places = markers.filter((m) => m.variant !== 'user')
  const users = markers.filter((m) => m.variant === 'user')
  const rendering = useMemo(() => resolveMapRendering(), [])
  const { tiles } = rendering

  return (
    // `isolate` gives the map its own stacking context: Leaflet panes/controls
    // use z-index 400–1000, which would otherwise paint over sticky headers.
    <div
      className={`isolate ${className ?? 'h-64 w-full overflow-hidden rounded-xl border border-[var(--border)]'}`}
      role="region"
      aria-label={ariaLabel}
      data-map-provider={rendering.provider.id}
    >
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={scrollWheelZoom} className="h-full w-full">
        <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={tiles.maxZoom} {...(tiles.subdomains ? { subdomains: tiles.subdomains } : {})} />
        <ViewSync center={center} zoom={zoom} fit={fitToCircle ? circles[0] : undefined} keepView={keepView} />
        <FitMarkers points={fitPoints ?? markers.map((m) => m.position)} fitKey={fitMarkersKey} />
        <ClickHandler onMapClick={onMapClick} onUserPan={onUserPan} />
        {circles.map((c) => (
          <Circle
            key={c.id}
            center={[c.center.lat, c.center.lng]}
            radius={c.radiusKm * 1000}
            pathOptions={{ color: c.color ?? MODE_COLORS[c.mode ?? 'visit_only'], fillOpacity: 0.12, weight: 2 }}
          />
        ))}
        {polygons.map((p) => (
          <Polygon
            key={p.id}
            positions={p.points.map((pt) => [pt.lat, pt.lng] as [number, number])}
            pathOptions={{ color: MODE_COLORS[p.mode ?? 'visit_only'], fillOpacity: 0.12, weight: 2 }}
          />
        ))}
        {routes.map((rt) => (
          <Polyline
            key={rt.id}
            positions={rt.points.map((pt) => [pt.lat, pt.lng] as [number, number])}
            pathOptions={{ color: rt.color ?? '#2563eb', weight: 5, opacity: 0.85, dashArray: rt.dashed ? '8 10' : undefined }}
          />
        ))}
        <PlaceMarkers markers={places} cluster={cluster} onMarkerClick={onMarkerClick} />
        {users.map((m) => (
          <Marker key={m.id} position={[m.position.lat, m.position.lng]} icon={userIcon()} zIndexOffset={2000}>
            {m.label && <Tooltip direction="top" offset={[0, -10]}>{m.label}</Tooltip>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
