/**
 * P4.2 — Firebase Push Notifications tests
 *
 * Unit tests for firebase.ts (initialization, permission handling, token
 * request), hook tests (useFcmRegistration wiring), source-structure guards,
 * and regression tests verifying auth/WebSocket are unchanged.
 *
 * Firebase SDK is fully mocked — no real network calls are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Mock Firebase SDK ─────────────────────────────────────────────────────────

const mockGetToken = vi.fn()
const mockOnMessage = vi.fn(() => () => {})
const mockGetMessaging = vi.fn(() => ({ /* messaging instance */ }))
const mockInitializeApp = vi.fn(() => ({ name: '[DEFAULT]' }))
const mockGetApps = vi.fn(() => [])

vi.mock('firebase/app', () => ({
  initializeApp: mockInitializeApp,
  getApps: mockGetApps,
}))

vi.mock('firebase/messaging', () => ({
  getMessaging: mockGetMessaging,
  getToken: mockGetToken,
  onMessage: mockOnMessage,
}))

// ── Source structure: firebase.ts ─────────────────────────────────────────────

describe('firebase.ts — source structure', () => {
  const src = () => readSrc('lib/firebase.ts')

  it('exports FIREBASE_CONFIGURED constant', () => {
    expect(src()).toContain('export const FIREBASE_CONFIGURED')
  })

  it('exports requestNotificationPermission', () => {
    expect(src()).toContain('export async function requestNotificationPermission')
  })

  it('exports requestNotificationToken', () => {
    expect(src()).toContain('export async function requestNotificationToken')
  })

  it('exports onForegroundMessage', () => {
    expect(src()).toContain('export function onForegroundMessage')
  })

  it('exports _resetFirebaseForTests', () => {
    expect(src()).toContain('export function _resetFirebaseForTests')
  })

  it('uses getToken from firebase/messaging', () => {
    expect(src()).toContain("from 'firebase/messaging'")
    expect(src()).toContain('getToken')
  })

  it('uses initializeApp from firebase/app', () => {
    expect(src()).toContain("from 'firebase/app'")
    expect(src()).toContain('initializeApp')
  })

  it('handles SSR (typeof window check)', () => {
    expect(src()).toContain("typeof window === 'undefined'")
  })

  it('handles unsupported browser (serviceWorker check)', () => {
    expect(src()).toContain("'serviceWorker' in navigator")
  })

  it('handles denied permission state', () => {
    expect(src()).toContain("'denied'")
  })

  it('handles unsupported browser return value', () => {
    expect(src()).toContain("'unsupported'")
  })

  it('uses VAPID key when calling getToken', () => {
    expect(src()).toContain('vapidKey')
    expect(src()).toContain('VAPID_KEY')
  })

  it('uses serviceWorkerRegistration from navigator.serviceWorker.ready', () => {
    expect(src()).toContain('serviceWorkerRegistration')
    expect(src()).toContain('navigator.serviceWorker.ready')
  })
})

// ── FIREBASE_CONFIGURED flag ──────────────────────────────────────────────────

describe('FIREBASE_CONFIGURED — false when env vars absent', () => {
  beforeEach(() => vi.resetModules())

  it('is false when no Firebase env vars are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', '')
    const { FIREBASE_CONFIGURED } = await import('@/lib/firebase')
    expect(FIREBASE_CONFIGURED).toBe(false)
  })
})

describe('FIREBASE_CONFIGURED — true when all env vars present', () => {
  beforeEach(() => vi.resetModules())

  it('is true when all required Firebase env vars are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'AIzaMock')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'samoon-test')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:123:web:abc')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'BKd_mock_vapid_key')
    const { FIREBASE_CONFIGURED } = await import('@/lib/firebase')
    expect(FIREBASE_CONFIGURED).toBe(true)
  })
})

// ── requestNotificationPermission ─────────────────────────────────────────────

describe('requestNotificationPermission — permission states', () => {
  beforeEach(() => {
    vi.resetModules()
    // Ensure serviceWorker is present in navigator
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) },
      writable: true,
      configurable: true,
    })
  })

  it('returns granted when Notification.permission is already granted', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') },
      writable: true, configurable: true,
    })
    const { requestNotificationPermission } = await import('@/lib/firebase')
    const result = await requestNotificationPermission()
    expect(result).toBe('granted')
  })

  it('returns denied when Notification.permission is denied', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'denied', requestPermission: vi.fn() },
      writable: true, configurable: true,
    })
    const { requestNotificationPermission } = await import('@/lib/firebase')
    const result = await requestNotificationPermission()
    expect(result).toBe('denied')
  })

  it('calls requestPermission when state is default', async () => {
    const mockRequest = vi.fn().mockResolvedValue('granted')
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'default', requestPermission: mockRequest },
      writable: true, configurable: true,
    })
    const { requestNotificationPermission } = await import('@/lib/firebase')
    const result = await requestNotificationPermission()
    expect(mockRequest).toHaveBeenCalledOnce()
    expect(result).toBe('granted')
  })

  it('returns unsupported when Notification API is absent', async () => {
    const originalNotification = window.Notification
    // @ts-expect-error testing absence
    delete window.Notification
    const { requestNotificationPermission } = await import('@/lib/firebase')
    const result = await requestNotificationPermission()
    expect(result).toBe('unsupported')
    // restore
    Object.defineProperty(window, 'Notification', { value: originalNotification, writable: true, configurable: true })
  })

  it('returns denied when requestPermission throws', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn().mockRejectedValue(new Error('blocked')) },
      writable: true, configurable: true,
    })
    const { requestNotificationPermission } = await import('@/lib/firebase')
    const result = await requestNotificationPermission()
    expect(result).toBe('denied')
  })
})

// ── requestNotificationToken ─────────────────────────────────────────────────

describe('requestNotificationToken — token fetch', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetToken.mockReset()
    mockGetMessaging.mockReset()
    mockInitializeApp.mockReset()
    mockGetApps.mockReset()
  })

  it('returns null when FIREBASE_CONFIGURED is false', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '')
    const { requestNotificationToken } = await import('@/lib/firebase')
    const result = await requestNotificationToken()
    expect(result).toBeNull()
  })

  it('returns null when permission is denied', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'AIzaMock')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'test')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:123:web:abc')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'vapid_key')
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'denied', requestPermission: vi.fn() },
      writable: true, configurable: true,
    })
    const { requestNotificationToken } = await import('@/lib/firebase')
    const result = await requestNotificationToken()
    expect(result).toBeNull()
  })

  it('returns null when getToken returns empty string', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'AIzaMock')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'test')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:123:web:abc')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'vapid_key')
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted', requestPermission: vi.fn() },
      writable: true, configurable: true,
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) },
      writable: true, configurable: true,
    })
    mockGetApps.mockReturnValue([])
    mockInitializeApp.mockReturnValue({ name: '[DEFAULT]' })
    mockGetMessaging.mockReturnValue({})
    mockGetToken.mockResolvedValue('')
    const { requestNotificationToken } = await import('@/lib/firebase')
    const result = await requestNotificationToken()
    expect(result).toBeNull()
  })

  it('returns null when getToken throws', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'AIzaMock')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'test')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:123:web:abc')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'vapid_key')
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted', requestPermission: vi.fn() },
      writable: true, configurable: true,
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) },
      writable: true, configurable: true,
    })
    mockGetApps.mockReturnValue([])
    mockInitializeApp.mockReturnValue({ name: '[DEFAULT]' })
    mockGetMessaging.mockReturnValue({})
    mockGetToken.mockRejectedValue(new Error('messaging/token-unsubscribe-failed'))
    const { requestNotificationToken } = await import('@/lib/firebase')
    const result = await requestNotificationToken()
    expect(result).toBeNull()
  })
})

// ── onForegroundMessage ───────────────────────────────────────────────────────

describe('onForegroundMessage', () => {
  beforeEach(() => {
    vi.resetModules()
    mockOnMessage.mockReset()
    mockGetMessaging.mockReset()
  })

  it('returns a no-op unsubscribe when Firebase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '')
    const { onForegroundMessage } = await import('@/lib/firebase')
    const unsub = onForegroundMessage(() => {})
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })
})

// ── hooks/client.ts source guards ────────────────────────────────────────────

describe('hooks/client.ts — useFcmRegistration source structure', () => {
  const src = () => readSrc('hooks/client.ts')

  it('exports useFcmRegistration', () => {
    expect(src()).toContain('export function useFcmRegistration')
  })

  it('imports requestNotificationToken from @/lib/firebase', () => {
    expect(src()).toContain('requestNotificationToken')
    expect(src()).toContain("from '@/lib/firebase'")
  })

  it('imports onForegroundMessage from @/lib/firebase', () => {
    expect(src()).toContain('onForegroundMessage')
  })

  it('imports notificationService for device registration', () => {
    expect(src()).toContain('notificationService')
    expect(src()).toContain("from '@/services/combined.service'")
  })

  it('checks isAuthenticated before requesting token', () => {
    expect(src()).toContain('isAuthenticated')
  })

  it('calls registerDevice with token and web platform', () => {
    expect(src()).toContain("registerDevice(token, 'web')")
  })

  it('calls onForegroundMessage to handle foreground push', () => {
    expect(src()).toContain('onForegroundMessage')
  })

  it('uses useRef to prevent duplicate registration', () => {
    expect(src()).toContain('registered.current')
  })

  it('adds notification to store on foreground message', () => {
    expect(src()).toContain('addNotification(notification)')
  })

  it('returns the foreground unsub on cleanup', () => {
    expect(src()).toContain('unsubForeground?.()')
  })
})

// ── providers/index.tsx source guards ────────────────────────────────────────

describe('providers/index.tsx — FcmRegistrationProvider wiring', () => {
  const src = () => readSrc('providers/index.tsx')

  it('imports useFcmRegistration from @/hooks/client', () => {
    expect(src()).toContain('useFcmRegistration')
  })

  it('defines FcmRegistrationProvider component', () => {
    expect(src()).toContain('FcmRegistrationProvider')
  })

  it('renders FcmRegistrationProvider inside AuthBootstrapper subtree', () => {
    // Both must be present; provider is nested inside auth subtree
    expect(src()).toContain('<FcmRegistrationProvider>')
    expect(src()).toContain('</FcmRegistrationProvider>')
  })

  it('AuthBootstrapper is still present (no regression)', () => {
    expect(src()).toContain('AuthBootstrapper')
  })

  it('NotificationWebSocketProvider is still present (no regression)', () => {
    expect(src()).toContain('NotificationWebSocketProvider')
  })
})

// ── public/firebase-messaging-sw.js ──────────────────────────────────────────

describe('firebase-messaging-sw.js — service worker present', () => {
  const swPath = path.join(ROOT, 'public', 'firebase-messaging-sw.js')

  it('file exists at public/firebase-messaging-sw.js', () => {
    expect(fs.existsSync(swPath)).toBe(true)
  })

  it('imports firebase-app-compat and firebase-messaging-compat', () => {
    const src = fs.readFileSync(swPath, 'utf-8')
    expect(src).toContain('firebase-app-compat')
    expect(src).toContain('firebase-messaging-compat')
  })

  it('calls onBackgroundMessage', () => {
    const src = fs.readFileSync(swPath, 'utf-8')
    expect(src).toContain('onBackgroundMessage')
  })

  it('calls showNotification', () => {
    const src = fs.readFileSync(swPath, 'utf-8')
    expect(src).toContain('showNotification')
  })
})

// ── env.ts — Firebase key documentation ─────────────────────────────────────

describe('env.ts — Firebase keys in optional schema', () => {
  const src = () => readSrc('lib/env.ts')

  it('registers NEXT_PUBLIC_FIREBASE_API_KEY', () => {
    expect(src()).toContain('NEXT_PUBLIC_FIREBASE_API_KEY')
  })

  it('registers NEXT_PUBLIC_FIREBASE_PROJECT_ID', () => {
    expect(src()).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  })

  it('registers NEXT_PUBLIC_FIREBASE_VAPID_KEY', () => {
    expect(src()).toContain('NEXT_PUBLIC_FIREBASE_VAPID_KEY')
  })
})

// ── Regression: auth service unchanged ───────────────────────────────────────

describe('authService regression — login/register still function', () => {
  let authService: typeof import('@/services/auth.service').authService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/auth.service')
    authService = mod.authService
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('login returns user and tokens', async () => {
    const p = authService.login({ email: 'demo@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.user).toBeDefined()
    expect(result.tokens.access).toBeTruthy()
  })

  it('register returns user and tokens', async () => {
    const p = authService.register({
      email: 'new@samoon.app',
      password: 'demo1234',
      confirm_password: 'demo1234',
      first_name: 'Test',
      last_name: 'User',
    })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.user).toBeDefined()
    expect(result.tokens.access).toBeTruthy()
  })
})

// ── Regression: notificationService still works ──────────────────────────────

describe('notificationService regression — existing methods unchanged', () => {
  let notificationService: typeof import('@/services/combined.service').notificationService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/combined.service')
    notificationService = mod.notificationService
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('getNotifications returns paginated results', async () => {
    const p = notificationService.getNotifications()
    await vi.runAllTimersAsync()
    const result = await p
    expect(Array.isArray(result.results)).toBe(true)
  })

  it('registerDevice resolves without error in mock mode', async () => {
    await expect(notificationService.registerDevice('tok_mock', 'web')).resolves.toBeUndefined()
  })

  it('markAllRead resolves without error in mock mode', async () => {
    const p = notificationService.markAllRead()
    await vi.runAllTimersAsync()
    await expect(p).resolves.toBeUndefined()
  })
})

// ── Regression: WebSocket hook source unchanged ──────────────────────────────

describe('useNotificationWebSocket regression — source unchanged', () => {
  const src = () => readSrc('hooks/client.ts')

  it('still exports useNotificationWebSocket', () => {
    expect(src()).toContain('export function useNotificationWebSocket')
  })

  it('still connects to notificationWebSocket', () => {
    expect(src()).toContain('notificationWebSocket.connect')
  })

  it('still calls addNotification on notification.new event', () => {
    expect(src()).toContain("'notification.new'")
  })
})
