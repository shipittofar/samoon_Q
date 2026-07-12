# 09 — WebSocket Usage

Source: `src/services/websocket.service.ts`. Not gated by `USE_MOCK` — the WebSocket layer always attempts a real connection regardless of the REST mock/real flag, which is an inconsistency worth flagging: REST calls can be mocked while sockets still try to dial a real server.

## Transport

- Base URL: `WS_BASE_URL` = `NEXT_PUBLIC_WS_BASE_URL`, default `ws://localhost:8000/ws`.
- Full connection URL: `${WS_BASE_URL}${path}` where `path` is supplied by the caller to `.connect(path)` (e.g. `orderWebSocket.connect('/orders/{orderId}/')` — exact call sites live in consuming hooks/components, not in the service file itself).
- **Auth**: JWT access token (from `localStorage`, same token axios uses) appended as a URL query string: `${url}?token=${encodeURIComponent(token)}`. This is the *only* auth mechanism — browsers cannot set custom headers on a WebSocket handshake.

## Message envelope

```ts
interface WebSocketMessage { type: string; data: unknown }
```
- `send(type, data)` — only sends if `socket.readyState === WebSocket.OPEN`.
- Incoming messages are parsed as JSON and dispatched to handlers registered for `msg.type`, plus a wildcard `'*'` handler receiving the full envelope.
- Synthetic **local-only** event types (not sent by the server): `'connected'`, `'disconnected'` (`{code, reason}`), `'error'`, `'status'` (payload = `ConnectionStatus`), `'offline'`, `'tab:status'` (cross-tab via `BroadcastChannel`).

## Heartbeat

`attachHeartbeat(ws, {intervalMs=30000, timeoutMs=10000})`:
- Sends `{type:'ping', data:{ts: Date.now()}}` every `intervalMs` after `'connected'`.
- Expects a `'pong'` reply within `timeoutMs`, else marks the connection unhealthy (internal flag).

## Reconnect logic

- Exponential backoff with jitter: `delay = min(1000 * 2^attempts, 30000) * (1 + 0.3*random())`.
- Capped at `MAX_RECONNECT_ATTEMPTS = 10`; after that, gives up and sets status `'disconnected'`.
- **Paused** while the tab is hidden (`document.hidden`) or the browser is offline (`navigator.onLine === false`).
- **Resumes immediately** (reconnect attempt counter reset, `scheduleReconnect(0)`) on `visibilitychange`→visible or the `window` `'online'` event.
- `disconnect()` sets `shouldReconnect=false` and tears down the socket + all listeners/timers without retrying.

## Multi-tab coordination

`BroadcastChannel(channelName)` (default `'savor-websocket'`, or a per-instance name) broadcasts `{type:'ws:status', status, channel}` on every status change. No-ops gracefully if `BroadcastChannel` is unavailable (e.g. some private-browsing contexts).

## Connection status values

```ts
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'disconnected'
```

## Exported singleton channels

| Singleton | Channel name | Purpose | Consumers |
|---|---|---|---|
| `orderWebSocket` | `savor-orders` | Order status push | `OrderTracker` component → `order/[orderId]/track`, `order/[orderId]`, `checkout/success` |
| `notificationWebSocket` | `savor-notifications` | Notification push | No customer page directly traced to `useNotificationWebSocket` — likely surfaced via a global layout bell icon |
| `adminOperationsSocket` | `admin.operations` | Admin-wide operations feed | via `OperationsChannelManager` |
| `branchOperationsSocket` | `branch.operations` | Branch-scoped operations feed | `console/operations` dashboard |
| `ordersBroadcastSocket` | `orders.broadcast` | Live order stream (admin) | `LiveOrderQueue` |
| `reservationsBroadcastSocket` | `reservations.broadcast` | Live reservation stream (admin) | `LiveReservationQueue` |
| `staffBroadcastSocket` | `staff.broadcast` | Staff presence stream | `StaffPresenceBoard` |
| `notificationsBroadcastSocket` | `notifications.broadcast` | Admin notification stream | — |
| `auditBroadcastSocket` | `audit.broadcast` | Live audit event stream | `ActivityFeed` |

All `OperationsChannelManager`-created sockets auto-attach heartbeat + health tracking.

## Realtime data types carried over WebSocket (see `04_TYPESCRIPT_MODEL_REFERENCE.md` "Realtime Operations" section for full field lists)

`OperationsEvent`, `LiveOrder`, `LiveReservation`, `StaffPresence`, `BranchStatus` (realtime variant — do not confuse with `branch.ts`'s `BranchStatus` string-literal type), `KitchenStatus`, `SLAAlert`, `LiveMetric`. Typed event-name → payload map: `RealtimeEventMap` (`live_order`, `live_reservation`, `staff_presence`, `branch_status`, `sla_alert`, `operations_event`, `metrics_update`, `system_alert`).

## Important caveat: `realtime-operations.service.ts` is REST polling, not WebSocket-driven

Despite the "realtime" name, `src/services/realtime-operations.service.ts` (P7.7) has **no WebSocket/SSE client code** — its `subscribe()` method is a pure in-memory mock event-emitter (`_eventSubscribers`), and every data-fetching method (`getOperationsSnapshot`, `getLiveOrders`, etc.) is a plain `GET` request. The `console/operations` dashboard achieves its "live" feel through **React Query polling** (`refetchInterval` ranging 8s–30s per hook — see `06_REACT_QUERY_MAPPING.md`), with `websocket.service.ts`'s singleton sockets layered on top for push updates in parallel. A backend implementer should treat these as **two separate integration surfaces**: (1) REST polling endpoints under `/operations/*`, and (2) actual WebSocket channels for push (`/ws/admin.operations`, `/ws/branch.operations`, etc., paths TBD by backend — exact WS path strings were not found hardcoded in the audited files, only channel *names* for the `BroadcastChannel` cross-tab layer).

## `simulateOrderUpdates()`

A pure client-side demo simulator (`setTimeout` sequence over `['pending','accepted','preparing','ready','delivered']`) — not a real WebSocket integration, exists for demo/mock UI purposes. Not part of the real contract.
