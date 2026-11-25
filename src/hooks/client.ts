'use client'

import { createElement, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { orderWebSocket, notificationWebSocket, type ConnectionStatus } from '@/services/websocket.service'
import { useNotificationStore, useAuthStore } from '@/stores'
import { requestNotificationToken, onForegroundMessage } from '@/lib/firebase'
import { notificationService } from '@/services/combined.service'
import type { Notification, OrderStatus, LoginCredentials } from '@/types'
import type { RichNotification } from '@/types/notification'
import toast from 'react-hot-toast'
import { invalidateNotificationQueries, performAuthenticatedLoginFlow } from '@/hooks'
import { useOpenNotification } from '@/hooks/open-notification'
import { ALL_TOPICS, applyLiveChange, type LiveTopic } from '@/lib/live-updates'
import {
  type AuthTransitionPhase,
  authTransitionLabelKey,
  isAuthTransitionActive,
} from '@/lib/auth-transition'

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
/** While the socket is down, refetch what is on screen this often. */
const FALLBACK_REFRESH_MS = 60_000
/** At most one refresh per this long when the user comes back to the tab. */
const FOCUS_REFRESH_MS = 15_000

/**
 * Personal notification socket (`/ws/notifications/?token=…&lang=…`), open
 * while signed in. Each new notification shows a toast (in the page's
 * language — the server renders it) and refreshes every notification list,
 * bell and counter; clicking the toast opens what it is about. `data.changed`
 * messages refetch the affected data (orders, wallet, the session itself…)
 * without a page reload. After a reconnect, on returning to the tab, and once
 * a minute while the socket is down, everything on screen is refetched, so
 * nothing missed offline stays stale. Mock mode has no backend socket.
 */
export function useNotificationWebSocket() {
  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()
  const openNotification = useOpenNotification()
  const openRef = useRef(openNotification)
  openRef.current = openNotification
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'fa' : 'fa'

  useEffect(() => {
    if (!isAuthenticated || process.env.NEXT_PUBLIC_USE_MOCK === 'true') return

    const refresh = () => invalidateNotificationQueries(queryClient)
    let lastFullRefresh = Date.now()
    const refreshAll = () => {
      lastFullRefresh = Date.now()
      refresh()
      applyLiveChange(queryClient, ALL_TOPICS)
    }
    let seenConnection = false
    let online = false

    // Several changes in one action (e.g. approving a business) become one refetch.
    const pending = new Set<LiveTopic>()
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const onChanged = (data: unknown) => {
      const topics = (data as { topics?: unknown } | null)?.topics
      if (!Array.isArray(topics)) return
      for (const topic of topics) if (ALL_TOPICS.includes(topic as LiveTopic)) pending.add(topic as LiveTopic)
      if (pending.size === 0 || flushTimer) return
      flushTimer = setTimeout(() => {
        flushTimer = null
        const batch = [...pending]
        pending.clear()
        applyLiveChange(queryClient, batch)
      }, 300)
    }

    notificationWebSocket.connect(`/notifications/?lang=${encodeURIComponent(lang)}`)

    const unsubs = [
      notificationWebSocket.on('connected', () => setConnected(true)),
      notificationWebSocket.on('disconnected', () => {
        online = false
        setConnected(false)
      }),
      notificationWebSocket.on('status', (s) => setConnectionStatus(s as ConnectionStatus)),
      notificationWebSocket.on('connection_established', () => {
        online = true
        if (seenConnection) refreshAll()
        else refresh()
        seenConnection = true
      }),
      notificationWebSocket.on('data.changed', onChanged),
      notificationWebSocket.on('notification.new', (data: unknown) => {
        const n = data as Partial<RichNotification> | null
        refresh()
        if (n?.title) {
          const text = n.message ? `${n.title} — ${n.message}` : n.title
          const body = (shown: { id: string }) =>
            createElement(
              'button',
              {
                type: 'button',
                className: 'text-start hover:underline',
                onClick: () => {
                  toast.dismiss(shown.id)
                  void openRef.current(n)
                },
              },
              text,
            )
          toast(body, {
            duration: 8000,
            icon: n.priority === 'urgent' ? '⚠️' : n.category === 'order' ? '📦' : n.category === 'reservation' ? '📅' : '🔔',
          })
        }
      }),
    ]

    const onVisible = () => {
      if (!document.hidden && Date.now() - lastFullRefresh > FOCUS_REFRESH_MS) refreshAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    const fallback = setInterval(() => {
      if (!online && !document.hidden) refreshAll()
    }, FALLBACK_REFRESH_MS)

    return () => {
      unsubs.forEach((fn) => fn())
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(fallback)
      if (flushTimer) clearTimeout(flushTimer)
      notificationWebSocket.disconnect()
    }
  }, [isAuthenticated, queryClient, lang])

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

// ── useLoginTransition — full auth transition state machine for login UI ─────

export function useLoginTransition() {
  const router = useRouter()
  const [phase, setPhase] = useState<AuthTransitionPhase>('idle')
  const inFlightRef = useRef(false)

  const executeLogin = useCallback(async (creds: LoginCredentials) => {
    if (inFlightRef.current || isAuthTransitionActive(phase)) return
    inFlightRef.current = true
    try {
      await performAuthenticatedLoginFlow(creds, router, setPhase)
    } catch {
      setPhase('failed')
      throw new Error('login_transition_failed')
    } finally {
      inFlightRef.current = false
    }
  }, [router, phase])

  const reset = useCallback(() => {
    if (!isAuthTransitionActive(phase)) {
      setPhase('idle')
    }
  }, [phase])

  const labelKey = authTransitionLabelKey(phase)

  return {
    phase,
    executeLogin,
    reset,
    isActive: isAuthTransitionActive(phase),
    labelKey,
  }
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
