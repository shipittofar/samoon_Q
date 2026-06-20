'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { orderWebSocket, notificationWebSocket, type ConnectionStatus } from '@/services/websocket.service'
import { useNotificationStore } from '@/stores'
import { useAuthStore } from '@/stores'
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
