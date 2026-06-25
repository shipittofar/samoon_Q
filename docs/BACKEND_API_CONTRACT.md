# Backend API Contract — Savor Restaurant SaaS

> **Single source of truth for backend development.**
> Generated from frontend source code. All types, endpoints, and business rules are
> derived from `src/types/index.ts`, `src/services/`, `src/hooks/`, and runtime service usage.
>
> Last updated: 2026-06-25 (updated for P7.8–P7.14.5: analytics, bulk ops, kitchen, staff, audit logs, realtime, branches, tenants, loyalty, promotions, vendors)

---

## Table of Contents

1. [Base Configuration](#1-base-configuration)
2. [Authentication](#2-authentication-endpoints)
3. [Menu](#3-menu-endpoints)
4. [Orders](#4-order-endpoints)
5. [Reservations](#5-reservation-endpoints)
6. [Payments](#6-payment-endpoints)
7. [Branches / Locations](#7-branch--location-endpoints)
8. [Users / Profile](#8-user--profile-endpoints)
9. [Notifications](#9-notification-endpoints)
10. [Tenants](#10-tenant-endpoints)
11. [Reviews](#11-review-endpoints)
12. [Tables](#12-table-endpoints)
13. [Admin — Dashboard & Stats](#13-admin-endpoints)
14. [Analytics](#14-analytics-endpoints) *(added P7.13)*
15. [Bulk Operations](#15-bulk-operation-endpoints) *(added P7.14)*
16. [Staff Management](#16-staff-management-endpoints) *(added P7.2)*
17. [Audit Logs](#17-audit-log-endpoints) *(added P7.5)*
18. [Kitchen Display](#18-kitchen-display-endpoints) *(added P7.13)*
19. [Loyalty & Promotions](#19-loyalty--promotion-endpoints) *(added P6)*
20. [Vendors](#20-vendor-endpoints) *(added P6)*
21. [Feature Flags](#21-feature-flag-endpoints) *(added P1B)*
22. [WebSocket Channels](#22-websocket-channels)
23. [Pagination Contract](#23-pagination-contract)
24. [Error Response Contract](#24-error-response-contract)
25. [Security & Headers](#25-security--headers)
26. [Business Rules](#26-business-rules)
19. [RBAC Permission Matrix](#19-rbac-permission-matrix)
20. [Environment Variables](#20-environment-variables)
21. [Endpoint Classification Summary](#21-endpoint-classification-summary)

---

## 1. Base Configuration

```
REST Base URL : process.env.NEXT_PUBLIC_API_BASE_URL  (default: http://localhost:8000/api)
WebSocket URL : process.env.NEXT_PUBLIC_WS_BASE_URL   (default: ws://localhost:8000/ws)
```

**Source:** `src/lib/env.ts`, `src/services/axios.instance.ts`

### Token Lifecycle

| Token | Storage | Lifetime | Notes |
|-------|---------|---------|-------|
| `access` | `localStorage["access_token"]` + cookie (not HttpOnly, SameSite=Strict) | Short-lived | Sent as `Authorization: Bearer {token}` |
| `refresh` | `localStorage["refresh_token"]` | Long-lived | Used only in `POST /auth/token/refresh/` |

The axios interceptor automatically calls `POST /auth/token/refresh/` on any 401 response, swaps the tokens, and retries the original request once. If refresh also fails, the user is logged out.

---

## 2. Authentication Endpoints

### 2.1 Login

**Method:** `POST`  
**Path:** `/auth/login/`  
**Authentication:** Public  
**Tenant Aware:** Yes (X-Tenant-Slug header)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Success Response `200`:**
```json
{
  "user": {
    "id": "u1",
    "email": "user@example.com",
    "phone": "+1234567890",
    "first_name": "Alice",
    "last_name": "Johnson",
    "avatar": null,
    "role": "customer",
    "is_verified": true,
    "created_at": "2024-01-15T00:00:00Z"
  },
  "tokens": {
    "access": "eyJ...",
    "refresh": "eyJ..."
  }
}
```

**Error Response `400`:**
```json
{ "message": "Invalid credentials", "code": "invalid_credentials" }
```

**Frontend Type:** `User`, `AuthTokens` — `src/types/index.ts:8,23`

---

### 2.2 Register

**Method:** `POST`  
**Path:** `/auth/register/`  
**Authentication:** Public

**Request Body:**
```json
{
  "email": "new@example.com",
  "phone": "+1234567890",
  "password": "Secret123!",
  "confirm_password": "Secret123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Success Response `201`:** Same shape as Login `200`.

**Frontend Type:** `RegisterData` — `src/types/index.ts:30`

---

### 2.3 Logout

**Method:** `POST`  
**Path:** `/auth/logout/`  
**Authentication:** Customer / Staff / Admin  

**Request Body:** Empty  
**Success Response:** `200 OK` (empty body)

---

### 2.4 Get Current User

**Method:** `GET`  
**Path:** `/auth/me/`  
**Authentication:** Customer / Staff / Admin

**Success Response `200`:** `User` object (same as login user field)

---

### 2.5 Refresh Token

**Method:** `POST`  
**Path:** `/auth/token/refresh/`  
**Authentication:** Public (bearer not required; refresh token in body)

**Request Body:**
```json
{ "refresh": "eyJ..." }
```

**Success Response `200`:**
```json
{ "access": "eyJ...", "refresh": "eyJ..." }
```

Backend should implement **refresh token rotation** — each refresh issues a new refresh token and invalidates the old one.

---

### 2.6 Forgot Password

**Method:** `POST`  
**Path:** `/auth/forgot-password/`  
**Authentication:** Public

**Request Body:** `{ "email": "user@example.com" }`  
**Success Response `200`:** `{ "message": "Reset link sent" }`

---

### 2.7 Reset Password

**Method:** `POST`  
**Path:** `/auth/reset-password/`  
**Authentication:** Public (token in body)

**Request Body:**
```json
{ "token": "abc123", "password": "NewSecret123!" }
```

**Success Response `200`:** `{ "message": "Password updated" }`

---

### 2.8 Send OTP

**Method:** `POST`  
**Path:** `/auth/send-otp/`  
**Authentication:** Public

**Request Body:** `{ "phone": "+1234567890" }`  
**Success Response `200`:** `{ "message": "OTP sent" }`

---

### 2.9 Verify OTP

**Method:** `POST`  
**Path:** `/auth/verify-otp/`  
**Authentication:** Public

**Request Body:**
```json
{ "phone": "+1234567890", "otp": "123456" }
```

**Success Response `200`:** Same shape as Login `200`.

**Frontend Type:** `OTPVerifyData` — `src/types/index.ts:39`

---

### 2.10 Change Password

**Method:** `POST`  
**Path:** `/auth/change-password/`  
**Authentication:** Customer / Staff / Admin

**Request Body:**
```json
{ "old_password": "current", "new_password": "NewSecret123!" }
```

**Success Response `200`:** `{ "message": "Password changed" }`

---

## 3. Menu Endpoints

### 3.1 List Categories

**Method:** `GET`  
**Path:** `/menu/categories/`  
**Authentication:** Public  
**Tenant Aware:** Yes

**Success Response `200`:**
```json
[
  {
    "id": "cat1",
    "name": "Burgers",
    "slug": "burgers",
    "description": "Premium handcrafted burgers",
    "image": "https://cdn.example.com/cat-burgers.jpg",
    "icon": "burger",
    "order": 1,
    "items_count": 12
  }
]
```

**Frontend Type:** `Category[]` — `src/types/index.ts:47`

---

### 3.2 Get Category

**Method:** `GET`  
**Path:** `/menu/categories/{id}/`  
**Authentication:** Public

**Success Response `200`:** Single `Category` object.

---

### 3.3 List Menu Items

**Method:** `GET`  
**Path:** `/menu/items/`  
**Authentication:** Public

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `category` | `string` | Filter by category ID |
| `search` | `string` | Full-text search on name/description |
| `min_price` | `number` | Minimum price filter |
| `max_price` | `number` | Maximum price filter |
| `min_rating` | `number` | Minimum rating filter |
| `available` | `boolean` | Filter by availability |
| `sort` | `string` | Sort field (e.g. `price`, `-rating`, `name`) |
| `page` | `number` | Page number (default: 1) |
| `page_size` | `number` | Items per page (default: 20) |

**Success Response `200`:** `PaginatedResponse<MenuItem>`

```json
{
  "count": 48,
  "next": "/menu/items/?page=2",
  "previous": null,
  "results": [
    {
      "id": "1",
      "category_id": "cat1",
      "category": { "id": "cat1", "name": "Burgers", "slug": "burgers", "order": 1 },
      "name": "Wagyu Smash Burger",
      "slug": "wagyu-smash-burger",
      "description": "Premium wagyu beef patty...",
      "price": 24.99,
      "discount": 10,
      "discounted_price": 22.49,
      "image": "https://cdn.example.com/burger1.jpg",
      "images": ["https://cdn.example.com/burger1-2.jpg"],
      "calories": 850,
      "preparation_time": 15,
      "rating": 4.8,
      "rating_count": 284,
      "available": true,
      "is_featured": true,
      "is_new": false,
      "is_popular": true,
      "tags": ["bestseller", "spicy"],
      "extras": [{ "id": "e1", "name": "Extra Patty", "price": 4.99, "available": true }],
      "allergens": ["gluten", "dairy"],
      "nutritional_info": { "calories": 850, "protein": 42, "carbs": 48, "fat": 38, "fiber": 3 }
    }
  ]
}
```

**Frontend Type:** `MenuItem` — `src/types/index.ts:65`  
**Filter type:** `MenuFilters` — `src/services/menu.service.ts`

---

### 3.4 Get Menu Item

**Method:** `GET`  
**Path:** `/menu/items/{id}/`  
**Authentication:** Public

**Success Response `200`:** Single `MenuItem` object.

---

### 3.5 Get Menu Item by Slug

**Method:** `GET`  
**Path:** `/menu/items/{slug}/`  
**Authentication:** Public

**Success Response `200`:** Single `MenuItem` object.

---

### 3.6 Featured Items

**Method:** `GET`  
**Path:** `/menu/items/featured/`  
**Authentication:** Public

**Success Response `200`:** `MenuItem[]` (not paginated — returns all featured items)

---

### 3.7 Popular Items

**Method:** `GET`  
**Path:** `/menu/items/popular/`  
**Authentication:** Public

**Success Response `200`:** `MenuItem[]`

---

### 3.8 Search Items

**Method:** `GET`  
**Path:** `/menu/items/search/`  
**Authentication:** Public

**Query Parameters:** `q: string` (required)

**Success Response `200`:** `MenuItem[]`

---

### 3.9 Related Items

**Method:** `GET`  
**Path:** `/menu/items/{id}/related/`  
**Authentication:** Public

**Success Response `200`:** `MenuItem[]`

---

### 3.10 Item Reviews

**Method:** `GET`  
**Path:** `/menu/items/{itemId}/reviews/`  
**Authentication:** Public

**Success Response `200`:**
```json
{
  "results": [
    {
      "id": "rev1",
      "user": { "id": "u1", "first_name": "Alice", "last_name": "J.", "avatar": null },
      "menu_item_id": "1",
      "order_id": "ord-001",
      "rating": 5,
      "comment": "Amazing burger!",
      "created_at": "2024-03-01T12:00:00Z"
    }
  ],
  "count": 284,
  "average_rating": 4.8
}
```

**Frontend Type:** `Review` — `src/types/index.ts:434`

---

### 3.11 Create Menu Item (Admin)

**Method:** `POST`  
**Path:** `/menu/items/`  
**Authentication:** Admin (requires `menu:manage` permission)

**Request Body:** `Partial<MenuItem>` — all fields of `MenuItem` except `id`, `slug`, `rating`, `rating_count` (server-generated).

```json
{
  "name": "New Burger",
  "category_id": "cat1",
  "description": "A great burger",
  "price": 14.99,
  "image": "https://cdn.example.com/new-burger.jpg",
  "preparation_time": 12,
  "available": true
}
```

**Success Response `201`:** Full `MenuItem` object.

---

### 3.12 Update Menu Item (Admin)

**Method:** `PATCH`  
**Path:** `/menu/items/{id}/`  
**Authentication:** Admin (requires `menu:manage` permission)

**Request Body:** Any subset of `MenuItem` fields.

```json
{ "available": false, "price": 16.99 }
```

**Success Response `200`:** Updated `MenuItem` object.

---

### 3.13 Delete Menu Item (Admin)

**Method:** `DELETE`  
**Path:** `/menu/items/{id}/`  
**Authentication:** Admin (requires `menu:manage` permission)

**Success Response:** `204 No Content`

---

## 4. Order Endpoints

### 4.1 List Orders (Customer)

**Method:** `GET`  
**Path:** `/orders/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Order>`

**Frontend Type:** `Order` — `src/types/index.ts:169`

---

### 4.2 Create Order

**Method:** `POST`  
**Path:** `/orders/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "branch_id": "branch1",
  "items": [
    {
      "menu_item_id": "item1",
      "quantity": 2,
      "notes": "No onions",
      "extras": ["e1", "e2"]
    }
  ],
  "order_type": "delivery",
  "payment_method": "card",
  "delivery_address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "lat": 40.7128,
    "lng": -74.0060
  },
  "table_number": null,
  "discount_code": "SAVE10",
  "notes": "Please ring doorbell"
}
```

**Frontend Type:** `CreateOrderPayload` — `src/services/order.service.ts`

**Success Response `201`:** Full `Order` object.

**Business Rules:**
- `order_type: 'delivery'` requires `delivery_address`
- `order_type: 'dine_in'` requires `table_number`
- `discount_code` must be validated via `/orders/validate-discount/` before submission
- Tax calculated server-side at 9% of subtotal
- Service charge calculated server-side at 5% of subtotal

---

### 4.3 Get Order Detail

**Method:** `GET`  
**Path:** `/orders/{id}/`  
**Authentication:** Customer (own orders only) / Admin

**Success Response `200`:** Full `Order` object including `status_history`.

---

### 4.4 Cancel Order

**Method:** `POST`  
**Path:** `/orders/{id}/cancel/`  
**Authentication:** Customer

**Success Response `200`:** Updated `Order` with `status: 'cancelled'`.

**Business Rules:** Only `pending` orders may be cancelled by the customer.

---

### 4.5 Reorder

**Method:** `POST`  
**Path:** `/orders/{id}/reorder/`  
**Authentication:** Customer

**Success Response `201`:** New `Order` object (clone of original with fresh timestamps and `status: 'pending'`).

---

### 4.6 Track Order

**Method:** `GET`  
**Path:** `/orders/{id}/track/`  
**Authentication:** Customer

**Success Response `200`:** `Order` object. Frontend polls or supplements with WebSocket.

---

### 4.7 Validate Discount

**Method:** `POST`  
**Path:** `/orders/validate-discount/`  
**Authentication:** Customer

**Request Body:**
```json
{ "code": "SAVE10", "subtotal": 45.99 }
```

**Success Response `200`:**
```json
{
  "valid": true,
  "discount_type": "percent",
  "discount_value": 10,
  "discount_amount": 4.60
}
```

**Error Response `200`:**
```json
{ "valid": false, "message": "Code expired or invalid" }
```

**Known valid codes (mock):** `SAVE10` (10%), `WEEKEND20` (20%), `FIRST5` ($5 fixed)

---

### 4.8 Update Order Status (Admin) ⚠️ BLOCKED

**Method:** `PATCH`  
**Path:** `/orders/{id}/status/`  
**Authentication:** Admin (requires `orders:manage` permission)

**Request Body:**
```json
{ "status": "preparing" }
```

**Success Response `200`:** Updated `Order` object.

**Status Transitions (enforced by frontend UI):**
```
pending → accepted → preparing → ready → delivered
any     → cancelled (admin only)
```

**Frontend Type:** `OrderStatus` — `src/types/index.ts:134`  
**Call site:** `src/services/admin.service.ts:184`, `src/hooks/index.ts:useUpdateOrderStatus`

---

## 5. Reservation Endpoints

### 5.1 List Reservations (Customer)

**Method:** `GET`  
**Path:** `/reservations/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Reservation>`

**Frontend Type:** `Reservation` — `src/types/index.ts:206`

---

### 5.2 Create Reservation

**Method:** `POST`  
**Path:** `/reservations/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "branch_id": "branch1",
  "date": "2024-08-15",
  "time": "19:00",
  "guests": 4,
  "name": "Alice Johnson",
  "phone": "+1234567890",
  "email": "alice@example.com",
  "notes": "Anniversary dinner, window table preferred"
}
```

**Frontend Type:** `CreateReservationPayload` — `src/services/combined.service.ts`

**Success Response `201`:** Full `Reservation` object.

---

### 5.3 Get Reservation

**Method:** `GET`  
**Path:** `/reservations/{id}/`  
**Authentication:** Customer (own) / Admin

**Success Response `200`:** `Reservation` object.

---

### 5.4 Cancel Reservation

**Method:** `POST`  
**Path:** `/reservations/{id}/cancel/`  
**Authentication:** Customer

**Success Response `200`:** Updated `Reservation` with `status: 'cancelled'`.

---

### 5.5 Confirm Reservation (Admin) ⚠️ BLOCKED

**Method:** `POST`  
**Path:** `/reservations/{id}/confirm/`  
**Authentication:** Admin (requires `reservations:manage` permission)

**Request Body:** Empty

**Success Response `200`:**
```json
{
  "id": "res1",
  "status": "confirmed",
  "confirmation_code": "SAV-4521",
  ...
}
```

**Frontend Type:** `ReservationStatus` — `src/types/index.ts:204`  
**Call site:** `src/services/admin.service.ts:208`, `src/hooks/index.ts:useConfirmReservation`

---

### 5.6 Available Slots

**Method:** `GET`  
**Path:** `/reservations/available-slots/`  
**Authentication:** Public

**Query Parameters:** `date` (ISO date string), `branch_id`

**Success Response `200`:** `string[]` — available time strings in `HH:MM` format.

```json
["12:00", "12:30", "13:00", "19:00", "19:30", "20:00"]
```

---

## 6. Payment Endpoints

### 6.1 Create Payment Intent

**Method:** `POST`  
**Path:** `/payments/create-intent/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "amount": 4560,
  "currency": "usd",
  "order_description": "Order #3902",
  "branch_id": "branch1"
}
```

`amount` is in **cents** (Stripe convention).

**Success Response `200`:**
```json
{
  "client_secret": "pi_xxx_secret_yyy",
  "payment_intent_id": "pi_xxx",
  "amount": 4560,
  "currency": "usd"
}
```

**Frontend Type:** `CreatePaymentIntentPayload` — `src/services/payment.service.ts`

---

### 6.2 Confirm Payment

**Method:** `POST`  
**Path:** `/payments/confirm/`  
**Authentication:** Customer

**Request Body:**
```json
{ "payment_intent_id": "pi_xxx" }
```

**Success Response `200`:**
```json
{
  "status": "succeeded",
  "payment_intent_id": "pi_xxx",
  "error": null
}
```

---

## 7. Branch / Location Endpoints

### 7.1 List Branches

**Method:** `GET`  
**Path:** `/branches/`  
**Authentication:** Public  
**Tenant Aware:** Yes

**Success Response `200`:** `Branch[]` (not paginated)

```json
[
  {
    "id": "branch1",
    "name": "Downtown",
    "slug": "downtown",
    "type": "restaurant_branch",
    "address": "123 Main St",
    "city": "New York",
    "phone": "+12125551234",
    "email": "downtown@savor.com",
    "lat": 40.7128,
    "lng": -74.0060,
    "working_hours": [
      { "day": "Monday", "open": "11:00", "close": "22:00", "is_closed": false },
      { "day": "Sunday", "open": "12:00", "close": "21:00", "is_closed": false }
    ],
    "is_active": true,
    "delivery_radius": 5.0,
    "images": ["https://cdn.example.com/branch1.jpg"]
  }
]
```

**Frontend Type:** `Branch = Location` — `src/types/index.ts:334,356`

---

### 7.2 Get Branch

**Method:** `GET`  
**Path:** `/branches/{id}/`  
**Authentication:** Public

**Success Response `200`:** Single `Branch` object.

---

### 7.3 Nearby Branches

**Method:** `GET`  
**Path:** `/branches/nearby/`  
**Authentication:** Public

**Query Parameters:** `lat: number`, `lng: number`, `radius?: number` (km, default: 10)

**Success Response `200`:** `Branch[]` sorted by distance.

---

## 8. User / Profile Endpoints

### 8.1 Get Profile

**Method:** `GET`  
**Path:** `/users/profile/`  
**Authentication:** Customer

**Success Response `200`:** `User` object.

---

### 8.2 Update Profile

**Method:** `PATCH`  
**Path:** `/users/profile/`  
**Authentication:** Customer

**Request Body:** Any subset of `User` fields (excluding `id`, `role`, `created_at`, `is_verified`).

```json
{ "first_name": "Alice", "phone": "+1234567890" }
```

**Success Response `200`:** Updated `User` object.

---

### 8.3 Upload Avatar

**Method:** `POST`  
**Path:** `/users/avatar/`  
**Authentication:** Customer  
**Content-Type:** `multipart/form-data`

**Request Body:** `FormData` with field `avatar: File`

**Constraints:**
- Allowed types: JPEG, PNG, WebP, GIF
- Max size: 5 MB

**Success Response `200`:**
```json
{ "avatar_url": "https://cdn.example.com/avatars/u1.jpg" }
```

---

### 8.4 List Addresses

**Method:** `GET`  
**Path:** `/users/addresses/`  
**Authentication:** Customer

**Success Response `200`:** `Address[]`

```json
[
  {
    "id": "addr1",
    "label": "Home",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "lat": 40.7128,
    "lng": -74.0060,
    "is_default": true
  }
]
```

**Frontend Type:** `Address` — `src/types/index.ts:447`

---

### 8.5 Create Address

**Method:** `POST`  
**Path:** `/users/addresses/`  
**Authentication:** Customer

**Request Body:** `Address` fields excluding `id`.

**Success Response `201`:** Full `Address` object with server-assigned `id`.

---

### 8.6 Delete Address

**Method:** `DELETE`  
**Path:** `/users/addresses/{id}/`  
**Authentication:** Customer

**Success Response:** `204 No Content`

---

### 8.7 Get Favorites

**Method:** `GET`  
**Path:** `/users/favorites/`  
**Authentication:** Customer

**Success Response `200`:** `string[]` — array of favorite `MenuItem` IDs.

```json
["item1", "item5", "item12"]
```

---

### 8.8 Toggle Favorite

**Method:** `POST`  
**Path:** `/users/favorites/{itemId}/`  
**Authentication:** Customer

**Request Body:** Empty

**Success Response `200`:**
```json
{ "favorited": true }
```

or

```json
{ "favorited": false }
```

---

## 9. Notification Endpoints

### 9.1 List Notifications

**Method:** `GET`  
**Path:** `/notifications/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Notification>`

```json
{
  "count": 12,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "notif1",
      "type": "order_update",
      "title": "Order Ready",
      "message": "Your order #3902 is ready for pickup!",
      "data": { "order_id": "ord-001" },
      "is_read": false,
      "created_at": "2024-08-15T19:05:00Z"
    }
  ]
}
```

**Frontend Type:** `Notification` — `src/types/index.ts:405`

---

### 9.2 Mark Notification Read

**Method:** `POST`  
**Path:** `/notifications/{id}/read/`  
**Authentication:** Customer

**Success Response:** `200 OK`

---

### 9.3 Mark All Notifications Read

**Method:** `POST`  
**Path:** `/notifications/read-all/`  
**Authentication:** Customer

**Success Response:** `200 OK`

---

### 9.4 Delete Notification

**Method:** `DELETE`  
**Path:** `/notifications/{id}/`  
**Authentication:** Customer

**Success Response:** `204 No Content`

---

### 9.5 Register Push Device

**Method:** `POST`  
**Path:** `/notifications/register-device/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "token": "fcm-device-token-string",
  "platform": "web"
}
```

`platform` values: `"web"` | `"ios"` | `"android"`

**Success Response:** `200 OK`

---

## 10. Tenant Endpoints

### 10.1 Get Tenant by Slug

**Method:** `GET`  
**Path:** `/tenants/{slug}/`  
**Authentication:** Public

**Success Response `200`:**
```json
{
  "id": "t1",
  "name": "Savor Restaurant",
  "slug": "savor",
  "businessTypes": ["restaurant"],
  "status": "active",
  "createdAt": "2023-01-01T00:00:00Z",
  "settings": {
    "theme": {
      "primaryColor": "#3b82f6",
      "accentHoverColor": "#2563eb",
      "logoUrl": "https://cdn.example.com/logo.png",
      "fontBody": "\"Inter\", sans-serif"
    },
    "featureFlags": {
      "delivery.enabled": true,
      "reservations.enabled": true
    }
  }
}
```

**Frontend Type:** `Tenant` — `src/types/index.ts:286`  
**Important:** `businessTypes` must contain valid module keys (currently only `"restaurant"`).

---

### 10.2 Get Current Tenant

**Method:** `GET`  
**Path:** `/tenants/current/`  
**Authentication:** Public  
**Resolution:** From `Host` header or `X-Tenant-Slug` header

**Success Response `200`:** Same as 10.1.

---

## 11. Review Endpoints

### 11.1 Create Review

**Method:** `POST`  
**Path:** `/reviews/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "menu_item_id": "item1",
  "rating": 5,
  "comment": "Amazing burger, will order again!",
  "order_id": "ord-001"
}
```

**Frontend Type:** `CreateReviewPayload` — `src/services/review.service.ts`

**Success Response `201`:** `Review` object.

---

### 11.2 List Reviews

**Method:** `GET`  
**Path:** `/reviews/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Review>`

---

## 12. Table Endpoints

### 12.1 Get Table Info

**Method:** `GET`  
**Path:** `/tables/{tableId}/`  
**Authentication:** Public (QR code scan scenario)

**Success Response `200`:**
```json
{
  "id": "t1",
  "number": 5,
  "capacity": 4,
  "section": "Garden",
  "server_name": "Marco",
  "status": "available"
}
```

**Frontend Type:** `TableInfo` — `src/types/index.ts:99`

---

### 12.2 Dine-In Order for Table

**Method:** `POST`  
**Path:** `/tables/{tableId}/order/`  
**Authentication:** Public (identified by table context)

**Request Body:** Same as `CreateOrderPayload` (section 4.2) with `order_type: "dine_in"`.

**Success Response `201`:** `Order` object.

---

## 13. Admin Endpoints

> **All admin endpoints require `role: 'admin'` or `role: 'staff'` on the authenticated user.**
> The frontend enforces this via `AuthGuard` checking `dashboard:access` permission.

### 13.1 Admin Dashboard Stats ⚠️ BLOCKED

**Method:** `GET`  
**Path:** `/admin/stats/`  
**Authentication:** Admin  
**Status:** **No backend route yet**

**Query Parameters:** `period_days?: number` (default: 30)

**Success Response `200`:**
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

**Frontend Type:** `AdminStats` — `src/types/index.ts:549`  
**Call site:** `src/services/admin.service.ts:162`

---

### 13.2 List Admin Orders ⚠️ PARTIAL

**Method:** `GET`  
**Path:** `/admin/orders/`  
**Authentication:** Admin  
**Status:** **Falls back to `/orders/?admin=true` until deployed**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | `OrderStatus` | Filter by order status |
| `order_type` | `OrderType` | Filter by order type |
| `search` | `string` | Search by order number or customer name |
| `page` | `number` | Page number |
| `page_size` | `number` | Results per page |

**Success Response `200`:** `PaginatedResponse<Order>`  
**Frontend Type:** `AdminOrderFilters` — `src/types/index.ts:567`

---

### 13.3 List Admin Reservations ⚠️ PARTIAL

**Method:** `GET`  
**Path:** `/admin/reservations/`  
**Authentication:** Admin  
**Status:** **Falls back to `/reservations/?admin=true` until deployed**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | `ReservationStatus` | Filter by status |
| `branch_id` | `string` | Filter by branch |
| `date` | `string` | Filter by date (ISO date: `YYYY-MM-DD`) |
| `search` | `string` | Search by name or phone |
| `page` | `number` | Page number |
| `page_size` | `number` | Results per page |

**Success Response `200`:** `PaginatedResponse<Reservation>`  
**Frontend Type:** `AdminReservationFilters` — `src/types/index.ts:574`

---

### 13.4 List Admin Customers ⚠️ BLOCKED

**Method:** `GET`  
**Path:** `/admin/customers/`  
**Authentication:** Admin  
**Status:** **No backend route yet**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `tier` | `AdminCustomerTier` | Filter by customer tier (`new`, `regular`, `vip`) |
| `search` | `string` | Search by first name, last name, or email |
| `page` | `number` | Page number |
| `page_size` | `number` | Results per page |

**Success Response `200`:** `PaginatedResponse<AdminCustomer>`

```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "u1",
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Johnson",
      "phone": "+1234567890",
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

**Frontend Type:** `AdminCustomer` — `src/types/index.ts:521`  
**Filter type:** `AdminCustomerFilters` — `src/types/index.ts:586`  
**Call site:** `src/services/admin.service.ts:222`

**Tier Calculation Rules:**
- `new` — fewer than 5 orders or less than 90 days since first order
- `regular` — 5–14 orders
- `vip` — 15+ orders (frontend uses this as display-only; backend should compute and return)

---

### 13.5 Get Customer Stats ⚠️ BLOCKED

**Method:** `GET`  
**Path:** `/admin/customers/{id}/stats/`  
**Authentication:** Admin  
**Status:** **No backend route yet**

**Success Response `200`:**
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

**Frontend Type:** `AdminCustomerStats` — `src/types/index.ts:530`  
**Call site:** `src/services/admin.service.ts:236`

---

## 14. WebSocket Channels

**Base:** `process.env.NEXT_PUBLIC_WS_BASE_URL` (default: `ws://localhost:8000/ws`)  
**Implementation:** Django Channels  
**Auth:** JWT token passed as query param `?token={access_token}`

### 14.1 Order Tracking Channel

**URL:** `ws://localhost:8000/ws/orders/{orderId}/?token={accessToken}`  
**Authentication:** Customer (must own the order)

**Server → Client Messages:**

```json
{ "type": "order.status_update", "data": { "status": "preparing", "estimated_time": 15 } }
{ "type": "connected", "data": null }
{ "type": "disconnected", "data": null }
```

**Frontend Type:** `OrderStatus` — `src/types/index.ts:134`  
**Call site:** `src/hooks/client.ts:useOrderWebSocket`

---

### 14.2 Notification Channel

**URL:** `ws://localhost:8000/ws/notifications/?token={accessToken}`  
**Authentication:** Customer

**Server → Client Messages:**

```json
{ "type": "notification.new", "data": { "id": "notif5", "type": "order_update", "title": "Ready!", "message": "Your order is ready.", "is_read": false, "created_at": "2024-08-15T19:05:00Z" } }
```

**Frontend Type:** `Notification` — `src/types/index.ts:405`  
**Call site:** `src/hooks/client.ts:useNotificationWebSocket`

---

### WebSocket Reconnection Contract

The frontend implements exponential backoff with jitter:

```
delay = min(BASE_DELAY * 2^attempt, MAX_DELAY) * (1 + jitter * Math.random())
BASE_DELAY = 1000ms
MAX_DELAY  = 30000ms
MAX_RECONNECT_ATTEMPTS = 10
```

- Pauses when `document.visibilityState === 'hidden'`
- Pauses when `navigator.onLine === false`
- Resumes immediately on `visibilitychange` or `online` event
- Uses `BroadcastChannel` for multi-tab coordination (graceful degradation if unavailable)

The backend should accept reconnecting clients without penalty and replay the last known status on connection.

---

## 15. Pagination Contract

**All list endpoints return this envelope:**

```typescript
interface PaginatedResponse<T> {
  count: number           // Total record count across all pages
  next: string | null     // Full URL of next page, or null
  previous: string | null // Full URL of previous page, or null
  results: T[]            // Records for current page
}
```

**Source:** `src/types/index.ts:418`

**Query Parameters (standard, all optional):**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | 1-indexed page number |
| `page_size` | `20` | Max records per page |

**Frontend accesses:** `data?.results`, `data?.count` — these exact field names are required.

---

## 16. Error Response Contract

**Source:** `src/types/index.ts:425`

```typescript
interface ApiError {
  message: string
  code?: string
  errors?: Record<string, string[]>
}
```

**HTTP Status Codes:**

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | |
| `201` | Created | |
| `204` | No Content | DELETE success |
| `400` | Validation error | `{ "message": "Invalid data", "errors": { "email": ["Already taken"] } }` |
| `401` | Unauthenticated | `{ "message": "Authentication required", "code": "not_authenticated" }` |
| `403` | Forbidden | `{ "message": "Permission denied", "code": "permission_denied" }` |
| `404` | Not found | `{ "message": "Not found", "code": "not_found" }` |
| `500` | Server error | `{ "message": "Internal server error" }` |

---

## 17. Security & Headers

### Request Headers (sent by frontend)

| Header | Value | When |
|--------|-------|------|
| `Authorization` | `Bearer {access_token}` | All authenticated requests |
| `Content-Type` | `application/json` | All POST/PATCH/PUT requests |
| `Accept` | `application/json` | All requests |
| `X-CSRFToken` | Value of `csrftoken` cookie | All non-GET requests |
| `X-Tenant-Slug` | Tenant slug string | All requests (injected by Next.js middleware) |

**Source:** `src/services/axios.instance.ts`, `src/middleware.ts`

### Required CORS Configuration

```
Access-Control-Allow-Origin: http://localhost:3000  (or production domain)
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRFToken, X-Tenant-Slug
```

The axios instance sets `withCredentials: true`, so the backend **must** allow credentials and cannot use wildcard (`*`) for `Access-Control-Allow-Origin`.

---

## 18. Business Rules

### Order Status Machine

```
pending ──→ accepted ──→ preparing ──→ ready ──→ delivered
   │            │              │           │
   └──────────────────────────────────────→ cancelled (admin action)
```

- Customer can cancel only `pending` orders
- Admin can advance status forward or cancel at any stage
- `status_history` array must be maintained by backend with timestamps

### Cart Calculation

```
subtotal       = sum(unit_price × quantity) for all items
tax            = subtotal × 0.09   (9% — hardcoded frontend assumption)
service_charge = subtotal × 0.05   (5% — hardcoded frontend assumption)
discount_amount = (from /orders/validate-discount/)
total          = subtotal - discount_amount + tax + service_charge
```

### Customer Tier Logic

| Tier | Condition |
|------|-----------|
| `new` | order_count < 5 |
| `regular` | 5 ≤ order_count < 15 |
| `vip` | order_count ≥ 15 |

Computed by backend; returned in `AdminCustomer.tier`.

### Tenant Resolution Order

1. `X-Tenant-Slug` header (set by Next.js middleware from subdomain)
2. `Host` header subdomain extraction
3. `NEXT_PUBLIC_TENANT_SLUG` env var (dev override)
4. Default tenant (`"default"`)

### RBAC Permissions by Role

| Permission | customer | staff | admin |
|-----------|---------|-------|-------|
| `menu:read` | ✓ | ✓ | ✓ |
| `orders:read` | ✓ | ✓ | ✓ |
| `orders:write` | ✓ | ✓ | ✓ |
| `orders:cancel` | ✓ | ✓ | ✓ |
| `orders:manage` | — | ✓ | ✓ |
| `menu:write` | — | ✓ | ✓ |
| `menu:manage` | — | — | ✓ |
| `reservations:read` | ✓ | ✓ | ✓ |
| `reservations:write` | ✓ | ✓ | ✓ |
| `reservations:manage` | — | ✓ | ✓ |
| `users:read` | ✓ | ✓ | ✓ |
| `users:manage` | — | — | ✓ |
| `dashboard:access` | — | ✓ | ✓ |
| `branches:read` | ✓ | ✓ | ✓ |
| `branches:manage` | — | — | ✓ |
| `notifications:read` | ✓ | ✓ | ✓ |

**Source:** `src/services/rbac.service.ts`, `src/types/index.ts:470`

### Feature Flags

Backend should include a `featureFlags` object inside `Tenant.settings`. The frontend merges module defaults with tenant overrides. Known flags:

| Flag Key | Default | Description |
|----------|---------|-------------|
| `delivery.enabled` | `true` | Enable delivery order type |
| `reservations.enabled` | `true` | Enable reservation flow |

---

## 19. RBAC Permission Matrix

See section 18 above. The frontend guards all admin pages via `AuthGuard` checking `dashboard:access`. Admin mutation endpoints additionally check specific permissions (`menu:manage`, `orders:manage`, `reservations:manage`).

---

## 20. Environment Variables

```bash
# Required
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_USE_MOCK=false

# Optional (gracefully degraded if missing)
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000/ws
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=savor-...
NEXT_PUBLIC_FIREBASE_APP_ID=1:...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BK...
NEXT_PUBLIC_TENANT_SLUG=default    # Dev override — bypasses middleware resolution
```

---

## 21. Endpoint Classification Summary

| Endpoint | Method | Status |
|----------|--------|--------|
| `/auth/login/` | POST | ✅ READY |
| `/auth/register/` | POST | ✅ READY |
| `/auth/logout/` | POST | ✅ READY |
| `/auth/me/` | GET | ✅ READY |
| `/auth/token/refresh/` | POST | ✅ READY |
| `/auth/forgot-password/` | POST | ✅ READY |
| `/auth/reset-password/` | POST | ✅ READY |
| `/auth/send-otp/` | POST | ✅ READY |
| `/auth/verify-otp/` | POST | ✅ READY |
| `/auth/change-password/` | POST | ✅ READY |
| `/menu/categories/` | GET | ✅ READY |
| `/menu/categories/{id}/` | GET | ✅ READY |
| `/menu/items/` | GET | ✅ READY |
| `/menu/items/` | POST | ✅ READY (admin) |
| `/menu/items/{id}/` | GET/PATCH/DELETE | ✅ READY |
| `/menu/items/featured/` | GET | ✅ READY |
| `/menu/items/popular/` | GET | ✅ READY |
| `/menu/items/search/` | GET | ✅ READY |
| `/menu/items/{id}/related/` | GET | ✅ READY |
| `/menu/items/{id}/reviews/` | GET | ✅ READY |
| `/orders/` | GET/POST | ✅ READY |
| `/orders/{id}/` | GET | ✅ READY |
| `/orders/{id}/cancel/` | POST | ✅ READY |
| `/orders/{id}/reorder/` | POST | ✅ READY |
| `/orders/{id}/track/` | GET | ✅ READY |
| `/orders/validate-discount/` | POST | ✅ READY |
| `/orders/{id}/status/` | PATCH | 🔴 BLOCKED |
| `/payments/create-intent/` | POST | ✅ READY |
| `/payments/confirm/` | POST | ✅ READY |
| `/reservations/` | GET/POST | ✅ READY |
| `/reservations/{id}/` | GET | ✅ READY |
| `/reservations/{id}/cancel/` | POST | ✅ READY |
| `/reservations/{id}/confirm/` | POST | 🔴 BLOCKED |
| `/reservations/available-slots/` | GET | ✅ READY |
| `/branches/` | GET | ✅ READY |
| `/branches/{id}/` | GET | ✅ READY |
| `/branches/nearby/` | GET | ✅ READY |
| `/users/profile/` | GET/PATCH | ✅ READY |
| `/users/avatar/` | POST | ✅ READY |
| `/users/addresses/` | GET/POST | ✅ READY |
| `/users/addresses/{id}/` | DELETE | ✅ READY |
| `/users/favorites/` | GET | ✅ READY |
| `/users/favorites/{itemId}/` | POST | ✅ READY |
| `/notifications/` | GET | ✅ READY |
| `/notifications/{id}/read/` | POST | ✅ READY |
| `/notifications/read-all/` | POST | ✅ READY |
| `/notifications/{id}/` | DELETE | ✅ READY |
| `/notifications/register-device/` | POST | ✅ READY |
| `/tenants/{slug}/` | GET | ✅ READY |
| `/tenants/current/` | GET | ✅ READY |
| `/reviews/` | GET/POST | ✅ READY |
| `/tables/{tableId}/` | GET | ✅ READY |
| `/tables/{tableId}/order/` | POST | ✅ READY |
| `/admin/stats/` | GET | 🔴 BLOCKED |
| `/admin/orders/` | GET | 🟡 PARTIAL (falls back to /orders/) |
| `/admin/reservations/` | GET | 🟡 PARTIAL (falls back to /reservations/) |
| `/admin/customers/` | GET | 🔴 BLOCKED |
| `/admin/customers/{id}/stats/` | GET | 🔴 BLOCKED |
| `ws/orders/{id}/` | WS | ✅ READY |
| `ws/notifications/` | WS | ✅ READY |

---

## 14. Analytics Endpoints

> Added in P7.13. All analytics endpoints require `admin` role or `analytics.view` permission.

### 14.1 Menu Analytics

**Method:** `GET`
**Path:** `/analytics/menu/`
**Authentication:** Admin
**Query params:** `tenant_id`, `branch_id` (optional), `period` (`7d` | `30d` | `90d`, default `30d`)

**Success Response `200`:**
```json
{
  "period": "30d",
  "topItems": [{ "itemId": "i1", "name": "Wagyu Burger", "orders": 142, "revenue": 2556.0, "trend": 12.5 }],
  "categoryBreakdown": [{ "categoryId": "c1", "name": "Burgers", "orders": 220, "revenue": 3960.0, "percentage": 35.2 }],
  "revenueByDay": [{ "date": "2026-06-01", "revenue": 1240.0, "orders": 68 }],
  "totalRevenue": 11250.0,
  "totalOrders": 620,
  "averageOrderValue": 18.15,
  "comparisonPeriod": { "totalRevenue": 9800.0, "totalOrders": 540, "revenueChange": 14.8, "ordersChange": 14.8 }
}
```

**Source:** `src/services/analytics.service.ts` → `getMenuAnalytics()`
**Type:** `MenuAnalytics` in `src/types/analytics.ts`

---

### 14.2 Revenue Analytics

**Method:** `GET`
**Path:** `/analytics/revenue/`
**Authentication:** Admin
**Query params:** `tenant_id`, `branch_id` (optional), `period` (`7d` | `30d` | `90d`, default `30d`), `group_by` (`day` | `week` | `month`)

**Success Response `200`:**
```json
{
  "period": "30d",
  "groupBy": "day",
  "data": [{ "date": "2026-06-01", "revenue": 1240.0, "orders": 68, "averageOrder": 18.24 }],
  "total": 11250.0,
  "averagePerPeriod": 375.0,
  "growth": 14.8
}
```

**Source:** `src/services/analytics.service.ts` → `getRevenueAnalytics()`
**Type:** `RevenueAnalytics` in `src/types/analytics.ts`

---

### 14.3 Analytics Summary

**Method:** `GET`
**Path:** `/analytics/summary/`
**Authentication:** Admin
**Query params:** `tenant_id`, `branch_id` (optional)

**Success Response `200`:**
```json
{
  "today": { "revenue": 840.0, "orders": 46, "avgOrderValue": 18.26 },
  "thisWeek": { "revenue": 5200.0, "orders": 286, "avgOrderValue": 18.18 },
  "thisMonth": { "revenue": 11250.0, "orders": 620, "avgOrderValue": 18.15 },
  "topItemToday": { "itemId": "i1", "name": "Wagyu Burger", "orders": 12 }
}
```

**Source:** `src/services/analytics.service.ts` → `getAnalyticsSummary()`
**Type:** `AnalyticsSummary` in `src/types/analytics.ts`

---

### 14.4 Branch Analytics

**Method:** `GET`
**Path:** `/branches/{id}/analytics/`
**Authentication:** Admin
**Query params:** `period`

**Success Response `200`:** Same shape as `MenuAnalytics` scoped to the given branch.

**Source:** `src/services/branch-analytics.service.ts`

---

## 15. Bulk Operation Endpoints

> Added in P7.14. All bulk endpoints require the corresponding `*.manage` permission.

### 15.1 Bulk Update Order Status

**Method:** `POST`
**Path:** `/admin/orders/bulk-status/`
**Authentication:** Admin (`orders.manage`)

**Request Body:**
```json
{ "ids": ["o1", "o2", "o3"], "status": "accepted" }
```

**Success Response `200`:**
```json
{ "updated": 3, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkUpdateOrderStatus()`

---

### 15.2 Bulk Cancel Orders

**Method:** `POST`
**Path:** `/admin/orders/bulk-cancel/`
**Authentication:** Admin (`orders.manage`)

**Request Body:**
```json
{ "ids": ["o1", "o2"] }
```

**Success Response `200`:**
```json
{ "cancelled": 2, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkCancelOrders()`

---

### 15.3 Bulk Confirm Reservations

**Method:** `POST`
**Path:** `/admin/reservations/bulk-confirm/`
**Authentication:** Admin (`reservations.manage`)

**Request Body:**
```json
{ "ids": ["r1", "r2"] }
```

**Success Response `200`:**
```json
{ "confirmed": 2, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkConfirmReservations()`

---

### 15.4 Bulk Cancel Reservations

**Method:** `POST`
**Path:** `/admin/reservations/bulk-cancel/`
**Authentication:** Admin (`reservations.manage`)

**Request Body:**
```json
{ "ids": ["r1", "r2"] }
```

**Success Response `200`:**
```json
{ "cancelled": 2, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkCancelReservations()`

---

### 15.5 Bulk Export Customers

**Method:** `POST`
**Path:** `/admin/customers/bulk-export/`
**Authentication:** Admin (`customers.export`)

**Request Body:**
```json
{ "ids": ["c1", "c2"] }
```

**Success Response `200`:** CSV file download (`Content-Type: text/csv`)

> **Note:** Frontend currently performs client-side CSV export. This endpoint enables server-side export for large datasets.

**Source:** `src/hooks/index.ts` → `useBulkExportCustomers()`

---

## 16. Staff Management Endpoints

> Added in P7.2. Requires `staff.view` / `staff.manage` permissions.

### 16.1 List Staff

**Method:** `GET`
**Path:** `/admin/staff/`
**Query params:** `branch_id`, `role`, `search`, `page`

**Success Response `200`:** Paginated list of `StaffMember` objects.

**Type:** `StaffMember` in `src/types/staff.ts`
**Source:** `src/services/staff.service.ts`

### 16.2 Staff Detail

**Method:** `GET` / `PATCH`
**Path:** `/admin/staff/{id}/`

### 16.3 Staff Shifts

**Method:** `GET`
**Path:** `/admin/staff/{id}/shifts/`

---

## 17. Audit Log Endpoints

> Added in P7.5. Requires `audit_logs.view` permission.

### 17.1 List Audit Logs

**Method:** `GET`
**Path:** `/admin/audit-logs/`
**Query params:** `entity_type`, `entity_id`, `actor_id`, `action`, `from_date`, `to_date`, `page`

**Success Response `200`:** Paginated list of `AuditLog` objects.

**Type:** `AuditLog` in `src/types/audit-log.ts`
**Source:** `src/services/audit-log.service.ts`

### 17.2 Audit Log Detail

**Method:** `GET`
**Path:** `/admin/audit-logs/{id}/`

---

## 18. Kitchen Display Endpoints

> Added in P7.13. Used by `KitchenDisplay` component and `useKitchenStatus` hook.

### 18.1 Kitchen Status

**Method:** `GET`
**Path:** `/admin/kitchen/status/`
**Authentication:** Admin (`kitchen.view`)
**Query params:** `branch_id` (required), `tenant_id`

**Success Response `200`:**
```json
{
  "pendingOrders": [],
  "preparingOrders": [],
  "readyOrders": [],
  "delayedOrders": [],
  "priorityOrders": [],
  "averagePrepMinutes": 12,
  "queueDepth": 8,
  "capacityPercent": 67
}
```

**Type:** `KitchenStatus` in `src/types/realtime-operations.ts`
**Source:** `src/services/realtime-operations.service.ts` → `getKitchenStatus()`

**WebSocket alternative:** `ws/kitchen/{branchId}/` — pushes `KitchenStatus` updates in real time.

---

## 19. Loyalty & Promotion Endpoints

> Added in P6. Requires `loyalty.view` / `promotions.view` permissions for admin endpoints.

### 19.1 Customer Loyalty Points

**Method:** `GET`
**Path:** `/loyalty/points/`
**Authentication:** Authenticated customer

### 19.2 Redeem Points

**Method:** `POST`
**Path:** `/loyalty/redeem/`

### 19.3 Admin — List Promotions

**Method:** `GET`
**Path:** `/admin/promotions/`
**Query params:** `active`, `branch_id`, `page`

**Type:** `Promotion` in `src/types/index.ts`
**Source:** `src/services/promotion.service.ts`

### 19.4 Admin — Create / Update Promotion

**Method:** `POST` / `PATCH`
**Path:** `/admin/promotions/` / `/admin/promotions/{id}/`

---

## 20. Vendor Endpoints

> Added in P6. Used by food court tenant module.

### 20.1 List Vendors (Admin)

**Method:** `GET`
**Path:** `/admin/vendors/`
**Query params:** `branch_id`, `active`, `page`

**Type:** `Vendor` in `src/types/index.ts`
**Source:** `src/services/vendor.service.ts`

### 20.2 Vendor Detail

**Method:** `GET` / `PATCH`
**Path:** `/admin/vendors/{id}/`

---

## 21. Feature Flag Endpoints

> Added in P1B. Requires `settings.manage` permission.

### 21.1 List Feature Flags

**Method:** `GET`
**Path:** `/admin/settings/feature-flags/`
**Query params:** `tenant_id`, `branch_id`

**Success Response `200`:**
```json
{
  "results": [{ "key": "online_ordering", "enabled": true, "tenantId": "t1", "branchId": null }]
}
```

**Source:** `src/services/feature-flags.service.ts`

### 21.2 Toggle Feature Flag

**Method:** `PATCH`
**Path:** `/admin/settings/feature-flags/{key}/`

**Request Body:**
```json
{ "enabled": false }
```

---

