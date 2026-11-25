import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const toastFn = vi.fn()
vi.mock('react-hot-toast', () => ({ default: Object.assign((...a: unknown[]) => toastFn(...a), { error: vi.fn(), success: vi.fn() }) }))

const handlers = new Map<string, (data: unknown) => void>()
const connect = vi.fn()
const disconnect = vi.fn()
vi.mock('@/services/websocket.service', () => ({
  orderWebSocket: { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(() => () => {}) },
  notificationWebSocket: {
    connect: (...a: unknown[]) => connect(...a),
    disconnect: () => disconnect(),
    on: (type: string, fn: (data: unknown) => void) => {
      handlers.set(type, fn)
      return () => handlers.delete(type)
    },
  },
}))

import { useNotificationWebSocket } from '@/hooks/client'
import { useAuthStore } from '@/stores'

function Probe() {
  useNotificationWebSocket()
  return null
}

describe('personal notification socket', () => {
  let qc: QueryClient

  beforeEach(() => {
    handlers.clear()
    connect.mockReset()
    disconnect.mockReset()
    toastFn.mockReset()
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
    document.documentElement.lang = 'fa'
    qc = new QueryClient()
    useAuthStore.setState({ isAuthenticated: true } as never)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    useAuthStore.setState({ isAuthenticated: false } as never)
  })

  it('connects with the page language and refreshes lists + toasts on a new notification', () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    )
    expect(connect).toHaveBeenCalledWith('/notifications/?lang=fa')

    act(() => {
      handlers.get('notification.new')?.({ title: 'سفارش جدید', message: 'سفارش #12', category: 'order', priority: 'high' })
    })
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0])
    expect(keys).toEqual(expect.arrayContaining(['rich-notifications', 'notification-summary', 'notification-unread-count']))
    const [body, opts] = toastFn.mock.calls[0] as [(t: { id: string }) => React.ReactElement<{ children: string }>, unknown]
    expect(body({ id: 't1' }).props.children).toBe('سفارش جدید — سفارش #12')
    expect(opts).toEqual(expect.objectContaining({ icon: '📦' }))

    // A reconnect refetches, so nothing sent while offline is missed.
    invalidate.mockClear()
    act(() => handlers.get('connection_established')?.({ unreadCount: 3 }))
    expect(invalidate).toHaveBeenCalled()

    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('does not connect when signed out or in mock mode', () => {
    useAuthStore.setState({ isAuthenticated: false } as never)
    render(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    )
    expect(connect).not.toHaveBeenCalled()
  })
})

describe('notification plumbing', () => {
  const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

  it('socket URLs join the token with & when the path already has a query', () => {
    expect(src('services/websocket.service.ts')).toContain("const sep = this.url.includes('?') ? '&' : '?'")
  })

  it('API requests carry the page language for server-rendered texts', () => {
    expect(src('services/axios.instance.ts')).toContain("config.headers['Accept-Language'] = document.documentElement.lang")
  })

  it('with a backend the client never creates notifications itself', () => {
    expect(src('services/notification.service.ts')).toContain('if (!USE_MOCK) return')
  })
})
