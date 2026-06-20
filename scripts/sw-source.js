/**
 * Service Worker source template — Phase 4.8 (P4.8.2 / P4.8.3)
 *
 * This file is the BUILD INPUT. Do not edit public/sw.js directly.
 * Run `node scripts/build-sw.mjs` (or `npm run build`) to regenerate
 * public/sw.js with __SW_VERSION__ replaced by the actual build version.
 *
 * Cache strategy:
 *   Static assets — cache-first with network fallback (offline resilience)
 *   API responses  — network-first with cache fallback (freshness by default)
 *   All caches include the build version so stale caches are pruned on activate.
 */

// ── Version ───────────────────────────────────────────────────────────────────
// __SW_VERSION__ is replaced at build time by scripts/build-sw.mjs
const SW_VERSION = '__SW_VERSION__'

// ── Cache names (version-stamped so old caches are pruned on activate) ────────
const CACHE_NAME = `savor-cache-v${SW_VERSION}`
const API_CACHE  = `savor-api-v${SW_VERSION}`

const KNOWN_CACHES = [CACHE_NAME, API_CACHE]

const STATIC_ASSETS = ['/', '/menu', '/manifest.json', '/offline']

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) =>
      c.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to pre-cache some assets:', err)
      }),
    ),
  )
  // Do NOT skip waiting here — update activation is controlled by the app
  // so users see the "New version available" banner before switching.
  // P4.8.4: The new SW waits until the user confirms the update.
})

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // P4.8.3: delete any cache whose name is NOT in KNOWN_CACHES for this version
          .filter((k) => !KNOWN_CACHES.includes(k))
          .map((k) => {
            console.log('[SW] Deleting stale cache:', k)
            return caches.delete(k)
          }),
      ),
    ),
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Only intercept GET requests; let mutations through to the network unchanged.
  if (e.request.method !== 'GET') return

  // API routes — network-first, cache fallback for offline reads.
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const clone = r.clone()
          caches.open(API_CACHE).then((cache) => cache.put(e.request, clone))
          return r
        })
        .catch(() => caches.match(e.request)),
    )
    return
  }

  // Static assets — cache-first, network fallback.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((r) => {
        const clone = r.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
        return r
      })
    }),
  )
})

// ── Message ───────────────────────────────────────────────────────────────────

// P4.8.4: Allow the app to trigger skipWaiting via postMessage.
// This is called by the update banner's "Refresh" action.
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'Savor', body: 'You have a new notification' }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: data.url ? { url: data.url } : undefined,
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.notification.data?.url) e.waitUntil(clients.openWindow(e.notification.data.url))
})
