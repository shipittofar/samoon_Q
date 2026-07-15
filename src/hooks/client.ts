'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { orderWebSocket, notificationWebSocket, type ConnectionStatus } from '@/services/websocket.service'
import { useNotificationStore } from '@/stores'
import { useAuthStore } from '@/stores'
import { requestNotificationToken, onForegroundMessage } from '@/lib/firebase'
import { notificationService } from '@/services/combined.service'
import type { Notification, OrderStatus } from '@/types'
import toast from 'react-hot-toast'

// ── useOrderWebSocket ─────────────────────────────────────────────────────────
export function useOrderWebSocket(orderId: string | null) {
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null)
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  useEffect(() => {
    if (!orderId) return

    orderWebSocket.connect(`/orders/${orderId}/`)

    const unsubs = [
      orderWebSocket.on('connected', () => setConnected(true)),
      orderWebSocket.on('disconnected', () => setConnected(false)),
      orderWebSocket.on('status', (s) => setConnectionStatus(s as ConnectionStatus)),
      orderWebSocket.on('order.status_update', (data: unknown) => {
        const d = data as { status: OrderStatus; estimated_time?: number }
        setStatus(d.status)
        if (d.estimated_time !== undefined) setEstimatedTime(d.estimated_time)
      }),
    ]

    return () => {
      unsubs.forEach((fn) => fn())
      orderWebSocket.disconnect()
    }
  }, [orderId])

  return { status, estimatedTime, connected, connectionStatus }
}

// ── useNotificationWebSocket ──────────────────────────────────────────────────
export function useNotificationWebSocket() {
  const { isAuthenticated } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  useEffect(() => {
    if (!isAuthenticated) return

    notificationWebSocket.connect('/notifications/')

    const unsubs = [
      notificationWebSocket.on('connected', () => setConnected(true)),
      notificationWebSocket.on('disconnected', () => setConnected(false)),
      notificationWebSocket.on('status', (s) => setConnectionStatus(s as ConnectionStatus)),
      notificationWebSocket.on('notification.new', (data: unknown) => {
        const notification = data as Notification
        addNotification(notification)
        toast(notification.message, {
          icon: notification.type === 'order_update' ? '📦'
            : notification.type === 'promotion' ? '🎉'
            : notification.type === 'reservation_update' ? '📅'
            : '🔔',
        })
      }),
    ]

    return () => {
      unsubs.forEach((fn) => fn())
      notificationWebSocket.disconnect()
    }
  }, [isAuthenticated, addNotification])

  return { connected, connectionStatus }
}

// ── useDebounce ───────────────────────────────────────────────────────────────
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── useLocalStorage ───────────────────────────────────────────────────────────
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })

  const setStored = useCallback(
    (v: T) => {
      setValue(v)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(v))
      }
    },
    [key],
  )

  return [value, setStored]
}

// ── useIntersectionObserver ───────────────────────────────────────────────────
export function useIntersectionObserver(
  options?: IntersectionObserverInit,
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [options])

  return [ref, isIntersecting]
}

// ── useScrollDirection ────────────────────────────────────────────────────────
export function useScrollDirection() {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)
  const lastY = useRef(0)

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY
      setDirection(y > lastY.current ? 'down' : 'up')
      lastY.current = y
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return direction
}

// ── useMediaQuery ─────────────────────────────────────────────────────────────
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}

// ── useFcmRegistration — P4.2 ─────────────────────────────────────────────────
/**
 * Requests FCM permission + token after login and registers the device with
 * the backend. Subscribes to foreground messages and surfaces them via the
 * existing notification store + toast system.
 *
 * Idempotent: once a token is registered in this session it is not re-sent.
 * Gracefully handles: unsupported browser, denied permission, missing Firebase
 * config, token fetch failure, backend registration failure.
 */
export function useFcmRegistration() {
  const { isAuthenticated } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const registered = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || registered.current) return

    let unsubForeground: (() => void) | null = null

    const register = async () => {
      const token = await requestNotificationToken()
      if (!token) return

      registered.current = true

      // Register token with backend — fire-and-forget; failure is non-fatal
      notificationService.registerDevice(token, 'web').catch(() => {})

      // Handle foreground messages (app is open and focused)
      unsubForeground = onForegroundMessage((payload) => {
        const { title = process.env.NEXT_PUBLIC_APP_NAME || 'Samoon', body = '' } = payload.notification ?? {}
        const notification: Notification = {
          id: `fcm-${Date.now()}`,
          type: (payload.data?.type as Notification['type']) ?? 'system',
          title,
          message: body,
          data: payload.data as Record<string, unknown> | undefined,
          is_read: false,
          created_at: new Date().toISOString(),
        }
        addNotification(notification)
        toast(body || title, {
          icon: notification.type === 'order_update' ? '📦'
            : notification.type === 'promotion' ? '🎉'
            : notification.type === 'reservation_update' ? '📅'
            : '🔔',
        })
      })
    }

    register()

    return () => {
      unsubForeground?.()
    }
  }, [isAuthenticated, addNotification])
}
