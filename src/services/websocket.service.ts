/**
 * WebSocket Service — Phase 4 (P4.5)
 *
 * Enhancements over the Phase 3 implementation:
 *   P4.5.2 — Exponential backoff with jitter + 30 s cap
 *   P4.5.3 — Tab-visibility pause/resume of reconnect loop
 *   P4.5.4 — navigator.onLine / online / offline handling
 *   P4.5.5 — BroadcastChannel for multi-tab status sync (graceful degradation)
 *   P4.5.6 — Typed ConnectionStatus ('connecting'|'connected'|'reconnecting'|
 *             'offline'|'disconnected') exposed via getStatus()
 *
 * Public API is backward-compatible: connect, disconnect, send, on, off,
 * isConnected are unchanged. getStatus() is additive.
 */

import { WS_BASE_URL } from '@/constants'
import { getAccessToken } from './axios.instance'

type MessageHandler = (data: unknown) => void

interface WebSocketMessage {
  type: string
  data: unknown
}

/** P4.5.6 — Stable connection status values. */
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'disconnected'

/** Broadcast message shape for multi-tab coordination (P4.5.5). */
interface BroadcastPayload {
  type: 'ws:status'
  status: ConnectionStatus
  channel: string
}

// ── Backoff constants ─────────────────────────────────────────────────────────

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const JITTER_FACTOR = 0.3   // up to 30 % of the base delay as random jitter
const MAX_RECONNECT_ATTEMPTS = 10

// ── DjangoChannelsWebSocket ───────────────────────────────────────────────────

export interface WebSocketServiceOptions {
  /**
   * BroadcastChannel name for multi-tab coordination (P4.5.5).
   * Pass a unique name per logical socket to keep channels isolated.
   */
  channelName?: string
  /**
   * Injectable WebSocket factory — lets tests supply a mock implementation
   * without patching globals. Defaults to the browser's native WebSocket.
   */
  wsFactory?: (url: string) => WebSocket
}

export class DjangoChannelsWebSocket {
  // ── State ───────────────────────────────────────────────────────────────────
  private socket: WebSocket | null = null
  private handlers = new Map<string, Set<MessageHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private shouldReconnect = true
  private _status: ConnectionStatus = 'disconnected'
  private _isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private _isHidden = typeof document !== 'undefined' ? document.hidden : false
  private url = ''

  // ── Dependencies ────────────────────────────────────────────────────────────
  private readonly channelName: string
  private readonly wsFactory: (url: string) => WebSocket
  private broadcastChannel: BroadcastChannel | null = null

  // ── Browser event handlers (stored so they can be removed) ──────────────────
  private readonly _onVisibilityChange: () => void
  private readonly _onOnline: () => void
  private readonly _onOffline: () => void

  constructor(options: WebSocketServiceOptions = {}) {
    this.channelName = options.channelName ?? 'samoon-websocket'
    this.wsFactory = options.wsFactory ?? ((url) => new WebSocket(url))

    this._onVisibilityChange = this.handleVisibilityChange.bind(this)
    this._onOnline = this.handleOnline.bind(this)
    this._onOffline = this.handleOffline.bind(this)
  }

  // ── Public API (unchanged signatures) ──────────────────────────────────────

  connect(path: string): void {
    this.url = `${WS_BASE_URL}${path}`
    this.shouldReconnect = true
    this.setupEnvironmentListeners()
    this.initBroadcastChannel()
    this.openSocket()
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.clearReconnectTimer()
    this.teardownEnvironmentListeners()
    this.teardownBroadcastChannel()
    this.socket?.close()
    this.socket = null
    this.updateStatus('disconnected')
  }

  send(type: string, data: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }))
    }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.off(type, handler)
  }

  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  get isConnected(): boolean {
    return this._status === 'connected'
  }

  /** P4.5.6 — Typed connection status. */
  getStatus(): ConnectionStatus {
    return this._status
  }

  // ── Internal: socket lifecycle ──────────────────────────────────────────────

  private openSocket(): void {
    if (this.socket) {
      // Close stale socket before re-opening
      this.socket.onopen = null
      this.socket.onmessage = null
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.close()
      this.socket = null
    }

    this.updateStatus('connecting')
    const token = getAccessToken()
    const wsUrl = token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url

    try {
      this.socket = this.wsFactory(wsUrl)
      this.socket.onopen = this.handleOpen.bind(this)
      this.socket.onmessage = this.handleMessage.bind(this)
      this.socket.onclose = this.handleClose.bind(this)
      this.socket.onerror = this.handleError.bind(this)
    } catch (err) {
      console.error('[WS] Failed to construct WebSocket:', err)
      this.updateStatus('disconnected')
    }
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0
    this.updateStatus('connected')
    this.emit('connected', null)
    this.broadcastStatus('connected')
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const msg: WebSocketMessage = JSON.parse(event.data as string)
      this.emit(msg.type, msg.data)
      this.emit('*', msg)
    } catch {
      console.error('[WS] Failed to parse message:', event.data)
    }
  }

  private handleClose(event: CloseEvent): void {
    this.socket = null
    this.emit('disconnected', { code: event.code, reason: event.reason })

    if (!this.shouldReconnect) return

    // Don't reconnect if offline or tab is hidden
    if (!this._isOnline) {
      this.updateStatus('offline')
      return
    }
    if (this._isHidden) {
      this.updateStatus('disconnected')
      return
    }

    this.scheduleReconnect()
  }

  private handleError(_event: Event): void {
    console.error('[WS] Error:', this.safeConnectionLog())
    this.emit('error', { type: 'error' })
  }

  /** Log host+path only — never query strings (tokens live on `?token=`). */
  private safeConnectionLog(): string {
    try {
      const parsed = new URL(this.url)
      return `${parsed.origin}${parsed.pathname}`
    } catch {
      return '[ws]'
    }
  }

  // ── Internal: reconnect scheduling (P4.5.2) ─────────────────────────────────

  /**
   * Exponential backoff with full jitter and a 30 s hard cap.
   * Formula: min(BASE * 2^attempt, MAX) * (1 + jitter * rand)
   */
  private getReconnectDelay(): number {
    const exponential = Math.min(
      BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_DELAY_MS,
    )
    const jitter = exponential * JITTER_FACTOR * Math.random()
    return Math.round(exponential + jitter)
  }

  private scheduleReconnect(overrideDelay?: number): void {
    if (!this.shouldReconnect) return
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.updateStatus('disconnected')
      return
    }

    this.clearReconnectTimer()
    this.updateStatus('reconnecting')

    const delay = overrideDelay ?? this.getReconnectDelay()

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.openSocket()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ── Internal: tab visibility (P4.5.3) ────────────────────────────────────────

  private handleVisibilityChange(): void {
    this._isHidden = typeof document !== 'undefined' && document.hidden

    if (this._isHidden) {
      // Pause reconnect attempts while tab is backgrounded
      this.clearReconnectTimer()
    } else {
      // Tab foregrounded — reconnect if needed
      if (this.shouldReconnect && !this.isConnected && this._isOnline) {
        this.reconnectAttempts = 0
        this.scheduleReconnect(0)
      }
    }
  }

  // ── Internal: online/offline (P4.5.4) ────────────────────────────────────────

  private handleOnline(): void {
    this._isOnline = true
    if (this.shouldReconnect && !this.isConnected) {
      this.reconnectAttempts = 0
      this.scheduleReconnect(0) // immediate reconnect
    }
  }

  private handleOffline(): void {
    this._isOnline = false
    this.clearReconnectTimer()
    this.updateStatus('offline')
    this.emit('offline', null)
  }

  // ── Internal: environment listener lifecycle ──────────────────────────────────

  private setupEnvironmentListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._onOnline)
      window.addEventListener('offline', this._onOffline)
    }
  }

  private teardownEnvironmentListeners(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._onOnline)
      window.removeEventListener('offline', this._onOffline)
    }
  }

  // ── Internal: BroadcastChannel (P4.5.5) ──────────────────────────────────────

  private initBroadcastChannel(): void {
    if (this.broadcastChannel) return
    if (typeof BroadcastChannel === 'undefined') return // graceful degradation

    try {
      this.broadcastChannel = new BroadcastChannel(this.channelName)
      this.broadcastChannel.onmessage = (e: MessageEvent<BroadcastPayload>) => {
        if (e.data?.type === 'ws:status' && e.data.channel === this.channelName) {
          this.emit('tab:status', e.data.status)
        }
      }
    } catch {
      // BroadcastChannel construction failure (e.g. private browsing limits)
      this.broadcastChannel = null
    }
  }

  private teardownBroadcastChannel(): void {
    this.broadcastChannel?.close()
    this.broadcastChannel = null
  }

  private broadcastStatus(status: ConnectionStatus): void {
    if (!this.broadcastChannel) return
    try {
      const payload: BroadcastPayload = {
        type: 'ws:status',
        status,
        channel: this.channelName,
      }
      this.broadcastChannel.postMessage(payload)
    } catch {
      // postMessage can throw if channel closed — ignore
    }
  }

  // ── Internal: status + emit ───────────────────────────────────────────────────

  private updateStatus(status: ConnectionStatus): void {
    if (this._status === status) return
    this._status = status
    this.emit('status', status)
    this.broadcastStatus(status)
  }

  private emit(type: string, data: unknown): void {
    this.handlers.get(type)?.forEach((h) => {
      try {
        h(data)
      } catch {
        // Subscriber failures must not tear down the socket or the page.
      }
    })
  }
}

// ── Heartbeat support ─────────────────────────────────────────────────────────

export interface HeartbeatOptions {
  intervalMs?: number
  timeoutMs?: number
}

/**
 * Attaches a heartbeat (ping/pong) loop to a DjangoChannelsWebSocket.
 * Sends a 'ping' message at the given interval and marks the connection
 * as unhealthy if no 'pong' arrives within timeoutMs.
 * Returns a cleanup function.
 */
export function attachHeartbeat(
  ws: DjangoChannelsWebSocket,
  opts: HeartbeatOptions = {},
): () => void {
  const intervalMs = opts.intervalMs ?? 30_000
  const timeoutMs = opts.timeoutMs ?? 10_000
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let pongTimer: ReturnType<typeof setTimeout> | null = null
  let healthy = true

  const offPong = ws.on('pong', () => {
    if (pongTimer) { clearTimeout(pongTimer); pongTimer = null }
    healthy = true
  })

  const offConnected = ws.on('connected', () => {
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = setInterval(() => {
      if (!ws.isConnected) return
      ws.send('ping', { ts: Date.now() })
      pongTimer = setTimeout(() => {
        healthy = false
      }, timeoutMs)
    }, intervalMs)
  })

  const offDisconnected = ws.on('disconnected', () => {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
    if (pongTimer) { clearTimeout(pongTimer); pongTimer = null }
    healthy = false
  })

  return () => {
    if (pingTimer) clearInterval(pingTimer)
    if (pongTimer) clearTimeout(pongTimer)
    offPong()
    offConnected()
    offDisconnected()
    healthy = false
  }
}

// ── Connection health tracker ─────────────────────────────────────────────────

export interface ConnectionHealth {
  status: ConnectionStatus
  reconnectCount: number
  lastConnectedAt?: string
  lastDisconnectedAt?: string
  pingLatencyMs?: number
  isHealthy: boolean
}

export class OperationsChannelManager {
  private channels = new Map<string, DjangoChannelsWebSocket>()
  private heartbeats = new Map<string, () => void>()
  private health = new Map<string, ConnectionHealth>()

  /**
   * Create or return an existing channel socket by name.
   * Automatically attaches heartbeat and tracks connection health.
   */
  getOrCreate(channelName: string, heartbeatOpts?: HeartbeatOptions): DjangoChannelsWebSocket {
    if (this.channels.has(channelName)) return this.channels.get(channelName)!

    const ws = new DjangoChannelsWebSocket({ channelName })
    const initialHealth: ConnectionHealth = {
      status: 'disconnected',
      reconnectCount: 0,
      isHealthy: false,
    }
    this.health.set(channelName, initialHealth)

    ws.on('status', (status) => {
      const h = this.health.get(channelName)!
      h.status = status as ConnectionStatus
      h.isHealthy = status === 'connected'
    })
    ws.on('connected', () => {
      const h = this.health.get(channelName)!
      h.lastConnectedAt = new Date().toISOString()
      h.isHealthy = true
    })
    ws.on('disconnected', () => {
      const h = this.health.get(channelName)!
      h.lastDisconnectedAt = new Date().toISOString()
      h.reconnectCount += 1
      h.isHealthy = false
    })

    const pingTimestamps = new Map<number, number>()
    ws.on('connected', () => {
      ws.send('ping', { ts: Date.now() })
    })
    ws.on('pong', (data) => {
      const payload = data as { ts?: number }
      if (payload?.ts) {
        const latency = Date.now() - payload.ts
        const h = this.health.get(channelName)!
        h.pingLatencyMs = latency
        pingTimestamps.delete(payload.ts)
      }
    })

    const cleanup = attachHeartbeat(ws, heartbeatOpts)
    this.heartbeats.set(channelName, cleanup)
    this.channels.set(channelName, ws)
    return ws
  }

  getHealth(channelName: string): ConnectionHealth | undefined {
    return this.health.get(channelName)
  }

  getAllHealth(): Record<string, ConnectionHealth> {
    const result: Record<string, ConnectionHealth> = {}
    this.health.forEach((h, name) => { result[name] = { ...h } })
    return result
  }

  disconnectAll(): void {
    this.channels.forEach((ws, name) => {
      this.heartbeats.get(name)?.()
      ws.disconnect()
    })
    this.channels.clear()
    this.heartbeats.clear()
    this.health.clear()
  }
}

// ── Singleton instances ───────────────────────────────────────────────────────
export const orderWebSocket = new DjangoChannelsWebSocket({
  channelName: 'samoon-orders',
})
export const notificationWebSocket = new DjangoChannelsWebSocket({
  channelName: 'samoon-notifications',
})
/** Single Console-workspace socket — `/ws/console/{branch_id}/?token=...` */
export const consoleWebSocket = new DjangoChannelsWebSocket({
  channelName: 'samoon-console',
})

// ── Admin broadcast channel singletons (P7.7 Step 5) ─────────────────────────
export const operationsChannelManager = new OperationsChannelManager()

export const adminOperationsSocket = operationsChannelManager.getOrCreate('admin.operations')
export const branchOperationsSocket = operationsChannelManager.getOrCreate('branch.operations')
export const ordersBroadcastSocket = operationsChannelManager.getOrCreate('orders.broadcast')
export const reservationsBroadcastSocket = operationsChannelManager.getOrCreate('reservations.broadcast')
export const staffBroadcastSocket = operationsChannelManager.getOrCreate('staff.broadcast')
export const notificationsBroadcastSocket = operationsChannelManager.getOrCreate('notifications.broadcast')
export const auditBroadcastSocket = operationsChannelManager.getOrCreate('audit.broadcast')

// ── Mock real-time simulation ─────────────────────────────────────────────────
const ORDER_STATUS_SEQUENCE = ['pending', 'accepted', 'preparing', 'ready', 'delivered'] as const

export function simulateOrderUpdates(
  orderId: string,
  onUpdate: (status: string, estimatedTime: number) => void,
): () => void {
  let step = 0
  const intervals = [3000, 5000, 8000, 5000, 3000]
  let timer: ReturnType<typeof setTimeout>

  function next() {
    if (step >= ORDER_STATUS_SEQUENCE.length) return
    const status = ORDER_STATUS_SEQUENCE[step]
    const estimatedTime = Math.max(0, (ORDER_STATUS_SEQUENCE.length - step - 1) * 5)
    onUpdate(status, estimatedTime)
    step++
    if (step < ORDER_STATUS_SEQUENCE.length) {
      timer = setTimeout(next, intervals[step] || 3000)
    }
  }

  timer = setTimeout(next, 1500)
  return () => clearTimeout(timer)
}
