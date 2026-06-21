/**
 * Firebase client initialization — P4.2
 *
 * Lazy-initializes the Firebase app and Cloud Messaging service only when
 * all required environment variables are present. Returns null otherwise so
 * callers never crash in mock mode, SSR, or unconfigured deployments.
 *
 * Permission states:
 *   granted  → getToken() proceeds normally
 *   denied   → logged, function returns null, no crash
 *   default  → Notification.requestPermission() is called once
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging'

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

/** True only when all required Firebase config vars are present. */
export const FIREBASE_CONFIGURED =
  Boolean(FIREBASE_CONFIG.apiKey) &&
  Boolean(FIREBASE_CONFIG.projectId) &&
  Boolean(FIREBASE_CONFIG.appId) &&
  Boolean(VAPID_KEY)

let _app: FirebaseApp | null = null
let _messaging: Messaging | null = null

function getFirebaseApp(): FirebaseApp | null {
  if (!FIREBASE_CONFIGURED) return null
  if (typeof window === 'undefined') return null
  if (_app) return _app
  _app = getApps().length > 0 ? getApps()[0]! : initializeApp(FIREBASE_CONFIG)
  return _app
}

function getFirebaseMessaging(): Messaging | null {
  if (!('serviceWorker' in navigator)) return null
  const app = getFirebaseApp()
  if (!app) return null
  if (_messaging) return _messaging
  try {
    _messaging = getMessaging(app)
    return _messaging
  } catch {
    return null
  }
}

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported'

/**
 * Requests notification permission from the browser.
 * Returns the resulting permission state.
 * Never throws.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  try {
    const result = await Notification.requestPermission()
    return result as NotificationPermission
  } catch {
    return 'denied'
  }
}

/**
 * Requests the FCM registration token.
 * Returns null when:
 *   - Firebase is not configured
 *   - Permission is not granted
 *   - Running in SSR / unsupported browser
 * Never throws.
 */
export async function requestNotificationToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (!FIREBASE_CONFIGURED) return null

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return null

  const messaging = getFirebaseMessaging()
  if (!messaging) return null

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    })
    return token || null
  } catch {
    return null
  }
}

/**
 * Subscribes to foreground messages.
 * Returns an unsubscribe function.
 * No-op when Firebase is not configured.
 */
export function onForegroundMessage(handler: (payload: MessagePayload) => void): () => void {
  const messaging = getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, handler)
}

/** Reset module-level singletons — used in tests only. */
export function _resetFirebaseForTests() {
  _app = null
  _messaging = null
}
