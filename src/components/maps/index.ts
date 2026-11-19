'use client'

import dynamic from 'next/dynamic'
import { createElement } from 'react'

export type { MapViewProps, MapMarker, MapAreaCircle, MapAreaPolygon, MapRoute } from './MapView'

/**
 * Client-only MapView (Leaflet needs `window`). Use this everywhere instead
 * of importing ./MapView directly.
 */
export const MapViewLazy = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () =>
    createElement('div', {
      className: 'h-64 w-full animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card-hover)]',
      'aria-busy': true,
    }),
})
