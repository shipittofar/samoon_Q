import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { DjangoChannelsWebSocket, consoleWebSocket } from '@/services/websocket.service'
import { ENDPOINTS } from '@/services/endpoints'
import { adminService } from '@/services/admin.service'
import {
  PENDING_ORDERS_COUNT_KEY,
  PENDING_RESERVATIONS_COUNT_KEY,
  consoleWebSocketPath,
  eventMatchesWorkspace,
  pendingOrdersCountKey,
  pendingReservationsCountKey,
  invalidatePendingOrdersCountQueries,
  invalidatePendingReservationsCountQueries,
} from '@/lib/console-pending-counts'
import {
  attachConsolePendingCountHandlers,
  useConsoleWorkspaceRealtime,
  usePendingOrdersCount,
  usePendingReservationsCount,
} from '@/hooks/console-realtime'
import { CountBadge, ConsoleNavPendingBadge } from '@/components/admin/ConsoleNavPendingBadge'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { useRbacStore, useBranchStore } from '@/stores'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'
import { JWT_ACCESS_KEY } from '@/constants'
import { renderWithIntl } from '@/test/test-utils'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Branch } from '@/types/branch'

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  readyState = 0
  url: string
  onopen: ((e: Event) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  send(_data: string): void {}
  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000, reason: '', wasClean: true } as CloseEvent)
  }
  triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }
  triggerMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

function createTestSocket() {
  const instances: MockWebSocket[] = []
  const svc = new DjangoChannelsWebSocket({
    channelName: 'test-console',
    wsFactory: (url) => {
      const ws = new MockWebSocket(url)
      instances.push(ws)
      return ws as unknown as WebSocket
    },
  })
  return { svc, instances }
}

function makeBranch(id: string, tenantId: string): Branch {
  return {
    id,
    tenantId,
    name: id,
    slug: id,
    status: 'active',
    type: 'physical',
    location: { address: '', city: '', country: '' },
    contact: {},
    businessHours: [],
    checkout: { ...DEFAULT_BRANCH_CHECKOUT },
    marketplaceVisible: true,
    reservationsEnabled: false,
    created_at: '',
    updated_at: '',
  }
}

function setWorkspace(opts: {
  tenantId?: string | null
  branchId?: string | null
  phase?: 'idle' | 'initializing' | 'switching_tenant' | 'switching_branch' | 'ready' | 'error'
  branchState?: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
}) {
  const tenantId = opts.tenantId ?? null
  const branchId = opts.branchId ?? null
  useRbacStore.setState({
    activeMembership: tenantId
      ? {
          tenantId,
          branchId: branchId ?? undefined,
          roles: ['owner'],
          branchAccess: { scope: 'all' as const },
        }
      : null,
    sessionMemberships: tenantId
      ? [{
          tenantId,
          tenantSlug: `slug-${tenantId}`,
          tenantName: `Tenant ${tenantId}`,
          roles: ['owner'],
          branchAccess: { scope: 'all' as const },
        }]
      : [],
  })
  useConsoleWorkspaceStore.setState({
    workspacePhase: opts.phase ?? 'ready',
    workspaceError: null,
    selectedTenantId: tenantId,
  })
  useBranchStore.setState({
    selectedBranch: tenantId && branchId ? makeBranch(branchId, tenantId) : null,
    branchState: opts.branchState ?? (branchId ? 'ready' : 'empty'),
    branches: tenantId && branchId ? [makeBranch(branchId, tenantId)] : [],
  })
}

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
}

function withClient(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

beforeEach(() => {
  vi.restoreAllMocks()
  setWorkspace({ tenantId: null, branchId: null, phase: 'idle' })
})

afterEach(() => {
  consoleWebSocket.disconnect()
})

describe('pending-count endpoints', () => {
  it('builds the exact Order pending-count path', () => {
    expect(ENDPOINTS.ORDERS.CONSOLE_PENDING_COUNT('tenant-a', 'branch-a')).toBe(
      '/orders/console-orders/tenants/tenant-a/branches/branch-a/pending-count/',
    )
  })

  it('builds the exact Reservation pending-count path', () => {
    expect(ENDPOINTS.RESERVATIONS.CONSOLE_PENDING_COUNT('tenant-a', 'branch-a')).toBe(
      '/reservations/console-reservations/tenants/tenant-a/branches/branch-a/pending-count/',
    )
  })
})

describe('query keys', () => {
  it('includes tenant and branch for orders', () => {
    expect(pendingOrdersCountKey('t1', 'b1')).toEqual(['pending-orders-count', 't1', 'b1'])
  })

  it('includes tenant and branch for reservations', () => {
    expect(pendingReservationsCountKey('t1', 'b1')).toEqual(['pending-reservations-count', 't1', 'b1'])
  })

  it('isolates tenant/branch combinations', () => {
    expect(pendingOrdersCountKey('tenantA', 'branchA')).not.toEqual(pendingOrdersCountKey('tenantA', 'branchB'))
    expect(pendingOrdersCountKey('tenantA', 'branchA')).not.toEqual(pendingOrdersCountKey('tenantB', 'branchA'))
  })
})

describe('eventMatchesWorkspace', () => {
  it('rejects a different tenant', () => {
    expect(eventMatchesWorkspace({ tenant_id: 't2', branch_id: 'b1' }, 't1', 'b1')).toBe(false)
  })

  it('rejects a different branch', () => {
    expect(eventMatchesWorkspace({ tenant_id: 't1', branch_id: 'b2' }, 't1', 'b1')).toBe(false)
  })

  it('accepts a matching payload', () => {
    expect(eventMatchesWorkspace({ tenant_id: 't1', branch_id: 'b1' }, 't1', 'b1')).toBe(true)
  })
})

describe('console WebSocket path', () => {
  it('connects to /console/{branch_id}/ without tenant scope params', () => {
    expect(consoleWebSocketPath('branch-99')).toBe('/console/branch-99/')
    expect(consoleWebSocketPath('branch-99')).not.toContain('tenant')
  })

  it('DjangoChannelsWebSocket appends ?token= from the access token', () => {
    localStorage.setItem(JWT_ACCESS_KEY, 'access-token-xyz')
    const { svc, instances } = createTestSocket()
    svc.connect(consoleWebSocketPath('branch-99'))
    expect(instances[0].url).toContain('/console/branch-99/')
    expect(instances[0].url).toContain('token=access-token-xyz')
    expect(instances[0].url).not.toContain('tenant_id=')
    expect(instances[0].url).not.toContain('admin=')
    svc.disconnect()
    localStorage.removeItem(JWT_ACCESS_KEY)
  })
})

describe('attachConsolePendingCountHandlers', () => {
  it('connection_established matching context refetches both counts', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    const off = attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    instances[0].triggerMessage({
      type: 'connection_established',
      data: { tenant_id: 't1', branch_id: 'b1' },
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: pendingOrdersCountKey('t1', 'b1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: pendingReservationsCountKey('t1', 'b1') })
    off()
    svc.disconnect()
  })

  it('connection_established for another workspace disconnects and does not invalidate', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const onStaleConnection = vi.fn()
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection,
    })

    instances[0].triggerMessage({
      type: 'connection_established',
      data: { tenant_id: 't-other', branch_id: 'b-other' },
    })

    expect(onStaleConnection).toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    svc.disconnect()
  })

  it('order.changed invalidates only the order count', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    instances[0].triggerMessage({
      type: 'order.changed',
      data: { tenant_id: 't1', branch_id: 'b1', order_id: 'o1', status: 'pending' },
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: pendingOrdersCountKey('t1', 'b1') })
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: pendingReservationsCountKey('t1', 'b1') })
    svc.disconnect()
  })

  it('reservation.changed invalidates only the reservation count', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    instances[0].triggerMessage({
      type: 'reservation.changed',
      data: { tenant_id: 't1', branch_id: 'b1', reservation_id: 'r1', status: 'pending' },
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: pendingReservationsCountKey('t1', 'b1') })
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: pendingOrdersCountKey('t1', 'b1') })
    svc.disconnect()
  })

  it('ignores events from another tenant/branch', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    instances[0].triggerMessage({
      type: 'order.changed',
      data: { tenant_id: 't2', branch_id: 'b2', order_id: 'o1', status: 'pending' },
    })

    expect(invalidate).not.toHaveBeenCalled()
    svc.disconnect()
  })

  it('ignores irrelevant event types', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    instances[0].triggerMessage({
      type: 'kitchen.changed',
      data: { tenant_id: 't1', branch_id: 'b1' },
    })

    expect(invalidate).not.toHaveBeenCalled()
    svc.disconnect()
  })

  it('stale generation cannot invalidate the new workspace', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()
    let current = true

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => current,
      onStaleConnection: vi.fn(),
    })

    current = false
    instances[0].triggerMessage({
      type: 'order.changed',
      data: { tenant_id: 't1', branch_id: 'b1', order_id: 'o1', status: 'pending' },
    })

    expect(invalidate).not.toHaveBeenCalled()
    svc.disconnect()
  })

  it('reconnect connection_established refetches both counts', () => {
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    instances[0].triggerMessage({
      type: 'connection_established',
      data: { tenant_id: 't1', branch_id: 'b1' },
    })

    svc.connect(consoleWebSocketPath('b1'))
    const reconnected = instances[instances.length - 1]
    reconnected.triggerOpen()
    reconnected.triggerMessage({
      type: 'connection_established',
      data: { tenant_id: 't1', branch_id: 'b1' },
    })

    const orderInvalidations = invalidate.mock.calls.filter(
      (c) => JSON.stringify(c[0]) === JSON.stringify({ queryKey: pendingOrdersCountKey('t1', 'b1') }),
    )
    const reservationInvalidations = invalidate.mock.calls.filter(
      (c) => JSON.stringify(c[0]) === JSON.stringify({ queryKey: pendingReservationsCountKey('t1', 'b1') }),
    )
    expect(orderInvalidations.length).toBeGreaterThanOrEqual(2)
    expect(reservationInvalidations.length).toBeGreaterThanOrEqual(2)
    svc.disconnect()
  })
})

describe('useConsoleWorkspaceRealtime lifecycle', () => {
  it('connects to /console/{branch_id}/ when workspace is ready', () => {
    const connect = vi.spyOn(consoleWebSocket, 'connect').mockImplementation(() => {})
    vi.spyOn(consoleWebSocket, 'disconnect').mockImplementation(() => {})
    vi.spyOn(consoleWebSocket, 'on').mockReturnValue(() => {})

    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const qc = createQc()
    renderHook(() => useConsoleWorkspaceRealtime(), { wrapper: withClient(qc) })

    expect(connect).toHaveBeenCalledWith('/console/b1/')
  })

  it('does not connect while switching tenant', () => {
    const connect = vi.spyOn(consoleWebSocket, 'connect').mockImplementation(() => {})
    vi.spyOn(consoleWebSocket, 'disconnect').mockImplementation(() => {})
    vi.spyOn(consoleWebSocket, 'on').mockReturnValue(() => {})

    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'switching_tenant' })
    const qc = createQc()
    renderHook(() => useConsoleWorkspaceRealtime(), { wrapper: withClient(qc) })

    expect(connect).not.toHaveBeenCalled()
  })

  it('disconnects the old socket and connects the new branch on switch', () => {
    const connect = vi.spyOn(consoleWebSocket, 'connect').mockImplementation(() => {})
    const disconnect = vi.spyOn(consoleWebSocket, 'disconnect').mockImplementation(() => {})
    vi.spyOn(consoleWebSocket, 'on').mockReturnValue(() => {})

    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const qc = createQc()
    const { rerender } = renderHook(() => useConsoleWorkspaceRealtime(), { wrapper: withClient(qc) })

    expect(connect).toHaveBeenCalledWith('/console/b1/')

    act(() => {
      setWorkspace({ tenantId: 't1', branchId: 'b2', phase: 'ready' })
    })
    rerender()

    expect(disconnect).toHaveBeenCalled()
    expect(connect).toHaveBeenCalledWith('/console/b2/')
  })

  it('disconnects on tenant switch and reconnects to the new tenant branch', () => {
    const connect = vi.spyOn(consoleWebSocket, 'connect').mockImplementation(() => {})
    const disconnect = vi.spyOn(consoleWebSocket, 'disconnect').mockImplementation(() => {})
    vi.spyOn(consoleWebSocket, 'on').mockReturnValue(() => {})

    setWorkspace({ tenantId: 'tenantA', branchId: 'branchA', phase: 'ready' })
    const qc = createQc()
    const { rerender } = renderHook(() => useConsoleWorkspaceRealtime(), { wrapper: withClient(qc) })
    expect(connect).toHaveBeenCalledWith('/console/branchA/')

    act(() => {
      setWorkspace({ tenantId: 'tenantA', branchId: null, phase: 'switching_tenant' })
    })
    rerender()
    expect(disconnect).toHaveBeenCalled()

    act(() => {
      setWorkspace({ tenantId: 'tenantB', branchId: 'branchB', phase: 'ready' })
    })
    rerender()
    expect(connect).toHaveBeenCalledWith('/console/branchB/')
  })
})

describe('pending count queries', () => {
  it('does not fetch when workspace is incomplete', async () => {
    const spy = vi.spyOn(adminService, 'getPendingOrdersCount')
    setWorkspace({ tenantId: 't1', branchId: null, phase: 'ready' })
    const qc = createQc()
    const { result } = renderHook(() => usePendingOrdersCount(), { wrapper: withClient(qc) })
    expect(result.current.isFetching).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not fetch while switching', async () => {
    const spy = vi.spyOn(adminService, 'getPendingOrdersCount')
    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'switching_branch' })
    const qc = createQc()
    renderHook(() => usePendingOrdersCount(), { wrapper: withClient(qc) })
    expect(spy).not.toHaveBeenCalled()
  })

  it('fetches order count for the active tenant and branch', async () => {
    vi.spyOn(adminService, 'getPendingOrdersCount').mockResolvedValue({ count: 3 })
    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const qc = createQc()
    const { result } = renderHook(() => usePendingOrdersCount(), { wrapper: withClient(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(adminService.getPendingOrdersCount).toHaveBeenCalledWith('t1', 'b1')
    expect(result.current.data?.count).toBe(3)
    expect(result.current.dataUpdatedAt).toBeTruthy()
    const cached = qc.getQueryData(pendingOrdersCountKey('t1', 'b1'))
    expect(cached).toEqual({ count: 3 })
  })

  it('fetches reservation count for the active tenant and branch', async () => {
    vi.spyOn(adminService, 'getPendingReservationsCount').mockResolvedValue({ count: 2 })
    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const qc = createQc()
    const { result } = renderHook(() => usePendingReservationsCount(), { wrapper: withClient(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(adminService.getPendingReservationsCount).toHaveBeenCalledWith('t1', 'b1')
    expect(result.current.data?.count).toBe(2)
  })

  it('does not render another branch cache after switch', async () => {
    vi.spyOn(adminService, 'getPendingOrdersCount').mockImplementation(async (_t, branchId) => ({
      count: branchId === 'b1' ? 9 : 1,
    }))
    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const qc = createQc()
    const { result, rerender } = renderHook(() => usePendingOrdersCount(), { wrapper: withClient(qc) })
    await waitFor(() => expect(result.current.data?.count).toBe(9))

    act(() => {
      setWorkspace({ tenantId: 't1', branchId: 'b2', phase: 'ready' })
    })
    rerender()
    await waitFor(() => expect(result.current.data?.count).toBe(1))
    expect(result.current.data?.count).not.toBe(9)
  })
})

describe('CountBadge UI', () => {
  it('hides the badge when count is 0', () => {
    const { container } = render(<CountBadge count={0} isSuccess label="Pending orders" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides the badge while loading', () => {
    const { container } = render(<CountBadge count={undefined} isSuccess={false} label="Pending orders" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides the badge on error (no invented zero)', () => {
    const { container } = render(<CountBadge count={undefined} isSuccess={false} label="Pending orders" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Orders badge value 3', () => {
    vi.spyOn(adminService, 'getPendingOrdersCount').mockResolvedValue({ count: 3 })
    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const qc = createQc()
    renderWithIntl(
      <QueryClientProvider client={qc}>
        <ConsoleNavPendingBadge href="/console/orders" />
      </QueryClientProvider>,
    )
    return waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
  })

  it('shows Reservations badge value 5', () => {
    vi.spyOn(adminService, 'getPendingReservationsCount').mockResolvedValue({ count: 5 })
    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const qc = createQc()
    renderWithIntl(
      <QueryClientProvider client={qc}>
        <ConsoleNavPendingBadge href="/console/reservations" />
      </QueryClientProvider>,
    )
    return waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
  })
})

describe('integration: event → invalidate → refetch → badge', () => {
  it('order.changed refetches HTTP count and updates the badge', async () => {
    const getCount = vi
      .spyOn(adminService, 'getPendingOrdersCount')
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 4 })

    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    const off = attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    renderWithIntl(
      <QueryClientProvider client={qc}>
        <ConsoleNavPendingBadge href="/console/orders" />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())

    act(() => {
      instances[0].triggerMessage({
        type: 'order.changed',
        data: { tenant_id: 't1', branch_id: 'b1', order_id: 'o1', status: 'pending' },
      })
    })

    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    expect(getCount.mock.calls.length).toBeGreaterThanOrEqual(2)
    off()
    svc.disconnect()
  })

  it('reservation.changed refetches HTTP count and updates the badge', async () => {
    vi.spyOn(adminService, 'getPendingReservationsCount')
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 6 })

    setWorkspace({ tenantId: 't1', branchId: 'b1', phase: 'ready' })
    const { svc, instances } = createTestSocket()
    const qc = createQc()
    svc.connect(consoleWebSocketPath('b1'))
    instances[0].triggerOpen()

    attachConsolePendingCountHandlers({
      socket: svc,
      qc,
      tenantId: 't1',
      branchId: 'b1',
      isCurrent: () => true,
      onStaleConnection: vi.fn(),
    })

    renderWithIntl(
      <QueryClientProvider client={qc}>
        <ConsoleNavPendingBadge href="/console/reservations" />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())

    act(() => {
      instances[0].triggerMessage({
        type: 'reservation.changed',
        data: { tenant_id: 't1', branch_id: 'b1', reservation_id: 'r1', status: 'pending' },
      })
    })

    await waitFor(() => expect(screen.getByText('6')).toBeInTheDocument())
    svc.disconnect()
  })
})

describe('mutation invalidation', () => {
  it('order mutations invalidate pending-orders-count', () => {
    const src = readSrc('hooks/index.ts')
    const update = src.slice(src.indexOf('export function useUpdateOrderStatus'), src.indexOf('export function useAdminReservations'))
    expect(update).toContain('invalidatePendingOrdersCountQueries')
    const create = src.slice(src.indexOf('export function useCreateOrder'), src.indexOf('export function useValidateDiscount'))
    expect(create).toContain('invalidatePendingOrdersCountQueries')
  })

  it('reservation mutations invalidate pending-reservations-count', () => {
    const src = readSrc('hooks/index.ts')
    const confirm = src.slice(src.indexOf('export function useConfirmReservation'), src.indexOf('export function useCancelReservation'))
    expect(confirm).toContain('invalidatePendingReservationsCountQueries')
    const cancel = src.slice(src.indexOf('export function useCancelReservation'), src.indexOf('export function useAdminCustomers'))
    expect(cancel).toContain('invalidatePendingReservationsCountQueries')
  })

  it('prefix invalidation does not use local arithmetic', () => {
    const qc = createQc()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    invalidatePendingOrdersCountQueries(qc)
    invalidatePendingReservationsCountQueries(qc)
    expect(spy).toHaveBeenCalledWith({ queryKey: [PENDING_ORDERS_COUNT_KEY] })
    expect(spy).toHaveBeenCalledWith({ queryKey: [PENDING_RESERVATIONS_COUNT_KEY] })
    expect(readSrc('hooks/console-realtime.ts')).not.toContain('count + 1')
    expect(readSrc('hooks/console-realtime.ts')).not.toContain('count - 1')
  })
})

describe('architecture contracts', () => {
  it('reuses DjangoChannelsWebSocket and mounts the socket in Console layout', () => {
    const layout = readSrc('app/console/layout.tsx')
    expect(layout).toContain('ConsoleWorkspaceRealtime')
    expect(readSrc('hooks/console-realtime.ts')).toContain('consoleWebSocket.connect')
    expect(readSrc('services/websocket.service.ts')).toContain("channelName: 'samoon-console'")
  })

  it('does not listen for a fake message event', () => {
    const hooks = readSrc('hooks/index.ts')
    const block = hooks.slice(hooks.indexOf('function useBroadcastInvalidation'))
    expect(block).not.toMatch(/socket\.on\('message'/)
    expect(block).toContain("socket.on(eventType")
  })

  it('registers pending-count keys as branch-scoped', () => {
    expect(readSrc('hooks/index.ts')).toContain("'pending-orders-count'")
    expect(readSrc('hooks/index.ts')).toContain("'pending-reservations-count'")
    expect(readSrc('hooks/console-workspace.ts')).toContain("'pending-orders-count'")
  })

  it('adminService pending-count methods use the shared axios client (Bearer interceptor)', () => {
    const src = readSrc('services/admin.service.ts')
    expect(src).toContain('ENDPOINTS.ORDERS.CONSOLE_PENDING_COUNT(tenantId, branchId)')
    expect(src).toContain('ENDPOINTS.RESERVATIONS.CONSOLE_PENDING_COUNT(tenantId, branchId)')
    expect(src).toContain('api.get<PendingCountResponse>')
  })
})

describe('adminService pending-count HTTP contract', () => {
  it('wires tenant and branch into the pending-count URLs', () => {
    const src = readSrc('services/admin.service.ts')
    const ordersFn = src.slice(src.indexOf('async getPendingOrdersCount'), src.indexOf('async getPendingReservationsCount'))
    const reservationsFn = src.slice(src.indexOf('async getPendingReservationsCount'), src.indexOf('async getAdminReservation'))
    expect(ordersFn).toContain('CONSOLE_PENDING_COUNT(tenantId, branchId)')
    expect(reservationsFn).toContain('CONSOLE_PENDING_COUNT(tenantId, branchId)')
    expect(ENDPOINTS.ORDERS.CONSOLE_PENDING_COUNT('tenant-1', 'branch-1')).toBe(
      '/orders/console-orders/tenants/tenant-1/branches/branch-1/pending-count/',
    )
    expect(ENDPOINTS.RESERVATIONS.CONSOLE_PENDING_COUNT('tenant-1', 'branch-1')).toBe(
      '/reservations/console-reservations/tenants/tenant-1/branches/branch-1/pending-count/',
    )
  })
})
