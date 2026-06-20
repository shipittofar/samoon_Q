'use client'

/**
 * Lightweight performance utilities — Phase 4.9 (P4.9.5)
 *
 * No external dependencies. All operations are non-blocking.
 * Integration is optional — callers decide whether and when to invoke.
 */

// ── Navigation Timing ─────────────────────────────────────────────────────────

export interface NavigationMetrics {
  /** Total page load time (loadEventEnd − navigationStart), ms. */
  loadTime?: number
  /** DOM interactive time (domInteractive − navigationStart), ms. */
  domInteractive?: number
  /** Time to first byte (responseStart − requestStart), ms. */
  ttfb?: number
  /** DNS lookup time, ms. */
  dns?: number
  /** TCP connection time, ms. */
  tcp?: number
}

/**
 * Read PerformanceNavigationTiming entries and return key metrics.
 * Returns an empty object when the API is unavailable (SSR, older browsers).
 * Never throws.
 */
export function measureNavigationTiming(): NavigationMetrics {
  try {
    if (typeof performance === 'undefined') return {}
    const entries = performance.getEntriesByType?.('navigation') as PerformanceNavigationTiming[]
    if (!entries || entries.length === 0) return {}

    const nav = entries[0]
    const metrics: NavigationMetrics = {}

    if (nav.loadEventEnd > 0 && nav.startTime >= 0) {
      metrics.loadTime = Math.round(nav.loadEventEnd - nav.startTime)
    }
    if (nav.domInteractive > 0 && nav.startTime >= 0) {
      metrics.domInteractive = Math.round(nav.domInteractive - nav.startTime)
    }
    if (nav.responseStart > 0 && nav.requestStart >= 0) {
      metrics.ttfb = Math.round(nav.responseStart - nav.requestStart)
    }
    if (nav.domainLookupEnd > 0 && nav.domainLookupStart >= 0) {
      metrics.dns = Math.round(nav.domainLookupEnd - nav.domainLookupStart)
    }
    if (nav.connectEnd > 0 && nav.connectStart >= 0) {
      metrics.tcp = Math.round(nav.connectEnd - nav.connectStart)
    }

    return metrics
  } catch {
    return {}
  }
}

// ── Web Vitals Hook ───────────────────────────────────────────────────────────

export type WebVitalName = 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'

export interface WebVitalEntry {
  name: WebVitalName
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

export type WebVitalsCallback = (entry: WebVitalEntry) => void

/**
 * Register a callback for Core Web Vitals via the PerformanceObserver API.
 * Returns an unsubscribe function.
 *
 * Observed metrics: LCP, CLS, FID/INP, FCP.
 * Degrades gracefully when PerformanceObserver is unavailable.
 * Never throws.
 *
 * @example
 * const unsub = reportWebVitalsHook((entry) => console.log(entry.name, entry.value))
 * // later: unsub()
 */
export function reportWebVitalsHook(onVital: WebVitalsCallback): () => void {
  const observers: PerformanceObserver[] = []

  const observe = (type: string, handler: (entry: PerformanceEntry) => void) => {
    try {
      if (typeof PerformanceObserver === 'undefined') return
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) handler(entry)
      })
      obs.observe({ type, buffered: true })
      observers.push(obs)
    } catch {
      // type not supported — skip silently
    }
  }

  // LCP
  observe('largest-contentful-paint', (entry) => {
    const value = (entry as PerformanceEntry & { startTime: number }).startTime
    onVital({ name: 'LCP', value: Math.round(value), rating: value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor' })
  })

  // FID
  observe('first-input', (entry) => {
    const value = (entry as PerformanceEntry & { processingStart: number; startTime: number }).processingStart
      - (entry as PerformanceEntry & { startTime: number }).startTime
    onVital({ name: 'FID', value: Math.round(value), rating: value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor' })
  })

  // INP
  observe('event', (entry) => {
    const value = (entry as PerformanceEntry & { duration: number }).duration
    onVital({ name: 'INP', value: Math.round(value), rating: value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor' })
  })

  // CLS
  observe('layout-shift', (entry) => {
    const value = (entry as PerformanceEntry & { value: number }).value
    onVital({ name: 'CLS', value, rating: value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor' })
  })

  // FCP
  observe('paint', (entry) => {
    if (entry.name !== 'first-contentful-paint') return
    const value = entry.startTime
    onVital({ name: 'FCP', value: Math.round(value), rating: value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor' })
  })

  return () => {
    for (const obs of observers) {
      try { obs.disconnect() } catch { /* ignore */ }
    }
    observers.length = 0
  }
}
