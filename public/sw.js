const CACHE_NAME = 'savor-v1'
const STATIC_ASSETS = ['/', '/menu', '/manifest.json']
const API_CACHE = 'savor-api-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then((r) => { const c = r.clone(); caches.open(API_CACHE).then((cache) => cache.put(e.request, c)); return r })
        .catch(() => caches.match(e.request))
    )
    return
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((r) => {
      const c = r.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(e.request, c))
      return r
    }))
  )
})

self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'Savor', body: 'You have a new notification' }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-72.png',
    data: data.url ? { url: data.url } : undefined,
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.notification.data?.url) e.waitUntil(clients.openWindow(e.notification.data.url))
})
