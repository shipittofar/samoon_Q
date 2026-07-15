// Firebase Cloud Messaging service worker — P4.2
// Handles background push notifications when the app is not in the foreground.
// This file must live at /firebase-messaging-sw.js (root of the public path).

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js')

// Config is injected at runtime via the query string when the SW is registered,
// or falls back to self.__FIREBASE_CONFIG__ which can be set by a build step.
// See src/lib/firebase.ts requestNotificationToken() for the registration call.
const config = self.__FIREBASE_CONFIG__ || {}

if (config.apiKey) {
  firebase.initializeApp(config)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const { title = 'Samoon', body = '' } = payload.notification || {}
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: payload.data,
      tag: payload.data?.order_id ?? 'samoon-notification',
    })
  })
}
