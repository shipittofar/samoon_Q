import { WS_BASE_URL } from '@/constants'
import { getAccessToken } from './axios.instance'

type MessageHandler = (data: unknown) => void

interface WebSocketMessage {
  type: string
  data: unknown
}

class DjangoChannelsWebSocket {
  private socket: WebSocket | null = null
  private handlers = new Map<string, Set<MessageHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private url = ''
  private shouldReconnect = true

  connect(path: string): void {
    this.url = `${WS_BASE_URL}${path}`
    const token = getAccessToken()
    const wsUrl = token ? `${this.url}?token=${token}` : this.url

    try {
      this.socket = new WebSocket(wsUrl)
      this.socket.onopen = this.handleOpen.bind(this)
      this.socket.onmessage = this.handleMessage.bind(this)
      this.socket.onclose = this.handleClose.bind(this)
      this.socket.onerror = this.handleError.bind(this)
    } catch (err) {
      console.error('[WS] Connection error:', err)
    }
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.socket?.close()
    this.socket = null
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
    return this.socket?.readyState === WebSocket.OPEN
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0
    this.emit('connected', null)
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const msg: WebSocketMessage = JSON.parse(event.data)
      this.emit(msg.type, msg.data)
      this.emit('*', msg)
    } catch {
      console.error('[WS] Failed to parse message:', event.data)
    }
  }

  private handleClose(event: CloseEvent): void {
    this.emit('disconnected', { code: event.code, reason: event.reason })
    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++
        this.connect(this.url.replace(WS_BASE_URL, ''))
      }, delay)
    }
  }

  private handleError(event: Event): void {
    console.error('[WS] Error:', event)
    this.emit('error', event)
  }

  private emit(type: string, data: unknown): void {
    this.handlers.get(type)?.forEach((h) => h(data))
  }
}

// ── Singleton instances ───────────────────────────────────────────────────────
export const orderWebSocket = new DjangoChannelsWebSocket()
export const notificationWebSocket = new DjangoChannelsWebSocket()

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
