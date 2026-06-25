# Missing Backend Endpoints

> Endpoints the frontend is fully wired for but the backend has not yet deployed.
> Frontend falls back to mock data (`NEXT_PUBLIC_USE_MOCK=true`) for all of these.
>
> Last updated: 2026-06-25. Sections 1–5 are pre-existing gaps. Sections 6–12 were added in P7.2–P7.14 and also require backend implementation.

---

## 1. PATCH /orders/{id}/status/

**Purpose:** Update an order's status through its lifecycle (pending → accepted → preparing → ready → delivered / cancelled).

**Authentication:** Admin / Staff (`orders:manage` permission)

**Request Schema:**
```json
{
  "status": "preparing"
}
```

| Field | Type | Required | Enum |
|-------|------|----------|------|
| `status` | `string` | Yes | `pending`, `accepted`, `preparing`, `ready`, `delivered`, `cancelled` |

**Response Schema:** Full `Order` object

```json
{
  "id": "ord-001",
  "order_number": "SAV-3902",
  "status": "preparing",
  "updated_at": "2024-08-15T19:05:00Z",
  "status_history": [
    { "status": "pending", "timestamp": "2024-08-15T19:00:00Z" },
    { "status": "accepted", "timestamp": "2024-08-15T19:01:00Z" },
    { "status": "preparing", "timestamp": "2024-08-15T19:05:00Z" }
  ]
}
```

**HTTP Status Codes:**
- `200 OK` — status updated
- `400 Bad Request` — invalid transition
- `403 Forbidden` — insufficient permissions
- `404 Not Found` — order not found

**Frontend Call Sites:**
- `src/services/admin.service.ts:184` — `adminService.updateOrderStatus(id, status)`
- `src/hooks/index.ts` — `useUpdateOrderStatus` (optimistic update + rollback)
- `src/app/admin/orders/page.tsx` — `advance()` function

**Business Rules:**
- `status_history` must be appended (not replaced) on each status change
- Backwards transitions should return `400` with descriptive message
- The WebSocket order channel (`ws/orders/{id}/`) should broadcast `order.status_update` after each status change

---

## 2. POST /reservations/{id}/confirm/

**Purpose:** Admin confirms a pending reservation, generating a confirmation code.

**Authentication:** Admin / Staff (`reservations:manage` permission)

**Request Body:** Empty (no body required)

**Response Schema:**

```json
{
  "id": "res-001",
  "status": "confirmed",
  "confirmation_code": "SAV-4521",
  "name": "Alice Johnson",
  "phone": "+1234567890",
  "date": "2024-08-15",
  "time": "19:00",
  "guests": 4,
  "branch_id": "branch1",
  "created_at": "2024-08-14T10:00:00Z"
}
```

**HTTP Status Codes:**
- `200 OK` — confirmed
- `400 Bad Request` — already confirmed/cancelled
- `403 Forbidden` — insufficient permissions
- `404 Not Found` — reservation not found

**Frontend Call Sites:**
- `src/services/admin.service.ts:208` — `adminService.confirmReservation(id)`
- `src/hooks/index.ts` — `useConfirmReservation` (optimistic update + rollback)
- `src/app/admin/reservations/page.tsx`

**Business Rules:**
- `confirmation_code` format: `SAV-{4-digit number}` (e.g. `SAV-4521`)
- Only `pending` reservations can be confirmed; `confirmed`, `cancelled`, `completed` should return `400`
- Consider sending SMS/email with confirmation code (frontend assumes this happens server-side)

---

## 3. GET /admin/stats/

**Purpose:** Return aggregated KPI dashboard data for the admin dashboard.

**Authentication:** Admin / Staff (`dashboard:access` permission)

**Query Parameters:**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `period_days` | `number` | No | `30` |

**Response Schema:**

```json
{
  "period_days": 30,
  "total_revenue": 48295.00,
  "revenue_change_pct": 12.5,
  "total_orders": 1284,
  "orders_change_pct": 8.2,
  "new_customers": 348,
  "customers_change_pct": 15.3,
  "total_reservations": 92,
  "reservations_change_pct": -3.1,
  "top_items": [
    {
      "menu_item_id": "1",
      "name": "Wagyu Smash Burger",
      "order_count": 284,
      "revenue": 7098.00,
      "trend_pct": 18
    }
  ],
  "orders_in_queue": 12,
  "avg_prep_time_minutes": 18,
  "tables_reserved": 8,
  "tables_total": 24
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `period_days` | `number` | The window used for percentage change calculations |
| `total_revenue` | `number` | Sum of all order totals in period |
| `revenue_change_pct` | `number` | % change vs previous period (negative = decline) |
| `total_orders` | `number` | Count of orders (excluding cancelled) in period |
| `orders_change_pct` | `number` | % change vs previous period |
| `new_customers` | `number` | Users with first order in period |
| `customers_change_pct` | `number` | % change vs previous period |
| `total_reservations` | `number` | Reservations created in period |
| `reservations_change_pct` | `number` | % change vs previous period |
| `top_items` | `AdminTopItem[]` | Top 5 items by order count |
| `orders_in_queue` | `number` | Current orders with status `pending` or `accepted` |
| `avg_prep_time_minutes` | `number` | Rolling average across `preparing` → `ready` transitions |
| `tables_reserved` | `number` | Tables with active reservations today |
| `tables_total` | `number` | Total tables at all active branches |

**HTTP Status Codes:**
- `200 OK`
- `403 Forbidden`

**Frontend Call Sites:**
- `src/services/admin.service.ts:162` — `adminService.getStats()`
- `src/hooks/index.ts` — `useAdminStats`
- `src/app/admin/page.tsx` — dashboard page

**Frontend Type:** `AdminStats`, `AdminTopItem` — `src/types/index.ts:539,546`

---

## 4. GET /admin/customers/

**Purpose:** List all customers with aggregated commerce metrics. Supports search and tier filtering.

**Authentication:** Admin (`users:manage` permission)

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tier` | `string` | No | `new` \| `regular` \| `vip` |
| `search` | `string` | No | Match first_name, last_name, or email (case-insensitive) |
| `page` | `number` | No | Default: 1 |
| `page_size` | `number` | No | Default: 20 |

**Response Schema:** `PaginatedResponse<AdminCustomer>`

```json
{
  "count": 348,
  "next": "/admin/customers/?page=2",
  "previous": null,
  "results": [
    {
      "id": "u1",
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Johnson",
      "phone": "+1234567890",
      "avatar": null,
      "role": "customer",
      "is_verified": true,
      "created_at": "2024-01-15T00:00:00Z",
      "order_count": 14,
      "total_spent": 420.50,
      "avg_order_value": 30.04,
      "tier": "vip",
      "last_order_at": "2024-08-13T10:00:00Z"
    }
  ]
}
```

**Response Fields (per customer):**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| All `User` fields | — | See User | Base user record |
| `order_count` | `number` | No | Total orders placed (all time) |
| `total_spent` | `number` | No | Sum of order totals (all time) |
| `avg_order_value` | `number` | No | `total_spent / order_count` |
| `tier` | `string` | No | `new` \| `regular` \| `vip` (computed) |
| `last_order_at` | `string` | Yes | ISO timestamp of most recent order |

**HTTP Status Codes:**
- `200 OK`
- `403 Forbidden`

**Frontend Call Sites:**
- `src/services/admin.service.ts:222` — `adminService.getCustomers(filters)`
- `src/hooks/index.ts` — `useAdminCustomers`
- `src/app/admin/customers/page.tsx`

**Frontend Types:** `AdminCustomer` (`src/types/index.ts:521`), `AdminCustomerFilters` (`src/types/index.ts:586`)

**Search Behavior:** Match against `first_name`, `last_name` (concatenated), or `email`. Case-insensitive, substring match.

**Tier Computation (backend responsibility):**
```
tier = 'new'     if order_count < 5
tier = 'regular' if 5 ≤ order_count < 15
tier = 'vip'     if order_count ≥ 15
```

---

## 5. GET /admin/customers/{id}/stats/

**Purpose:** Detailed commerce statistics for a single customer.

**Authentication:** Admin (`users:manage` permission)

**Path Parameters:** `id` — User ID

**Response Schema:**

```json
{
  "customer_id": "u1",
  "order_count": 14,
  "total_spent": 420.50,
  "avg_order_value": 30.04,
  "favorite_item": "Wagyu Smash Burger",
  "last_order_at": "2024-08-13T10:00:00Z"
}
```

**Response Fields:**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `customer_id` | `string` | No | Matches the `id` path param |
| `order_count` | `number` | No | Total lifetime orders |
| `total_spent` | `number` | No | Lifetime total spend |
| `avg_order_value` | `number` | No | `total_spent / order_count`, or `0` if no orders |
| `favorite_item` | `string` | Yes | Name of the most frequently ordered item |
| `last_order_at` | `string` | Yes | ISO timestamp of most recent order |

**HTTP Status Codes:**
- `200 OK`
- `403 Forbidden`
- `404 Not Found`

**Frontend Call Sites:**
- `src/services/admin.service.ts:236` — `adminService.getCustomerStats(id)`
- `src/hooks/index.ts` — `useAdminCustomerStats`
- `src/app/admin/customers/page.tsx`

**Frontend Type:** `AdminCustomerStats` — `src/types/index.ts:530`

---

## Partially Implemented (Fallback Active)

These endpoints exist in principle but currently redirect to public endpoints with an `admin=true` query param. Once the dedicated admin endpoints are deployed, swap the service call.

### GET /admin/orders/

Current fallback: `GET /orders/?admin=true`  
Expected behavior difference from `/orders/`:
- Returns orders across **all users** (not just the authenticated user)
- Supports `order_type` filter in addition to `status` and `search`
- Returns full `user` sub-object embedded in each order

**Frontend type:** `AdminOrderFilters` — `src/types/index.ts:567`

### GET /admin/reservations/

Current fallback: `GET /reservations/?admin=true`  
Expected behavior difference from `/reservations/`:
- Returns reservations across **all users and branches**
- Supports `branch_id` and `date` filters
- Returns full `user` sub-object embedded in each reservation

**Frontend type:** `AdminReservationFilters` — `src/types/index.ts:574`

---

## 6. Analytics Endpoints (added P7.13)

All three analytics endpoints are fully implemented on the frontend and fall back to rich mock data.

### GET /analytics/menu/

**Frontend call site:** `src/services/analytics.service.ts` → `getMenuAnalytics()`
**Hook:** `useMenuAnalytics()` in `src/hooks/index.ts`
**Used by:** `src/app/admin/analytics/page.tsx`
**Query params:** `tenant_id`, `branch_id`, `period` (`7d`|`30d`|`90d`)
**Response type:** `MenuAnalytics` — `src/types/analytics.ts`

### GET /analytics/revenue/

**Frontend call site:** `src/services/analytics.service.ts` → `getRevenueAnalytics()`
**Hook:** `useRevenueAnalytics()` in `src/hooks/index.ts`
**Used by:** `src/app/admin/analytics/page.tsx`
**Query params:** `tenant_id`, `branch_id`, `period`, `group_by`
**Response type:** `RevenueAnalytics` — `src/types/analytics.ts`

### GET /analytics/summary/

**Frontend call site:** `src/services/analytics.service.ts` → `getAnalyticsSummary()`
**Hook:** `useAnalyticsSummary()` in `src/hooks/index.ts`
**Used by:** `src/app/admin/analytics/page.tsx`
**Response type:** `AnalyticsSummary` — `src/types/analytics.ts`

---

## 7. Bulk Operation Endpoints (added P7.14)

### POST /admin/orders/bulk-status/

**Frontend call site:** `src/hooks/index.ts` → `useBulkUpdateOrderStatus()`
**Used by:** `src/app/admin/orders/page.tsx` — "Accept Selected" action
**Request:** `{ ids: string[], status: OrderStatus }`

### POST /admin/orders/bulk-cancel/

**Frontend call site:** `src/hooks/index.ts` → `useBulkCancelOrders()`
**Used by:** `src/app/admin/orders/page.tsx` — "Cancel Selected" action
**Request:** `{ ids: string[] }`

### POST /admin/reservations/bulk-confirm/

**Frontend call site:** `src/hooks/index.ts` → `useBulkConfirmReservations()`
**Used by:** `src/app/admin/reservations/page.tsx` — "Confirm Selected" action
**Request:** `{ ids: string[] }`

### POST /admin/reservations/bulk-cancel/

**Frontend call site:** `src/hooks/index.ts` → `useBulkCancelReservations()`
**Used by:** `src/app/admin/reservations/page.tsx` — "Cancel Selected" action
**Request:** `{ ids: string[] }`

### POST /admin/customers/bulk-export/

**Frontend call site:** `src/hooks/index.ts` → `useBulkExportCustomers()`
**Used by:** `src/app/admin/customers/page.tsx` — "Export Selected" action
**Request:** `{ ids: string[] }`
**Response:** CSV file download

> **Note:** Frontend currently does client-side CSV generation as a temporary measure. Server-side export via this endpoint is required for large datasets.

---

## 8. Kitchen Display Endpoint (added P7.13)

### GET /admin/kitchen/status/

**Frontend call site:** `src/services/realtime-operations.service.ts` → `getKitchenStatus()`
**Hook:** `useKitchenStatus(branchId, tenantId)` in `src/hooks/index.ts`
**Used by:** `src/app/admin/kitchen/page.tsx`, `src/components/admin/KitchenDisplay.tsx`
**Query params:** `branch_id` (required), `tenant_id`
**Response type:** `KitchenStatus` — `src/types/realtime-operations.ts`

---

## 9. Staff Management Endpoints (added P7.2)

### GET /admin/staff/

**Frontend call site:** `src/services/staff.service.ts`
**Hook:** `useAdminStaff()` in `src/hooks/index.ts`
**Used by:** `src/app/admin/staff/page.tsx`
**Response type:** `StaffMember[]` — `src/types/staff.ts`

### GET|PATCH /admin/staff/{id}/

**Frontend call site:** `src/services/staff.service.ts`
**Used by:** `src/app/admin/staff/[id]/page.tsx`

---

## 10. Audit Log Endpoints (added P7.5)

### GET /admin/audit-logs/

**Frontend call site:** `src/services/audit-log.service.ts`
**Hook:** `useAdminAuditLogs()` in `src/hooks/index.ts`
**Used by:** `src/app/admin/audit-logs/page.tsx`
**Response type:** `AuditLog[]` — `src/types/audit-log.ts`

### GET /admin/audit-logs/{id}/

**Used by:** `src/app/admin/audit-logs/[id]/page.tsx`

---

## 11. Realtime Operations Endpoints (added P7.7)

### GET /admin/operations/status/

**Frontend call site:** `src/services/realtime-operations.service.ts`
**Hook:** `useRealtimeOperations()` in `src/hooks/index.ts`
**Used by:** `src/app/admin/operations/page.tsx`
**Response type:** `RealtimeOperationsStatus` — `src/types/realtime-operations.ts`

**WebSocket alternative:** `ws/operations/{branchId}/` — real-time push.

---

## 12. Feature Flag Endpoints (added P1B)

### GET|PATCH /admin/settings/feature-flags/

**Frontend call site:** `src/services/feature-flags.service.ts`
**Hook:** `useFeatureFlags()`, `useToggleFeatureFlag()` in `src/hooks/index.ts`
**Used by:** `src/app/admin/settings/feature-flags/page.tsx`

